#!/usr/bin/env python3
"""
Fix broken media record where media_type doesn't match S3 file location.
This script fixes the piqua-daily-call record that has media_type='article' but files in image/ folder.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

def fix_broken_media():
    # Connect to database
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find the broken record
            media_slug = '1933-04-22-the-piqua-daily-call-ee9ad66a'

            cur.execute("""
                SELECT media_slug, media_type, s3_url, public_derivative_url
                FROM sequoia.media
                WHERE media_slug = %s
            """, (media_slug,))

            record = cur.fetchone()
            if not record:
                print(f"Media {media_slug} not found")
                return

            print(f"Current state:")
            print(f"  media_type: {record['media_type']}")
            print(f"  s3_url: {record['s3_url']}")
            print(f"  public_derivative_url: {record['public_derivative_url']}")

            # Check if URLs contain 'image' folder
            if '/image/' in str(record['s3_url']):
                print(f"\nFiles are in 'image' folder, updating media_type to 'image'...")

                cur.execute("""
                    UPDATE sequoia.media
                    SET media_type = 'image', updated_at = CURRENT_TIMESTAMP
                    WHERE media_slug = %s
                    RETURNING media_slug, media_type, s3_url
                """, (media_slug,))

                updated = cur.fetchone()
                conn.commit()

                print(f"\n✓ Fixed!")
                print(f"  media_type: {updated['media_type']}")
                print(f"  s3_url: {updated['s3_url']}")
            else:
                print(f"\nNo fix needed - URLs don't point to image folder")

    finally:
        conn.close()

if __name__ == '__main__':
    fix_broken_media()
