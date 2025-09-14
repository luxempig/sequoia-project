from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.db import db_cursor
import logging

LOG = logging.getLogger("app.routers.presidents")

router = APIRouter(prefix="/api/presidents", tags=["presidents"])

def get_mock_presidents() -> List[Dict[str, Any]]:
    """Mock president data for development when database is unavailable"""
    return [
        {
            "president_slug": "roosevelt",
            "full_name": "Franklin D. Roosevelt",
            "party": "Democratic",
            "term_start": "1933-03-04",
            "term_end": "1945-04-12",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Franklin_D._Roosevelt",
            "tags": "",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        },
        {
            "president_slug": "kennedy",
            "full_name": "John F. Kennedy",
            "party": "Democratic",
            "term_start": "1961-01-20",
            "term_end": "1963-11-22",
            "wikipedia_url": "https://en.wikipedia.org/wiki/John_F._Kennedy",
            "tags": "",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        },
        {
            "president_slug": "nixon",
            "full_name": "Richard Nixon",
            "party": "Republican",
            "term_start": "1969-01-20",
            "term_end": "1974-08-09",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Richard_Nixon",
            "tags": "",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
    ]

@router.get("/", response_model=List[Dict[str, Any]])
def list_presidents() -> List[Dict[str, Any]]:
    try:
        with db_cursor(read_only=True) as cur:
            cur.execute("SELECT * FROM sequoia.presidents ORDER BY term_start")
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        LOG.warning(f"Database error in list_presidents, returning mock data: {e}")
        return get_mock_presidents()

@router.get("/{president_slug}/voyages", response_model=List[Dict[str, Any]])
def voyages_by_president(president_slug: str) -> List[Dict[str, Any]]:
    with db_cursor(read_only=True) as cur:
        cur.execute(
            """
            SELECT v.*
            FROM sequoia.voyage_presidents vp
            JOIN sequoia.voyages v ON v.voyage_slug = vp.voyage_slug
            WHERE vp.president_slug = %s
            ORDER BY v.start_date
            """,
            (president_slug,)
        )
        rows = cur.fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="No voyages found for this president")
        return [dict(row) for row in rows]
