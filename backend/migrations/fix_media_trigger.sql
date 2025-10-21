-- Migration: Fix broken trigger on media table
-- Date: 2025-10-21
-- Description: Remove trigger from media table that references non-existent voyage_slug field
-- The trigger should be on voyage_media table, not media table

-- Drop the broken trigger from media table
DROP TRIGGER IF EXISTS update_voyage_media_flags_trigger ON sequoia.media;

-- Drop the function if it exists (we'll recreate it properly)
DROP FUNCTION IF EXISTS sequoia.update_voyage_media_flags();

-- Create the function to update has_photo and has_video flags
CREATE OR REPLACE FUNCTION sequoia.update_voyage_media_flags()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all affected voyages (could be NEW.voyage_slug or OLD.voyage_slug depending on operation)
    UPDATE sequoia.voyages v
    SET
        has_photo = EXISTS (
            SELECT 1 FROM sequoia.voyage_media vm
            JOIN sequoia.media m ON vm.media_slug = m.media_slug
            WHERE vm.voyage_slug = v.voyage_slug
            AND m.media_type = 'image'
        ),
        has_video = EXISTS (
            SELECT 1 FROM sequoia.voyage_media vm
            JOIN sequoia.media m ON vm.media_slug = m.media_slug
            WHERE vm.voyage_slug = v.voyage_slug
            AND m.media_type = 'video'
        )
    WHERE v.voyage_slug IN (
        SELECT DISTINCT voyage_slug
        FROM (
            SELECT NEW.voyage_slug AS voyage_slug
            UNION ALL
            SELECT OLD.voyage_slug AS voyage_slug
        ) AS affected_voyages
        WHERE voyage_slug IS NOT NULL
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers on voyage_media table (where voyage_slug actually exists)
CREATE TRIGGER update_voyage_media_flags_on_insert
    AFTER INSERT ON sequoia.voyage_media
    FOR EACH ROW
    EXECUTE FUNCTION sequoia.update_voyage_media_flags();

CREATE TRIGGER update_voyage_media_flags_on_update
    AFTER UPDATE ON sequoia.voyage_media
    FOR EACH ROW
    EXECUTE FUNCTION sequoia.update_voyage_media_flags();

CREATE TRIGGER update_voyage_media_flags_on_delete
    AFTER DELETE ON sequoia.voyage_media
    FOR EACH ROW
    EXECUTE FUNCTION sequoia.update_voyage_media_flags();

-- Also create a trigger on media table for when media_type changes
-- This trigger updates all voyages that use this media
CREATE OR REPLACE FUNCTION sequoia.update_voyage_flags_on_media_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all voyages that use this media
    UPDATE sequoia.voyages v
    SET
        has_photo = EXISTS (
            SELECT 1 FROM sequoia.voyage_media vm
            JOIN sequoia.media m ON vm.media_slug = m.media_slug
            WHERE vm.voyage_slug = v.voyage_slug
            AND m.media_type = 'image'
        ),
        has_video = EXISTS (
            SELECT 1 FROM sequoia.voyage_media vm
            JOIN sequoia.media m ON vm.media_slug = m.media_slug
            WHERE vm.voyage_slug = v.voyage_slug
            AND m.media_type = 'video'
        )
    WHERE v.voyage_slug IN (
        SELECT voyage_slug FROM sequoia.voyage_media
        WHERE media_slug = COALESCE(NEW.media_slug, OLD.media_slug)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_voyage_flags_on_media_update
    AFTER UPDATE OF media_type ON sequoia.media
    FOR EACH ROW
    EXECUTE FUNCTION sequoia.update_voyage_flags_on_media_change();
