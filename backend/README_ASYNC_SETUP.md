# Async Thumbnail Generation Setup

This document explains how to set up and use the new async thumbnail generation system.

## Overview

The async thumbnail generation system offloads thumbnail/derivative creation from the main ingest pipeline to background workers. This prevents large media files from blocking the voyage ingest process and provides better scalability.

## Architecture

- **Celery**: Task queue system for async processing
- **Redis**: Message broker and result backend
- **Background Workers**: Process thumbnail generation tasks
- **API Endpoints**: Track task status and progress

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start Redis

Option A - Using Docker:
```bash
docker-compose -f docker-compose.redis.yml up -d
```

Option B - Local Redis installation:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server
```

### 3. Run Database Migrations

```bash
psql -d your_database -f migrations/add_async_media_processing.sql
```

### 4. Start Celery Worker

```bash
./start_celery_worker.sh
```

### 5. Start Flower (Optional - for monitoring)

```bash
./start_celery_flower.sh
```

Visit http://localhost:5555 to view the Flower monitoring interface.

## Usage

### Automatic Mode (Default)

When `ASYNC_THUMBNAILS=true` in `.env`, the system automatically:

1. Uploads original media files to S3
2. Queues thumbnail generation tasks for background processing
3. Returns immediately without waiting for thumbnails
4. Processes thumbnails asynchronously in the background

### Manual Control

You can disable async processing by setting `ASYNC_THUMBNAILS=false` to use the original synchronous behavior.

## API Endpoints

### Task Status Tracking

```bash
# Get status of a specific task
GET /api/async/async-tasks/{task_id}

# Get all active tasks
GET /api/async/async-tasks

# Cancel a task
POST /api/async/async-tasks/{task_id}/cancel
```

### Media Processing Status

```bash
# Get processing status for a voyage
GET /api/async/media-processing-status/{voyage_slug}

# Get thumbnail generation statistics
GET /api/async/thumbnail-generation-stats

# Retry failed thumbnails
POST /api/async/retry-failed-thumbnails

# Check worker health
GET /api/async/worker-health
```

## Monitoring

### Flower Web Interface

- URL: http://localhost:5555
- Username: admin
- Password: sequoia_admin

### Log Files

Workers log to stdout by default. To save logs:

```bash
./start_celery_worker.sh worker1 info > celery_worker.log 2>&1 &
```

### Database Queries

Check processing status:

```sql
-- Media processing summary by voyage
SELECT * FROM media_processing_summary;

-- Failed tasks
SELECT * FROM media WHERE processing_status = 'failed';

-- Active task batches
SELECT * FROM async_task_batches WHERE batch_status = 'processing';
```

## Supported Media Types

- **Images**: jpg, jpeg, png, webp, gif, tiff → Preview + Thumbnail
- **PDFs**: pdf → Thumbnail from first page
- **Videos**: mp4, mov, avi, mkv → Frame thumbnail
- **Audio**: mp3, wav, aac, ogg → Waveform visualization

## Performance Tuning

### Worker Configuration

Edit `start_celery_worker.sh`:

- `--concurrency=N`: Number of worker processes (default: 2)
- `--max-tasks-per-child=N`: Restart workers after N tasks (prevents memory leaks)
- `--time-limit=N`: Hard timeout for tasks (default: 1800s = 30min)

### Redis Configuration

For production, tune Redis in `docker-compose.redis.yml`:

- `maxmemory`: Adjust based on available RAM
- `maxmemory-policy`: Choose eviction strategy

### Queue Priority

Tasks are routed to specific queues:

- `thumbnails`: Image/PDF/Video/Audio processing
- `media`: General media tasks
- `default`: Other tasks

## Troubleshooting

### Common Issues

1. **Worker not starting**: Check Redis connection and environment variables
2. **Tasks failing**: Check worker logs and S3 permissions
3. **Thumbnails not appearing**: Check S3 public bucket configuration
4. **High memory usage**: Reduce worker concurrency or add max-tasks-per-child

### Debug Commands

```bash
# Check Redis connection
redis-cli ping

# List active workers
celery -A celery_app inspect active

# Check worker stats
celery -A celery_app inspect stats

# Purge all tasks (development only!)
celery -A celery_app purge
```

### Log Analysis

Enable detailed logging by setting log level to `debug`:

```bash
./start_celery_worker.sh worker1 debug
```

## Production Deployment

### Systemd Service

Create `/etc/systemd/system/celery-sequoia.service`:

```ini
[Unit]
Description=Celery Worker for Sequoia
After=network.target redis.service

[Service]
Type=forking
User=sequoia
Group=sequoia
WorkingDirectory=/path/to/sequoia-project/backend
Environment=REDIS_URL=redis://localhost:6379/0
ExecStart=/path/to/sequoia-project/backend/start_celery_worker.sh production_worker
Restart=always

[Install]
WantedBy=multi-user.target
```

### Process Manager

For multiple workers:

```bash
# Start multiple workers
for i in {1..4}; do
    ./start_celery_worker.sh worker$i info > worker$i.log 2>&1 &
done
```

### Health Monitoring

Set up monitoring alerts for:

- Worker availability (`GET /api/async/worker-health`)
- Failed task rate
- Queue depth
- Processing delays