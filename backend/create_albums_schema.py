#!/usr/bin/env python3
"""
Create albums schema for grouping media items.
Allows photos to be organized into albums within voyages.
"""

import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from db import db_cursor

def create_albums_schema():
    """Create albums and album_media tables"""

    with db_cursor() as cur:
        print("Creating albums table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sequoia.albums (
                album_id SERIAL PRIMARY KEY,
                album_slug VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                voyage_slug VARCHAR(255) REFERENCES sequoia.voyages(voyage_slug) ON DELETE CASCADE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        print("✓ Created albums table")

        print("Creating album_media junction table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sequoia.album_media (
                album_id INTEGER REFERENCES sequoia.albums(album_id) ON DELETE CASCADE,
                media_slug VARCHAR(255) REFERENCES sequoia.media(media_slug) ON DELETE CASCADE,
                sort_order INTEGER DEFAULT 0,
                added_at TIMESTAMP DEFAULT NOW(),
                PRIMARY KEY (album_id, media_slug)
            )
        """)
        print("✓ Created album_media junction table")

        print("Creating indexes for performance...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_albums_voyage_slug
            ON sequoia.albums(voyage_slug)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_album_media_album_id
            ON sequoia.album_media(album_id)
        """)
        print("✓ Created indexes")

        print("\n✅ Albums schema created successfully!")
        print("\nNew tables:")
        print("  - sequoia.albums (album metadata)")
        print("  - sequoia.album_media (media-to-album associations)")

if __name__ == "__main__":
    confirm = input("Create albums schema? (yes/no): ")
    if confirm.lower() == 'yes':
        create_albums_schema()
    else:
        print("Cancelled")
