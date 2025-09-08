from fastapi import APIRouter, HTTPException
from app.db import db_cursor
from typing import Dict, List, Any
import logging

LOG = logging.getLogger("app.analytics")
router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/dashboard", response_model=Dict[str, Any])
async def get_dashboard_stats():
    """Get comprehensive dashboard statistics"""
    try:
        with db_cursor(read_only=True) as cur:
            # Get basic counts
            cur.execute("""
                SELECT 
                    (SELECT COUNT(*) FROM sequoia.voyages) as total_voyages,
                    (SELECT COUNT(*) FROM sequoia.presidents) as total_presidents,
                    (SELECT COUNT(*) FROM sequoia.people) as total_people,
                    (SELECT COUNT(*) FROM sequoia.media) as total_media,
                    (SELECT COUNT(*) FROM sequoia.voyage_passengers) as total_passengers
            """)
            counts = cur.fetchone()
            
            # Get voyage type distribution
            cur.execute("""
                SELECT voyage_type, COUNT(*) as count
                FROM sequoia.voyages 
                WHERE voyage_type IS NOT NULL
                GROUP BY voyage_type
                ORDER BY count DESC
            """)
            voyage_types = cur.fetchall()
            
            # Get media type distribution
            cur.execute("""
                SELECT media_type, COUNT(*) as count
                FROM sequoia.media 
                WHERE media_type IS NOT NULL
                GROUP BY media_type
                ORDER BY count DESC
            """)
            media_types = cur.fetchall()
            
            # Get voyages per president (top 10)
            cur.execute("""
                SELECT p.full_name, COUNT(v.voyage_slug) as voyage_count
                FROM sequoia.presidents p
                LEFT JOIN sequoia.voyages v ON p.president_slug = v.president_slug_from_voyage
                GROUP BY p.president_slug, p.full_name
                HAVING COUNT(v.voyage_slug) > 0
                ORDER BY voyage_count DESC
                LIMIT 10
            """)
            president_voyages = cur.fetchall()
            
            # Get recent activity
            cur.execute("""
                SELECT 'voyage' as type, title as name, created_at
                FROM sequoia.voyages
                UNION ALL
                SELECT 'media', title, created_at
                FROM sequoia.media
                UNION ALL
                SELECT 'person', full_name, created_at
                FROM sequoia.people
                ORDER BY created_at DESC
                LIMIT 10
            """)
            recent_activity = cur.fetchall()
            
            return {
                "totals": dict(counts),
                "distributions": {
                    "voyage_types": [dict(row) for row in voyage_types],
                    "media_types": [dict(row) for row in media_types]
                },
                "top_presidents": [dict(row) for row in president_voyages],
                "recent_activity": [dict(row) for row in recent_activity]
            }
            
    except Exception as e:
        LOG.error(f"Failed to get dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard stats: {str(e)}")

@router.get("/timeline", response_model=List[Dict[str, Any]])
async def get_voyage_timeline():
    """Get voyage timeline data for visualization"""
    try:
        with db_cursor(read_only=True) as cur:
            cur.execute("""
                SELECT 
                    v.voyage_slug,
                    v.title,
                    v.start_date,
                    v.end_date,
                    v.voyage_type,
                    p.full_name as president_name,
                    p.party as president_party,
                    EXTRACT(YEAR FROM v.start_date::date) as year
                FROM sequoia.voyages v
                LEFT JOIN sequoia.presidents p ON v.president_slug_from_voyage = p.president_slug
                WHERE v.start_date IS NOT NULL
                ORDER BY v.start_date::date
            """)
            voyages = cur.fetchall()
            
            return [dict(row) for row in voyages]
            
    except Exception as e:
        LOG.error(f"Failed to get timeline data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get timeline data: {str(e)}")

@router.get("/search/suggestions", response_model=Dict[str, List[str]])
async def get_search_suggestions(q: str):
    """Get search suggestions for autocomplete"""
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    try:
        with db_cursor(read_only=True) as cur:
            # Search in voyages, presidents, people
            cur.execute("""
                (SELECT DISTINCT title as suggestion, 'voyage' as type
                 FROM sequoia.voyages 
                 WHERE title ILIKE %s 
                 LIMIT 5)
                UNION ALL
                (SELECT DISTINCT full_name, 'president' as type
                 FROM sequoia.presidents 
                 WHERE full_name ILIKE %s 
                 LIMIT 5)
                UNION ALL
                (SELECT DISTINCT full_name, 'person' as type
                 FROM sequoia.people 
                 WHERE full_name ILIKE %s 
                 LIMIT 5)
                UNION ALL
                (SELECT DISTINCT title, 'media' as type
                 FROM sequoia.media 
                 WHERE title ILIKE %s 
                 LIMIT 5)
                ORDER BY suggestion
                LIMIT 20
            """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"))
            
            results = cur.fetchall()
            return {
                "suggestions": [dict(row) for row in results]
            }
            
    except Exception as e:
        LOG.error(f"Failed to get search suggestions: {e}")
        return {"suggestions": []}