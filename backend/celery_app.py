"""
Celery configuration for async task processing.
"""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Redis configuration
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "voyage_ingest",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "voyage_ingest.async_tasks.thumbnail_tasks",
        "voyage_ingest.async_tasks.media_tasks"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task routing
    task_routes={
        "voyage_ingest.async_tasks.thumbnail_tasks.*": {"queue": "thumbnails"},
        "voyage_ingest.async_tasks.media_tasks.*": {"queue": "media"},
    },

    # Task execution
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Worker configuration
    worker_prefetch_multiplier=1,  # Process one task at a time per worker
    task_acks_late=True,          # Acknowledge after task completion
    worker_disable_rate_limits=False,

    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    result_backend_transport_options={
        "retry_on_timeout": True,
        "socket_keepalive": True,
        "socket_keepalive_options": {
            1: 1,  # TCP_KEEPIDLE
            2: 3,  # TCP_KEEPINTVL
            3: 5,  # TCP_KEEPCNT
        },
    },

    # Task retry settings
    task_default_retry_delay=60,   # 1 minute
    task_max_retries=3,

    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Auto-discover tasks in voyage_ingest package
celery_app.autodiscover_tasks([
    "voyage_ingest.async_tasks"
])

if __name__ == "__main__":
    celery_app.start()