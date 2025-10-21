#!/usr/bin/env python3
"""Run database migration to fix media trigger"""
from dotenv import load_dotenv
load_dotenv()

import psycopg2
from app.config import get_settings

# Read migration SQL
with open('migrations/fix_media_trigger.sql', 'r') as f:
    migration_sql = f.read()

# Get settings
s = get_settings()

print(f"Connecting to database at {s.DB_HOST}...")

# Connect using same settings as the backend app
conn = psycopg2.connect(
    host=s.DB_HOST,
    port=s.DB_PORT,
    dbname=s.DB_NAME,
    user=s.DB_USER,
    password=s.DB_PASSWORD,
    sslmode="require",
    connect_timeout=10
)
conn.autocommit = True  # Important for DDL statements
cursor = conn.cursor()

print("Executing migration...")
cursor.execute(migration_sql)

print("Migration completed successfully!")

cursor.close()
conn.close()
