#!/usr/bin/env python3
"""
Delete phantom media records (database entries without actual files in S3)
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

def delete_phantom_records():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )

    phantom_slugs = [
        '1933-04-01-to-1933-04-30-e3e991e3',
        '1933-04-01-to-1933-04-30-6dfa14cb'
    ]

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for slug in phantom_slugs:
                # Check if it's linked to any voyages
                cur.execute("""
                    SELECT voyage_slug
                    FROM sequoia.voyage_media
                    WHERE media_slug = %s
                """, (slug,))
                voyages = cur.fetchall()

                if voyages:
                    print(f"\n{slug} is linked to {len(voyages)} voyage(s):")
                    for v in voyages:
                        print(f"  - {v['voyage_slug']}")

                    # Delete voyage links first
                    cur.execute("""
                        DELETE FROM sequoia.voyage_media
                        WHERE media_slug = %s
                    """, (slug,))
                    print(f"  ✓ Removed {len(voyages)} voyage link(s)")

                # Delete the media record
                cur.execute("""
                    DELETE FROM sequoia.media
                    WHERE media_slug = %s
                    RETURNING title
                """, (slug,))

                deleted = cur.fetchone()
                if deleted:
                    print(f"\n✓ Deleted phantom record: {deleted['title']}")
                    print(f"  Slug: {slug}")
                else:
                    print(f"\n⚠️  Record not found: {slug}")

            conn.commit()
            print(f"\n✅ Successfully deleted {len(phantom_slugs)} phantom records")

    finally:
        conn.close()

if __name__ == '__main__':
    delete_phantom_records()
