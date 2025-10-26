#!/usr/bin/env python3
"""
Backfill sort_order for all existing voyage_passengers.
Sets sort_order based on current alphabetical ordering by full_name.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

def backfill_sort_orders():
    """Backfill sort_order for all voyage_passengers"""
    try:
        # Get connection params
        db_host = os.getenv('DB_HOST', '').strip('"')
        db_port = os.getenv('DB_PORT', '5432')
        db_name = os.getenv('DB_NAME', '').strip('"')
        db_user = os.getenv('DB_USER', '').strip('"')
        db_password = os.getenv('DB_PASSWORD', '').strip("'").strip('"')

        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_password
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Get all voyages
        cur.execute("SELECT DISTINCT voyage_slug FROM sequoia.voyage_passengers ORDER BY voyage_slug")
        voyages = cur.fetchall()

        print(f"Found {len(voyages)} voyages with passengers\n")

        total_updated = 0

        for voyage in voyages:
            voyage_slug = voyage['voyage_slug']

            # Get passengers for this voyage, ordered by current display order (full_name)
            cur.execute("""
                SELECT vp.person_slug, p.full_name, vp.sort_order
                FROM sequoia.voyage_passengers vp
                JOIN sequoia.people p ON p.person_slug = vp.person_slug
                WHERE vp.voyage_slug = %s
                ORDER BY vp.sort_order NULLS LAST, p.full_name
            """, (voyage_slug,))

            passengers = cur.fetchall()

            if not passengers:
                continue

            # Check if passengers need reordering (all have same sort_order or NULL)
            unique_orders = set(p['sort_order'] for p in passengers if p['sort_order'] is not None)
            needs_update = len(unique_orders) <= 1  # All same value or all NULL

            if needs_update:
                print(f"Updating {voyage_slug} ({len(passengers)} passengers)")

                # Update each passenger with their position in the list
                for idx, passenger in enumerate(passengers):
                    cur.execute("""
                        UPDATE sequoia.voyage_passengers
                        SET sort_order = %s
                        WHERE voyage_slug = %s AND person_slug = %s
                    """, (idx, voyage_slug, passenger['person_slug']))

                total_updated += len(passengers)

        conn.commit()

        print(f"\n✓ Backfilled sort_order for {total_updated} passenger records")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    backfill_sort_orders()
