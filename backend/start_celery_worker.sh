#!/bin/bash

# Start Celery worker for async thumbnail generation
# Usage: ./start_celery_worker.sh [worker_name]

WORKER_NAME=${1:-"thumbnail_worker"}
LOG_LEVEL=${2:-"info"}

echo "Starting Celery worker: $WORKER_NAME"
echo "Log level: $LOG_LEVEL"
echo "Redis URL: ${REDIS_URL:-redis://localhost:6379/0}"

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment from .env file"
    export $(grep -v '^#' .env | xargs)
fi

# Start the worker with specific queues
celery -A celery_app worker \
    --loglevel=$LOG_LEVEL \
    --queues=thumbnails,media,default \
    --hostname=$WORKER_NAME@%h \
    --concurrency=2 \
    --max-tasks-per-child=1000 \
    --time-limit=1800 \
    --soft-time-limit=1500 \
    --prefetch-multiplier=1