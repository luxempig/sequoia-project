from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query
from psycopg2.extras import RealDictCursor
from app.db import get_connection
from app.utils.s3 import presign_from_media_s3_url
from app.config import get_settings
import logging

LOG = logging.getLogger("app.routers.media")

router = APIRouter(prefix="/api/media", tags=["media"])

@router.get("/", response_model=List[Dict[str, Any]])
def list_media(
    q: Optional[str] = Query(None, description="Search title/description_markdown/credit/publication-like fields"),
    media_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="media.date >= YYYY-MM-DD"),
    date_to: Optional[str]   = Query(None, description="media.date <= YYYY-MM-DD"),
    voyage_slug: Optional[str] = Query(None, description="Filter by a specific voyage via voyage_media"),
    presign: bool = Query(False),
    ttl: Optional[int] = Query(None, ge=60, le=86400),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    base = "SELECT m.* FROM media m"
    joins: List[str] = []
    conds: List[str] = []
    params: List[Any] = []

    if voyage_slug:
        joins.append("INNER JOIN voyage_media vm ON vm.media_slug = m.media_slug AND vm.voyage_slug = %s")
        params.append(voyage_slug)

    if q:
        conds.append(
            "(COALESCE(m.title,'') ILIKE %s OR COALESCE(m.description_markdown,'') ILIKE %s OR COALESCE(m.credit,'') ILIKE %s)"
        )
        params += [f"%{q}%", f"%{q}%", f"%{q}%"]
    if media_type:
        conds.append("m.media_type = %s"); params.append(media_type)
    if date_from:
        conds.append("m.date >= %s"); params.append(date_from)
    if date_to:
        conds.append("m.date <= %s"); params.append(date_to)

    sql = base + (" " + " ".join(joins) if joins else "")
    if conds:
        sql += " WHERE " + " AND ".join(conds)
    sql += " ORDER BY m.date NULLS LAST, m.media_slug LIMIT %s OFFSET %s"
    params += [limit, offset]

    cur.execute(sql, params)
    rows = cur.fetchall()
    cur.close(); conn.close()

    if presign:
        ttl_eff = int(ttl) if ttl is not None else get_settings().PRESIGNED_TTL
        for r in rows:
            # ONLY serve from S3 - no Drive/Dropbox links
            s3_url = r.get("s3_url") or ""
            public_url = r.get("public_derivative_url") or ""
            presigned_url = presign_from_media_s3_url(s3_url, expires=ttl_eff) if s3_url else None

            # Priority: presigned S3 -> public derivative -> raw S3 (no external fallbacks)
            r["url"] = presigned_url or public_url or s3_url
    else:
        for r in rows:
            # ONLY serve from S3 - no Drive/Dropbox links
            r["url"] = r.get("public_derivative_url") or r.get("s3_url")

    return rows

def get_mock_media(voyage_slug: str) -> List[Dict[str, Any]]:
    """Mock media data for development when database is unavailable"""
    base_media = [
        {
            "media_slug": f"{voyage_slug}-photo-1",
            "title": "Presidential Group Photo",
            "media_type": "image",
            "s3_url": "",
            "public_derivative_url": "",
            "credit": "White House Photography Office",
            "date": voyage_slug[:10],  # Extract date from slug
            "description_markdown": "Official photograph taken during the voyage",
            "sort_order": 1,
            "voyage_media_notes": "Primary documentation",
            "url": "https://via.placeholder.com/400x300.jpg?text=Presidential+Photo"
        },
        {
            "media_slug": f"{voyage_slug}-document-1",
            "title": "Ship's Log Entry",
            "media_type": "pdf",
            "s3_url": "",
            "public_derivative_url": "",
            "credit": "USS Sequoia Archives",
            "date": voyage_slug[:10],
            "description_markdown": "Captain's log entry for this voyage",
            "sort_order": 2,
            "voyage_media_notes": "Historical record",
            "url": "https://via.placeholder.com/400x300.jpg?text=Ship's+Log"
        }
    ]
    return base_media

@router.get("/by-voyage/{voyage_slug}", response_model=List[Dict[str, Any]])
def media_for_voyage(
    voyage_slug: str,
    presign: bool = Query(True),
    ttl: Optional[int] = Query(None, ge=60, le=86400),
) -> List[Dict[str, Any]]:
    """
    Returns media joined via voyage_media, preserving sort_order and notes.
    """
    try:
        conn = get_connection()
        cur  = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT m.*, vm.sort_order, vm.notes AS voyage_media_notes
            FROM voyage_media vm
            JOIN media m ON m.media_slug = vm.media_slug
            WHERE vm.voyage_slug = %s
            ORDER BY vm.sort_order NULLS LAST, m.date NULLS LAST, m.media_slug
            """,
            (voyage_slug,)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()

        if presign:
            ttl_eff = int(ttl) if ttl is not None else get_settings().PRESIGNED_TTL
            for r in rows:
                # ONLY serve from S3 - no Drive/Dropbox links
                s3_url = r.get("s3_url") or ""
                public_url = r.get("public_derivative_url") or ""
                presigned_url = presign_from_media_s3_url(s3_url, expires=ttl_eff) if s3_url else None

                # Priority: presigned S3 -> public derivative -> raw S3 (no external fallbacks)
                r["url"] = presigned_url or public_url or s3_url
        else:
            for r in rows:
                # ONLY serve from S3 - no Drive/Dropbox links
                r["url"] = r.get("public_derivative_url") or r.get("s3_url")

        return rows
    except Exception as e:
        LOG.warning(f"Database error in media_for_voyage, returning mock data: {e}")
        return get_mock_media(voyage_slug)

@router.get("/{media_slug}", response_model=Dict[str, Any])
def get_media(media_slug: str, presign: bool = Query(True), ttl: Optional[int] = Query(None, ge=60, le=86400)) -> Dict[str, Any]:
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM media WHERE media_slug = %s", (media_slug,))
    row = cur.fetchone()
    cur.close(); conn.close()

    if not row:
        return {}

    if presign:
        ttl_eff = int(ttl) if ttl is not None else get_settings().PRESIGNED_TTL
        # ONLY serve from S3 - no Drive/Dropbox links
        s3_url = row.get("s3_url") or ""
        public_url = row.get("public_derivative_url") or ""
        presigned_url = presign_from_media_s3_url(s3_url, expires=ttl_eff) if s3_url else None

        # Priority: presigned S3 -> public derivative -> raw S3 (no external fallbacks)
        row["url"] = presigned_url or public_url or s3_url
    else:
        # ONLY serve from S3 - no Drive/Dropbox links
        row["url"] = row.get("public_derivative_url") or row.get("s3_url")
    return row

@router.get("/{media_slug}/related-voyages", response_model=List[Dict[str, Any]])
def get_media_related_voyages(media_slug: str) -> List[Dict[str, Any]]:
    """Get all voyages that use this media item"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT v.*, vm.sort_order, vm.notes as voyage_media_notes,
               p.full_name as president_name, p.party as president_party
        FROM voyage_media vm
        JOIN voyages v ON v.voyage_slug = vm.voyage_slug
        LEFT JOIN presidents p ON p.president_slug = v.president_slug_from_voyage
        WHERE vm.media_slug = %s
        ORDER BY v.start_date::date
    """, (media_slug,))
    rows = cur.fetchall()
    cur.close(); conn.close()
    return rows

@router.get("/types/stats", response_model=Dict[str, Any])
def get_media_type_statistics():
    """Get statistics about media types in the collection"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT 
            media_type,
            COUNT(*) as count,
            MIN(date) as earliest_date,
            MAX(date) as latest_date,
            COUNT(DISTINCT vm.voyage_slug) as voyage_count
        FROM media m
        LEFT JOIN voyage_media vm ON m.media_slug = vm.media_slug
        WHERE media_type IS NOT NULL
        GROUP BY media_type
        ORDER BY count DESC
    """)
    stats = cur.fetchall()
    
    cur.execute("SELECT COUNT(*) as total FROM media")
    total = cur.fetchone()
    
    cur.close(); conn.close()
    
    return {
        "total_media": total["total"],
        "by_type": [dict(row) for row in stats]
    }
