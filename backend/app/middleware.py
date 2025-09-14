import logging
import time
import traceback
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import psycopg2

LOG = logging.getLogger("app.middleware")

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware for consistent error responses."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Log successful requests
            process_time = time.time() - start_time
            LOG.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
            
            return response
            
        except HTTPException as e:
            # FastAPI HTTPExceptions - let them pass through
            process_time = time.time() - start_time  
            LOG.warning(f"{request.method} {request.url.path} - {e.status_code} {e.detail} - {process_time:.3f}s")
            raise
            
        except psycopg2.Error as e:
            # Database errors - let route handlers try their fallbacks first
            process_time = time.time() - start_time
            LOG.error(f"Database error on {request.method} {request.url.path}: {e} - {process_time:.3f}s")
            
            # For API routes that should have mock data fallbacks, don't intercept the error
            if request.url.path.startswith("/api/voyages") or request.url.path.startswith("/api/presidents") or request.url.path.startswith("/api/media"):
                # Let the route handler's try-catch blocks handle this
                raise
                
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Database error",
                    "detail": "An internal database error occurred. Please try again later.",
                    "type": "database_error"
                }
            )
            
        except ValueError as e:
            # Input validation errors
            process_time = time.time() - start_time
            LOG.warning(f"Validation error on {request.method} {request.url.path}: {e} - {process_time:.3f}s")
            
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Validation error", 
                    "detail": str(e),
                    "type": "validation_error"
                }
            )
            
        except Exception as e:
            # Unexpected errors
            process_time = time.time() - start_time
            LOG.error(f"Unexpected error on {request.method} {request.url.path}: {e} - {process_time:.3f}s")
            LOG.error(f"Traceback: {traceback.format_exc()}")
            
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "detail": "An unexpected error occurred. Please try again later.",
                    "type": "internal_error"
                }
            )

class LoggingMiddleware(BaseHTTPMiddleware):
    """Request/response logging middleware."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Log request details for debugging
        LOG.debug(f"Request: {request.method} {request.url}")
        LOG.debug(f"Headers: {dict(request.headers)}")
        LOG.debug(f"Query params: {dict(request.query_params)}")
        
        response = await call_next(request)
        
        LOG.debug(f"Response status: {response.status_code}")
        
        return response