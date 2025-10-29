#!/usr/bin/env python3
"""
Fix Content-Disposition metadata for existing S3 files.

This script updates all files in both sequoia-canonical and sequoia-public buckets
to have Content-Disposition: inline so they open in browser instead of downloading.
"""

import boto3
import os
from typing import List, Tuple

def get_content_type_from_key(key: str) -> str:
    """Determine content type from file extension."""
    ext = key.lower().split('.')[-1] if '.' in key else ''

    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'bmp': 'image/bmp',
        'tif': 'image/tiff',
        'tiff': 'image/tiff',
        'pdf': 'application/pdf',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
    }

    return content_types.get(ext, 'application/octet-stream')


def fix_bucket_files(bucket_name: str, dry_run: bool = True) -> Tuple[int, int]:
    """Fix Content-Disposition for all files in a bucket."""
    s3_client = boto3.client('s3')

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing bucket: {bucket_name}")
    print("=" * 80)

    # List all objects in bucket
    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket_name)

    total_files = 0
    updated_files = 0

    for page in pages:
        if 'Contents' not in page:
            continue

        for obj in page['Contents']:
            key = obj['Key']
            total_files += 1

            try:
                # Get current metadata
                response = s3_client.head_object(Bucket=bucket_name, Key=key)
                current_disposition = response.get('ContentDisposition', '')
                current_content_type = response.get('ContentType', 'application/octet-stream')

                # Check if update needed
                if current_disposition == 'inline':
                    print(f"✓ Already correct: {key}")
                    continue

                # Determine correct content type
                correct_content_type = get_content_type_from_key(key) or current_content_type

                print(f"{'[DRY RUN] Would update' if dry_run else 'Updating'}: {key}")
                print(f"  Current: ContentDisposition={current_disposition!r}, ContentType={current_content_type}")
                print(f"  New:     ContentDisposition='inline', ContentType={correct_content_type}")

                if not dry_run:
                    # Copy object to itself with new metadata
                    s3_client.copy_object(
                        Bucket=bucket_name,
                        Key=key,
                        CopySource={'Bucket': bucket_name, 'Key': key},
                        ContentType=correct_content_type,
                        ContentDisposition='inline',
                        MetadataDirective='REPLACE'
                    )
                    print(f"  ✓ Updated successfully")

                updated_files += 1

            except Exception as e:
                print(f"  ✗ Error processing {key}: {e}")

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Summary for {bucket_name}:")
    print(f"  Total files: {total_files}")
    print(f"  {'Would update' if dry_run else 'Updated'}: {updated_files}")
    print(f"  Already correct: {total_files - updated_files}")

    return total_files, updated_files


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Fix S3 Content-Disposition metadata')
    parser.add_argument('--apply', action='store_true',
                       help='Actually apply changes (default is dry-run)')
    parser.add_argument('--yes', action='store_true',
                       help='Skip confirmation prompt (use with --apply)')
    parser.add_argument('--bucket', type=str,
                       help='Only process specific bucket (sequoia-canonical or sequoia-public)')

    args = parser.parse_args()

    dry_run = not args.apply

    if dry_run:
        print("\n" + "=" * 80)
        print("DRY RUN MODE - No changes will be made")
        print("Run with --apply to actually update files")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("⚠️  APPLYING CHANGES - This will modify S3 metadata")
        print("=" * 80)
        if not args.yes:
            response = input("Are you sure you want to continue? (yes/no): ")
            if response.lower() != 'yes':
                print("Aborted.")
                return
        else:
            print("Auto-confirmed with --yes flag")

    buckets = []
    if args.bucket:
        buckets = [args.bucket]
    else:
        buckets = ['sequoia-canonical', 'sequoia-public']

    total_all = 0
    updated_all = 0

    for bucket in buckets:
        try:
            total, updated = fix_bucket_files(bucket, dry_run=dry_run)
            total_all += total
            updated_all += updated
        except Exception as e:
            print(f"\n✗ Error processing bucket {bucket}: {e}")

    print("\n" + "=" * 80)
    print(f"{'[DRY RUN] ' if dry_run else ''}OVERALL SUMMARY:")
    print(f"  Total files processed: {total_all}")
    print(f"  {'Would update' if dry_run else 'Updated'}: {updated_all}")
    print(f"  Already correct: {total_all - updated_all}")
    print("=" * 80)

    if dry_run:
        print("\nRun with --apply to actually update files")


if __name__ == '__main__':
    main()
