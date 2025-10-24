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

# Create table to track passenger voyage counts by president
print("Creating person_president_stats table...")
cur.execute("""
    CREATE TABLE IF NOT EXISTS sequoia.person_president_stats (
        person_slug TEXT NOT NULL,
        president_slug TEXT NOT NULL,
        voyage_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (person_slug, president_slug),
        CONSTRAINT fk_person
            FOREIGN KEY (person_slug)
            REFERENCES sequoia.people(person_slug)
            ON DELETE CASCADE
    );
""")

# Create index for faster queries
print("Creating indexes...")
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_person_president_stats_person
    ON sequoia.person_president_stats(person_slug);
""")

cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_person_president_stats_president
    ON sequoia.person_president_stats(president_slug);
""")

cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_person_president_stats_count
    ON sequoia.person_president_stats(voyage_count DESC);
""")

conn.commit()
print("✓ Table and indexes created successfully")

# Show table structure
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'sequoia' AND table_name = 'person_president_stats'
    ORDER BY ordinal_position
""")
print("\n=== person_president_stats table columns ===")
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]} (nullable: {row[2]})')

cur.close()
conn.close()
