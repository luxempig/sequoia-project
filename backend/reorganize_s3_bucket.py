"""
Reorganize S3 bucket to proper hierarchy: media/{owner}/{voyage}/{files}

This script:
1. Finds all files in sequoia-canonical bucket
2. Moves files to correct media/{owner}/{voyage}/ structure
3. Updates database s3_url and public_derivative_url fields
4. Preserves all files (copy then delete to ensure safety)
"""
import boto3
import os
from dotenv import load_dotenv
load_dotenv()

# Add app directory to path to import database utilities
import sys
sys.path.insert(0, '/home/ec2-user/sequoia-project/backend')

from app.db import get_connection


def extract_owner_from_voyage(voyage_slug):
    """Extract owner name from voyage slug (e.g., 'roosevelt-franklin-1938-01' -> 'roosevelt-franklin')"""
    parts = voyage_slug.split('-')
    if len(parts) >= 2:
        return f"{parts[0]}-{parts[1]}"
    return parts[0]


def reorganize_s3_bucket():
    """Reorganize S3 bucket files into proper hierarchy"""
    s3_client = boto3.client('s3')
    bucket = 'sequoia-canonical'

    # Get all objects in bucket
    print(f"Scanning {bucket} bucket...")
    response = s3_client.list_objects_v2(Bucket=bucket)

    if 'Contents' not in response:
        print("No files found in bucket")
        return

    files_to_move = []

    # Find files that need to be moved (not already in media/{owner}/{voyage}/ structure)
    for obj in response['Contents']:
        key = obj['Key']

        # Check if already in correct structure: media/{owner}/{voyage}/{file}
        parts = key.split('/')

        # Correct structure has 4 parts: ['media', '{owner}', '{voyage}', '{filename}']
        if len(parts) == 4 and parts[0] == 'media':
            print(f"✓ Already correct: {key}")
            continue

        # Files at root level with voyage slug pattern (e.g., 'roosevelt-franklin-1938-01/file.jpg')
        # Should be moved to: media/{owner}/{voyage}/{file}
        if len(parts) == 2:
            voyage_slug = parts[0]
            filename = parts[1]

            # Extract owner from voyage slug
            owner = extract_owner_from_voyage(voyage_slug)
            new_key = f"media/{owner}/{voyage_slug}/{filename}"

            files_to_move.append({
                'old_key': key,
                'new_key': new_key,
                'voyage_slug': voyage_slug,
                'owner': owner
            })
            print(f"📦 Will move: {key} -> {new_key}")

        # Files in wrong structure (e.g., 'media/{voyage}/{file}' without owner)
        # Should be moved to: media/{owner}/{voyage}/{file}
        elif len(parts) == 3 and parts[0] == 'media':
            voyage_slug = parts[1]
            filename = parts[2]

            # Check if this is actually an owner folder (not a voyage)
            # If it looks like a voyage slug (has year), reorganize
            if any(char.isdigit() for char in voyage_slug):
                owner = extract_owner_from_voyage(voyage_slug)
                new_key = f"media/{owner}/{voyage_slug}/{filename}"

                files_to_move.append({
                    'old_key': key,
                    'new_key': new_key,
                    'voyage_slug': voyage_slug,
                    'owner': owner
                })
                print(f"📦 Will move: {key} -> {new_key}")
            else:
                print(f"ℹ️  Skipping (appears to be owner folder): {key}")

    print(f"\n{'='*80}")
    print(f"Found {len(files_to_move)} files to reorganize")
    print(f"{'='*80}\n")

    if not files_to_move:
        print("✓ All files are already in correct structure!")
        return

    # Auto-proceed with reorganization
    print(f"Proceeding with moving {len(files_to_move)} files...")
    print()

    # Move files
    moved_count = 0
    db_updates = []

    for item in files_to_move:
        old_key = item['old_key']
        new_key = item['new_key']

        try:
            # Copy to new location
            print(f"Copying: {old_key} -> {new_key}")
            s3_client.copy_object(
                Bucket=bucket,
                CopySource={'Bucket': bucket, 'Key': old_key},
                Key=new_key
            )

            # Delete old location
            print(f"Deleting: {old_key}")
            s3_client.delete_object(Bucket=bucket, Key=old_key)

            moved_count += 1

            # Track database updates needed
            old_url = f"https://{bucket}.s3.amazonaws.com/{old_key}"
            new_url = f"https://{bucket}.s3.amazonaws.com/{new_key}"
            db_updates.append((old_url, new_url))

            print(f"✓ Moved ({moved_count}/{len(files_to_move)})")

        except Exception as e:
            print(f"✗ Error moving {old_key}: {e}")

    print(f"\n{'='*80}")
    print(f"Moved {moved_count} files successfully")
    print(f"{'='*80}\n")

    # Update database URLs
    if db_updates:
        print("Updating database URLs...")
        update_database_urls(db_updates)

    print("\n✓ S3 reorganization complete!")


def update_database_urls(url_updates):
    """Update s3_url and public_derivative_url in database"""
    conn = get_connection()
    cur = conn.cursor()

    updated_count = 0

    for old_url, new_url in url_updates:
        # Update media table
        cur.execute("""
            UPDATE sequoia.media
            SET s3_url = %s, updated_at = CURRENT_TIMESTAMP
            WHERE s3_url = %s
        """, (new_url, old_url))

        if cur.rowcount > 0:
            updated_count += cur.rowcount
            print(f"  Updated media record: {old_url} -> {new_url}")

        # Also check public_derivative_url (though thumbnails are in different bucket)
        # This is just in case any derivatives reference canonical bucket
        cur.execute("""
            UPDATE sequoia.media
            SET public_derivative_url = %s, updated_at = CURRENT_TIMESTAMP
            WHERE public_derivative_url = %s
        """, (new_url, old_url))

        if cur.rowcount > 0:
            updated_count += cur.rowcount
            print(f"  Updated derivative URL: {old_url} -> {new_url}")

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n✓ Updated {updated_count} database records")


if __name__ == "__main__":
    print("""
╔════════════════════════════════════════════════════════════════════╗
║                 S3 Bucket Reorganization Tool                      ║
║                                                                    ║
║  This will reorganize files in sequoia-canonical bucket to:       ║
║  media/{owner}/{voyage}/{files}                                    ║
║                                                                    ║
║  Database s3_url fields will be updated automatically.            ║
╚════════════════════════════════════════════════════════════════════╝
    """)

    reorganize_s3_bucket()
