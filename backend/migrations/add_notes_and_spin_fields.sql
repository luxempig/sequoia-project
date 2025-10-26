-- Migration: Add notes, spin, and spin_source fields to voyages table
-- Date: 2025-10-24

-- Add notes field (public notes)
ALTER TABLE sequoia.voyages
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add spin field (spin text to be displayed in italics with quotes)
ALTER TABLE sequoia.voyages
ADD COLUMN IF NOT EXISTS spin TEXT;

-- Add spin_source field (source for the spin)
ALTER TABLE sequoia.voyages
ADD COLUMN IF NOT EXISTS spin_source TEXT;

-- Add comments for documentation
COMMENT ON COLUMN sequoia.voyages.notes IS 'Public notes about the voyage';
COMMENT ON COLUMN sequoia.voyages.spin IS 'Spin text (displayed in italics with quotes)';
COMMENT ON COLUMN sequoia.voyages.spin_source IS 'Source attribution for the spin quote';
