import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    port=os.getenv('DB_PORT', '5432'),
    dbname=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    sslmode='require'
)
cur = conn.cursor()

print("Starting backfill of person_president_stats table...")
print("=" * 60)

# Get all person-president combinations with their voyage counts
cur.execute("""
    SELECT
        vp.person_slug,
        v.president_slug_from_voyage as president_slug,
        COUNT(*) as voyage_count
    FROM sequoia.voyage_passengers vp
    JOIN sequoia.voyages v ON v.voyage_slug = vp.voyage_slug
    WHERE v.president_slug_from_voyage IS NOT NULL
    GROUP BY vp.person_slug, v.president_slug_from_voyage
    ORDER BY vp.person_slug, voyage_count DESC
""")

rows = cur.fetchall()
print(f"Found {len(rows)} person-president combinations to backfill")
print()

if len(rows) == 0:
    print("No data to backfill. Exiting.")
    cur.close()
    conn.close()
    exit(0)

# Show sample data before inserting
print("Sample data (first 10 rows):")
print(f"{'Person Slug':<40} {'President Slug':<30} {'Voyage Count':<15}")
print("-" * 85)
for i, row in enumerate(rows[:10]):
    print(f"{row[0]:<40} {row[1]:<30} {row[2]:<15}")
print()

# Insert the data
print("Inserting data into person_president_stats...")
inserted_count = 0
updated_count = 0

for row in rows:
    person_slug, president_slug, voyage_count = row

    # Use INSERT ... ON CONFLICT to handle existing entries
    cur.execute("""
        INSERT INTO sequoia.person_president_stats (person_slug, president_slug, voyage_count)
        VALUES (%s, %s, %s)
        ON CONFLICT (person_slug, president_slug)
        DO UPDATE SET
            voyage_count = EXCLUDED.voyage_count,
            updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS inserted
    """, (person_slug, president_slug, voyage_count))

    result = cur.fetchone()
    if result and result[0]:
        inserted_count += 1
    else:
        updated_count += 1

conn.commit()
print(f"✓ Backfill complete!")
print(f"  - Inserted: {inserted_count} new records")
print(f"  - Updated: {updated_count} existing records")
print()

# Show statistics
cur.execute("""
    SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT person_slug) as unique_people,
        COUNT(DISTINCT president_slug) as unique_presidents,
        SUM(voyage_count) as total_voyage_links,
        MAX(voyage_count) as max_voyages_per_person_president
    FROM sequoia.person_president_stats
""")

stats = cur.fetchone()
print("=== Final Statistics ===")
print(f"Total records: {stats[0]}")
print(f"Unique people: {stats[1]}")
print(f"Unique presidents: {stats[2]}")
print(f"Total voyage links: {stats[3]}")
print(f"Max voyages for a person-president pair: {stats[4]}")
print()

# Show top person-president combinations
print("=== Top 10 Person-President Combinations ===")
cur.execute("""
    SELECT
        pps.person_slug,
        p.full_name,
        pps.president_slug,
        pps.voyage_count
    FROM sequoia.person_president_stats pps
    LEFT JOIN sequoia.people p ON p.person_slug = pps.person_slug
    ORDER BY pps.voyage_count DESC
    LIMIT 10
""")

print(f"{'Person':<40} {'President Slug':<30} {'Voyages':<10}")
print("-" * 80)
for row in cur.fetchall():
    person_name = row[1] if row[1] else row[0]
    print(f"{person_name:<40} {row[2]:<30} {row[3]:<10}")

cur.close()
conn.close()

print()
print("✓ All done!")
