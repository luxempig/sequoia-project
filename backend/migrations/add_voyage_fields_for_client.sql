-- Migration: Add new voyage fields per client requirements
-- Date: 2025-10-14
-- Description: Adds start_location, end_location, start_timestamp, end_timestamp,
--              additional_information, and additional_sources fields to voyages table

-- Add new columns to voyages table
ALTER TABLE sequoia.voyages
  ADD COLUMN IF NOT EXISTS start_location TEXT,
  ADD COLUMN IF NOT EXISTS end_location TEXT,
  ADD COLUMN IF NOT EXISTS start_timestamp TIMESTAMP,
  ADD COLUMN IF NOT EXISTS end_timestamp TIMESTAMP,
  ADD COLUMN IF NOT EXISTS additional_information TEXT,
  ADD COLUMN IF NOT EXISTS additional_sources TEXT;

-- Migrate existing origin/destination to start_location/end_location
UPDATE sequoia.voyages
  SET start_location = origin
  WHERE start_location IS NULL AND origin IS NOT NULL;

UPDATE sequoia.voyages
  SET end_location = destination
  WHERE end_location IS NULL AND destination IS NOT NULL;

-- Build timestamps from existing date + time fields if they exist
-- Handle cases where we have both date and time
UPDATE sequoia.voyages
  SET start_timestamp = (start_date || ' ' || COALESCE(start_time, '00:00:00'))::TIMESTAMP
  WHERE start_timestamp IS NULL
    AND start_date IS NOT NULL
    AND start_date != '';

UPDATE sequoia.voyages
  SET end_timestamp = (end_date || ' ' || COALESCE(end_time, '23:59:59'))::TIMESTAMP
  WHERE end_timestamp IS NULL
    AND end_date IS NOT NULL
    AND end_date != '';

-- Create indexes for the new fields to improve query performance
CREATE INDEX IF NOT EXISTS idx_voyages_start_location ON sequoia.voyages(start_location);
CREATE INDEX IF NOT EXISTS idx_voyages_end_location ON sequoia.voyages(end_location);
CREATE INDEX IF NOT EXISTS idx_voyages_start_timestamp ON sequoia.voyages(start_timestamp);
CREATE INDEX IF NOT EXISTS idx_voyages_end_timestamp ON sequoia.voyages(end_timestamp);

-- Add a column for notes if it doesn't exist (keeping existing notes_internal)
-- notes_internal will be used for internal curator notes
-- We'll use summary_markdown for "additional_information"
COMMENT ON COLUMN sequoia.voyages.summary_markdown IS 'Additional information about the voyage (public-facing)';
COMMENT ON COLUMN sequoia.voyages.notes_internal IS 'Internal notes for curators (not shown to public)';
COMMENT ON COLUMN sequoia.voyages.additional_sources IS 'Additional source references beyond primary media sources';
COMMENT ON COLUMN sequoia.voyages.start_timestamp IS 'Combined start date and time';
COMMENT ON COLUMN sequoia.voyages.end_timestamp IS 'Combined end date and time';
COMMENT ON COLUMN sequoia.voyages.start_location IS 'Starting location of voyage';
COMMENT ON COLUMN sequoia.voyages.end_location IS 'Ending location of voyage';
