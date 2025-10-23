"""
Album management endpoints for curator interface.
Allows creating, editing, and deleting photo albums.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import re
from db import db_cursor

router = APIRouter(prefix="/api/curator/albums", tags=["curator-albums"])

class AlbumCreate(BaseModel):
    title: str
    description: Optional[str] = None
    voyage_slug: str
    sort_order: Optional[int] = 0

class AlbumUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None

class AlbumMediaAdd(BaseModel):
    media_slug: str
    sort_order: Optional[int] = 0

def generate_album_slug(title: str, voyage_slug: str) -> str:
    """Generate a unique slug for an album"""
    # Convert title to slug format
    slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    # Combine with voyage slug for uniqueness
    base_slug = f"{voyage_slug}-album-{slug}"

    with db_cursor(read_only=True) as cur:
        # Check if slug exists, append number if needed
        cur.execute("SELECT COUNT(*) as count FROM sequoia.albums WHERE album_slug LIKE %s", (f"{base_slug}%",))
        count = cur.fetchone()['count']

        if count == 0:
            return base_slug
        else:
            return f"{base_slug}-{count + 1}"

@router.post("")
def create_album(album: AlbumCreate) -> Dict[str, Any]:
    """Create a new photo album"""

    album_slug = generate_album_slug(album.title, album.voyage_slug)

    with db_cursor() as cur:
        # Verify voyage exists
        cur.execute("SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s", (album.voyage_slug,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Voyage '{album.voyage_slug}' not found")

        # Create album
        cur.execute("""
            INSERT INTO sequoia.albums (album_slug, title, description, voyage_slug, sort_order)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING album_id, album_slug, title, description, voyage_slug, sort_order, created_at
        """, (album_slug, album.title, album.description, album.voyage_slug, album.sort_order))

        result = cur.fetchone()

        return {
            "album_id": result['album_id'],
            "album_slug": result['album_slug'],
            "title": result['title'],
            "description": result['description'],
            "voyage_slug": result['voyage_slug'],
            "sort_order": result['sort_order'],
            "created_at": result['created_at'].isoformat() if result['created_at'] else None,
            "media_count": 0
        }

@router.get("/by-voyage/{voyage_slug}")
def get_voyage_albums(voyage_slug: str) -> List[Dict[str, Any]]:
    """Get all albums for a voyage with media counts"""

    with db_cursor(read_only=True) as cur:
        cur.execute("""
            SELECT
                a.album_id,
                a.album_slug,
                a.title,
                a.description,
                a.voyage_slug,
                a.sort_order,
                a.created_at,
                COUNT(am.media_slug) as media_count
            FROM sequoia.albums a
            LEFT JOIN sequoia.album_media am ON a.album_id = am.album_id
            WHERE a.voyage_slug = %s
            GROUP BY a.album_id, a.album_slug, a.title, a.description, a.voyage_slug, a.sort_order, a.created_at
            ORDER BY a.sort_order, a.created_at
        """, (voyage_slug,))

        albums = []
        for row in cur.fetchall():
            albums.append({
                "album_id": row['album_id'],
                "album_slug": row['album_slug'],
                "title": row['title'],
                "description": row['description'],
                "voyage_slug": row['voyage_slug'],
                "sort_order": row['sort_order'],
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                "media_count": row['media_count']
            })

        return albums

@router.get("/{album_slug}")
def get_album(album_slug: str) -> Dict[str, Any]:
    """Get album details with all media items"""

    with db_cursor(read_only=True) as cur:
        # Get album details
        cur.execute("""
            SELECT album_id, album_slug, title, description, voyage_slug, sort_order, created_at
            FROM sequoia.albums
            WHERE album_slug = %s
        """, (album_slug,))

        album = cur.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail=f"Album '{album_slug}' not found")

        # Get media items in album
        cur.execute("""
            SELECT
                m.media_slug,
                m.title,
                m.media_type,
                m.s3_url,
                m.public_derivative_url,
                m.date,
                m.credit,
                am.sort_order
            FROM sequoia.album_media am
            JOIN sequoia.media m ON am.media_slug = m.media_slug
            WHERE am.album_id = %s
            ORDER BY am.sort_order, m.title
        """, (album['album_id'],))

        media_items = []
        for row in cur.fetchall():
            media_items.append({
                "media_slug": row['media_slug'],
                "title": row['title'],
                "media_type": row['media_type'],
                "s3_url": row['s3_url'],
                "public_derivative_url": row['public_derivative_url'],
                "date": row['date'],
                "credit": row['credit'],
                "sort_order": row['sort_order']
            })

        return {
            "album_id": album['album_id'],
            "album_slug": album['album_slug'],
            "title": album['title'],
            "description": album['description'],
            "voyage_slug": album['voyage_slug'],
            "sort_order": album['sort_order'],
            "created_at": album['created_at'].isoformat() if album['created_at'] else None,
            "media": media_items,
            "media_count": len(media_items)
        }

@router.put("/{album_slug}")
def update_album(album_slug: str, update: AlbumUpdate) -> Dict[str, Any]:
    """Update album details"""

    with db_cursor() as cur:
        # Build dynamic update query
        updates = []
        params = []

        if update.title is not None:
            updates.append("title = %s")
            params.append(update.title)

        if update.description is not None:
            updates.append("description = %s")
            params.append(update.description)

        if update.sort_order is not None:
            updates.append("sort_order = %s")
            params.append(update.sort_order)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        updates.append("updated_at = NOW()")
        params.append(album_slug)

        query = f"""
            UPDATE sequoia.albums
            SET {', '.join(updates)}
            WHERE album_slug = %s
            RETURNING album_id, album_slug, title, description, voyage_slug, sort_order, updated_at
        """

        cur.execute(query, params)
        result = cur.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail=f"Album '{album_slug}' not found")

        return {
            "album_id": result['album_id'],
            "album_slug": result['album_slug'],
            "title": result['title'],
            "description": result['description'],
            "voyage_slug": result['voyage_slug'],
            "sort_order": result['sort_order'],
            "updated_at": result['updated_at'].isoformat() if result['updated_at'] else None
        }

@router.delete("/{album_slug}")
def delete_album(album_slug: str) -> Dict[str, str]:
    """Delete an album (media items are preserved)"""

    with db_cursor() as cur:
        cur.execute("DELETE FROM sequoia.albums WHERE album_slug = %s", (album_slug,))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Album '{album_slug}' not found")

        return {"message": f"Album '{album_slug}' deleted successfully"}

@router.post("/{album_slug}/media")
def add_media_to_album(album_slug: str, media_add: AlbumMediaAdd) -> Dict[str, Any]:
    """Add a media item to an album"""

    with db_cursor() as cur:
        # Get album_id
        cur.execute("SELECT album_id FROM sequoia.albums WHERE album_slug = %s", (album_slug,))
        album = cur.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail=f"Album '{album_slug}' not found")

        # Verify media exists
        cur.execute("SELECT media_slug FROM sequoia.media WHERE media_slug = %s", (media_add.media_slug,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Media '{media_add.media_slug}' not found")

        # Add to album (or update sort_order if already exists)
        try:
            cur.execute("""
                INSERT INTO sequoia.album_media (album_id, media_slug, sort_order)
                VALUES (%s, %s, %s)
                ON CONFLICT (album_id, media_slug)
                DO UPDATE SET sort_order = EXCLUDED.sort_order
            """, (album['album_id'], media_add.media_slug, media_add.sort_order))

            return {
                "message": f"Media '{media_add.media_slug}' added to album '{album_slug}'",
                "album_slug": album_slug,
                "media_slug": media_add.media_slug,
                "sort_order": media_add.sort_order
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to add media to album: {str(e)}")

@router.delete("/{album_slug}/media/{media_slug}")
def remove_media_from_album(album_slug: str, media_slug: str) -> Dict[str, str]:
    """Remove a media item from an album"""

    with db_cursor() as cur:
        # Get album_id
        cur.execute("SELECT album_id FROM sequoia.albums WHERE album_slug = %s", (album_slug,))
        album = cur.fetchone()
        if not album:
            raise HTTPException(status_code=404, detail=f"Album '{album_slug}' not found")

        # Remove from album
        cur.execute("""
            DELETE FROM sequoia.album_media
            WHERE album_id = %s AND media_slug = %s
        """, (album['album_id'], media_slug))

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Media '{media_slug}' not in album '{album_slug}'")

        return {"message": f"Media '{media_slug}' removed from album '{album_slug}'"}
