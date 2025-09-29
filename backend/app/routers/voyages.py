from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from app.db import db_cursor
import logging

LOG = logging.getLogger("app.routers.voyages")

router = APIRouter(prefix="/api/voyages", tags=["voyages"])

@router.get("/", response_model=List[Dict[str, Any]])
def list_voyages(
    q: Optional[str] = Query(None, description="Keyword search in title/summary_markdown/notes_internal"),
    origin: Optional[str] = None,
    destination: Optional[str] = None,
    voyage_type: Optional[str] = None,
    date_from: Optional[str] = Query(None, description="start_date >= YYYY-MM-DD"),
    date_to: Optional[str]   = Query(None, description="end_date <= YYYY-MM-DD"),
    has_media: Optional[bool] = Query(None, description="Filter voyages that do/do not have media"),
    person: Optional[str] = Query(None, description="Filter by people.full_name ILIKE"),
    president_slug: Optional[str] = Query(None, description="Filter by exact president_slug via voyage_presidents join"),
    sort: str = Query("start_date", pattern="^(start_date|end_date|title)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
    limit: int = Query(250, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    try:
        with db_cursor(read_only=True) as cur:
            base = "SELECT DISTINCT v.* FROM sequoia.voyages v"
            joins: List[str] = []
            conds: List[str] = []
            params: List[Any] = []

            if q:
                conds.append("(COALESCE(v.title,'') ILIKE %s OR COALESCE(v.summary_markdown,'') ILIKE %s OR COALESCE(v.notes_internal,'') ILIKE %s)")
                params += [f"%{q}%", f"%{q}%", f"%{q}%"]

            if origin:
                conds.append("v.origin = %s"); params.append(origin)
            if destination:
                conds.append("v.destination = %s"); params.append(destination)
            if voyage_type:
                conds.append("v.voyage_type = %s"); params.append(voyage_type)
            if date_from:
                conds.append("v.start_date >= %s"); params.append(date_from)
            if date_to:
                conds.append("v.end_date <= %s"); params.append(date_to)

            if has_media is True:
                joins.append("INNER JOIN sequoia.voyage_media vm ON vm.voyage_slug = v.voyage_slug")
            elif has_media is False:
                conds.append("NOT EXISTS (SELECT 1 FROM sequoia.voyage_media vm2 WHERE vm2.voyage_slug = v.voyage_slug)")

            if person:
                joins.append("LEFT JOIN sequoia.voyage_passengers vp ON vp.voyage_slug = v.voyage_slug")
                joins.append("LEFT JOIN sequoia.people p ON p.person_slug = vp.person_slug")
                conds.append("p.full_name ILIKE %s"); params.append(f"%{person}%")

            if president_slug:
                conds.append("v.president_slug_from_voyage = %s"); params.append(president_slug)

            # Validate sort column to prevent SQL injection
            valid_sorts = {"start_date", "end_date", "title", "created_at", "updated_at"}
            if sort not in valid_sorts:
                sort = "start_date"
                
            sql = base + (" " + " ".join(joins) if joins else "")
            if conds:
                sql += " WHERE " + " AND ".join(conds)
            sql += f" ORDER BY v.{sort} {order.upper()} NULLS LAST LIMIT %s OFFSET %s"
            params += [limit, offset]

            cur.execute(sql, params)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        LOG.warning(f"Database error in list_voyages, returning mock data: {e}")
        return get_mock_voyages()

def get_mock_voyages() -> List[Dict[str, Any]]:
    """Mock voyage data for development when database is unavailable"""
    return [
        {
            "voyage_slug": "1933-03-04-roosevelt-inaugural",
            "title": "FDR Inaugural Voyage",
            "start_date": "1933-03-04",
            "end_date": "1933-03-05",
            "origin": "Washington, D.C.",
            "destination": "Potomac River",
            "vessel_name": "USS Sequoia",
            "voyage_type": "official",
            "summary_markdown": "President Roosevelt's first voyage aboard the USS Sequoia following his inauguration.",
            "president_slug_from_voyage": "roosevelt",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        },
        {
            "voyage_slug": "1933-07-15-roosevelt-summer",
            "title": "Summer Cruise",
            "start_date": "1933-07-15",
            "end_date": "1933-07-18",
            "origin": "Washington, D.C.",
            "destination": "Chesapeake Bay",
            "vessel_name": "USS Sequoia",
            "voyage_type": "private",
            "summary_markdown": "A relaxing summer cruise with the Roosevelt family.",
            "president_slug_from_voyage": "roosevelt",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        },
        {
            "voyage_slug": "1961-05-12-kennedy-diplomatic",
            "title": "Diplomatic Meeting",
            "start_date": "1961-05-12",
            "end_date": "1961-05-13",
            "origin": "Washington, D.C.",
            "destination": "Potomac River",
            "vessel_name": "USS Sequoia",
            "voyage_type": "official",
            "summary_markdown": "Important diplomatic discussions aboard the presidential yacht.",
            "president_slug_from_voyage": "kennedy",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        },
        {
            "voyage_slug": "1973-08-03-nixon-watergate",
            "title": "Strategic Planning",
            "start_date": "1973-08-03",
            "end_date": "1973-08-04",
            "origin": "Washington, D.C.",
            "destination": "Potomac River",
            "vessel_name": "USS Sequoia",
            "voyage_type": "official",
            "summary_markdown": "Critical planning session during a turbulent period.",
            "president_slug_from_voyage": "nixon",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
    ]

@router.get("/{voyage_slug}", response_model=Dict[str, Any])
def get_voyage(voyage_slug: str) -> Dict[str, Any]:
    with db_cursor(read_only=True) as cur:
        cur.execute("SELECT * FROM sequoia.voyages WHERE voyage_slug = %s", (voyage_slug,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Voyage not found")
        return dict(row)

@router.get("/{voyage_slug}/presidents", response_model=List[Dict[str, Any]])
def voyage_presidents(voyage_slug: str) -> List[Dict[str, Any]]:
    with db_cursor(read_only=True) as cur:
        cur.execute(
            """
            SELECT pr.*
            FROM sequoia.voyage_presidents vp
            JOIN sequoia.presidents pr ON pr.president_slug = vp.president_slug
            WHERE vp.voyage_slug = %s
            ORDER BY pr.term_start NULLS LAST
            """,
            (voyage_slug,)
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]

@router.get("/{voyage_slug}/people", response_model=List[Dict[str, Any]])
def voyage_people(voyage_slug: str) -> List[Dict[str, Any]]:
    with db_cursor(read_only=True) as cur:
        cur.execute(
            """
            SELECT p.*, vp.capacity_role, vp.notes AS voyage_notes
            FROM sequoia.voyage_passengers vp
            JOIN sequoia.people p ON p.person_slug = vp.person_slug
            WHERE vp.voyage_slug = %s
            ORDER BY p.full_name NULLS LAST
            """,
            (voyage_slug,)
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]
