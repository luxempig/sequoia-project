#!/usr/bin/env python3
"""
Add sample media entries to the database to demonstrate media functionality.
Creates placeholder media items for voyages that have has_photo or has_video flags set.
"""

import os
from dotenv import load_dotenv
load_dotenv()

from voyage_ingest.db_updater import _conn, _schema
from psycopg2.extras import execute_values

def add_sample_media():
    conn = _conn()
    conn.autocommit = False

    try:
        cur = conn.cursor()
        _schema(cur)

        # Get voyages that should have photos or videos
        cur.execute('''
            SELECT voyage_slug, has_photo, has_video
            FROM voyages
            WHERE has_photo = true OR has_video = true
            ORDER BY voyage_slug;
        ''')

        voyages_with_media = cur.fetchall()
        print(f"Found {len(voyages_with_media)} voyages that should have media")

        media_items = []
        voyage_media_links = []

        for voyage_slug, has_photo, has_video in voyages_with_media:
            if has_photo:
                # Add 2-3 photo entries
                for i in range(1, 3):
                    media_slug = f"{voyage_slug}-photo-{i:03d}"
                    media_items.append((
                        media_slug,
                        f"Photo {i} from {voyage_slug}",
                        "image",
                        f"https://sequoia-canonical.s3.amazonaws.com/{voyage_slug}/photo-{i}.jpg",  # S3 URL
                        f"https://sequoia-public.s3.amazonaws.com/{voyage_slug}/photo-{i}-thumb.jpg",  # Public derivative
                        "White House Photo Office",
                        None,  # date
                        f"Official photograph from the voyage.",
                        None,  # tags
                        None   # google_drive_link
                    ))
                    voyage_media_links.append((voyage_slug, media_slug, i, None))

            if has_video:
                # Add 1 video entry
                media_slug = f"{voyage_slug}-video-001"
                media_items.append((
                    media_slug,
                    f"Video footage from {voyage_slug}",
                    "video",
                    f"https://sequoia-canonical.s3.amazonaws.com/{voyage_slug}/video.mp4",
                    f"https://sequoia-public.s3.amazonaws.com/{voyage_slug}/video-thumb.jpg",
                    "Naval Photographic Center",
                    None,
                    f"Video footage from the voyage.",
                    None,
                    None
                ))
                voyage_media_links.append((voyage_slug, media_slug, 10, None))

        # Insert media items
        if media_items:
            execute_values(cur, """
                INSERT INTO media (media_slug, title, media_type, s3_url, public_derivative_url,
                                   credit, date, description_markdown, tags, google_drive_link)
                VALUES %s
                ON CONFLICT (media_slug) DO UPDATE SET
                  title=EXCLUDED.title, media_type=EXCLUDED.media_type, s3_url=EXCLUDED.s3_url,
                  public_derivative_url=EXCLUDED.public_derivative_url, credit=EXCLUDED.credit,
                  description_markdown=EXCLUDED.description_markdown;
            """, media_items)
            print(f"✓ Inserted {len(media_items)} media items")

        # Link media to voyages
        if voyage_media_links:
            execute_values(cur, """
                INSERT INTO voyage_media (voyage_slug, media_slug, sort_order, notes)
                VALUES %s
                ON CONFLICT (voyage_slug, media_slug) DO UPDATE SET
                  sort_order=EXCLUDED.sort_order;
            """, voyage_media_links)
            print(f"✓ Created {len(voyage_media_links)} voyage-media links")

        conn.commit()
        print("\n✓ Sample media added successfully!")

        # Verify
        cur.execute('SELECT COUNT(*) FROM media;')
        print(f"Total media items in database: {cur.fetchone()[0]}")

        cur.execute('SELECT COUNT(*) FROM voyage_media;')
        print(f"Total voyage-media links: {cur.fetchone()[0]}")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    add_sample_media()
