"""
Async media processing and status tracking tasks.
"""
import os
import json
import logging
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from celery import current_task

# Import celery app
from celery_app import celery_app

# Import the async thumbnail tasks
from .thumbnail_tasks import (
    generate_image_derivatives,
    generate_pdf_thumbnail,
    generate_video_thumbnail,
    generate_audio_waveform
)

LOG = logging.getLogger("voyage_ingest.async_tasks.media_tasks")


def detect_media_type_from_ext(ext: str) -> str:
    """Detect media type from file extension."""
    e = (ext or "").lower()
    IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "tiff"}
    VIDEO_EXTS = {"mp4", "mov", "avi", "mkv"}
    AUDIO_EXTS = {"mp3", "wav", "aac", "ogg"}
    PDF_EXTS = {"pdf"}

    if e in IMAGE_EXTS:
        return "image"
    if e in VIDEO_EXTS:
        return "video"
    if e in AUDIO_EXTS:
        return "audio"
    if e in PDF_EXTS:
        return "pdf"
    return "other"


@celery_app.task(bind=True, name="process_media_derivatives_batch")
def process_media_derivatives_batch(self, media_batch: List[Dict[str, Any]],
                                  voyage_slug: str) -> Dict[str, Any]:
    """
    Process a batch of media items for derivative generation.
    This is the main orchestrator task that delegates to specific thumbnail tasks.
    """
    try:
        self.update_state(
            state="PROCESSING",
            meta={
                "stage": "initializing_batch",
                "progress": 5,
                "total_media": len(media_batch),
                "processed": 0
            }
        )

        results = {}
        task_ids = {}
        processed_count = 0

        # Submit async tasks for each media item
        for i, media_item in enumerate(media_batch):
            media_slug = media_item.get("media_slug", "")
            ext = media_item.get("ext", "")
            credit = media_item.get("credit", "")
            s3_original_key = media_item.get("s3_original_key", "")
            media_type = detect_media_type_from_ext(ext)

            if not all([media_slug, ext, s3_original_key]):
                results[media_slug or f"media_{i}"] = {
                    "status": "skipped",
                    "reason": "Missing required fields (media_slug, ext, or s3_original_key)"
                }
                continue

            # Submit appropriate task based on media type
            task_result = None
            if media_type == "image":
                task_result = generate_image_derivatives.delay(
                    voyage_slug, media_slug, ext, credit, s3_original_key
                )
            elif media_type == "pdf":
                task_result = generate_pdf_thumbnail.delay(
                    voyage_slug, media_slug, ext, credit, s3_original_key
                )
            elif media_type == "video":
                task_result = generate_video_thumbnail.delay(
                    voyage_slug, media_slug, ext, credit, s3_original_key
                )
            elif media_type == "audio":
                task_result = generate_audio_waveform.delay(
                    voyage_slug, media_slug, ext, credit, s3_original_key
                )
            else:
                results[media_slug] = {
                    "status": "skipped",
                    "reason": f"Unsupported media type: {media_type}"
                }
                continue

            if task_result:
                task_ids[media_slug] = {
                    "task_id": task_result.id,
                    "media_type": media_type,
                    "submitted_at": time.time()
                }

            processed_count += 1
            progress = 10 + (processed_count / len(media_batch)) * 20
            self.update_state(
                state="PROCESSING",
                meta={
                    "stage": "submitting_tasks",
                    "progress": int(progress),
                    "total_media": len(media_batch),
                    "processed": processed_count,
                    "submitted_tasks": len(task_ids)
                }
            )

        # Wait for all tasks to complete and collect results
        self.update_state(
            state="PROCESSING",
            meta={
                "stage": "waiting_for_completion",
                "progress": 30,
                "total_tasks": len(task_ids),
                "completed_tasks": 0
            }
        )

        completed_count = 0
        max_wait_time = 600  # 10 minutes timeout
        start_time = time.time()

        while completed_count < len(task_ids) and (time.time() - start_time) < max_wait_time:
            for media_slug, task_info in task_ids.items():
                if media_slug in results:
                    continue  # Already completed

                task_id = task_info["task_id"]
                task_result = celery_app.AsyncResult(task_id)

                if task_result.ready():
                    try:
                        result = task_result.get(timeout=5)
                        results[media_slug] = result
                        completed_count += 1

                        progress = 30 + (completed_count / len(task_ids)) * 60
                        self.update_state(
                            state="PROCESSING",
                            meta={
                                "stage": "collecting_results",
                                "progress": int(progress),
                                "total_tasks": len(task_ids),
                                "completed_tasks": completed_count
                            }
                        )
                    except Exception as e:
                        results[media_slug] = {
                            "status": "error",
                            "error": f"Task execution failed: {str(e)}"
                        }
                        completed_count += 1

            if completed_count < len(task_ids):
                time.sleep(2)  # Wait 2 seconds before checking again

        # Handle any remaining incomplete tasks
        for media_slug, task_info in task_ids.items():
            if media_slug not in results:
                results[media_slug] = {
                    "status": "timeout",
                    "error": "Task did not complete within timeout period",
                    "task_id": task_info["task_id"]
                }

        # Calculate final statistics
        success_count = len([r for r in results.values() if r.get("status") == "success"])
        error_count = len([r for r in results.values() if r.get("status") == "error"])
        skipped_count = len([r for r in results.values() if r.get("status") == "skipped"])
        timeout_count = len([r for r in results.values() if r.get("status") == "timeout"])

        return {
            "batch_status": "completed",
            "voyage_slug": voyage_slug,
            "total_media": len(media_batch),
            "results": results,
            "statistics": {
                "success_count": success_count,
                "error_count": error_count,
                "skipped_count": skipped_count,
                "timeout_count": timeout_count
            },
            "processing_duration": time.time() - start_time,
            "completed_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        LOG.error(f"Batch processing failed for voyage {voyage_slug}: {e}")
        return {
            "batch_status": "error",
            "voyage_slug": voyage_slug,
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat()
        }


@celery_app.task(name="update_media_status")
def update_media_status(media_slug: str, voyage_slug: str, status: str,
                       derivative_urls: Optional[Dict[str, str]] = None,
                       error_message: Optional[str] = None) -> Dict[str, Any]:
    """
    Update media processing status in database.
    This would typically update a media_processing_status table.
    """
    try:
        # This is a placeholder for database update logic
        # In a real implementation, you would:
        # 1. Connect to your database
        # 2. Update the media record with processing status
        # 3. Store derivative URLs if successful
        # 4. Store error message if failed

        LOG.info(f"Media status update: {media_slug} -> {status}")

        status_record = {
            "media_slug": media_slug,
            "voyage_slug": voyage_slug,
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
            "derivative_urls": derivative_urls or {},
            "error_message": error_message
        }

        # TODO: Implement actual database update
        # Example:
        # db_conn = get_database_connection()
        # db_conn.execute("""
        #     UPDATE media SET
        #         processing_status = %s,
        #         thumbnail_url = %s,
        #         preview_url = %s,
        #         processing_error = %s,
        #         processed_at = NOW()
        #     WHERE media_slug = %s AND voyage_slug = %s
        # """, (status, derivative_urls.get('thumbnail_url'),
        #       derivative_urls.get('preview_url'), error_message,
        #       media_slug, voyage_slug))

        return {"status": "updated", "record": status_record}

    except Exception as e:
        LOG.error(f"Failed to update media status for {media_slug}: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="cleanup_failed_derivatives")
def cleanup_failed_derivatives(s3_keys: List[str]) -> Dict[str, Any]:
    """
    Clean up any partially uploaded derivative files from failed processing.
    """
    try:
        import boto3

        AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
        S3_PUBLIC_BUCKET = os.environ.get("S3_PUBLIC_BUCKET", "sequoia-public")

        s3 = boto3.client("s3", region_name=AWS_REGION)
        deleted_count = 0

        for key in s3_keys:
            try:
                s3.delete_object(Bucket=S3_PUBLIC_BUCKET, Key=key)
                deleted_count += 1
                LOG.info(f"Cleaned up failed derivative: {key}")
            except Exception as e:
                LOG.warning(f"Failed to cleanup {key}: {e}")

        return {
            "status": "completed",
            "total_keys": len(s3_keys),
            "deleted_count": deleted_count,
            "cleaned_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        LOG.error(f"Cleanup task failed: {e}")
        return {"status": "error", "error": str(e)}