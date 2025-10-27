-- Create a trigger to automatically sync presidents/owners to the people table
-- This ensures presidents are also searchable/linkable as people with appropriate titles

-- Function to sync president to people table
CREATE OR REPLACE FUNCTION sequoia.sync_president_to_people()
RETURNS TRIGGER AS $$
BEGIN
    -- Determine role_title based on party field
    -- If party is 'Private Owner', use 'Sequoia Private Owner'
    -- Otherwise, use 'President of the United States'
    INSERT INTO sequoia.people (
        person_slug,
        full_name,
        role_title,
        wikipedia_url,
        created_at,
        updated_at
    ) VALUES (
        NEW.president_slug,
        NEW.full_name,
        CASE
            WHEN NEW.party = 'Private Owner' THEN 'Sequoia Private Owner'
            WHEN NEW.party = 'U.S. Navy' THEN 'Secretary of the Navy'
            ELSE 'President of the United States'
        END,
        NEW.wikipedia_url,
        NOW(),
        NOW()
    )
    ON CONFLICT (person_slug) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role_title = EXCLUDED.role_title,
        wikipedia_url = EXCLUDED.wikipedia_url,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after insert or update on presidents table
DROP TRIGGER IF EXISTS sync_president_to_people_trigger ON sequoia.presidents;
CREATE TRIGGER sync_president_to_people_trigger
    AFTER INSERT OR UPDATE ON sequoia.presidents
    FOR EACH ROW
    EXECUTE FUNCTION sequoia.sync_president_to_people();

COMMENT ON FUNCTION sequoia.sync_president_to_people() IS 'Automatically syncs president/owner records to the people table with appropriate role titles';
