#!/usr/bin/env python3
"""
Clear all media data from the database.
This removes all media records and voyage_media associations, but PRESERVES S3 files.
"""

import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from db import db_cursor

def clear_media_database():
    """Clear all media data from the database"""

    with db_cursor() as cur:
        # Get counts before deletion
        cur.execute("SELECT COUNT(*) as count FROM sequoia.media")
        media_count = cur.fetchone()['count']

        cur.execute("SELECT COUNT(*) as count FROM sequoia.voyage_media")
        associations_count = cur.fetchone()['count']

        print(f"Found {media_count} media records and {associations_count} voyage associations")

        # Delete voyage_media associations first (foreign key constraint)
        print("Deleting voyage_media associations...")
        cur.execute("DELETE FROM sequoia.voyage_media")
        print(f"✓ Deleted {associations_count} voyage-media associations")

        # Delete all media records
        print("Deleting all media records...")
        cur.execute("DELETE FROM sequoia.media")
        print(f"✓ Deleted {media_count} media records")

        # Reset has_photos and has_videos flags for all voyages (if columns exist)
        print("Checking for voyage media flags...")
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'sequoia'
            AND table_name = 'voyages'
            AND column_name IN ('has_photos', 'has_videos')
        """)
        existing_columns = [row['column_name'] for row in cur.fetchall()]

        if existing_columns:
            print(f"Resetting voyage media flags ({', '.join(existing_columns)})...")
            cur.execute("""
                UPDATE sequoia.voyages
                SET has_photos = FALSE, has_videos = FALSE
            """)
            print(f"✓ Reset media flags for all voyages")
        else:
            print("ℹ️  Voyage media flag columns don't exist yet (has_photos, has_videos)")

        print("\n✅ Database cleared successfully!")
        print("Note: S3 files have been preserved and can be re-imported")

if __name__ == "__main__":
    confirm = input("⚠️  This will DELETE ALL media records from the database. S3 files will be preserved.\nType 'DELETE ALL MEDIA' to confirm: ")

    if confirm == "DELETE ALL MEDIA":
        clear_media_database()
    else:
        print("❌ Cancelled - confirmation text did not match")
