"""
CRUD endpoints for curator interface - People
Direct database manipulation without JSON intermediary
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from app.db import db_cursor
import logging

LOG = logging.getLogger("app.routers.curator_people")

router = APIRouter(prefix="/api/curator/people", tags=["curator-people"])


class PersonCreate(BaseModel):
    """Schema for creating a new person"""
    person_slug: str = Field(..., description="Unique identifier (e.g., 'truman-harry-s')")
    full_name: str = Field(..., description="Full name of the person")
    role_title: Optional[str] = Field(None, description="Title/Role of the person")
    organization: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    wikipedia_url: Optional[str] = Field(None, description="Wikipedia or bio URL")
    notes_internal: Optional[str] = None
    tags: Optional[str] = None


class PersonUpdate(BaseModel):
    """Schema for updating an existing person (all fields optional)"""
    full_name: Optional[str] = None
    role_title: Optional[str] = None
    organization: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    wikipedia_url: Optional[str] = None
    notes_internal: Optional[str] = None
    tags: Optional[str] = None


class VoyagePassengerLink(BaseModel):
    """Schema for linking a person to a voyage"""
    person_slug: str
    voyage_slug: str
    capacity_role: Optional[str] = Field(None, description="Role on this specific voyage (e.g., 'Guest', 'Admiral')")
    notes: Optional[str] = Field(None, description="Notes specific to this person on this voyage")


def generate_person_slug(full_name: str) -> str:
    """Generate a slug from a person's full name"""
    import re
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    slug = full_name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special characters
    slug = re.sub(r'[\s_]+', '-', slug)   # Replace spaces/underscores with hyphens
    slug = re.sub(r'-+', '-', slug)       # Replace multiple hyphens with single
    return slug.strip('-')


@router.post("/", response_model=Dict[str, Any])
def create_person(person: PersonCreate) -> Dict[str, Any]:
    """Create a new person"""
    try:
        with db_cursor() as cur:
            # Auto-generate slug if not provided
            person_slug = person.person_slug
            if not person_slug or person_slug == "auto":
                person_slug = generate_person_slug(person.full_name)

                # Check for duplicates and append number if needed
                base_slug = person_slug
                counter = 2
                while True:
                    cur.execute(
                        "SELECT person_slug FROM sequoia.people WHERE person_slug = %s",
                        (person_slug,)
                    )
                    if not cur.fetchone():
                        break
                    person_slug = f"{base_slug}-{counter}"
                    counter += 1
            else:
                # Check if person_slug already exists
                cur.execute(
                    "SELECT person_slug FROM sequoia.people WHERE person_slug = %s",
                    (person_slug,)
                )
                if cur.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail=f"Person with slug '{person_slug}' already exists"
                    )

            # Insert the person with the determined slug
            person_data = person.model_dump()
            person_data['person_slug'] = person_slug

            cur.execute("""
                INSERT INTO sequoia.people (
                    person_slug, full_name, role_title, organization,
                    birth_year, death_year, wikipedia_url, notes_internal, tags,
                    created_at, updated_at
                ) VALUES (
                    %(person_slug)s, %(full_name)s, %(role_title)s, %(organization)s,
                    %(birth_year)s, %(death_year)s, %(wikipedia_url)s, %(notes_internal)s, %(tags)s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING *
            """, person_data)

            row = cur.fetchone()
            LOG.info(f"Created person: {person_slug}")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error creating person: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.put("/{person_slug}", response_model=Dict[str, Any])
def update_person(person_slug: str, updates: PersonUpdate) -> Dict[str, Any]:
    """Update an existing person"""
    try:
        with db_cursor() as cur:
            # Check if person exists
            cur.execute(
                "SELECT person_slug FROM sequoia.people WHERE person_slug = %s",
                (person_slug,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Person '{person_slug}' not found")

            # Build dynamic UPDATE query for only provided fields
            update_data = {k: v for k, v in updates.model_dump(exclude_unset=True).items() if v is not None or k in updates.model_fields_set}

            if not update_data:
                raise HTTPException(status_code=400, detail="No fields to update")

            set_clause = ", ".join([f"{k} = %({k})s" for k in update_data.keys()])
            update_data['person_slug'] = person_slug

            cur.execute(f"""
                UPDATE sequoia.people
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE person_slug = %(person_slug)s
                RETURNING *
            """, update_data)

            row = cur.fetchone()
            LOG.info(f"Updated person: {person_slug} ({len(update_data)} fields)")
            return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error updating person: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/{person_slug}")
def delete_person(person_slug: str) -> Dict[str, str]:
    """Delete a person and all voyage associations"""
    try:
        with db_cursor() as cur:
            # Check if person exists
            cur.execute(
                "SELECT person_slug FROM sequoia.people WHERE person_slug = %s",
                (person_slug,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Person '{person_slug}' not found")

            # Delete voyage associations first
            cur.execute("DELETE FROM sequoia.voyage_passengers WHERE person_slug = %s", (person_slug,))
            voyages_deleted = cur.rowcount

            # Delete the person
            cur.execute("DELETE FROM sequoia.people WHERE person_slug = %s", (person_slug,))

            LOG.info(f"Deleted person: {person_slug} (removed from {voyages_deleted} voyages)")

            return {
                "message": f"Person '{person_slug}' deleted successfully",
                "person_slug": person_slug,
                "voyages_removed_from": voyages_deleted
            }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error deleting person: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/link-to-voyage", response_model=Dict[str, str])
def link_person_to_voyage(link: VoyagePassengerLink) -> Dict[str, str]:
    """Link a person to a voyage as a passenger"""
    try:
        with db_cursor() as cur:
            # Verify person exists
            cur.execute("SELECT person_slug FROM sequoia.people WHERE person_slug = %s", (link.person_slug,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Person '{link.person_slug}' not found")

            # Verify voyage exists
            cur.execute("SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s", (link.voyage_slug,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Voyage '{link.voyage_slug}' not found")

            # Insert or update the link
            cur.execute("""
                INSERT INTO sequoia.voyage_passengers (voyage_slug, person_slug, capacity_role, notes)
                VALUES (%(voyage_slug)s, %(person_slug)s, %(capacity_role)s, %(notes)s)
                ON CONFLICT (voyage_slug, person_slug)
                DO UPDATE SET
                    capacity_role = EXCLUDED.capacity_role,
                    notes = EXCLUDED.notes
            """, link.model_dump())

            LOG.info(f"Linked person {link.person_slug} to voyage {link.voyage_slug}")

            return {
                "message": "Person linked to voyage successfully",
                "person_slug": link.person_slug,
                "voyage_slug": link.voyage_slug
            }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error linking person to voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/unlink-from-voyage")
def unlink_person_from_voyage(person_slug: str, voyage_slug: str) -> Dict[str, str]:
    """Remove a person from a voyage"""
    try:
        with db_cursor() as cur:
            cur.execute(
                "DELETE FROM sequoia.voyage_passengers WHERE voyage_slug = %s AND person_slug = %s",
                (voyage_slug, person_slug)
            )

            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No link found between person '{person_slug}' and voyage '{voyage_slug}'"
                )

            LOG.info(f"Unlinked person {person_slug} from voyage {voyage_slug}")

            return {
                "message": "Person unlinked from voyage successfully",
                "person_slug": person_slug,
                "voyage_slug": voyage_slug
            }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error unlinking person from voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/search", response_model=List[Dict[str, Any]])
def search_people(
    q: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Search for people by name (useful for autocomplete in forms)"""
    try:
        with db_cursor(read_only=True) as cur:
            if q:
                cur.execute("""
                    SELECT * FROM sequoia.people
                    WHERE full_name ILIKE %s OR person_slug ILIKE %s
                    ORDER BY full_name
                    LIMIT %s
                """, (f"%{q}%", f"%{q}%", limit))
            else:
                cur.execute("""
                    SELECT * FROM sequoia.people
                    ORDER BY full_name
                    LIMIT %s
                """, (limit,))

            rows = cur.fetchall()
            return [dict(row) for row in rows]

    except Exception as e:
        LOG.error(f"Error searching people: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
