#!/usr/bin/env python3
"""
Clear all data from the database (keep schema intact)
"""
import psycopg2
from app.config import get_settings

s = get_settings()

def clear_database():
    """Delete all data from all tables in the sequoia schema"""
    conn = psycopg2.connect(
        host=s.DB_HOST,
        port=s.DB_PORT,
        database=s.DB_NAME,
        user=s.DB_USER,
        password=s.DB_PASSWORD
    )

    try:
        with conn.cursor() as cur:
            # Disable triggers temporarily to avoid FK issues
            cur.execute("SET session_replication_role = 'replica';")

            # Delete from all tables in sequoia schema
            tables = [
                'sequoia.voyage_media',
                'sequoia.voyage_passengers',
                'sequoia.media',
                'sequoia.people',
                'sequoia.voyages',
                'sequoia.presidents',
            ]

            for table in tables:
                print(f"Clearing {table}...")
                cur.execute(f"DELETE FROM {table}")
                count = cur.rowcount
                print(f"  Deleted {count} rows")

            # Re-enable triggers
            cur.execute("SET session_replication_role = 'origin';")

            conn.commit()
            print("\n✓ Database cleared successfully!")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    clear_database()
