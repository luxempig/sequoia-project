"""
API endpoints for async media processing status tracking.
"""
import os
import logging
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from celery.result import AsyncResult
from celery_app import celery_app

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/async-tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a specific async task."""
    try:
        result = AsyncResult(task_id, app=celery_app)

        if result.state == "PENDING":
            response = {
                "task_id": task_id,
                "state": result.state,
                "status": "Task is waiting to be processed"
            }
        elif result.state == "PROCESSING":
            response = {
                "task_id": task_id,
                "state": result.state,
                "current": result.info.get("progress", 0),
                "total": 100,
                "status": result.info.get("stage", "Processing..."),
                "meta": result.info
            }
        elif result.state == "SUCCESS":
            response = {
                "task_id": task_id,
                "state": result.state,
                "result": result.result,
                "status": "Task completed successfully"
            }
        elif result.state == "FAILURE":
            response = {
                "task_id": task_id,
                "state": result.state,
                "error": str(result.info),
                "status": "Task failed"
            }
        else:
            response = {
                "task_id": task_id,
                "state": result.state,
                "status": f"Unknown state: {result.state}"
            }

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Failed to get task status for {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve task status: {str(e)}")


@router.get("/async-tasks")
async def get_active_tasks():
    """Get all active (non-completed) async tasks."""
    try:
        # Get active tasks from Celery
        inspect = celery_app.control.inspect()

        # Get active tasks from all workers
        active_tasks = inspect.active()
        scheduled_tasks = inspect.scheduled()
        reserved_tasks = inspect.reserved()

        response = {
            "active_tasks": active_tasks or {},
            "scheduled_tasks": scheduled_tasks or {},
            "reserved_tasks": reserved_tasks or {},
            "total_active": sum(len(tasks) for tasks in (active_tasks or {}).values()),
            "total_scheduled": sum(len(tasks) for tasks in (scheduled_tasks or {}).values()),
            "total_reserved": sum(len(tasks) for tasks in (reserved_tasks or {}).values())
        }

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Failed to get active tasks: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve active tasks: {str(e)}")


@router.post("/async-tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a running async task."""
    try:
        celery_app.control.revoke(task_id, terminate=True)

        return {
            "task_id": task_id,
            "status": "cancellation_requested",
            "message": "Task cancellation has been requested"
        }

    except Exception as e:
        logger.error(f"Failed to cancel task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel task: {str(e)}")


@router.get("/media-processing-status/{voyage_slug}")
async def get_media_processing_status(voyage_slug: str):
    """Get the processing status of all media items for a specific voyage."""
    try:
        # This would typically query a database for media processing status
        # For now, return a placeholder response

        # TODO: Implement actual database query
        # Example query:
        # SELECT media_slug, processing_status, task_id, thumbnail_url, preview_url,
        #        processing_error, processed_at
        # FROM media
        # WHERE voyage_slug = %s

        return {
            "voyage_slug": voyage_slug,
            "media_status": {
                "pending": 0,
                "processing": 0,
                "completed": 0,
                "failed": 0
            },
            "message": "Database integration not yet implemented",
            "note": "This endpoint will provide real media processing status once database schema is updated"
        }

    except Exception as e:
        logger.error(f"Failed to get media processing status for voyage {voyage_slug}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve media status: {str(e)}")


@router.get("/thumbnail-generation-stats")
async def get_thumbnail_generation_stats():
    """Get overall statistics about thumbnail generation."""
    try:
        # Get worker statistics
        inspect = celery_app.control.inspect()
        stats = inspect.stats()

        # Count tasks by type
        active_tasks = inspect.active() or {}
        thumbnail_tasks = []

        for worker, tasks in active_tasks.items():
            for task in tasks:
                if any(thumb_task in task.get("name", "") for thumb_task in
                      ["generate_image_derivatives", "generate_pdf_thumbnail",
                       "generate_video_thumbnail", "generate_audio_waveform"]):
                    thumbnail_tasks.append({
                        "worker": worker,
                        "task_name": task.get("name"),
                        "task_id": task.get("id"),
                        "args": task.get("args", [])
                    })

        return {
            "worker_stats": stats or {},
            "active_thumbnail_tasks": thumbnail_tasks,
            "total_thumbnail_tasks": len(thumbnail_tasks),
            "supported_formats": {
                "image": ["jpg", "jpeg", "png", "webp", "gif", "tiff"],
                "video": ["mp4", "mov", "avi", "mkv"],
                "audio": ["mp3", "wav", "aac", "ogg"],
                "pdf": ["pdf"]
            }
        }

    except Exception as e:
        logger.error(f"Failed to get thumbnail generation stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve stats: {str(e)}")


@router.post("/retry-failed-thumbnails")
async def retry_failed_thumbnails(voyage_slug: Optional[str] = None):
    """Retry thumbnail generation for failed media items."""
    try:
        # This would typically:
        # 1. Query database for media with failed processing status
        # 2. Re-queue them for async processing
        # 3. Return the number of items re-queued

        # TODO: Implement actual retry logic
        # Example:
        # failed_media = db.query("""
        #     SELECT media_slug, voyage_slug, s3_original_key, media_type, ext, credit
        #     FROM media
        #     WHERE processing_status = 'failed'
        #     AND (%s IS NULL OR voyage_slug = %s)
        # """, (voyage_slug, voyage_slug))

        # for media in failed_media:
        #     # Re-queue appropriate task based on media_type
        #     pass

        return {
            "status": "not_implemented",
            "message": "Retry functionality will be available once database schema is updated",
            "voyage_slug": voyage_slug
        }

    except Exception as e:
        logger.error(f"Failed to retry failed thumbnails: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retry thumbnails: {str(e)}")


@router.get("/worker-health")
async def get_worker_health():
    """Check the health of Celery workers."""
    try:
        inspect = celery_app.control.inspect()

        # Ping all workers
        pong = inspect.ping()

        # Get worker stats
        stats = inspect.stats()

        # Check if any workers are available
        workers_available = bool(pong and len(pong) > 0)

        response = {
            "workers_available": workers_available,
            "worker_count": len(pong) if pong else 0,
            "workers": {}
        }

        if pong:
            for worker, status in pong.items():
                worker_stats = (stats or {}).get(worker, {})
                response["workers"][worker] = {
                    "ping_status": status,
                    "stats": worker_stats
                }

        return JSONResponse(content=response)

    except Exception as e:
        logger.error(f"Failed to check worker health: {e}")
        return JSONResponse(
            content={
                "workers_available": False,
                "error": str(e),
                "message": "Failed to connect to Celery workers"
            },
            status_code=500
        )