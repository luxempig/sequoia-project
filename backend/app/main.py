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

from app.routers.meta        import router as meta_router
from app.routers.voyages     import router as voyages_router
from app.routers.media       import router as media_router
from app.routers.presidents  import router as presidents_router
from app.routers.people      import router as people_router
from app.routers.ingest      import router as ingest_router
from app.routers.analytics   import router as analytics_router
from app.routers.curator     import router as curator_router
from app.routers.async_media import router as async_media_router

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
app.include_router(async_media_router, prefix="/api/async", tags=["async-media"])

@app.get("/", tags=["root"])
def read_root():
    return {
        "message": "Welcome to the Sequoia API (slug schema)",
        "version": "truman-json-fix-v2025.09.14-23:06",
        "endpoints": ["/truman.json", "/health", "/api/voyages", "/api/curator/truman.json"]
    }

@app.get("/truman.json", tags=["data"])
def get_truman_data():
    """Serve the truman_translated.json file for the curator interface."""
    import os
    import json

    json_path = os.path.join(os.path.dirname(__file__), "..", "..", "truman_translated.json")

    try:
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data
        else:
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
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to load truman data: {str(e)}")


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
