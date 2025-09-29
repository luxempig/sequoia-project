-- Migration to add async media processing support
-- Run this to add thumbnail/derivative processing status tracking

-- Add processing status columns to the media table
ALTER TABLE media ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE media ADD COLUMN IF NOT EXISTS processing_task_id VARCHAR(100);
ALTER TABLE media ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;
ALTER TABLE media ADD COLUMN IF NOT EXISTS preview_url TEXT;  -- For larger preview images
ALTER TABLE media ADD COLUMN IF NOT EXISTS waveform_url TEXT; -- For audio waveforms

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_media_processing_status ON media(processing_status);
CREATE INDEX IF NOT EXISTS idx_media_task_id ON media(processing_task_id);
CREATE INDEX IF NOT EXISTS idx_media_voyage_status ON media(voyage_slug, processing_status);

-- Create a table to track async task batches
CREATE TABLE IF NOT EXISTS async_task_batches (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(100) UNIQUE NOT NULL,
    voyage_slug VARCHAR(100) NOT NULL,
    total_media_items INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    batch_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_batches_voyage ON async_task_batches(voyage_slug);
CREATE INDEX IF NOT EXISTS idx_task_batches_status ON async_task_batches(batch_status);

-- Create a table to track individual task results
CREATE TABLE IF NOT EXISTS async_task_results (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(100) UNIQUE NOT NULL,
    batch_id VARCHAR(100),
    media_slug VARCHAR(100) NOT NULL,
    voyage_slug VARCHAR(100) NOT NULL,
    task_name VARCHAR(100) NOT NULL,
    task_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, success, failed
    result_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES async_task_batches(batch_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_results_task_id ON async_task_results(task_id);
CREATE INDEX IF NOT EXISTS idx_task_results_batch ON async_task_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_task_results_media ON async_task_results(media_slug, voyage_slug);
CREATE INDEX IF NOT EXISTS idx_task_results_status ON async_task_results(task_status);

-- Add comments for documentation
COMMENT ON COLUMN media.processing_status IS 'Status of thumbnail/derivative generation: pending, processing, completed, failed, skipped';
COMMENT ON COLUMN media.processing_task_id IS 'Celery task ID for async processing';
COMMENT ON COLUMN media.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN media.processed_at IS 'Timestamp when processing completed';
COMMENT ON COLUMN media.preview_url IS 'URL to larger preview image (for images)';
COMMENT ON COLUMN media.waveform_url IS 'URL to waveform visualization (for audio files)';

COMMENT ON TABLE async_task_batches IS 'Tracks batches of async media processing tasks';
COMMENT ON TABLE async_task_results IS 'Tracks individual async task results and status';

-- Create a view for easy media processing status queries
CREATE OR REPLACE VIEW media_processing_summary AS
SELECT
    m.voyage_slug,
    COUNT(*) as total_media,
    COUNT(CASE WHEN m.processing_status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN m.processing_status = 'processing' THEN 1 END) as processing_count,
    COUNT(CASE WHEN m.processing_status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN m.processing_status = 'failed' THEN 1 END) as failed_count,
    COUNT(CASE WHEN m.processing_status = 'skipped' THEN 1 END) as skipped_count,
    ROUND(
        (COUNT(CASE WHEN m.processing_status IN ('completed', 'skipped') THEN 1 END) * 100.0) / COUNT(*),
        2
    ) as completion_percentage,
    MIN(m.processed_at) as first_processed_at,
    MAX(m.processed_at) as last_processed_at
FROM media m
GROUP BY m.voyage_slug;

COMMENT ON VIEW media_processing_summary IS 'Summary view of media processing status by voyage';

-- Update any existing media records to have default processing status
UPDATE media SET processing_status = 'completed'
WHERE processing_status IS NULL
AND (thumbnail_s3_url IS NOT NULL OR public_derivative_url IS NOT NULL);

UPDATE media SET processing_status = 'pending'
WHERE processing_status IS NULL;

-- Create a function to update batch progress
CREATE OR REPLACE FUNCTION update_batch_progress(batch_id_param VARCHAR(100))
RETURNS VOID AS $$
DECLARE
    completed_count INTEGER;
    failed_count INTEGER;
    total_count INTEGER;
    new_status VARCHAR(20);
BEGIN
    -- Count completed and failed tasks in this batch
    SELECT
        COUNT(CASE WHEN task_status = 'success' THEN 1 END),
        COUNT(CASE WHEN task_status = 'failed' THEN 1 END),
        COUNT(*)
    INTO completed_count, failed_count, total_count
    FROM async_task_results
    WHERE batch_id = batch_id_param;

    -- Determine new batch status
    IF (completed_count + failed_count) = total_count AND total_count > 0 THEN
        new_status = 'completed';
    ELSIF failed_count > 0 OR completed_count > 0 THEN
        new_status = 'processing';
    ELSE
        new_status = 'pending';
    END IF;

    -- Update the batch record
    UPDATE async_task_batches
    SET
        completed_items = completed_count,
        failed_items = failed_count,
        batch_status = new_status,
        updated_at = NOW(),
        completed_at = CASE WHEN new_status = 'completed' THEN NOW() ELSE completed_at END
    WHERE batch_id = batch_id_param;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_batch_progress IS 'Updates batch progress based on individual task statuses';