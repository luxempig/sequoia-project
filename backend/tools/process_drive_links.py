#!/usr/bin/env python3
"""
Process Google Drive links in voyage source_urls and additional_sources.
Downloads files, parses credit/date from filenames, and adds to voyage sources.

Usage:
    python process_drive_links.py [--dry-run] [--voyage-slug SLUG]
"""

import os
import sys
import re
import json
import argparse
from typing import Optional, Dict, List, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor

# Add parent directory to path to import drive_sync
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from voyage_ingest.drive_sync import _parse_drive_file_id, _download_drive_binary, _drive_service

def get_db_connection():
    """Get database connection using environment variables"""
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=os.environ.get("DB_PORT", "5432"),
        dbname=os.environ.get("DB_NAME", "sequoia"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", ""),
    )

def parse_drive_folder_id(url: str) -> Optional[str]:
    """Extract folder ID from Google Drive folder URL"""
    # https://drive.google.com/drive/folders/FOLDER_ID
    m = re.search(r"/folders/([A-Za-z0-9_\-]+)", url or "")
    return m.group(1) if m else None

def list_files_in_folder(folder_id: str) -> List[Dict[str, str]]:
    """List all files in a Google Drive folder"""
    try:
        service = _drive_service()
        results = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType)",
            pageSize=1000
        ).execute()

        files = results.get('files', [])
        return [{'id': f['id'], 'name': f['name'], 'mimeType': f.get('mimeType', '')} for f in files]
    except Exception as e:
        print(f"  Error listing folder {folder_id}: {e}")
        return []

def parse_filename_metadata(filename: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse credit and date from filename.

    Expected patterns:
    - 1933.04.23_FDR_Day_by_Day.pdf → date: "1933-04-23", credit: "FDR Day by Day"
    - 1933.04.24_The_Baltimore_Sun_pg2.jpg → date: "1933-04-24", credit: "The Baltimore Sun"
    - 1933_White_House_Photo.jpg → date: "1933", credit: "White House Photo"
    - Some_Document.pdf → date: None, credit: "Some Document"
    """
    # Remove file extension
    name_without_ext = re.sub(r'\.[^.]+$', '', filename)

    # Pattern 1: YYYY.MM.DD_Credit_Name or YYYY-MM-DD_Credit_Name
    date_match = re.match(r'^(\d{4})[._-](\d{2})[._-](\d{2})_(.+)', name_without_ext)
    if date_match:
        year, month, day, credit_part = date_match.groups()
        date = f"{year}-{month}-{day}"
        credit = credit_part.replace('_', ' ').strip()
        # Remove page numbers like "pg2", "pg 2", "p2", etc.
        credit = re.sub(r'\s*p(g|age)?\s*\d+\s*$', '', credit, flags=re.IGNORECASE)
        return date, credit

    # Pattern 2: YYYY_Credit_Name (year only)
    year_match = re.match(r'^(\d{4})_(.+)', name_without_ext)
    if year_match:
        year, credit_part = year_match.groups()
        date = year
        credit = credit_part.replace('_', ' ').strip()
        credit = re.sub(r'\s*p(g|age)?\s*\d+\s*$', '', credit, flags=re.IGNORECASE)
        return date, credit

    # Pattern 3: No date prefix - use filename as credit
    credit = name_without_ext.replace('_', ' ').strip()
    credit = re.sub(r'\s*p(g|age)?\s*\d+\s*$', '', credit, flags=re.IGNORECASE)
    return None, credit

def determine_media_type(filename: str, mime_type: str) -> str:
    """Determine media type from filename and MIME type"""
    filename_lower = filename.lower()

    # Check file extension first
    if any(filename_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
        return 'image'
    if any(filename_lower.endswith(ext) for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']):
        return 'video'
    if any(filename_lower.endswith(ext) for ext in ['.mp3', '.wav', '.ogg', '.m4a']):
        return 'audio'
    if any(filename_lower.endswith(ext) for ext in ['.pdf']):
        return 'article'

    # Check MIME type
    if mime_type.startswith('image/'):
        return 'image'
    if mime_type.startswith('video/'):
        return 'video'
    if mime_type.startswith('audio/'):
        return 'audio'
    if mime_type in ['application/pdf']:
        return 'article'

    # Default to unchecked
    return 'unchecked'

def process_drive_url(url: str, voyage_slug: str, dry_run: bool = False) -> List[Dict[str, any]]:
    """
    Process a single Google Drive URL (file or folder).
    Returns list of media items to add.
    """
    media_items = []

    # Check if it's a folder
    folder_id = parse_drive_folder_id(url)
    if folder_id:
        print(f"  Processing folder: {url}")

        try:
            files = list_files_in_folder(folder_id)
            print(f"    Found {len(files)} files in folder")

            for file_info in files:
                file_id = file_info['id']
                filename = file_info['name']
                mime_type = file_info.get('mimeType', '')

                print(f"    - {filename}")

                # Parse metadata from filename
                date, credit = parse_filename_metadata(filename)
                media_type = determine_media_type(filename, mime_type)

                # Create media item
                media_item = {
                    'filename': filename,
                    'credit': credit,
                    'date': date,
                    'media_type': media_type,
                    'google_drive_link': f"https://drive.google.com/file/d/{file_id}/view",
                    'voyage_slug': voyage_slug
                }
                media_items.append(media_item)

                print(f"      → credit: {credit}, date: {date}, type: {media_type}")
        except Exception as e:
            print(f"  ✗ Error listing folder: {e}")
            if dry_run:
                print(f"    [DRY RUN] Skipping folder due to error")

    else:
        # It's a file
        file_id = _parse_drive_file_id(url)
        if not file_id:
            print(f"  ⚠ Could not parse file ID from URL: {url}")
            return media_items

        print(f"  Processing file: {url}")

        try:
            # Get file metadata (don't download yet)
            service = _drive_service()
            meta = service.files().get(fileId=file_id, fields="id,name,mimeType").execute()
            filename = meta.get("name", "file")
            mime_type = meta.get("mimeType", "")

            print(f"    - {filename}")

            # Parse metadata from filename
            date, credit = parse_filename_metadata(filename)
            media_type = determine_media_type(filename, mime_type)

            # Create media item
            media_item = {
                'filename': filename,
                'credit': credit,
                'date': date,
                'media_type': media_type,
                'google_drive_link': url,
                'voyage_slug': voyage_slug
            }
            media_items.append(media_item)

            print(f"      → credit: {credit}, date: {date}, type: {media_type}")

        except Exception as e:
            print(f"  ✗ Error processing file {file_id}: {e}")
            if dry_run:
                # In dry-run mode, try to infer what we can from the URL
                print(f"    [DRY RUN] Would process file ID: {file_id}")
                print(f"    [DRY RUN] Note: Actual filename and metadata will be available when credentials are configured")

    return media_items

def extract_drive_urls_from_text(text: str) -> List[str]:
    """Extract all Google Drive URLs from text"""
    pattern = r'https://drive\.google\.com/[^\s\)\]>"]+'
    urls = re.findall(pattern, text)
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    return unique_urls

def update_voyage_sources(voyage_slug: str, new_media_items: List[Dict], conn, dry_run: bool = False):
    """
    Add new media items to voyage's source_urls field.
    source_urls is a JSON array of objects with url and media_type.
    """
    cur = conn.cursor()

    # Get current source_urls
    cur.execute("""
        SELECT source_urls
        FROM sequoia.voyages
        WHERE voyage_slug = %s
    """, (voyage_slug,))

    row = cur.fetchone()
    if not row:
        print(f"  ⚠ Voyage {voyage_slug} not found")
        return

    current_sources = row[0] or []

    # Add new media items to source_urls
    added_count = 0
    for item in new_media_items:
        # Check if URL already exists
        url = item['google_drive_link']
        if any(s.get('url') == url for s in current_sources):
            print(f"  - Skipped (already exists): {item['filename']}")
            continue

        # Add new source
        new_source = {
            'url': url,
            'media_type': item['media_type']
        }
        current_sources.append(new_source)
        added_count += 1
        print(f"  + Added: {item['filename']} ({item['media_type']})")

    if added_count > 0:
        if dry_run:
            print(f"  [DRY RUN] Would add {added_count} new sources to {voyage_slug}")
        else:
            # Update database
            cur.execute("""
                UPDATE sequoia.voyages
                SET source_urls = %s
                WHERE voyage_slug = %s
            """, (json.dumps(current_sources), voyage_slug))
            conn.commit()
            print(f"  ✓ Added {added_count} new sources to {voyage_slug}")
    else:
        print(f"  No new sources to add")

    cur.close()

def process_voyages(voyage_slug: Optional[str] = None, dry_run: bool = False):
    """Process all voyages (or a specific one) to extract Drive files"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Query for voyages with Google Drive links
    if voyage_slug:
        query = """
            SELECT voyage_slug, source_urls, additional_sources
            FROM sequoia.voyages
            WHERE voyage_slug = %s
        """
        cur.execute(query, (voyage_slug,))
    else:
        query = """
            SELECT voyage_slug, source_urls, additional_sources
            FROM sequoia.voyages
            WHERE source_urls::text LIKE '%drive.google.com%'
               OR additional_sources LIKE '%drive.google.com%'
            ORDER BY start_date
        """
        cur.execute(query)

    voyages = cur.fetchall()
    cur.close()

    print(f"\nFound {len(voyages)} voyages with Google Drive links\n")
    print("=" * 80)

    for voyage in voyages:
        slug = voyage['voyage_slug']
        print(f"\n[{slug}]")

        # Collect all Drive URLs from both fields
        drive_urls = []

        # From source_urls (already parsed as Python list/dict by psycopg2)
        if voyage['source_urls']:
            sources = voyage['source_urls']
            # Handle both list of strings and list of dicts
            for source in sources:
                if isinstance(source, str):
                    url = source
                elif isinstance(source, dict):
                    url = source.get('url', '')
                else:
                    continue

                if 'drive.google.com' in url:
                    drive_urls.append(url)

        # From additional_sources (text field)
        if voyage['additional_sources']:
            urls = extract_drive_urls_from_text(voyage['additional_sources'])
            drive_urls.extend(urls)

        # Remove duplicates
        drive_urls = list(set(drive_urls))

        if not drive_urls:
            print("  No Drive URLs found")
            continue

        print(f"  Found {len(drive_urls)} Drive URL(s)")

        # Process each URL
        all_media_items = []
        for url in drive_urls:
            try:
                media_items = process_drive_url(url, slug, dry_run)
                all_media_items.extend(media_items)
            except Exception as e:
                print(f"  ✗ Error processing URL {url}: {e}")

        # Update voyage with new media items
        if all_media_items:
            update_voyage_sources(slug, all_media_items, conn, dry_run)

    print("\n" + "=" * 80)
    print("DONE\n")

    conn.close()

def main():
    parser = argparse.ArgumentParser(
        description='Process Google Drive links in voyage sources'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Parse and validate but don\'t update database')
    parser.add_argument('--voyage-slug', type=str,
                        help='Process only a specific voyage')

    args = parser.parse_args()

    # Check for required environment variables
    if not os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
        print("Error: GOOGLE_APPLICATION_CREDENTIALS not set")
        sys.exit(1)

    process_voyages(voyage_slug=args.voyage_slug, dry_run=args.dry_run)

if __name__ == '__main__':
    main()
