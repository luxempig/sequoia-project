#!/bin/bash

# Start Flower (Celery monitoring web interface)
# Usage: ./start_celery_flower.sh [port]

PORT=${1:-5555}

echo "Starting Flower monitoring interface on port $PORT"
echo "Redis URL: ${REDIS_URL:-redis://localhost:6379/0}"

# Ensure we're in the correct directory
cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment from .env file"
    export $(grep -v '^#' .env | xargs)
fi

# Start Flower
celery -A celery_app flower \
    --port=$PORT \
    --basic_auth=admin:sequoia_admin \
    --url_prefix=flower