from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from psycopg2.extras import RealDictCursor
from app.db import db_cursor
from app.config import get_settings
import subprocess
import logging
import os
from datetime import datetime

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

LOG = logging.getLogger("app.ingest")

@router.post("/trigger", response_model=Dict[str, Any])
async def trigger_ingest(
    background_tasks: BackgroundTasks,
    dry_run: bool = Query(False, description="Run in dry-run mode without making changes"),
    doc_id: Optional[str] = Query(None, description="Override DOC_ID from environment"),
) -> Dict[str, Any]:
    """
    Trigger voyage_ingest process in the background.
    Returns immediately with a task ID for status tracking.
    """
    task_id = f"ingest_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    # Run ingest in background
    background_tasks.add_task(
        _run_voyage_ingest,
        task_id=task_id,
        dry_run=dry_run,
        doc_id_override=doc_id
    )
    
    return {
        "task_id": task_id,
        "status": "started",
        "dry_run": dry_run,
        "message": f"Voyage ingest {'(dry run)' if dry_run else ''} started in background"
    }

@router.get("/status/{task_id}", response_model=Dict[str, Any])
def get_ingest_status(task_id: str) -> Dict[str, Any]:
    """
    Get status of a background ingest task.
    Note: This is a basic implementation - you might want to use Redis/database for production.
    """
    # For now, just return basic info since we don't have persistent task tracking
    # In production, you'd store task status in Redis/database
    return {
        "task_id": task_id,
        "status": "unknown",
        "message": "Task tracking not implemented - check logs for progress"
    }

@router.get("/logs", response_model=List[Dict[str, Any]])
def get_ingest_logs(
    limit: int = Query(50, ge=1, le=500),
    voyage_slug: Optional[str] = Query(None, description="Filter by voyage_slug")
) -> List[Dict[str, Any]]:
    """
    Get recent ingest log entries from the ingest_log sheet/table.
    """
    with db_cursor() as cur:
        # This assumes you have an ingest_log table that mirrors the sheet
        base_query = """
        SELECT timestamp, doc_id, voyage_slug, status, validation_errors, 
               media_warnings, media_declared, media_uploaded, thumbs_uploaded,
               reconcile_mode, dry_run, notes
        FROM ingest_log
        """
        
        params = []
        if voyage_slug:
            base_query += " WHERE voyage_slug = %s"
            params.append(voyage_slug)
            
        base_query += " ORDER BY timestamp DESC LIMIT %s"
        params.append(limit)
        
        cur.execute(base_query, params)
        rows = cur.fetchall()
        
    return [dict(row) for row in rows]

@router.get("/stats", response_model=Dict[str, Any])
def get_ingest_stats() -> Dict[str, Any]:
    """
    Get summary statistics about the voyage data.
    """
    with db_cursor() as cur:
        # Count totals
        cur.execute("SELECT COUNT(*) as total_voyages FROM voyages")
        total_voyages = cur.fetchone()['total_voyages']
        
        cur.execute("SELECT COUNT(*) as total_media FROM media")  
        total_media = cur.fetchone()['total_media']
        
        cur.execute("SELECT COUNT(*) as total_people FROM people")
        total_people = cur.fetchone()['total_people']
        
        cur.execute("SELECT COUNT(*) as total_presidents FROM presidents")
        total_presidents = cur.fetchone()['total_presidents']
        
        # Media by type
        cur.execute("""
            SELECT media_type, COUNT(*) as count 
            FROM media 
            GROUP BY media_type 
            ORDER BY count DESC
        """)
        media_by_type = {row['media_type']: row['count'] for row in cur.fetchall()}
        
        # Recent activity (last 7 days)
        cur.execute("""
            SELECT COUNT(*) as recent_updates 
            FROM voyages 
            WHERE updated_at > NOW() - INTERVAL '7 days'
        """)
        recent_updates = cur.fetchone()['recent_updates']
        
    return {
        "totals": {
            "voyages": total_voyages,
            "media": total_media,
            "people": total_people,  
            "presidents": total_presidents
        },
        "media_by_type": media_by_type,
        "recent_updates": recent_updates,
        "generated_at": datetime.utcnow().isoformat()
    }

@router.post("/cleanup/orphans", response_model=Dict[str, Any])
async def cleanup_orphaned_data(
    background_tasks: BackgroundTasks,
    dry_run: bool = Query(True, description="Preview changes without executing them")
) -> Dict[str, Any]:
    """
    Clean up orphaned records (media not linked to voyages, etc.).
    """
    task_id = f"cleanup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    background_tasks.add_task(
        _run_cleanup,
        task_id=task_id,
        dry_run=dry_run
    )
    
    return {
        "task_id": task_id,
        "status": "started",
        "dry_run": dry_run,
        "message": f"Cleanup {'(dry run)' if dry_run else ''} started in background"
    }

async def _run_voyage_ingest(task_id: str, dry_run: bool = False, doc_id_override: Optional[str] = None):
    """
    Background task to run voyage_ingest process.
    """
    try:
        LOG.info(f"Starting voyage_ingest task {task_id}, dry_run={dry_run}")
        
        # Prepare environment
        env = os.environ.copy()
        if dry_run:
            env["DRY_RUN"] = "true"
        if doc_id_override:
            env["DOC_ID"] = doc_id_override
            
        # Run voyage_ingest
        result = subprocess.run(
            ["python", "-m", "voyage_ingest.main"],
            cwd="/home/ec2-user/sequoia-backend",
            env=env,
            capture_output=True,
            text=True,
            timeout=1800  # 30 minutes max
        )
        
        if result.returncode == 0:
            LOG.info(f"Voyage_ingest task {task_id} completed successfully")
            LOG.info(f"Output: {result.stdout}")
        else:
            LOG.error(f"Voyage_ingest task {task_id} failed with return code {result.returncode}")
            LOG.error(f"Error: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        LOG.error(f"Voyage_ingest task {task_id} timed out after 30 minutes")
    except Exception as e:
        LOG.error(f"Voyage_ingest task {task_id} failed with exception: {e}")

async def _run_cleanup(task_id: str, dry_run: bool = True):
    """
    Background task to clean up orphaned data.
    """
    try:
        LOG.info(f"Starting cleanup task {task_id}, dry_run={dry_run}")
        
        with db_cursor() as cur:
            # Find orphaned media (not linked to any voyage)
            cur.execute("""
                SELECT m.media_slug, m.title, m.media_type
                FROM media m 
                LEFT JOIN voyage_media vm ON vm.media_slug = m.media_slug
                WHERE vm.media_slug IS NULL
                ORDER BY m.created_at DESC
                LIMIT 100
            """)
            orphaned_media = cur.fetchall()
            
            # Find orphaned people (not linked to any voyage)
            cur.execute("""
                SELECT p.person_slug, p.full_name
                FROM people p
                LEFT JOIN voyage_passengers vp ON vp.person_slug = p.person_slug  
                WHERE vp.person_slug IS NULL
                ORDER BY p.full_name
                LIMIT 100
            """)
            orphaned_people = cur.fetchall()
            
            LOG.info(f"Found {len(orphaned_media)} orphaned media, {len(orphaned_people)} orphaned people")
            
            if not dry_run:
                # Delete orphaned records (be careful!)
                if orphaned_media:
                    media_slugs = [row['media_slug'] for row in orphaned_media]
                    cur.execute("DELETE FROM media WHERE media_slug = ANY(%s)", (media_slugs,))
                    LOG.info(f"Deleted {len(media_slugs)} orphaned media records")
                    
                if orphaned_people:
                    person_slugs = [row['person_slug'] for row in orphaned_people] 
                    cur.execute("DELETE FROM people WHERE person_slug = ANY(%s)", (person_slugs,))
                    LOG.info(f"Deleted {len(person_slugs)} orphaned people records")
                    
        LOG.info(f"Cleanup task {task_id} completed")
        
    except Exception as e:
        LOG.error(f"Cleanup task {task_id} failed with exception: {e}")