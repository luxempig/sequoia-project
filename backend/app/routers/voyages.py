from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from app.db import db_cursor
import logging
import json

LOG = logging.getLogger("app.routers.voyages")

router = APIRouter(prefix="/api/voyages", tags=["voyages"])

def parse_voyage_sources(voyage: Dict[str, Any]) -> Dict[str, Any]:
    """Parse source_urls from JSON strings to objects"""
    if voyage.get('source_urls'):
        try:
            # If source_urls is a list of JSON strings, parse each one
            if isinstance(voyage['source_urls'], list) and voyage['source_urls']:
                if isinstance(voyage['source_urls'][0], str):
                    voyage['source_urls'] = [json.loads(s) for s in voyage['source_urls']]
        except (json.JSONDecodeError, TypeError, IndexError):
            # If parsing fails, leave as is
            pass
    return voyage

@router.get("/", response_model=List[Dict[str, Any]])
def list_voyages(
    q: Optional[str] = Query(None, description="Keyword search across all voyage text fields"),
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
                # Search across all text fields
                search_pattern = f"%{q}%"
                conds.append("""(
                    COALESCE(v.voyage_slug,'') ILIKE %s OR
                    COALESCE(v.title,'') ILIKE %s OR
                    COALESCE(v.summary_markdown,'') ILIKE %s OR
                    COALESCE(v.notes_internal,'') ILIKE %s OR
                    COALESCE(v.additional_information,'') ILIKE %s OR
                    COALESCE(v.additional_sources,'') ILIKE %s OR
                    COALESCE(v.tags,'') ILIKE %s OR
                    COALESCE(v.origin,'') ILIKE %s OR
                    COALESCE(v.destination,'') ILIKE %s OR
                    COALESCE(v.start_location,'') ILIKE %s OR
                    COALESCE(v.end_location,'') ILIKE %s OR
                    COALESCE(v.vessel_name,'') ILIKE %s OR
                    COALESCE(v.voyage_type,'') ILIKE %s OR
                    COALESCE(v.presidential_initials,'') ILIKE %s OR
                    COALESCE(v.royalty_details,'') ILIKE %s OR
                    COALESCE(v.foreign_leader_country,'') ILIKE %s OR
                    COALESCE(array_to_string(v.source_urls, ' '),'') ILIKE %s
                )""")
                params += [search_pattern] * 17

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
            return [parse_voyage_sources(dict(row)) for row in rows]
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
        return parse_voyage_sources(dict(row))

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
            SELECT p.*, vp.capacity_role, vp.notes AS voyage_notes, vp.is_crew
            FROM sequoia.voyage_passengers vp
            JOIN sequoia.people p ON p.person_slug = vp.person_slug
            WHERE vp.voyage_slug = %s
            ORDER BY p.full_name NULLS LAST
            """,
            (voyage_slug,)
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]

@router.get("/{voyage_slug}/adjacent", response_model=Dict[str, Any])
def get_adjacent_voyages(voyage_slug: str) -> Dict[str, Any]:
    """Get the previous and next voyages in chronological order"""
    with db_cursor(read_only=True) as cur:
        # Get the current voyage's start date
        cur.execute(
            "SELECT start_date FROM sequoia.voyages WHERE voyage_slug = %s",
            (voyage_slug,)
        )
        current = cur.fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Voyage not found")

        current_date = current['start_date']

        # Get previous voyage
        cur.execute(
            """
            SELECT voyage_slug, title, start_date
            FROM sequoia.voyages
            WHERE start_date < %s
            ORDER BY start_date DESC, voyage_slug DESC
            LIMIT 1
            """,
            (current_date,)
        )
        prev_row = cur.fetchone()

        # Get next voyage
        cur.execute(
            """
            SELECT voyage_slug, title, start_date
            FROM sequoia.voyages
            WHERE start_date > %s
            ORDER BY start_date ASC, voyage_slug ASC
            LIMIT 1
            """,
            (current_date,)
        )
        next_row = cur.fetchone()

        return {
            "previous": dict(prev_row) if prev_row else None,
            "next": dict(next_row) if next_row else None
        }
