#!/usr/bin/env python3
"""
Clear all media-related data from the database
"""
import psycopg2
from app.config import get_settings

s = get_settings()

def clear_media_data():
    """Clear all media records and voyage-media associations"""
    conn = psycopg2.connect(
        host=s.DB_HOST,
        port=s.DB_PORT,
        database=s.DB_NAME,
        user=s.DB_USER,
        password=s.DB_PASSWORD
    )

    try:
        with conn.cursor() as cur:
            print("=== Clearing media data ===\n")

            # Step 1: Clear voyage_media junction table
            print("1. Clearing voyage-media associations...")
            cur.execute("DELETE FROM sequoia.voyage_media")
            voyage_media_count = cur.rowcount
            print(f"   Deleted {voyage_media_count} voyage-media links\n")

            # Step 2: Clear media table
            print("2. Clearing media records...")
            cur.execute("DELETE FROM sequoia.media")
            media_count = cur.rowcount
            print(f"   Deleted {media_count} media records\n")

            # Step 3: Show summary
            print("=== Summary ===")
            print(f"Voyage-media links deleted: {voyage_media_count}")
            print(f"Media records deleted: {media_count}")

            conn.commit()
            print("\n✓ Media data cleared successfully!")
            print("\nNote: S3 files remain unchanged. To delete S3 files, use the S3 console or AWS CLI.")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    clear_media_data()
