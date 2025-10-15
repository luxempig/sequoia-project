import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.middleware import ErrorHandlingMiddleware, LoggingMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
    ]
)

logger = logging.getLogger(__name__)

from app.routers.meta        import router as meta_router
from app.routers.voyages     import router as voyages_router
from app.routers.media       import router as media_router
from app.routers.presidents  import router as presidents_router
from app.routers.people      import router as people_router
from app.routers.ingest      import router as ingest_router
from app.routers.analytics   import router as analytics_router
from app.routers.curator     import router as curator_router
from app.routers.curator_voyages import router as curator_voyages_router
from app.routers.curator_people  import router as curator_people_router
from app.routers.curator_media   import router as curator_media_router
# from app.routers.async_media import router as async_media_router  # Temporarily disabled due to celery dependency

s = get_settings()
app = FastAPI(
    title=s.APP_TITLE,
    description="Sequoia Presidential Yacht API - Historical voyage data with media and passenger records",
    version="1.0.0",
)

# Add middleware (order matters - first added = outermost)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware) 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in s.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta_router)
app.include_router(voyages_router)
app.include_router(media_router)
app.include_router(presidents_router)
app.include_router(people_router)
app.include_router(ingest_router)
app.include_router(analytics_router)
app.include_router(curator_router, prefix="/api/curator", tags=["curator"])
app.include_router(curator_voyages_router)
app.include_router(curator_people_router)
app.include_router(curator_media_router)
# app.include_router(async_media_router, prefix="/api/async", tags=["async-media"])  # Temporarily disabled

@app.get("/", tags=["root"])
def read_root():
    return {
        "message": "Welcome to the Sequoia API (slug schema)",
        "version": "truman-json-fix-v2025.09.14-23:06",
        "endpoints": ["/canonical_timeline.json", "/health", "/api/voyages", "/api/curator/canonical_timeline.json"]
    }

@app.get("/canonical_timeline.json", tags=["data"])
def get_canonical_timeline_data():
    """Serve the canonical timeline data from output.json for the curator interface."""
    import os
    import json

    json_path = os.path.join(os.path.dirname(__file__), "..", "canonical_voyages.json")

    try:
        logging.info(f"DEBUG: Trying to load from: {json_path}")
        logging.info(f"DEBUG: File exists: {os.path.exists(json_path)}")
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logging.info(f"DEBUG: Loaded {len(data)} presidents")
            return data
        else:
            logging.info(f"DEBUG: File not found at {json_path}")
            # Return empty structure if file doesn't exist
            return {
                "truman-harry-s": {
                    "president": {
                        "president_slug": "truman-harry-s",
                        "full_name": "Harry S. Truman",
                        "term_start": "1945-04-12",
                        "term_end": "1953-01-20",
                        "party": "Democratic"
                    },
                    "voyages": [],
                    "passengers": [],
                    "media": []
                }
            }
    except Exception as e:
        logging.error(f"ERROR loading canonical timeline: {e}")
        import traceback
        logging.error(traceback.format_exc())
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to load canonical timeline data: {str(e)}")


@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint for monitoring."""
    from app.db import db_cursor
    try:
        # Test database connection
        with db_cursor(read_only=True) as cur:
            cur.execute("SELECT 1")
            cur.fetchone()

        return {
            "status": "healthy",
            "database": "connected",
            "backend": "running",
            "timestamp": "2025-09-09T05:52:00Z"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "backend": "error",
            "error": str(e),
            "timestamp": "2025-09-09T05:52:00Z"
        }
