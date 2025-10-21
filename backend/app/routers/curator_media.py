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
    media_type: Optional[str] = Field(None, description="image, video, pdf, document, etc.")
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
            # Check if media exists
            cur.execute(
                "SELECT media_slug FROM sequoia.media WHERE media_slug = %s",
                (media_slug,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Media '{media_slug}' not found")

            # Build dynamic UPDATE query for only provided fields
            update_data = {k: v for k, v in updates.model_dump(exclude_unset=True).items() if v is not None or k in updates.model_fields_set}

            if not update_data:
                raise HTTPException(status_code=400, detail="No fields to update")

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

            # Delete voyage associations first
            cur.execute("DELETE FROM sequoia.voyage_media WHERE media_slug = %s", (media_slug,))
            voyages_deleted = cur.rowcount

            # Delete the media record
            cur.execute("DELETE FROM sequoia.media WHERE media_slug = %s", (media_slug,))

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
                INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, sort_order, notes)
                VALUES (%(voyage_slug)s, %(media_slug)s, %(sort_order)s, %(notes)s)
                ON CONFLICT (voyage_slug, media_slug)
                DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    notes = EXCLUDED.notes
            """, link.model_dump())

            LOG.info(f"Linked media {link.media_slug} to voyage {link.voyage_slug}")

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


@router.post("/upload")
async def upload_media_file(
    file: UploadFile = File(...),
    media_slug: str = Form(...),
    voyage_slug: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    media_type: Optional[str] = Form(None),
    credit: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    bucket: str = Form("sequoia-canonical")
) -> Dict[str, Any]:
    """
    Upload a file to S3 and create a media record

    This handles the full flow:
    1. Upload file to S3
    2. Create media record in database
    3. Optionally link to a voyage
    """
    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        # Determine S3 key with proper hierarchy: media/{owner}/{voyage}/{filename}
        if voyage_slug:
            # Extract owner from voyage_slug (e.g., "roosevelt-franklin-1938-01" -> "roosevelt-franklin")
            # Voyage slugs are formatted as: {lastname}-{firstname}-{year}-{month}
            parts = voyage_slug.split('-')
            if len(parts) >= 2:
                owner = f"{parts[0]}-{parts[1]}"  # e.g., "roosevelt-franklin"
            else:
                owner = parts[0]  # fallback

            s3_key = f"media/{owner}/{voyage_slug}/{file.filename}"
        else:
            s3_key = f"media/{media_slug}/{file.filename}"

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
            if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
                media_type = 'image'
            elif ext in ['mp4', 'mov', 'avi', 'webm']:
                media_type = 'video'
            elif ext == 'pdf':
                media_type = 'pdf'
            else:
                media_type = 'document'

        # Generate thumbnail if voyage_slug is provided
        thumbnail_url = None
        if voyage_slug and media_type in ('image', 'pdf'):
            thumbnail_url = generate_and_upload_thumbnail(
                file_content=file_content,
                media_type=media_type,
                voyage_slug=voyage_slug,
                media_slug=media_slug
            )

        # Create media record
        with db_cursor() as cur:
            cur.execute("""
                INSERT INTO sequoia.media (
                    media_slug, title, media_type, s3_url, public_derivative_url,
                    credit, description_markdown,
                    created_at, updated_at
                ) VALUES (
                    %(media_slug)s, %(title)s, %(media_type)s, %(s3_url)s, %(thumbnail_url)s,
                    %(credit)s, %(description)s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (media_slug)
                DO UPDATE SET
                    title = EXCLUDED.title,
                    s3_url = EXCLUDED.s3_url,
                    public_derivative_url = EXCLUDED.public_derivative_url,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, {
                'media_slug': media_slug,
                'title': title or file.filename,
                'media_type': media_type,
                's3_url': s3_url,
                'thumbnail_url': thumbnail_url,
                'credit': credit,
                'description': description
            })

            media_record = dict(cur.fetchone())

            # Link to voyage if provided
            if voyage_slug:
                cur.execute("""
                    INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, sort_order)
                    VALUES (%s, %s, 999)
                    ON CONFLICT (voyage_slug, media_slug) DO NOTHING
                """, (voyage_slug, media_slug))

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
    limit: int = 50
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


def generate_and_upload_thumbnail(file_content: bytes, media_type: str, voyage_slug: str, media_slug: str) -> Optional[str]:
    """Generate thumbnail and upload to sequoia-public bucket."""
    try:
        # Generate thumbnail based on media type
        thumb_bytes = None

        if media_type == 'image':
            thumb_bytes = make_image_thumbnail(file_content)
        elif media_type == 'pdf':
            thumb_bytes = make_pdf_thumbnail(file_content)
        else:
            LOG.info(f"Thumbnail generation not supported for media_type: {media_type}")
            return None

        if not thumb_bytes:
            LOG.warning(f"Failed to generate thumbnail for {media_slug}")
            return None

        # Upload thumbnail to public bucket
        public_bucket = os.environ.get("S3_PUBLIC_BUCKET", "sequoia-public")
        thumb_key = f"thumbnails/{voyage_slug}/{media_slug}.jpg"

        s3_client = boto3.client('s3')
        s3_client.put_object(
            Bucket=public_bucket,
            Key=thumb_key,
            Body=thumb_bytes,
            ContentType='image/jpeg',
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
            ContentType=content_type
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
