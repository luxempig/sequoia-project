#!/usr/bin/env python3
"""
Process Dropbox links in voyage source_urls and additional_sources.
Downloads files, uploads to S3, creates media records, and links to voyages.

Usage:
    python process_dropbox_links.py [--dry-run] [--voyage-slug SLUG]
"""

import os
import sys
import re
import json
import argparse
import uuid
import io
import mimetypes
from typing import Optional, Dict, List, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from PIL import Image
from dotenv import load_dotenv
import dropbox
from dropbox.exceptions import ApiError
from dropbox.files import FileMetadata, FolderMetadata

# Load .env file from backend directory
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, '.env')
load_dotenv(env_path)

# Add parent directory to path to import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import the existing DB connection function
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
    """Get database connection"""
    return get_voyage_db_connection()

def get_dropbox_client():
    """Initialize Dropbox client with access token from environment"""
    access_token = os.environ.get('DROPBOX_ACCESS_TOKEN')
    if not access_token:
        raise ValueError("DROPBOX_ACCESS_TOKEN not set in environment")
    return dropbox.Dropbox(access_token)

def parse_dropbox_url(url: str) -> Optional[Tuple[str, str]]:
    """
    Parse Dropbox URL and return (type, identifier).

    Returns:
        ('shared_file', url) for shared file links
        ('shared_folder', url) for shared folder links
        ('path', path) for direct paths
        None if not a valid Dropbox URL

    Examples:
        https://www.dropbox.com/s/abc123/file.pdf?dl=0 -> ('shared_file', url)
        https://www.dropbox.com/sh/abc123/folder?dl=0 -> ('shared_folder', url)
        https://www.dropbox.com/scl/fi/abc123/file.pdf?rlkey=xyz&dl=0 -> ('shared_file', url)
    """
    if not url or 'dropbox.com' not in url:
        return None

    # Shared file link (old style)
    if '/s/' in url:
        return ('shared_file', url)

    # Shared folder link
    if '/sh/' in url:
        return ('shared_folder', url)

    # New shared link format (scl/fi or scl/fo)
    if '/scl/fi/' in url:
        return ('shared_file', url)
    if '/scl/fo/' in url:
        return ('shared_folder', url)

    # Direct path (less common in public URLs)
    match = re.search(r'dropbox\.com/home/(.+)', url)
    if match:
        return ('path', '/' + match.group(1))

    # Try to extract any path-like structure
    match = re.search(r'dropbox\.com/(.+?)(\?|$)', url)
    if match:
        path_part = match.group(1)
        if path_part.startswith('s/') or path_part.startswith('sh/'):
            # Already handled above
            return None
        return ('path', '/' + path_part)

    return None

def download_dropbox_file(dbx, path: str) -> Tuple[bytes, str, str]:
    """
    Download file from Dropbox using direct path.

    Args:
        dbx: Dropbox client
        path: Dropbox path (e.g., '/folder/file.pdf')

    Returns:
        (file_content, mime_type, filename)
    """
    try:
        metadata, response = dbx.files_download(path)
        file_content = response.content
        filename = metadata.name

        # Dropbox doesn't provide MIME type, infer from extension
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        return file_content, mime_type, filename
    except ApiError as e:
        raise Exception(f"Failed to download {path}: {e}")

def download_dropbox_shared_file(dbx, url: str) -> Tuple[bytes, str, str]:
    """
    Download file from Dropbox shared link.

    Args:
        dbx: Dropbox client
        url: Shared link URL

    Returns:
        (file_content, mime_type, filename)
    """
    try:
        # Ensure URL has dl=0 or dl=1 parameter
        if '?' not in url:
            url += '?dl=0'

        metadata, response = dbx.sharing_get_shared_link_file(url=url)
        file_content = response.content
        filename = metadata.name
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        return file_content, mime_type, filename
    except ApiError as e:
        raise Exception(f"Failed to download shared link: {e}")

def list_dropbox_folder(dbx, folder_path: str) -> List[Dict]:
    """
    List all files in Dropbox folder using direct path.

    Args:
        dbx: Dropbox client
        folder_path: Dropbox folder path (e.g., '/folder')

    Returns:
        List of {'path': str, 'name': str, 'is_folder': bool, 'size': int}
    """
    files = []

    try:
        result = dbx.files_list_folder(folder_path)

        while True:
            for entry in result.entries:
                if isinstance(entry, FileMetadata):
                    files.append({
                        'path': entry.path_display,
                        'name': entry.name,
                        'is_folder': False,
                        'size': entry.size
                    })
                elif isinstance(entry, FolderMetadata):
                    files.append({
                        'path': entry.path_display,
                        'name': entry.name,
                        'is_folder': True,
                        'size': 0
                    })

            if not result.has_more:
                break
            result = dbx.files_list_folder_continue(result.cursor)

        return files
    except ApiError as e:
        print(f"  Error listing folder {folder_path}: {e}")
        return []

def list_dropbox_shared_folder(dbx, url: str) -> List[Dict]:
    """
    List all files in Dropbox shared folder.

    Args:
        dbx: Dropbox client
        url: Shared folder URL

    Returns:
        List of {'url': str, 'name': str, 'is_folder': bool, 'path': str}
    """
    files = []

    try:
        # Ensure URL has proper format
        if '?' not in url:
            url += '?dl=0'

        # Get shared folder metadata and list contents
        result = dbx.sharing_list_folder(shared_link=url, path='')

        while True:
            for entry in result.entries:
                if isinstance(entry, FileMetadata):
                    files.append({
                        'shared_link': url,
                        'path': entry.path_display,
                        'name': entry.name,
                        'is_folder': False,
                        'size': entry.size
                    })
                elif isinstance(entry, FolderMetadata):
                    # Recursively handle subfolders if needed
                    files.append({
                        'shared_link': url,
                        'path': entry.path_display,
                        'name': entry.name,
                        'is_folder': True,
                        'size': 0
                    })

            if not result.has_more:
                break
            result = dbx.sharing_list_folder_continue(result.cursor)

        return files
    except ApiError as e:
        print(f"  Error listing shared folder: {e}")
        return []

def download_file_from_shared_folder(dbx, shared_link: str, file_path: str, filename: str) -> Tuple[bytes, str, str]:
    """
    Download a specific file from a shared folder.

    Args:
        dbx: Dropbox client
        shared_link: Shared folder URL
        file_path: Path to file within the shared folder
        filename: Name of the file

    Returns:
        (file_content, mime_type, filename)
    """
    try:
        metadata, response = dbx.sharing_get_shared_link_file(
            url=shared_link,
            path=file_path
        )
        file_content = response.content
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'

        return file_content, mime_type, filename
    except ApiError as e:
        raise Exception(f"Failed to download file from shared folder: {e}")

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

def generate_media_slug(filename: str) -> str:
    """Generate a unique media slug"""
    base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
    # Clean the filename for slug use
    slug_base = re.sub(r'[^a-z0-9-]', '-', base_name.lower())
    slug_base = re.sub(r'-+', '-', slug_base).strip('-')[:50]
    # Add short UUID to ensure uniqueness
    unique_suffix = str(uuid.uuid4())[:8]
    return f"{slug_base}-{unique_suffix}" if slug_base else f"media-{unique_suffix}"

def process_dropbox_file(
    dbx,
    file_info: Dict,
    voyage_slug: str,
    president_slug: str,
    media_category: str,
    dry_run: bool = False
) -> Optional[Dict]:
    """
    Download file from Dropbox, upload to S3, create media record, and link to voyage.

    Args:
        dbx: Dropbox client
        file_info: Dict with 'name', and either 'path', 'shared_link', or 'url'
        voyage_slug: Voyage to link media to
        president_slug: President for S3 path organization
        media_category: Category for voyage_media link
        dry_run: If True, don't upload or modify database

    Returns:
        Created media record dict or None if failed
    """
    try:
        filename = file_info['name']
        print(f"    - {filename}")

        # Parse metadata from filename
        date, credit = parse_filename_metadata(filename)

        # Download file from Dropbox
        if 'url' in file_info:
            # Shared file link
            file_content, mime_type, original_name = download_dropbox_shared_file(dbx, file_info['url'])
            dropbox_url = file_info['url']
        elif 'shared_link' in file_info and 'path' in file_info:
            # File in shared folder
            file_content, mime_type, original_name = download_file_from_shared_folder(
                dbx, file_info['shared_link'], file_info['path'], filename
            )
            dropbox_url = file_info['shared_link']
        elif 'path' in file_info:
            # Direct path
            file_content, mime_type, original_name = download_dropbox_file(dbx, file_info['path'])
            dropbox_url = f"https://www.dropbox.com/home{file_info['path']}"
        else:
            print(f"      ✗ No valid identifier in file_info")
            return None

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
        media_slug = generate_media_slug(filename)

        # Create media record
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            INSERT INTO sequoia.media (
                media_slug, title, media_type, s3_url, public_derivative_url,
                credit, date, google_drive_link,
                created_at, updated_at
            ) VALUES (
                %(media_slug)s, %(title)s, %(media_type)s, %(s3_url)s, %(thumbnail_url)s,
                %(credit)s, %(date)s, %(dropbox_url)s,
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
            'dropbox_url': dropbox_url  # Store in google_drive_link field for now
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
        import traceback
        traceback.print_exc()
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

def extract_dropbox_urls_from_text(text: str) -> List[str]:
    """Extract all Dropbox URLs from text"""
    pattern = r'https://(?:www\.)?dropbox\.com/[^\s\)\]>"]+'
    urls = re.findall(pattern, text)
    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)
    return unique_urls

def process_dropbox_url(dbx, url: str, voyage_slug: str, president_slug: str, media_category: str, dry_run: bool = False) -> int:
    """
    Process a single Dropbox URL (file or folder).
    Returns count of files processed.
    """
    processed_count = 0

    parsed = parse_dropbox_url(url)
    if not parsed:
        print(f"  ⚠ Could not parse Dropbox URL: {url}")
        return 0

    url_type, identifier = parsed

    if url_type == 'shared_folder':
        print(f"  Processing shared folder: {url}")

        try:
            files = list_dropbox_shared_folder(dbx, identifier)
            print(f"    Found {len(files)} items in folder")

            for file_info in files:
                if file_info['is_folder']:
                    print(f"    Skipping subfolder: {file_info['name']}")
                    continue

                result = process_dropbox_file(
                    dbx=dbx,
                    file_info=file_info,
                    voyage_slug=voyage_slug,
                    president_slug=president_slug,
                    media_category=media_category,
                    dry_run=dry_run
                )
                if result:
                    processed_count += 1

        except Exception as e:
            print(f"  ✗ Error processing shared folder: {e}")

    elif url_type == 'path':
        # Direct path - could be file or folder
        print(f"  Processing path: {identifier}")

        try:
            # Try to list as folder first
            files = list_dropbox_folder(dbx, identifier)
            if files:
                print(f"    Found {len(files)} items in folder")
                for file_info in files:
                    if file_info['is_folder']:
                        print(f"    Skipping subfolder: {file_info['name']}")
                        continue

                    result = process_dropbox_file(
                        dbx=dbx,
                        file_info=file_info,
                        voyage_slug=voyage_slug,
                        president_slug=president_slug,
                        media_category=media_category,
                        dry_run=dry_run
                    )
                    if result:
                        processed_count += 1
            else:
                # It's a file
                filename = identifier.split('/')[-1]
                result = process_dropbox_file(
                    dbx=dbx,
                    file_info={'path': identifier, 'name': filename},
                    voyage_slug=voyage_slug,
                    president_slug=president_slug,
                    media_category=media_category,
                    dry_run=dry_run
                )
                if result:
                    processed_count += 1

        except Exception as e:
            print(f"  ✗ Error processing path: {e}")

    elif url_type == 'shared_file':
        # Shared file link
        print(f"  Processing shared file: {url}")

        try:
            # Get filename from metadata
            metadata, _ = dbx.sharing_get_shared_link_file(url=identifier)
            filename = metadata.name

            result = process_dropbox_file(
                dbx=dbx,
                file_info={'url': identifier, 'name': filename},
                voyage_slug=voyage_slug,
                president_slug=president_slug,
                media_category=media_category,
                dry_run=dry_run
            )
            if result:
                processed_count += 1

        except Exception as e:
            print(f"  ✗ Error processing shared file: {e}")

    return processed_count

def process_voyages(dbx, voyage_slug: Optional[str] = None, dry_run: bool = False):
    """Process all voyages (or a specific one) to extract Dropbox files"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Query for voyages with Dropbox links
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
            WHERE source_urls::text LIKE '%dropbox.com%'
               OR additional_sources LIKE '%dropbox.com%'
            ORDER BY start_date
        """
        cur.execute(query)

    voyages = cur.fetchall()
    cur.close()

    print(f"\nFound {len(voyages)} voyages with Dropbox links\n")
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

        # Collect Dropbox URLs from source_urls (category: 'source')
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

                if 'dropbox.com' in url:
                    source_urls.append(url)

        # Collect Dropbox URLs from additional_sources (category: 'additional_source')
        additional_urls = []
        if voyage['additional_sources']:
            urls = extract_dropbox_urls_from_text(voyage['additional_sources'])
            additional_urls = urls

        if not source_urls and not additional_urls:
            print("  No Dropbox URLs found")
            continue

        # Process source URLs
        if source_urls:
            print(f"\n  Processing {len(source_urls)} Dropbox URL(s) from SOURCES:")
            for url in source_urls:
                count = process_dropbox_url(dbx, url, slug, president_slug, 'source', dry_run)
                total_processed += count

        # Process additional source URLs
        if additional_urls:
            print(f"\n  Processing {len(additional_urls)} Dropbox URL(s) from ADDITIONAL SOURCES:")
            for url in additional_urls:
                count = process_dropbox_url(dbx, url, slug, president_slug, 'additional_source', dry_run)
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
        description='Process Dropbox links in voyage sources'
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Parse and validate but don\'t upload or modify database')
    parser.add_argument('--voyage-slug', type=str,
                        help='Process only a specific voyage')

    args = parser.parse_args()

    # Check for required environment variables
    if not os.getenv('DROPBOX_ACCESS_TOKEN'):
        print("Error: DROPBOX_ACCESS_TOKEN not set in environment")
        print("\nTo get a Dropbox access token:")
        print("1. Go to https://www.dropbox.com/developers/apps")
        print("2. Create an app with 'Full Dropbox' access")
        print("3. Generate an access token in the app settings")
        print("4. Add to .env: DROPBOX_ACCESS_TOKEN=your_token_here")
        sys.exit(1)

    try:
        dbx = get_dropbox_client()
        print("✓ Connected to Dropbox")
    except Exception as e:
        print(f"Error connecting to Dropbox: {e}")
        sys.exit(1)

    process_voyages(dbx, voyage_slug=args.voyage_slug, dry_run=args.dry_run)

if __name__ == '__main__':
    main()
