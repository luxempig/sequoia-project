from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.db import db_cursor

router = APIRouter(prefix="/api/presidents", tags=["presidents"])

@router.get("/", response_model=List[Dict[str, Any]])
def list_presidents() -> List[Dict[str, Any]]:
    with db_cursor(read_only=True) as cur:
        cur.execute("SELECT * FROM sequoia.presidents ORDER BY term_start")
        rows = cur.fetchall()
        return [dict(row) for row in rows]

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
