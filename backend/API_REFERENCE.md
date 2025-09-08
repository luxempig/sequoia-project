# Sequoia Backend API Reference

## Base URL
- Development: `http://localhost:8000` (when running locally)
- Your server: Update with your actual server URL

## Core Endpoints

### Voyages
- `GET /api/voyages/` - List voyages with filtering
- `GET /api/voyages/{voyage_slug}` - Get specific voyage
- `GET /api/voyages/{voyage_slug}/people` - Get voyage passengers
- `GET /api/voyages/{voyage_slug}/presidents` - Get voyage presidents

### Media
- `GET /api/media/` - List media with filtering
- `GET /api/media/by-voyage/{voyage_slug}` - Media for specific voyage
- `GET /api/media/{media_slug}` - Get specific media item

### Presidents & People
- `GET /api/presidents/` - List presidents
- `GET /api/people/` - List people

### Ingest Management (NEW)
- `POST /api/ingest/trigger?dry_run=true` - Trigger voyage_ingest process
- `GET /api/ingest/status/{task_id}` - Check ingest task status
- `GET /api/ingest/logs` - View recent ingest logs
- `GET /api/ingest/stats` - Get data statistics
- `POST /api/ingest/cleanup/orphans?dry_run=true` - Clean up orphaned data

### System
- `GET /health` - Health check endpoint
- `GET /` - API welcome message

## Key Features Added
- Enhanced error handling with structured responses
- Read-only database transactions for performance
- Background task support for long-running operations
- Comprehensive thumbnail generation (images, PDFs, videos, audio)
- Voyage ingest integration with dry-run support

## CORS
Configured for `localhost:3000` frontend development.

## Media URLs
- Images: Returns preview URLs (public bucket)
- PDFs/Videos/Audio: Returns thumbnail URLs (public bucket)
- Presigned URLs available with `?presign=true` parameter