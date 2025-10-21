-- Migration: Add media_category to voyage_media table
-- Date: 2025-10-21
-- Description: Allow media items to be categorized as sources or additional sources

-- Add media_category column with default 'general'
ALTER TABLE sequoia.voyage_media
  ADD COLUMN IF NOT EXISTS media_category VARCHAR(50) DEFAULT 'general' NOT NULL;

-- Add constraint to ensure valid values
ALTER TABLE sequoia.voyage_media
  DROP CONSTRAINT IF EXISTS voyage_media_category_check;

ALTER TABLE sequoia.voyage_media
  ADD CONSTRAINT voyage_media_category_check
  CHECK (media_category IN ('general', 'source', 'additional_source'));

-- Add index for better query performance when filtering by category
CREATE INDEX IF NOT EXISTS idx_voyage_media_category
  ON sequoia.voyage_media(voyage_slug, media_category);

-- Add comment
COMMENT ON COLUMN sequoia.voyage_media.media_category IS 'Category of media: general (default), source (primary source), or additional_source';
