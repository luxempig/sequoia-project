"""
CRUD endpoints for curator interface - Presidents/Owners
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.db import db_cursor
import logging
import re
from datetime import date

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
    president_slug: str = Field(..., description="Unique slug for president")
    full_name: str = Field(..., description="Full name of president/owner")
    party: str = Field(..., description="Type: 'Democratic', 'Republican', 'Private Owner', or 'U.S. Navy'")
    term_start: Optional[str] = Field(None, description="Start of term (YYYY-MM-DD)")
    term_end: Optional[str] = Field(None, description="End of term (YYYY-MM-DD)")
    wikipedia_url: Optional[str] = Field(None, description="Wikipedia URL")
    tags: Optional[str] = Field(None, description="Comma-separated tags")

    def model_post_init(self, __context):
        """Validate party field"""
        valid_parties = ['Democratic', 'Republican', 'Private Owner', 'U.S. Navy']
        if self.party and self.party not in valid_parties:
            raise ValueError(f"Party must be one of: {', '.join(valid_parties)}")


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
                    president_slug, full_name, party, term_start, term_end,
                    wikipedia_url, tags, created_at, updated_at
                ) VALUES (
                    %(president_slug)s, %(full_name)s, %(party)s, %(term_start)s, %(term_end)s,
                    %(wikipedia_url)s, %(tags)s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
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
