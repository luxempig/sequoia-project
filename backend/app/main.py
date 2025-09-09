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

@app.get("/", tags=["root"])
def read_root():
    return {"message": "Welcome to the Sequoia API (slug schema)"}

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
            "timestamp": "2025-09-09T05:46:00Z"
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "database": "disconnected",
            "backend": "error",
            "error": str(e),
            "timestamp": "2025-09-09T05:46:00Z"
        }
