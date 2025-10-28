"""
CRUD endpoints for curator interface - Media
Direct database manipulation without JSON intermediary
Includes S3 upload support
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel, Field
from app.db import db_cursor
import logging
import boto3
import os
import io
from datetime import datetime
from PIL import Image

# Try to import PyMuPDF for PDF thumbnails
try:
    import fitz
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

LOG = logging.getLogger("app.routers.curator_media")

router = APIRouter(prefix="/api/curator/media", tags=["curator-media"])


class MediaCreate(BaseModel):
    """Schema for creating a new media item"""
    media_slug: str = Field(..., description="Unique identifier (e.g., 'truman-1945-01-photo-001')")
    title: Optional[str] = None
    media_type: Optional[str] = Field(None, description="article, image, video, audio, book, other")
    url: Optional[str] = Field(None, description="External URL or presigned URL")
    s3_url: Optional[str] = Field(None, description="S3 canonical URL")
    public_derivative_url: Optional[str] = Field(None, description="Public thumbnail/derivative URL")
    credit: Optional[str] = None
    date: Optional[str] = None
    description_markdown: Optional[str] = None
    tags: Optional[str] = None
    google_drive_link: Optional[str] = None


class MediaUpdate(BaseModel):
    """Schema for updating an existing media item (all fields optional)"""
    title: Optional[str] = None
    media_type: Optional[str] = None
    url: Optional[str] = None
    s3_url: Optional[str] = None
    public_derivative_url: Optional[str] = None
    credit: Optional[str] = None
    date: Optional[str] = None
    description_markdown: Optional[str] = None
    tags: Optional[str] = None
    google_drive_link: Optional[str] = None


class VoyageMediaLink(BaseModel):
    """Schema for linking media to a voyage"""
    media_slug: str
    voyage_slug: str
    sort_order: Optional[int] = Field(None, description="Display order (lower numbers first)")
    notes: Optional[str] = Field(None, description="Notes specific to this media on this voyage")
    media_category: Optional[str] = Field('general', description="Category: general, source, or additional_source")


def update_voyage_media_flags(voyage_slug: str):
    """Update has_photos and has_videos flags for a voyage based on attached media"""
    try:
        with db_cursor() as cur:
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

            LOG.info(f"Updated voyage {voyage_slug}: has_photos={has_photos}, has_videos={has_videos}")

    except Exception as e:
        LOG.warning(f"Failed to update media flags for voyage {voyage_slug}: {e}")
        # Don't raise - this is a non-critical operation


@router.post("/", response_model=Dict[str, Any])
def create_media(media: MediaCreate) -> Dict[str, Any]:
    """Create a new media item"""
    try:
        with db_cursor() as cur:
            # Check if media_slug already exists
            cur.execute(
                "SELECT media_slug FROM sequoia.media WHERE media_slug = %s",
                (media.media_slug,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"Media with slug '{media.media_slug}' already exists"
                )

            # Insert the media
            cur.execute("""
                INSERT INTO sequoia.media (
                    media_slug, title, media_type, url, s3_url, public_derivative_url,
                    credit, date, description_markdown, tags, google_drive_link,
                    created_at, updated_at
                ) VALUES (
                    %(media_slug)s, %(title)s, %(media_type)s, %(url)s, %(s3_url)s, %(public_derivative_url)s,
                    %(credit)s, %(date)s, %(description_markdown)s, %(tags)s, %(google_drive_link)s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING *
            """, media.model_dump())

            row = cur.fetchone()
            LOG.info(f"Created media: {media.media_slug}")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error creating media: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.put("/{media_slug}", response_model=Dict[str, Any])
def update_media(media_slug: str, updates: MediaUpdate) -> Dict[str, Any]:
    """Update an existing media item"""
    try:
        with db_cursor() as cur:
            # Get current media record
            cur.execute(
                "SELECT * FROM sequoia.media WHERE media_slug = %s",
                (media_slug,)
            )
            current_media = cur.fetchone()
            if not current_media:
                raise HTTPException(status_code=404, detail=f"Media '{media_slug}' not found")

            # Build dynamic UPDATE query for only provided fields
            update_data = {k: v for k, v in updates.model_dump(exclude_unset=True).items() if v is not None or k in updates.model_fields_set}

            if not update_data:
                raise HTTPException(status_code=400, detail="No fields to update")

            # Check if media_type is being changed and S3 URLs exist
            if 'media_type' in update_data and current_media['media_type'] != update_data['media_type']:
                old_media_type = current_media['media_type']
                new_media_type = update_data['media_type']
                s3_url = current_media['s3_url']
                derivative_url = current_media['public_derivative_url']

                LOG.info(f"Media type changing from '{old_media_type}' to '{new_media_type}' - reorganizing S3 files")

                # Reorganize S3 files and get new URLs
                new_urls = reorganize_media_in_s3(
                    s3_url=s3_url,
                    derivative_url=derivative_url,
                    old_media_type=old_media_type,
                    new_media_type=new_media_type
                )

                # Update the URLs in update_data
                if new_urls.get('s3_url'):
                    update_data['s3_url'] = new_urls['s3_url']
                if new_urls.get('public_derivative_url'):
                    update_data['public_derivative_url'] = new_urls['public_derivative_url']

            set_clause = ", ".join([f"{k} = %({k})s" for k in update_data.keys()])
            update_data['media_slug'] = media_slug

            cur.execute(f"""
                UPDATE sequoia.media
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE media_slug = %(media_slug)s
                RETURNING *
            """, update_data)

            row = cur.fetchone()
            LOG.info(f"Updated media: {media_slug} ({len(update_data)} fields)")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error updating media: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/{media_slug}/usage")
def check_media_usage(media_slug: str) -> Dict[str, Any]:
    """Check which voyages use this media"""
    try:
        with db_cursor() as cur:
            # Get voyages using this media
            cur.execute("""
                SELECT v.voyage_slug, v.title, v.start_date, v.end_date
                FROM sequoia.voyage_media vm
                JOIN sequoia.voyages v ON v.voyage_slug = vm.voyage_slug
                WHERE vm.media_slug = %s
                ORDER BY v.start_date
            """, (media_slug,))
            voyages = cur.fetchall()

            return {
                "media_slug": media_slug,
                "usage_count": len(voyages),
                "voyages": [dict(row) for row in voyages]
            }
    except Exception as e:
        LOG.error(f"Error checking media usage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/link-to-voyage", response_model=Dict[str, str])
def link_media_to_voyage(link: VoyageMediaLink) -> Dict[str, str]:
    """Link media to a voyage"""
    try:
        with db_cursor() as cur:
            # Verify media exists
            cur.execute("SELECT media_slug FROM sequoia.media WHERE media_slug = %s", (link.media_slug,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Media '{link.media_slug}' not found")

            # Verify voyage exists
            cur.execute("SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s", (link.voyage_slug,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Voyage '{link.voyage_slug}' not found")

            # Insert or update the link
            cur.execute("""
                INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, media_category, sort_order, notes)
                VALUES (%(voyage_slug)s, %(media_slug)s, %(media_category)s, %(sort_order)s, %(notes)s)
                ON CONFLICT (voyage_slug, media_slug)
                DO UPDATE SET
                    media_category = EXCLUDED.media_category,
                    sort_order = EXCLUDED.sort_order,
                    notes = EXCLUDED.notes
            """, link.model_dump())

            LOG.info(f"Linked media {link.media_slug} to voyage {link.voyage_slug}")

        # Update has_photos and has_videos flags for the voyage
        update_voyage_media_flags(link.voyage_slug)

        return {
            "message": "Media linked to voyage successfully",
            "media_slug": link.media_slug,
            "voyage_slug": link.voyage_slug
        }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error linking media to voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/unlink-from-voyage")
def unlink_media_from_voyage(media_slug: str, voyage_slug: str) -> Dict[str, str]:
    """Remove media from a voyage"""
    try:
        with db_cursor() as cur:
            cur.execute(
                "DELETE FROM sequoia.voyage_media WHERE voyage_slug = %s AND media_slug = %s",
                (voyage_slug, media_slug)
            )

            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No link found between media '{media_slug}' and voyage '{voyage_slug}'"
                )

            LOG.info(f"Unlinked media {media_slug} from voyage {voyage_slug}")

        # Update has_photos and has_videos flags for the voyage
        update_voyage_media_flags(voyage_slug)

        return {
            "message": "Media unlinked from voyage successfully",
            "media_slug": media_slug,
            "voyage_slug": voyage_slug
        }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error unlinking media from voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{media_slug}/detach-from-all-voyages")
def detach_media_from_all_voyages(media_slug: str) -> Dict[str, Any]:
    """Remove media from all voyages but keep in database"""
    try:
        with db_cursor() as cur:
            # Check if media exists
            cur.execute("SELECT media_slug FROM sequoia.media WHERE media_slug = %s", (media_slug,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Media '{media_slug}' not found")

            # Get affected voyages before deleting links
            cur.execute(
                "SELECT DISTINCT voyage_slug FROM sequoia.voyage_media WHERE media_slug = %s",
                (media_slug,)
            )
            affected_voyages = [row['voyage_slug'] for row in cur.fetchall()]

            # Delete all voyage associations
            cur.execute("DELETE FROM sequoia.voyage_media WHERE media_slug = %s", (media_slug,))
            links_deleted = cur.rowcount

        # Update has_photos and has_videos flags for affected voyages
        for voyage_slug in affected_voyages:
            update_voyage_media_flags(voyage_slug)

        LOG.info(f"Detached media {media_slug} from {links_deleted} voyage(s)")

        return {
            "message": "Media detached from all voyages successfully",
            "media_slug": media_slug,
            "voyages_affected": len(affected_voyages),
            "links_deleted": links_deleted
        }
    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error detaching media from all voyages: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/{media_slug}")
def delete_media(media_slug: str, delete_from_s3: bool = False) -> Dict[str, Any]:
    """Delete a media item and optionally remove from S3"""
    try:
        with db_cursor() as cur:
            # Check if media exists and get S3 URL
            cur.execute(
                "SELECT media_slug, s3_url, public_derivative_url FROM sequoia.media WHERE media_slug = %s",
                (media_slug,)
            )
            media_row = cur.fetchone()
            if not media_row:
                raise HTTPException(status_code=404, detail=f"Media '{media_slug}' not found")

            s3_url = media_row['s3_url']
            derivative_url = media_row['public_derivative_url']

            # Get list of voyages that will be affected (before deleting associations)
            cur.execute("SELECT voyage_slug FROM sequoia.voyage_media WHERE media_slug = %s", (media_slug,))
            affected_voyages = [row['voyage_slug'] for row in cur.fetchall()]

            # Delete voyage associations first
            cur.execute("DELETE FROM sequoia.voyage_media WHERE media_slug = %s", (media_slug,))
            voyages_deleted = cur.rowcount

            # Delete the media record
            cur.execute("DELETE FROM sequoia.media WHERE media_slug = %s", (media_slug,))

        # Update has_photos and has_videos flags for affected voyages
        for voyage_slug in affected_voyages:
            update_voyage_media_flags(voyage_slug)

        # Optionally delete from S3
        s3_deleted = False
        derivative_deleted = False
        if delete_from_s3:
            if s3_url:
                try:
                    s3_deleted = delete_from_s3_bucket(s3_url)
                except Exception as s3_error:
                    LOG.warning(f"Failed to delete from S3: {s3_error}")

            if derivative_url:
                try:
                    derivative_deleted = delete_from_s3_bucket(derivative_url)
                except Exception as s3_error:
                    LOG.warning(f"Failed to delete derivative from S3: {s3_error}")

        LOG.info(f"Deleted media: {media_slug} (removed from {voyages_deleted} voyages, S3 deleted: {s3_deleted})")

        return {
            "message": f"Media '{media_slug}' deleted successfully",
            "media_slug": media_slug,
            "voyages_removed_from": voyages_deleted,
            "s3_deleted": s3_deleted,
            "derivative_deleted": derivative_deleted
        }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error deleting media: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/upload")
async def upload_media_file(
    file: UploadFile = File(...),
    media_slug: str = Form(...),
    voyage_slug: Optional[str] = Form(None),
    president_slug: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    media_type: Optional[str] = Form(None),
    credit: Optional[str] = Form(None),
    date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    media_category: Optional[str] = Form('general'),
    bucket: str = Form("sequoia-canonical")
) -> Dict[str, Any]:
    """
    Upload a file to S3 and create a media record

    This handles the full flow:
    1. Upload file to S3 with formatted filename
    2. Create media record in database
    3. Optionally link to a voyage
    """
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        import re
        import uuid

        # Get file extension
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'

        # Generate unique ID for filename
        unique_id = str(uuid.uuid4())[:8]

        # Get president name for S3 path - REQUIRED
        president_owner = None

        # Option 1: president_slug provided directly
        if president_slug:
            with db_cursor(read_only=True) as cur:
                cur.execute("SELECT full_name FROM sequoia.people WHERE person_slug = %s", (president_slug,))
                pres_row = cur.fetchone()
                if pres_row and pres_row['full_name']:
                    president_name = pres_row['full_name']
                    president_owner = re.sub(r'[^a-z0-9-]', '-', president_name.lower())
                    president_owner = re.sub(r'-+', '-', president_owner).strip('-')

        # Option 2: Get from voyage if provided
        elif voyage_slug:
            with db_cursor(read_only=True) as cur:
                cur.execute("""
                    SELECT president_slug_from_voyage
                    FROM sequoia.voyages
                    WHERE voyage_slug = %s
                """, (voyage_slug,))
                voyage_row = cur.fetchone()
                if voyage_row and voyage_row['president_slug_from_voyage']:
                    president_owner = voyage_row['president_slug_from_voyage']
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Voyage '{voyage_slug}' does not have a president assigned"
                    )

        # Require president for S3 path
        if not president_owner:
            raise HTTPException(
                status_code=400,
                detail="President is required. Provide either president_slug or voyage_slug."
            )

        # Build directory path: president/media-type/
        directory_parts = [president_owner, media_type or 'other']
        directory_path = '/'.join(directory_parts)

        # Build filename: date_description-slug_unique-id.ext
        # Build filename: credit_date_title (spaces replaced with dashes, fields separated by underscores)
        filename_parts = []

        # Add credit (spaces replaced with dashes)
        if credit:
            credit_slug = re.sub(r'[^a-z0-9\s-]', '', credit.lower())
            credit_slug = re.sub(r'\s+', '-', credit_slug.strip())
            credit_slug = re.sub(r'-+', '-', credit_slug).strip('-')
            if credit_slug:
                filename_parts.append(credit_slug)

        # Add date
        if date:
            filename_parts.append(date.replace('/', '-'))

        # Add title (spaces replaced with dashes)
        if title:
            title_slug = re.sub(r'[^a-z0-9\s-]', '', title.lower())
            title_slug = re.sub(r'\s+', '-', title_slug.strip())
            title_slug = re.sub(r'-+', '-', title_slug).strip('-')
            if title_slug:
                filename_parts.append(title_slug)

        # Build filename (fields separated by underscores)
        formatted_filename = '_'.join(filename_parts) + f'.{file_ext}'

        # Determine S3 key with proper hierarchy
        s3_key = f"{directory_path}/{formatted_filename}"

        # Upload to S3
        s3_url = upload_to_s3(
            file_content=file_content,
            bucket=bucket,
            key=s3_key,
            content_type=file.content_type or "application/octet-stream"
        )

        # Infer media_type from file extension if not provided
        if not media_type:
            ext = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
            if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff']:
                media_type = 'image'
            elif ext in ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv']:
                media_type = 'video'
            elif ext in ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']:
                media_type = 'audio'
            elif ext in ['pdf', 'doc', 'docx', 'txt', 'rtf']:
                media_type = 'article'
            elif ext in ['epub', 'mobi', 'azw', 'azw3']:
                media_type = 'book'
            else:
                media_type = 'other'

        # Generate unique media_slug if 'auto'
        if media_slug == 'auto':
            import uuid
            import re
            # Create slug from filename or use UUID
            base_name = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename
            # Clean the filename for slug use
            slug_base = re.sub(r'[^a-z0-9-]', '-', base_name.lower())
            slug_base = re.sub(r'-+', '-', slug_base).strip('-')[:50]
            # Add short UUID to ensure uniqueness
            unique_suffix = str(uuid.uuid4())[:8]
            media_slug = f"{slug_base}-{unique_suffix}" if slug_base else f"media-{unique_suffix}"

        # Generate thumbnail for images and articles (both attached and unattached media)
        thumbnail_url = None
        if media_type in ('image', 'article', 'book', 'document', 'logbook'):
            # Generate thumbnail filename (add -thumb before extension)
            thumb_filename = formatted_filename.rsplit('.', 1)[0] + '-thumb.jpg'
            thumbnail_url = generate_and_upload_thumbnail(
                file_content=file_content,
                media_type=media_type,
                directory_path=directory_path,
                thumb_filename=thumb_filename
            )

        # Create media record
        with db_cursor() as cur:
            cur.execute("""
                INSERT INTO sequoia.media (
                    media_slug, title, media_type, s3_url, public_derivative_url,
                    credit, date, description_markdown,
                    created_at, updated_at
                ) VALUES (
                    %(media_slug)s, %(title)s, %(media_type)s, %(s3_url)s, %(thumbnail_url)s,
                    %(credit)s, %(date)s, %(description)s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (media_slug)
                DO UPDATE SET
                    title = EXCLUDED.title,
                    s3_url = EXCLUDED.s3_url,
                    public_derivative_url = EXCLUDED.public_derivative_url,
                    date = EXCLUDED.date,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, {
                'media_slug': media_slug,
                'title': title or file.filename,
                'media_type': media_type,
                's3_url': s3_url,
                'thumbnail_url': thumbnail_url,
                'credit': credit,
                'date': date,
                'description': description
            })

            media_record = dict(cur.fetchone())

            # Link to voyage if provided
            if voyage_slug:
                cur.execute("""
                    INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, sort_order, media_category)
                    VALUES (%s, %s, 999, %s)
                    ON CONFLICT (voyage_slug, media_slug) DO NOTHING
                """, (voyage_slug, media_slug, media_category))

        # Update has_photos and has_videos flags if linked to voyage
        if voyage_slug:
            update_voyage_media_flags(voyage_slug)

        LOG.info(f"Uploaded media: {media_slug} ({file_size} bytes) to {s3_url}")

        return {
            **media_record,
            "upload_info": {
                "filename": file.filename,
                "size_bytes": file_size,
                "s3_bucket": bucket,
                "s3_key": s3_key
            }
        }

    except Exception as e:
        LOG.error(f"Error uploading media: {e}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


@router.get("/search", response_model=List[Dict[str, Any]])
def search_media(
    q: Optional[str] = None,
    media_type: Optional[str] = None,
    limit: int = 2000
) -> List[Dict[str, Any]]:
    """Search for media (useful for autocomplete in forms)"""
    try:
        with db_cursor(read_only=True) as cur:
            conditions = []
            params = []

            if q:
                conditions.append("(title ILIKE %s OR media_slug ILIKE %s OR description_markdown ILIKE %s)")
                params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])

            if media_type:
                conditions.append("media_type = %s")
                params.append(media_type)

            where_clause = " AND ".join(conditions) if conditions else "TRUE"
            params.append(limit)

            cur.execute(f"""
                SELECT * FROM sequoia.media
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT %s
            """, params)

            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        LOG.error(f"Error searching media: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# Helper functions for S3 operations and thumbnail generation

def make_image_thumbnail(img_bytes: bytes, thumb_size=320) -> Optional[bytes]:
    """Create a thumbnail from an image."""
    try:
        with Image.open(io.BytesIO(img_bytes)) as im:
            im = im.convert("RGB")
            im.thumbnail((thumb_size, thumb_size), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=85, optimize=True)
            return buf.getvalue()
    except Exception as e:
        LOG.warning(f"Failed to create image thumbnail: {e}")
        return None


def make_pdf_thumbnail(pdf_bytes: bytes, thumb_size=320) -> Optional[bytes]:
    """Create a thumbnail from the first page of a PDF."""
    if not HAS_PYMUPDF:
        return None

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            return None

        # Get first page
        page = doc[0]

        # Render as image (at 150 DPI for good quality)
        mat = fitz.Matrix(150/72, 150/72)
        pix = page.get_pixmap(matrix=mat)
        img_data = pix.tobytes("ppm")
        doc.close()

        # Convert to PIL Image and create thumbnail
        img = Image.open(io.BytesIO(img_data))
        img.thumbnail((thumb_size, thumb_size), Image.LANCZOS)

        # Convert to JPEG
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()

    except Exception as e:
        LOG.warning(f"Failed to create PDF thumbnail: {e}")
        return None


def generate_and_upload_thumbnail(file_content: bytes, media_type: str, directory_path: str, thumb_filename: str) -> Optional[str]:
    """Generate thumbnail and upload to sequoia-public bucket with matching directory structure."""
    try:
        # Generate thumbnail based on media type
        thumb_bytes = None

        if media_type == 'image':
            thumb_bytes = make_image_thumbnail(file_content)
        elif media_type in ('article', 'book', 'document', 'logbook', 'pdf'):  # pdf for legacy support
            # Try image thumbnail first (for scanned documents as images)
            thumb_bytes = make_image_thumbnail(file_content)
            if not thumb_bytes:
                # Fall back to PDF thumbnail generation
                thumb_bytes = make_pdf_thumbnail(file_content)
        else:
            LOG.info(f"Thumbnail generation not supported for media_type: {media_type}")
            return None

        if not thumb_bytes:
            LOG.warning(f"Failed to generate thumbnail")
            return None

        # Upload thumbnail to public bucket using same directory structure
        public_bucket = os.environ.get("S3_PUBLIC_BUCKET", "sequoia-public")
        thumb_key = f"{directory_path}/{thumb_filename}"

        s3_client = boto3.client('s3')
        s3_client.put_object(
            Bucket=public_bucket,
            Key=thumb_key,
            Body=thumb_bytes,
            ContentType='image/jpeg',
            ContentDisposition='inline',
            CacheControl='public, max-age=31536000'  # Cache for 1 year
        )

        thumbnail_url = f"https://{public_bucket}.s3.amazonaws.com/{thumb_key}"
        LOG.info(f"Generated thumbnail: {thumbnail_url}")
        return thumbnail_url

    except Exception as e:
        LOG.error(f"Error generating/uploading thumbnail: {e}")
        return None


def upload_to_s3(file_content: bytes, bucket: str, key: str, content_type: str) -> str:
    """Upload file to S3 and return the S3 URL"""
    try:
        s3_client = boto3.client('s3')

        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_content,
            ContentType=content_type,
            ContentDisposition='inline'
        )

        s3_url = f"https://{bucket}.s3.amazonaws.com/{key}"
        LOG.info(f"Uploaded to S3: {s3_url}")
        return s3_url

    except Exception as e:
        LOG.error(f"S3 upload error: {e}")
        raise


def delete_from_s3_bucket(s3_url: str) -> bool:
    """Delete a file from S3 given its URL"""
    try:
        # Parse bucket and key from URL
        # Format: https://bucket-name.s3.amazonaws.com/key/path
        if not s3_url or 's3.amazonaws.com' not in s3_url:
            return False

        parts = s3_url.replace('https://', '').split('/')
        bucket = parts[0].replace('.s3.amazonaws.com', '')
        key = '/'.join(parts[1:])

        s3_client = boto3.client('s3')
        s3_client.delete_object(Bucket=bucket, Key=key)

        LOG.info(f"Deleted from S3: {s3_url}")
        return True

    except Exception as e:
        LOG.error(f"S3 delete error: {e}")
        return False


def reorganize_media_in_s3(
    s3_url: Optional[str],
    derivative_url: Optional[str],
    old_media_type: str,
    new_media_type: str
) -> Dict[str, Optional[str]]:
    """
    Reorganize media files in S3 when media_type changes.

    Moves files from old path (president/old-type/file) to new path (president/new-type/file).
    Returns dict with new URLs.
    """
    result = {'s3_url': None, 'public_derivative_url': None}

    try:
        s3_client = boto3.client('s3')

        # Reorganize main file
        if s3_url and (s3_url.startswith('s3://') or 's3.amazonaws.com' in s3_url):
            # Parse current URL
            if s3_url.startswith('s3://'):
                # Format: s3://bucket-name/president/media-type/file
                parts = s3_url.replace('s3://', '').split('/')
                bucket = parts[0]
                old_key = '/'.join(parts[1:])
            else:
                # Format: https://bucket-name.s3.amazonaws.com/president/media-type/file
                parts = s3_url.replace('https://', '').split('/')
                bucket = parts[0].replace('.s3.amazonaws.com', '')
                old_key = '/'.join(parts[1:])

            # Parse the key structure: president/media-type/filename
            key_parts = old_key.split('/')
            if len(key_parts) >= 3:
                # Replace media_type in path
                # Find which part is the media_type (should be second part)
                president = key_parts[0]
                filename = '/'.join(key_parts[2:])  # Everything after media_type

                new_key = f"{president}/{new_media_type}/{filename}"

                LOG.info(f"Copying S3 file: {old_key} -> {new_key}")

                # Copy to new location
                s3_client.copy_object(
                    Bucket=bucket,
                    CopySource={'Bucket': bucket, 'Key': old_key},
                    Key=new_key,
                    MetadataDirective='COPY'
                )

                # Delete old location
                s3_client.delete_object(Bucket=bucket, Key=old_key)

                # Return in s3:// format to match database format
                result['s3_url'] = f"s3://{bucket}/{new_key}"
                LOG.info(f"Reorganized main file to: {result['s3_url']}")

        # Reorganize thumbnail/derivative
        if derivative_url and (derivative_url.startswith('s3://') or 's3.amazonaws.com' in derivative_url):
            # Parse current URL
            if derivative_url.startswith('s3://'):
                parts = derivative_url.replace('s3://', '').split('/')
                bucket = parts[0]
                old_key = '/'.join(parts[1:])
            else:
                parts = derivative_url.replace('https://', '').split('/')
                bucket = parts[0].replace('.s3.amazonaws.com', '')
                old_key = '/'.join(parts[1:])

            # Parse the key structure: president/media-type/filename
            key_parts = old_key.split('/')
            if len(key_parts) >= 3:
                president = key_parts[0]
                filename = '/'.join(key_parts[2:])  # Everything after media_type

                new_key = f"{president}/{new_media_type}/{filename}"

                LOG.info(f"Copying derivative: {old_key} -> {new_key}")

                # Copy to new location
                s3_client.copy_object(
                    Bucket=bucket,
                    CopySource={'Bucket': bucket, 'Key': old_key},
                    Key=new_key,
                    MetadataDirective='COPY'
                )

                # Delete old location
                s3_client.delete_object(Bucket=bucket, Key=old_key)

                result['public_derivative_url'] = f"https://{bucket}.s3.amazonaws.com/{new_key}"
                LOG.info(f"Reorganized derivative to: {result['public_derivative_url']}")

        return result

    except Exception as e:
        LOG.error(f"Error reorganizing S3 files: {e}")
        # Return empty result - update will proceed without URL changes
        return {'s3_url': None, 'public_derivative_url': None}
