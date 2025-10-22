#!/usr/bin/env python3
"""
Deduplicate passengers in the database based on identical full_name and role_title.
Merges all voyage associations to the oldest person record and deletes duplicates.
"""
from app.db import db_cursor
import logging

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)


def deduplicate_passengers():
    """Find and merge duplicate passengers"""

    with db_cursor() as cur:
        # Find duplicate groups (same name and title)
        cur.execute("""
            SELECT
                full_name,
                COALESCE(role_title, '') as role_title,
                ARRAY_AGG(person_slug ORDER BY created_at) as person_slugs,
                COUNT(*) as count
            FROM sequoia.people
            GROUP BY full_name, COALESCE(role_title, '')
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        """)

        duplicate_groups = cur.fetchall()

        if not duplicate_groups:
            LOG.info("No duplicates found!")
            return

        LOG.info(f"Found {len(duplicate_groups)} duplicate groups")

        total_merged = 0

        for group in duplicate_groups:
            full_name = group['full_name']
            role_title = group['role_title'] or '(no title)'
            person_slugs = group['person_slugs']
            count = group['count']

            # Keep the first (oldest) record
            keep_slug = person_slugs[0]
            duplicate_slugs = person_slugs[1:]

            LOG.info(f"\n{'='*60}")
            LOG.info(f"Merging: {full_name} - {role_title}")
            LOG.info(f"  Keeping: {keep_slug}")
            LOG.info(f"  Removing: {', '.join(duplicate_slugs)}")

            # Update all voyage_passengers references to point to the kept record
            for dup_slug in duplicate_slugs:
                # Check for voyages this duplicate is in
                cur.execute("""
                    SELECT voyage_slug, capacity_role, notes, is_crew
                    FROM sequoia.voyage_passengers
                    WHERE person_slug = %s
                """, (dup_slug,))

                voyages = cur.fetchall()

                for voyage in voyages:
                    voyage_slug = voyage['voyage_slug']

                    # Check if the kept person is already in this voyage
                    cur.execute("""
                        SELECT 1 FROM sequoia.voyage_passengers
                        WHERE voyage_slug = %s AND person_slug = %s
                    """, (voyage_slug, keep_slug))

                    if cur.fetchone():
                        # Already exists, just delete the duplicate entry
                        LOG.info(f"    Voyage {voyage_slug}: already has {keep_slug}, removing duplicate")
                        cur.execute("""
                            DELETE FROM sequoia.voyage_passengers
                            WHERE voyage_slug = %s AND person_slug = %s
                        """, (voyage_slug, dup_slug))
                    else:
                        # Update to point to kept person
                        LOG.info(f"    Voyage {voyage_slug}: updating to {keep_slug}")
                        cur.execute("""
                            UPDATE sequoia.voyage_passengers
                            SET person_slug = %s
                            WHERE voyage_slug = %s AND person_slug = %s
                        """, (keep_slug, voyage_slug, dup_slug))

                # Delete the duplicate person record
                cur.execute("DELETE FROM sequoia.people WHERE person_slug = %s", (dup_slug,))
                LOG.info(f"  Deleted duplicate person: {dup_slug}")

            total_merged += len(duplicate_slugs)

        LOG.info(f"\n{'='*60}")
        LOG.info(f"✓ Deduplication complete!")
        LOG.info(f"  Merged {total_merged} duplicate records")
        LOG.info(f"  From {len(duplicate_groups)} duplicate groups")


if __name__ == "__main__":
    LOG.info("Starting passenger deduplication...")
    deduplicate_passengers()
    LOG.info("Done!")
