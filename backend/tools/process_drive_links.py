#!/usr/bin/env python3
"""
Process Google Drive links in voyage source_urls and additional_sources.
Downloads files, uploads to S3, creates media records, and links to voyages.
Updated: 2025-10-28

Usage:
    python process_drive_links.py [--dry-run] [--voyage-slug SLUG]
"""

import os
import sys
import re
import json
import argparse
import uuid
import io
from typing import Optional, Dict, List, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from PIL import Image
from dotenv import load_dotenv

# Load .env file from backend directory
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, '.env')
load_dotenv(env_path)

# Add parent directory to path to import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from voyage_ingest.drive_sync import _parse_drive_file_id, _download_drive_binary, _drive_service

# Import the existing DB connection function from claude_voyage_ingest
sys.path.insert(0, os.path.dirname(__file__))
from claude_voyage_ingest import get_db_connection as get_voyage_db_connection

# Try to import PyMuPDF for PDF thumbnails
try:
    import fitz
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

# AWS S3 configuration
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_CANONICAL_BUCKET = os.environ.get("S3_PRIVATE_BUCKET", "sequoia-canonical")
S3_PUBLIC_BUCKET = os.environ.get("S3_PUBLIC_BUCKET", "sequoia-public")

def get_db_connection():
    """Get database connection using the same method as other tools"""
    return get_voyage_db_connection()

def parse_drive_folder_id(url: str) -> Optional[str]:
    """Extract folder ID from Google Drive folder URL"""
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
    if any(filename_lower.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tif', '.tiff']):
        return 'image'
    if any(filename_lower.endswith(ext) for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv']):
        return 'video'
    if any(filename_lower.endswith(ext) for ext in ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']):
        return 'audio'
    if any(filename_lower.endswith(ext) for ext in ['.pdf', '.doc', '.docx', '.txt', '.rtf']):
        return 'article'
    if any(filename_lower.endswith(ext) for ext in ['.epub', '.mobi', '.azw', '.azw3']):
        return 'book'

    # Check MIME type
    if mime_type.startswith('image/'):
        return 'image'
    if mime_type.startswith('video/'):
        return 'video'
    if mime_type.startswith('audio/'):
        return 'audio'
    if mime_type in ['application/pdf']:
        return 'article'

    # Default to other
    return 'other'

def upload_to_s3(file_content: bytes, bucket: str, key: str, content_type: str) -> str:
    """Upload file to S3 and return the S3 URL"""
    s3_client = boto3.client('s3', region_name=AWS_REGION)
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_content,
        ContentType=content_type
    )
    return f"s3://{bucket}/{key}"

def generate_and_upload_thumbnail(file_content: bytes, media_type: str, directory_path: str, thumb_filename: str) -> Optional[str]:
    """Generate thumbnail and upload to S3 public bucket"""
    try:
        thumbnail_data = None

        if media_type == 'image':
            # Generate image thumbnail
            img = Image.open(io.BytesIO(file_content))
            img.thumbnail((400, 400))
            thumb_buffer = io.BytesIO()
            img.convert('RGB').save(thumb_buffer, format='JPEG', quality=85)
            thumbnail_data = thumb_buffer.getvalue()

        elif media_type in ('article', 'book') and HAS_PYMUPDF:
            # Generate PDF thumbnail
            doc = fitz.open(stream=file_content, filetype="pdf")
            if len(doc) > 0:
                page = doc[0]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img.thumbnail((400, 400))
                thumb_buffer = io.BytesIO()
                img.save(thumb_buffer, format='JPEG', quality=85)
                thumbnail_data = thumb_buffer.getvalue()
                doc.close()

        if thumbnail_data:
            # Upload thumbnail to public bucket
            thumb_key = f"{directory_path}/{thumb_filename}"
            s3_client = boto3.client('s3', region_name=AWS_REGION)
            s3_client.put_object(
                Bucket=S3_PUBLIC_BUCKET,
                Key=thumb_key,
                Body=thumbnail_data,
                ContentType='image/jpeg'
            )
            return f"https://{S3_PUBLIC_BUCKET}.s3.amazonaws.com/{thumb_key}"

    except Exception as e:
        print(f"      Warning: Could not generate thumbnail: {e}")

    return None

def generate_media_slug(filename: str, voyage_slug: str) -> str:
    """Generate a unique media slug"""
    base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
    # Clean the filename for slug use
    slug_base = re.sub(r'[^a-z0-9-]', '-', base_name.lower())
    slug_base = re.sub(r'-+', '-', slug_base).strip('-')[:50]
    # Add short UUID to ensure uniqueness
    unique_suffix = str(uuid.uuid4())[:8]
    return f"{slug_base}-{unique_suffix}" if slug_base else f"media-{unique_suffix}"

def process_drive_file(
    file_id: str,
    filename: str,
    voyage_slug: str,
    president_slug: str,
    media_category: str,
    dry_run: bool = False
) -> Optional[Dict]:
    """
    Download file from Drive, upload to S3, create media record, and link to voyage.
    Returns the created media record or None if failed.
    """
    try:
        print(f"    - {filename}")

        # Parse metadata from filename
        date, credit = parse_filename_metadata(filename)

        # Download file from Google Drive
        file_content, mime_type, original_name = _download_drive_binary(file_id)
        file_ext = filename.split('.')[-1] if '.' in filename else 'bin'

        # Determine media type
        media_type = determine_media_type(filename, mime_type)

        print(f"      → credit: {credit}, date: {date}, type: {media_type}")

        if dry_run:
            print(f"      [DRY RUN] Would upload to S3 and create media record")
            return None

        # Build S3 path: president-slug/media-type/
        directory_path = f"{president_slug}/{media_type}"

        # Build filename: credit_date_title.ext
        filename_parts = []
        if credit:
            credit_slug = re.sub(r'[^a-z0-9\s-]', '', credit.lower())
            credit_slug = re.sub(r'\s+', '-', credit_slug.strip())
            credit_slug = re.sub(r'-+', '-', credit_slug).strip('-')
            if credit_slug:
                filename_parts.append(credit_slug)

        if date:
            filename_parts.append(date.replace('/', '-'))

        # Add original filename (cleaned)
        name_slug = re.sub(r'[^a-z0-9\s-]', '', filename.rsplit('.', 1)[0].lower())
        name_slug = re.sub(r'\s+', '-', name_slug.strip())
        name_slug = re.sub(r'-+', '-', name_slug).strip('-')
        if name_slug and name_slug not in '_'.join(filename_parts):
            filename_parts.append(name_slug[:30])

        formatted_filename = '_'.join(filename_parts) + f'.{file_ext}' if filename_parts else filename
        s3_key = f"{directory_path}/{formatted_filename}"

        # Upload to S3
        s3_url = upload_to_s3(
            file_content=file_content,
            bucket=S3_CANONICAL_BUCKET,
            key=s3_key,
            content_type=mime_type or "application/octet-stream"
        )

        print(f"      ✓ Uploaded to S3: {s3_url}")

        # Generate thumbnail
        thumbnail_url = None
        if media_type in ('image', 'article', 'book'):
            thumb_filename = formatted_filename.rsplit('.', 1)[0] + '-thumb.jpg'
            thumbnail_url = generate_and_upload_thumbnail(
                file_content=file_content,
                media_type=media_type,
                directory_path=directory_path,
                thumb_filename=thumb_filename
            )
            if thumbnail_url:
                print(f"      ✓ Generated thumbnail: {thumbnail_url}")

        # Generate media slug
        media_slug = generate_media_slug(filename, voyage_slug)

        # Create media record
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Store the original Drive link
        drive_link = f"https://drive.google.com/file/d/{file_id}/view"

        cur.execute("""
            INSERT INTO sequoia.media (
                media_slug, title, media_type, s3_url, public_derivative_url,
                credit, date, google_drive_link,
                created_at, updated_at
            ) VALUES (
                %(media_slug)s, %(title)s, %(media_type)s, %(s3_url)s, %(thumbnail_url)s,
                %(credit)s, %(date)s, %(google_drive_link)s,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT (media_slug) DO UPDATE SET
                title = EXCLUDED.title,
                s3_url = EXCLUDED.s3_url,
                public_derivative_url = EXCLUDED.public_derivative_url,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        """, {
            'media_slug': media_slug,
            'title': filename,
            'media_type': media_type,
            's3_url': s3_url,
            'thumbnail_url': thumbnail_url,
            'credit': credit,
            'date': date,
            'google_drive_link': drive_link
        })

        media_record = dict(cur.fetchone())
        print(f"      ✓ Created media record: {media_slug}")

        # Link to voyage
        cur.execute("""
            INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, sort_order, media_category)
            VALUES (%s, %s, 999, %s)
            ON CONFLICT (voyage_slug, media_slug) DO UPDATE SET
                media_category = EXCLUDED.media_category
        """, (voyage_slug, media_slug, media_category))

        print(f"      ✓ Linked to voyage in '{media_category}' section")

        conn.commit()
        cur.close()
        conn.close()

        return media_record

    except Exception as e:
        print(f"      ✗ Error processing file: {e}")
        return None

def update_voyage_media_flags(voyage_slug: str):
    """Update has_photos and has_videos flags for a voyage"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Check if voyage has any images
        cur.execute("""
            SELECT EXISTS(
                SELECT 1 FROM sequoia.voyage_media vm
                JOIN sequoia.media m ON m.media_slug = vm.media_slug
                WHERE vm.voyage_slug = %s AND m.media_type = 'image'
            ) as has_images
        """, (voyage_slug,))
        has_photos = cur.fetchone()['has_images']

        # Check if voyage has any videos
        cur.execute("""
            SELECT EXISTS(
                SELECT 1 FROM sequoia.voyage_media vm
                JOIN sequoia.media m ON m.media_slug = vm.media_slug
                WHERE vm.voyage_slug = %s AND m.media_type = 'video'
            ) as has_videos
        """, (voyage_slug,))
        has_videos = cur.fetchone()['has_videos']

        # Update the voyage flags
        cur.execute("""
            UPDATE sequoia.voyages
            SET has_photos = %s, has_videos = %s
            WHERE voyage_slug = %s
        """, (has_photos, has_videos, voyage_slug))

        conn.commit()
        cur.close()
        conn.close()

        print(f"  ✓ Updated voyage flags: has_photos={has_photos}, has_videos={has_videos}")

    except Exception as e:
        print(f"  Warning: Failed to update voyage flags: {e}")

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

def process_drive_url(url: str, voyage_slug: str, president_slug: str, media_category: str, dry_run: bool = False) -> int:
    """
    Process a single Google Drive URL (file or folder).
    Returns count of files processed.
    """
    processed_count = 0

    # Check if it's a folder
    folder_id = parse_drive_folder_id(url)
    if folder_id:
        print(f"  Processing folder: {url}")

        try:
            files = list_files_in_folder(folder_id)
            print(f"    Found {len(files)} files in folder")

            for file_info in files:
                result = process_drive_file(
                    file_id=file_info['id'],
                    filename=file_info['name'],
                    voyage_slug=voyage_slug,
                    president_slug=president_slug,
                    media_category=media_category,
                    dry_run=dry_run
                )
                if result:
                    processed_count += 1

        except Exception as e:
            print(f"  ✗ Error listing folder: {e}")

    else:
        # It's a file
        file_id = _parse_drive_file_id(url)
        if not file_id:
            print(f"  ⚠ Could not parse file ID from URL: {url}")
            return 0

        print(f"  Processing file: {url}")

        # Get filename from Drive
        try:
            service = _drive_service()
            meta = service.files().get(fileId=file_id, fields="id,name,mimeType").execute()
            filename = meta.get("name", "file")

            result = process_drive_file(
                file_id=file_id,
                filename=filename,
                voyage_slug=voyage_slug,
                president_slug=president_slug,
                media_category=media_category,
                dry_run=dry_run
            )
            if result:
                processed_count += 1

        except Exception as e:
            print(f"  ✗ Error processing file: {e}")

    return processed_count

def process_voyages(voyage_slug: Optional[str] = None, dry_run: bool = False):
    """Process all voyages (or a specific one) to extract Drive files"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Query for voyages with Google Drive links
    if voyage_slug:
        query = """
            SELECT voyage_slug, source_urls, additional_sources, president_slug_from_voyage
            FROM sequoia.voyages
            WHERE voyage_slug = %s
        """
        cur.execute(query, (voyage_slug,))
    else:
        query = """
            SELECT voyage_slug, source_urls, additional_sources, president_slug_from_voyage
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

    total_processed = 0

    for voyage in voyages:
        slug = voyage['voyage_slug']
        president_slug = voyage['president_slug_from_voyage']

        if not president_slug:
            print(f"\n[{slug}]")
            print(f"  ⚠ Skipping: No president assigned to voyage")
            continue

        print(f"\n[{slug}] (President: {president_slug})")

        # Collect Drive URLs from source_urls (category: 'source')
        source_urls = []
        if voyage['source_urls']:
            sources = voyage['source_urls']
            for source in sources:
                if isinstance(source, str):
                    url = source
                elif isinstance(source, dict):
                    url = source.get('url', '')
                else:
                    continue

                if 'drive.google.com' in url:
                    source_urls.append(url)

        # Collect Drive URLs from additional_sources (category: 'additional_source')
        additional_urls = []
        if voyage['additional_sources']:
            urls = extract_drive_urls_from_text(voyage['additional_sources'])
            additional_urls = urls

        if not source_urls and not additional_urls:
            print("  No Drive URLs found")
            continue

        # Process source URLs
        if source_urls:
            print(f"\n  Processing {len(source_urls)} Drive URL(s) from SOURCES:")
            for url in source_urls:
                count = process_drive_url(url, slug, president_slug, 'source', dry_run)
                total_processed += count

        # Process additional source URLs
        if additional_urls:
            print(f"\n  Processing {len(additional_urls)} Drive URL(s) from ADDITIONAL SOURCES:")
            for url in additional_urls:
                count = process_drive_url(url, slug, president_slug, 'additional_source', dry_run)
                total_processed += count

        # Update voyage flags
        if not dry_run and total_processed > 0:
            update_voyage_media_flags(slug)

    print("\n" + "=" * 80)
    print(f"SUMMARY: Processed {total_processed} files total")
    if dry_run:
        print("[DRY RUN MODE - No changes made to database]")
    print()

    conn.close()

def main():
    parser = argparse.ArgumentParser(
        description='Process Google Drive links in voyage sources'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Parse and validate but don\'t upload or modify database')
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
