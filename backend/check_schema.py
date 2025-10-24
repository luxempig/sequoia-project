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

# Get voyages table structure
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'sequoia' AND table_name = 'voyages'
    ORDER BY ordinal_position
""")
print('=== voyages table columns ===')
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

# Check for president/owner related columns
cur.execute("""
    SELECT DISTINCT president_slug_from_voyage
    FROM sequoia.voyages
    WHERE president_slug_from_voyage IS NOT NULL
    ORDER BY president_slug_from_voyage
    LIMIT 10
""")
print('\n=== Sample president_slug_from_voyage values ===')
for row in cur.fetchall():
    print(row[0])

# Check if there's a presidents table
cur.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'sequoia' AND table_name LIKE '%president%'
""")
print('\n=== President-related tables ===')
for row in cur.fetchall():
    print(row[0])

# Check voyage_presidents table structure
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'sequoia' AND table_name = 'voyage_presidents'
    ORDER BY ordinal_position
""")
print('\n=== voyage_presidents table columns ===')
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

# Check presidents table structure
cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'sequoia' AND table_name = 'presidents'
    ORDER BY ordinal_position
""")
print('\n=== presidents table columns ===')
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

# Sample data from voyage_presidents
cur.execute("""
    SELECT vp.voyage_slug, vp.president_slug, p.full_name
    FROM sequoia.voyage_presidents vp
    JOIN sequoia.presidents p ON p.president_slug = vp.president_slug
    LIMIT 5
""")
print('\n=== Sample voyage_presidents data ===')
for row in cur.fetchall():
    print(f'Voyage: {row[0]}, President: {row[1]} ({row[2]})')

cur.close()
conn.close()
