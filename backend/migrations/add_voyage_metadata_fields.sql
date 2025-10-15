-- Migration: Add voyage metadata fields for categorization and filtering
-- Date: 2025-10-14
-- Description: Adds boolean flags and associated text fields for voyage categorization

-- Add boolean flags
ALTER TABLE sequoia.voyages
  ADD COLUMN IF NOT EXISTS has_photo BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS presidential_use BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_royalty BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_foreign_leader BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_camp_david BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_mount_vernon BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_captain BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_crew BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_rmd BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_yacht_spin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_menu BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mention_drinks_wine BOOLEAN DEFAULT FALSE;

-- Add associated text fields for those that need additional information
ALTER TABLE sequoia.voyages
  ADD COLUMN IF NOT EXISTS presidential_initials TEXT,           -- President initials when presidential_use = true
  ADD COLUMN IF NOT EXISTS royalty_details TEXT,                 -- Royalty names/details when has_royalty = true
  ADD COLUMN IF NOT EXISTS foreign_leader_country TEXT;          -- Country of foreign leader when has_foreign_leader = true

-- Add comments for documentation
COMMENT ON COLUMN sequoia.voyages.has_photo IS 'Indicates if voyage has associated photo(s)';
COMMENT ON COLUMN sequoia.voyages.has_video IS 'Indicates if voyage has associated video(s)';
COMMENT ON COLUMN sequoia.voyages.presidential_use IS 'Indicates if president was present/used the yacht';
COMMENT ON COLUMN sequoia.voyages.presidential_initials IS 'President initials (e.g., HST, FDR) when presidential_use = true';
COMMENT ON COLUMN sequoia.voyages.has_royalty IS 'Indicates if royalty was present on voyage';
COMMENT ON COLUMN sequoia.voyages.royalty_details IS 'Names/details of royalty when has_royalty = true';
COMMENT ON COLUMN sequoia.voyages.has_foreign_leader IS 'Indicates if foreign leader was present';
COMMENT ON COLUMN sequoia.voyages.foreign_leader_country IS 'Country of foreign leader when has_foreign_leader = true';
COMMENT ON COLUMN sequoia.voyages.mention_camp_david IS 'Voyage mentions Camp David (CD)';
COMMENT ON COLUMN sequoia.voyages.mention_mount_vernon IS 'Voyage mentions Mount Vernon (MV)';
COMMENT ON COLUMN sequoia.voyages.mention_captain IS 'Voyage mentions captain';
COMMENT ON COLUMN sequoia.voyages.mention_crew IS 'Voyage mentions crew member(s)';
COMMENT ON COLUMN sequoia.voyages.mention_rmd IS 'Voyage mentions Restoration, Maintenance, and/or Damage';
COMMENT ON COLUMN sequoia.voyages.mention_yacht_spin IS 'Voyage mentions Maintenance, Cost, Buy/Sell, and/or yacht spin';
COMMENT ON COLUMN sequoia.voyages.mention_menu IS 'Voyage mentions menu';
COMMENT ON COLUMN sequoia.voyages.mention_drinks_wine IS 'Voyage mentions drinks or wine';

-- Create indexes for commonly filtered boolean fields
CREATE INDEX IF NOT EXISTS idx_voyages_presidential_use ON sequoia.voyages(presidential_use) WHERE presidential_use = true;
CREATE INDEX IF NOT EXISTS idx_voyages_has_royalty ON sequoia.voyages(has_royalty) WHERE has_royalty = true;
CREATE INDEX IF NOT EXISTS idx_voyages_has_foreign_leader ON sequoia.voyages(has_foreign_leader) WHERE has_foreign_leader = true;
CREATE INDEX IF NOT EXISTS idx_voyages_has_photo ON sequoia.voyages(has_photo) WHERE has_photo = true;
CREATE INDEX IF NOT EXISTS idx_voyages_has_video ON sequoia.voyages(has_video) WHERE has_video = true;

-- Example usage comments
-- UPDATE sequoia.voyages SET presidential_use = true, presidential_initials = 'HST' WHERE voyage_slug = 'truman-harry-1945-05-14';
-- UPDATE sequoia.voyages SET has_royalty = true, royalty_details = 'Queen Elizabeth II' WHERE voyage_slug = 'example-voyage';
-- UPDATE sequoia.voyages SET has_foreign_leader = true, foreign_leader_country = 'United Kingdom' WHERE voyage_slug = 'example-voyage';
