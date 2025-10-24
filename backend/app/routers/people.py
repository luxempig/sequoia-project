from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Query
from app.db import db_cursor
import logging

LOG = logging.getLogger("app.routers.people")
router = APIRouter(prefix="/api/people", tags=["people"])

@router.get("/test123")
def simple_test():
    return {"simple": "test", "number": 999}

@router.get("/presidentgroups")
def test_no_hyphen():
    return {"test": "no hyphen", "number": 888}

@router.get("/", response_model=List[Dict[str, Any]])
def list_people(
    q: Optional[str] = Query(None, description="Search people by full_name ILIKE"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    with db_cursor(read_only=True) as cur:
        if q:
            cur.execute("SELECT * FROM sequoia.people WHERE full_name ILIKE %s ORDER BY full_name LIMIT %s OFFSET %s", (f"%{q}%", limit, offset))
        else:
            cur.execute("SELECT * FROM sequoia.people ORDER BY full_name LIMIT %s OFFSET %s", (limit, offset))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

@router.get("/by-voyage/{voyage_slug}", response_model=List[Dict[str, Any]])
def people_for_voyage(voyage_slug: str) -> List[Dict[str, Any]]:
    with db_cursor(read_only=True) as cur:
        cur.execute(
            """
            SELECT p.*, vp.capacity_role, vp.notes AS voyage_notes, vp.is_crew, vp.sort_order
            FROM sequoia.voyage_passengers vp
            JOIN sequoia.people p ON p.person_slug = vp.person_slug
            WHERE vp.voyage_slug = %s
            ORDER BY vp.sort_order, p.full_name
            """,
            (voyage_slug,)
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]

@router.get("/{person_slug}", response_model=Dict[str, Any])
def get_person(person_slug: str) -> Dict[str, Any]:
    """Get detailed information about a specific person"""
    with db_cursor(read_only=True) as cur:
        cur.execute("SELECT * FROM sequoia.people WHERE person_slug = %s", (person_slug,))
        person = cur.fetchone()
        
        if not person:
            return {}
        
        # Get voyage history for this person
        cur.execute("""
            SELECT v.*, vp.capacity_role, vp.notes as voyage_notes,
                   p.full_name as president_name, p.party as president_party
            FROM sequoia.voyage_passengers vp
            JOIN sequoia.voyages v ON v.voyage_slug = vp.voyage_slug
            LEFT JOIN sequoia.presidents p ON p.president_slug = v.president_slug_from_voyage
            WHERE vp.person_slug = %s
            ORDER BY v.start_date::date
        """, (person_slug,))
        voyages = cur.fetchall()
        
        result = dict(person)
        result["voyages"] = [dict(row) for row in voyages]
        result["voyage_count"] = len(voyages)
        
        return result

@router.get("/roles/stats", response_model=Dict[str, Any])
def get_role_statistics():
    """Get statistics about passenger roles"""
    with db_cursor(read_only=True) as cur:
        cur.execute("""
            SELECT 
                capacity_role,
                COUNT(*) as count,
                COUNT(DISTINCT person_slug) as unique_people,
                COUNT(DISTINCT voyage_slug) as voyage_count
            FROM sequoia.voyage_passengers
            WHERE capacity_role IS NOT NULL AND capacity_role != ''
            GROUP BY capacity_role
            ORDER BY count DESC
        """)
        roles = cur.fetchall()
        
        cur.execute("""
            SELECT COUNT(DISTINCT person_slug) as total_people,
                   COUNT(*) as total_passenger_records
            FROM sequoia.voyage_passengers
        """)
        totals = cur.fetchone()

        # Get unique titles count
        cur.execute("""
            SELECT COUNT(DISTINCT role_title) as unique_titles
            FROM sequoia.people
            WHERE role_title IS NOT NULL
              AND role_title != ''
        """)
        titles = cur.fetchone()

        # Calculate average voyages per passenger
        avg_voyages = 0
        if totals and totals["total_people"] > 0:
            avg_voyages = round(totals["total_passenger_records"] / totals["total_people"], 1)

        return {
            "total_people": totals["total_people"] if totals else 0,
            "total_passenger_records": totals["total_passenger_records"] if totals else 0,
            "unique_titles": titles["unique_titles"] if titles else 0,
            "avg_voyages_per_passenger": avg_voyages,
            "by_role": [dict(row) for row in roles]
        }

@router.get("/search/autocomplete", response_model=List[Dict[str, Any]])
def people_autocomplete(q: str = Query(..., min_length=2)):
    """Autocomplete search for people names"""
    with db_cursor(read_only=True) as cur:
        cur.execute("""
            SELECT person_slug, full_name, role_title, organization,
                   COUNT(vp.voyage_slug) as voyage_count
            FROM sequoia.people p
            LEFT JOIN sequoia.voyage_passengers vp ON p.person_slug = vp.person_slug
            WHERE p.full_name ILIKE %s
            GROUP BY p.person_slug, p.full_name, p.role_title, p.organization
            ORDER BY voyage_count DESC, p.full_name
            LIMIT 20
        """, (f"%{q}%",))
        results = cur.fetchall()

        return [dict(row) for row in results]

@router.get("/grouped-by-president-test")
def test_endpoint():
    return {"test": "it works", "number": 123}

@router.get("/president-groups")
def get_people_grouped_by_president(
    limit: int = Query(default=500, ge=1, le=1000),
) -> Dict[str, Any]:
    """
    Get people grouped by the presidents/owners they sailed with.
    Each person may appear under multiple presidents if they sailed with multiple.
    Returns appearance counts for each person-president combination.
    """
    LOG.info(f"president-groups called with limit={limit}")
    return {"test": "endpoint called", "limit": limit}
    with db_cursor(read_only=True) as cur:
        # Get all person-president combinations with appearance counts
        cur.execute("""
            SELECT
                p.person_slug,
                p.full_name,
                p.role_title,
                p.organization,
                p.wikipedia_url,
                pres.president_slug,
                pres.full_name as president_name,
                pres.party as president_party,
                COUNT(vp.voyage_slug) as appearance_count
            FROM sequoia.people p
            JOIN sequoia.voyage_passengers vp ON p.person_slug = vp.person_slug
            JOIN sequoia.voyages v ON vp.voyage_slug = v.voyage_slug
            LEFT JOIN sequoia.presidents pres ON v.president_slug_from_voyage = pres.president_slug
            GROUP BY
                p.person_slug, p.full_name, p.role_title, p.organization, p.wikipedia_url,
                pres.president_slug, pres.full_name, pres.party
            ORDER BY pres.full_name, appearance_count DESC, p.full_name
            LIMIT %s
        """, (limit,))

        rows = cur.fetchall()
        LOG.info(f"Query returned {len(rows)} rows")

        # Group results by president
        grouped: Dict[str, Any] = {}
        for row in rows:
            president_slug = row['president_slug'] or 'unknown'
            president_name = row['president_name'] or 'Unknown/Private Owner'

            if president_slug not in grouped:
                grouped[president_slug] = {
                    'president_slug': president_slug,
                    'president_name': president_name,
                    'president_party': row.get('president_party'),
                    'people': []
                }

            grouped[president_slug]['people'].append({
                'person_slug': row['person_slug'],
                'full_name': row['full_name'],
                'role_title': row['role_title'],
                'organization': row['organization'],
                'wikipedia_url': row['wikipedia_url'],
                'appearance_count': row['appearance_count']
            })

        result = {
            'grouped_by_president': list(grouped.values()),
            'total_president_groups': len(grouped)
        }
        LOG.info(f"Returning {len(grouped)} president groups")
        return result
