#!/usr/bin/env python3
"""
Regenerate missing PDF thumbnails in S3.
Checks all articles (PDFs) and regenerates thumbnails if they're missing from S3.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import os
import boto3
from dotenv import load_dotenv
from pathlib import Path
import tempfile
import subprocess

load_dotenv()

s3_client = boto3.client('s3')

def check_thumbnail_exists(bucket, key):
    """Check if a file exists in S3"""
    try:
        s3_client.head_object(Bucket=bucket, Key=key)
        return True
    except:
        return False

def extract_thumbnail_path_from_url(url):
    """Extract bucket and key from S3 URL"""
    if url.startswith('https://'):
        # Format: https://bucket.s3.amazonaws.com/key
        parts = url.replace('https://', '').split('/', 1)
        bucket = parts[0].replace('.s3.amazonaws.com', '')
        key = parts[1] if len(parts) > 1 else None
        return bucket, key
    elif url.startswith('s3://'):
        # Format: s3://bucket/key
        parts = url.replace('s3://', '').split('/', 1)
        bucket = parts[0]
        key = parts[1] if len(parts) > 1 else None
        return bucket, key
    return None, None

def main():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get all PDFs/articles with thumbnail URLs
            cur.execute("""
                SELECT media_slug, title, s3_url, public_derivative_url
                FROM sequoia.media
                WHERE media_type = 'article'
                  AND public_derivative_url IS NOT NULL
                ORDER BY created_at DESC
            """)

            media_items = cur.fetchall()
            print(f"Found {len(media_items)} articles with thumbnail URLs")

            missing_count = 0
            checked_count = 0

            for item in media_items:
                thumb_url = item['public_derivative_url']
                if not thumb_url:
                    continue

                bucket, key = extract_thumbnail_path_from_url(thumb_url)
                if not bucket or not key:
                    print(f"⚠️  Could not parse URL: {thumb_url}")
                    continue

                checked_count += 1
                exists = check_thumbnail_exists(bucket, key)

                if not exists:
                    missing_count += 1
                    print(f"✗ Missing: {item['title']}")
                    print(f"  Slug: {item['media_slug']}")
                    print(f"  Thumbnail: {thumb_url}")
                    print()

                if checked_count % 20 == 0:
                    print(f"... checked {checked_count} thumbnails so far ...")

            print(f"\nSummary:")
            print(f"  Total checked: {checked_count}")
            print(f"  Missing thumbnails: {missing_count}")
            print(f"  Exists: {checked_count - missing_count}")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
