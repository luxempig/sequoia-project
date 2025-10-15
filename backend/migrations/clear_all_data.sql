-- Migration: Clear all data from USS Sequoia database
-- Date: 2025-10-14
-- Description: Truncates all tables while preserving schema and structure
-- WARNING: This will DELETE ALL DATA from the database!

-- Disable foreign key checks temporarily (PostgreSQL way)
SET session_replication_role = 'replica';

-- Truncate join tables first (they reference other tables)
TRUNCATE TABLE sequoia.voyage_passengers CASCADE;
TRUNCATE TABLE sequoia.voyage_media CASCADE;

-- Truncate main tables
TRUNCATE TABLE sequoia.voyages CASCADE;
TRUNCATE TABLE sequoia.people CASCADE;
TRUNCATE TABLE sequoia.media CASCADE;
TRUNCATE TABLE sequoia.presidents CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify tables are empty (optional - for confirmation)
-- Uncomment to see row counts after truncation
-- SELECT 'voyages' as table_name, COUNT(*) as rows FROM sequoia.voyages
-- UNION ALL
-- SELECT 'people', COUNT(*) FROM sequoia.people
-- UNION ALL
-- SELECT 'media', COUNT(*) FROM sequoia.media
-- UNION ALL
-- SELECT 'presidents', COUNT(*) FROM sequoia.presidents
-- UNION ALL
-- SELECT 'voyage_passengers', COUNT(*) FROM sequoia.voyage_passengers
-- UNION ALL
-- SELECT 'voyage_media', COUNT(*) FROM sequoia.voyage_media;
