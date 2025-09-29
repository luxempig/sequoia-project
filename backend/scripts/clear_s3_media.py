#!/usr/bin/env python3
"""
Script to clear old media files from S3 buckets.
Run this to clean up before re-ingesting with the new path structure.
"""
import os
import boto3
import sys
from typing import List

AWS_REGION = os.getenv('AWS_REGION', 'us-east-2')
S3_PRIVATE_BUCKET = os.getenv('S3_PRIVATE_BUCKET', 'sequoia-canonical')
S3_PUBLIC_BUCKET = os.getenv('S3_PUBLIC_BUCKET', 'sequoia-public')

def list_media_files(bucket: str) -> List[str]:
    """List all files under media/ prefix."""
    s3 = boto3.client('s3', region_name=AWS_REGION)
    keys = []

    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket, Prefix='media/')

    for page in pages:
        if 'Contents' in page:
            for obj in page['Contents']:
                keys.append(obj['Key'])

    return keys

def delete_files(bucket: str, keys: List[str], dry_run: bool = True):
    """Delete files from S3 bucket."""
    s3 = boto3.client('s3', region_name=AWS_REGION)

    if not keys:
        print(f"No files to delete in {bucket}")
        return

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Deleting {len(keys)} files from {bucket}:")

    # Show sample of files
    for key in keys[:10]:
        print(f"  - {key}")
    if len(keys) > 10:
        print(f"  ... and {len(keys) - 10} more files")

    if not dry_run:
        # Delete in batches of 1000 (S3 limit)
        for i in range(0, len(keys), 1000):
            batch = keys[i:i+1000]
            delete_objects = [{'Key': k} for k in batch]
            s3.delete_objects(
                Bucket=bucket,
                Delete={'Objects': delete_objects}
            )
            print(f"Deleted {len(batch)} files...")
        print(f"✅ Deleted all {len(keys)} files from {bucket}")
    else:
        print(f"[DRY RUN] Would delete {len(keys)} files")

def main():
    dry_run = '--execute' not in sys.argv

    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE - No files will be deleted")
        print("Add --execute flag to actually delete files")
        print("=" * 60)
    else:
        print("=" * 60)
        print("⚠️  EXECUTING DELETION - Files will be permanently removed!")
        print("=" * 60)
        response = input("Are you sure you want to delete ALL media files? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted")
            return

    # Process private bucket
    print(f"\nScanning {S3_PRIVATE_BUCKET}...")
    private_keys = list_media_files(S3_PRIVATE_BUCKET)
    delete_files(S3_PRIVATE_BUCKET, private_keys, dry_run)

    # Process public bucket
    print(f"\nScanning {S3_PUBLIC_BUCKET}...")
    public_keys = list_media_files(S3_PUBLIC_BUCKET)
    delete_files(S3_PUBLIC_BUCKET, public_keys, dry_run)

    print("\n" + "=" * 60)
    print(f"Summary:")
    print(f"  Private bucket: {len(private_keys)} files")
    print(f"  Public bucket: {len(public_keys)} files")
    print(f"  Total: {len(private_keys) + len(public_keys)} files")

    if dry_run:
        print("\nTo actually delete these files, run:")
        print("  python scripts/clear_s3_media.py --execute")
    else:
        print("\n✅ All media files cleared from S3 buckets")
        print("Run the ingest script to repopulate with new path structure")
    print("=" * 60)

if __name__ == '__main__':
    main()