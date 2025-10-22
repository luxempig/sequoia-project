#!/usr/bin/env python3
"""
Clear all media-related data from the database.
This will:
1. Delete all voyage_media links
2. Delete all media records
Does NOT delete files from S3.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "sequoia"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )

def clear_media_data():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # First, count what we have
        cur.execute("SELECT COUNT(*) as count FROM sequoia.voyage_media")
        voyage_media_count = cur.fetchone()['count']

        cur.execute("SELECT COUNT(*) as count FROM sequoia.media")
        media_count = cur.fetchone()['count']

        print(f"Found {voyage_media_count} voyage-media links")
        print(f"Found {media_count} media records")
        print()

        # Delete voyage_media links first (foreign key constraint)
        print("Deleting voyage-media links...")
        cur.execute("DELETE FROM sequoia.voyage_media")
        conn.commit()
        print(f"✓ Deleted {voyage_media_count} voyage-media links")

        # Delete media records
        print("Deleting media records...")
        cur.execute("DELETE FROM sequoia.media")
        conn.commit()
        print(f"✓ Deleted {media_count} media records")

        print()
        print("✓ All media data cleared successfully!")
        print("Note: S3 files were NOT deleted")

    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    clear_media_data()
