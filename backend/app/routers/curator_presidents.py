"""
CRUD endpoints for curator interface - Presidents/Owners
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from app.db import db_cursor
import logging
import re

LOG = logging.getLogger("app.routers.curator_presidents")

router = APIRouter(prefix="/api/curator/presidents", tags=["curator-presidents"])


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


class PresidentCreate(BaseModel):
    """Schema for creating a new president/owner"""
    president_slug: str
    person_slug: str
    start_year: int
    end_year: Optional[int] = None


@router.post("/", response_model=Dict[str, Any])
def create_president(president: PresidentCreate) -> Dict[str, Any]:
    """Create a new president/owner entry"""
    try:
        with db_cursor() as cur:
            # Check if president_slug already exists
            cur.execute(
                "SELECT president_slug FROM sequoia.presidents WHERE president_slug = %s",
                (president.president_slug,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=409,
                    detail=f"President with ID '{president.president_slug}' already exists"
                )

            # Insert the president
            cur.execute("""
                INSERT INTO sequoia.presidents (
                    president_slug, person_slug, start_year, end_year,
                    created_at, updated_at
                ) VALUES (
                    %(president_slug)s, %(person_slug)s, %(start_year)s, %(end_year)s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING *
            """, president.model_dump())

            row = cur.fetchone()
            LOG.info(f"Created president: {president.president_slug}")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error creating president: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
