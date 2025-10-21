#!/usr/bin/env python3
"""Run database migration to fix media trigger"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Read migration SQL
with open('migrations/fix_media_trigger.sql', 'r') as f:
    migration_sql = f.read()

# Get database connection details from environment
db_config = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', 5432)),
    'database': os.environ.get('DB_NAME', 'sequoia_db'),
    'user': os.environ.get('DB_USER', 'sequoia'),
    'password': os.environ.get('DB_PASSWORD', ''),
}

print(f"Connecting to database at {db_config['host']}...")

# Connect and execute migration
conn = psycopg2.connect(**db_config)
conn.autocommit = True  # Important for DDL statements
cursor = conn.cursor()

print("Executing migration...")
cursor.execute(migration_sql)

print("Migration completed successfully!")

cursor.close()
conn.close()
