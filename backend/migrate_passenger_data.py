#!/usr/bin/env python3
"""
Migrate passenger data to new structure:
- Clear capacity_role values (now unused)
- Set is_crew based on role_title in people table
"""
import psycopg2
from app.config import get_settings

s = get_settings()

def migrate_passenger_data():
    """Migrate passenger data to match new structure"""
    conn = psycopg2.connect(
        host=s.DB_HOST,
        port=s.DB_PORT,
        database=s.DB_NAME,
        user=s.DB_USER,
        password=s.DB_PASSWORD
    )

    try:
        with conn.cursor() as cur:
            print("=== Migrating passenger data ===\n")

            # Step 1: Clear all capacity_role values (no longer used)
            print("1. Clearing capacity_role values...")
            cur.execute("UPDATE sequoia.voyage_passengers SET capacity_role = NULL")
            print(f"   Cleared {cur.rowcount} capacity_role values\n")

            # Step 2: Set is_crew based on role_title
            print("2. Setting is_crew flags based on role_title...")

            # Mark people with crew-related titles as crew
            cur.execute("""
                UPDATE sequoia.voyage_passengers vp
                SET is_crew = TRUE
                FROM sequoia.people p
                WHERE vp.person_slug = p.person_slug
                AND (
                    LOWER(p.role_title) LIKE '%captain%'
                    OR LOWER(p.role_title) LIKE '%steward%'
                    OR LOWER(p.role_title) LIKE '%officer%'
                    OR LOWER(p.role_title) LIKE '%crew%'
                    OR LOWER(p.role_title) LIKE '%engineer%'
                    OR LOWER(p.role_title) LIKE '%sailor%'
                    OR LOWER(p.role_title) LIKE '%mate%'
                    OR LOWER(p.role_title) LIKE '%boatswain%'
                    OR LOWER(p.role_title) LIKE '%cook%'
                )
            """)
            crew_count = cur.rowcount
            print(f"   Marked {crew_count} voyage associations as crew\n")

            # Step 3: Show summary
            print("=== Summary ===")
            cur.execute("SELECT COUNT(*) as count FROM sequoia.voyage_passengers WHERE is_crew = TRUE")
            crew_total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) as count FROM sequoia.voyage_passengers WHERE is_crew = FALSE")
            passenger_total = cur.fetchone()[0]

            print(f"Crew associations: {crew_total}")
            print(f"Passenger associations: {passenger_total}")
            print(f"Total: {crew_total + passenger_total}")

            conn.commit()
            print("\n✓ Migration completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_passenger_data()
