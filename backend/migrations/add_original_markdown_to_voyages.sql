-- Add original_markdown field to voyages table to store the markdown used during ingestion
-- This helps curators see the original source when editing voyages

ALTER TABLE sequoia.voyages
ADD COLUMN IF NOT EXISTS original_markdown TEXT;

COMMENT ON COLUMN sequoia.voyages.original_markdown IS 'Original markdown text used to create this voyage during ingestion';
