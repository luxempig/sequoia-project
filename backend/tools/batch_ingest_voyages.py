#!/usr/bin/env python3
"""
Batch process multiple voyages from a single markdown file.
Splits by ## headers and processes each voyage individually.

Usage:
    python batch_ingest_voyages.py truman_voyages.md --president-slug harry-s-truman
"""

import os
import sys
import re
import argparse
import tempfile
from pathlib import Path
from claude_voyage_ingest import parse_with_claude, insert_voyage_to_db

def split_voyages(markdown_content: str):
    """Split markdown file into individual voyages by ## headers"""
    # Split by ## headers (voyage dates)
    voyage_pattern = r'^##\s+(.+?)$'
    parts = re.split(voyage_pattern, markdown_content, flags=re.MULTILINE)

    voyages = []
    # parts[0] is the header/intro before first voyage
    # Then alternates: header, content, header, content...
    for i in range(1, len(parts), 2):
        if i + 1 < len(parts):
            header = parts[i].strip()
            content = parts[i + 1].strip()
            if content:  # Skip empty voyages
                voyages.append((header, f"## {header}\n\n{content}"))

    return voyages

def main():
    parser = argparse.ArgumentParser(description='Batch process voyages from markdown file')
    parser.add_argument('markdown_file', help='Path to markdown file with multiple voyages')
    parser.add_argument('--president-slug', help='President/owner slug (e.g., harry-s-truman)', required=True)
    parser.add_argument('--dry-run', action='store_true', help='Parse and validate but don\'t insert to database')
    parser.add_argument('--start-at', type=int, default=1, help='Start at voyage number (1-indexed)')
    parser.add_argument('--limit', type=int, help='Limit number of voyages to process')

    args = parser.parse_args()

    # Check for API key
    if not os.getenv('ANTHROPIC_API_KEY'):
        print("Error: ANTHROPIC_API_KEY not found in environment")
        sys.exit(1)

    # Read markdown file
    try:
        with open(args.markdown_file, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

    # Split into individual voyages
    voyages = split_voyages(markdown_content)
    print(f"\nFound {len(voyages)} voyages in file")

    # Apply start-at and limit
    start_idx = args.start_at - 1
    end_idx = start_idx + args.limit if args.limit else len(voyages)
    voyages_to_process = voyages[start_idx:end_idx]

    print(f"Processing voyages {args.start_at} to {min(end_idx, len(voyages))}")
    print("=" * 80)

    success_count = 0
    error_count = 0
    skipped_count = 0

    for idx, (header, voyage_markdown) in enumerate(voyages_to_process, start=start_idx + 1):
        print(f"\n[{idx}/{len(voyages)}] Processing: {header}")
        print("-" * 80)

        try:
            # Parse with Claude
            parsed_data = parse_with_claude(voyage_markdown, args.president_slug)

            # Check if we got valid data
            if not parsed_data or 'voyage' not in parsed_data:
                print(f"  ⚠ Skipped: Could not parse voyage")
                skipped_count += 1
                continue

            # Insert to database
            voyage_slug = insert_voyage_to_db(parsed_data, dry_run=args.dry_run)

            if args.dry_run:
                print(f"  ✓ [DRY RUN] Would create: {voyage_slug}")
            else:
                print(f"  ✓ Created: {voyage_slug}")

            success_count += 1

        except Exception as e:
            print(f"  ✗ Error: {e}")
            error_count += 1
            # Continue processing remaining voyages

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total voyages in file: {len(voyages)}")
    print(f"Processed: {len(voyages_to_process)}")
    print(f"✓ Success: {success_count}")
    print(f"✗ Errors: {error_count}")
    print(f"⚠ Skipped: {skipped_count}")

    if args.dry_run:
        print("\n[DRY RUN MODE - No changes made to database]")

if __name__ == '__main__':
    main()
