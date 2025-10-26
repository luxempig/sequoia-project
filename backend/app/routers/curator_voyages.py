"""
CRUD endpoints for curator interface - Voyages
Direct database manipulation without JSON intermediary
"""
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from app.db import db_cursor
import logging
import re
import json

LOG = logging.getLogger("app.routers.curator_voyages")

router = APIRouter(prefix="/api/curator/voyages", tags=["curator-voyages"])


def normalize_source_urls(value: Union[List[str], List[Dict[str, str]], None]) -> Optional[List[str]]:
    """
    Convert source_urls to list of JSON strings.
    Accepts either:
    - List of JSON strings (already correct format)
    - List of dicts (from frontend) - converts to JSON strings
    """
    if value is None:
        return None

    result = []
    for item in value:
        if isinstance(item, str):
            # Already a JSON string
            result.append(item)
        elif isinstance(item, dict):
            # Convert dict to JSON string
            result.append(json.dumps(item))
        else:
            # Unknown type, skip
            LOG.warning(f"Unknown source_url type: {type(item)}")

    return result if result else None


def parse_voyage_sources(voyage: Dict[str, Any]) -> Dict[str, Any]:
    """Parse source_urls from JSON strings to objects for API responses"""
    if voyage.get('source_urls'):
        try:
            # If source_urls is a list of JSON strings, parse each one
            if isinstance(voyage['source_urls'], list) and voyage['source_urls']:
                if isinstance(voyage['source_urls'][0], str):
                    voyage['source_urls'] = [json.loads(s) for s in voyage['source_urls']]
        except (json.JSONDecodeError, TypeError, IndexError):
            # If parsing fails, leave as is
            pass
    return voyage


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text


def generate_voyage_slug(president_slug: Optional[str], start_date: Optional[str], cur) -> str:
    """
    Auto-generate voyage slug from president and date
    Format: president-YYYY-MM-DD or voyage-YYYY-MM-DD if no president
    Handles deduplication with -2, -3, etc.
    """
    if not start_date:
        # No date provided, use timestamp
        base_slug = f"voyage-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    else:
        # Extract YYYY-MM-DD
        date_part = start_date[:10] if len(start_date) >= 10 else start_date

        if president_slug:
            base_slug = f"{president_slug}-{date_part}"
        else:
            base_slug = f"voyage-{date_part}"

    # Check if slug exists and deduplicate
    final_slug = base_slug
    counter = 2

    while True:
        cur.execute(
            "SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s",
            (final_slug,)
        )
        if not cur.fetchone():
            break
        final_slug = f"{base_slug}-{counter}"
        counter += 1

    return final_slug


class VoyageCreate(BaseModel):
    """Schema for creating a new voyage"""
    voyage_slug: Optional[str] = Field(None, description="Unique identifier (auto-generated if not provided)")
    title: Optional[str] = None
    start_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="ISO date YYYY-MM-DD")
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_timestamp: Optional[str] = None
    end_timestamp: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_type: Optional[str] = Field(None, description="One of: official, private, maintenance, other")
    summary_markdown: Optional[str] = None
    notes_internal: Optional[str] = None
    additional_information: Optional[str] = None
    additional_sources: Optional[str] = None
    notes: Optional[str] = None
    spin: Optional[str] = None
    spin_source: Optional[str] = None
    source_urls: Optional[Union[List[str], List[Dict[str, str]]]] = Field(None, description="List of source URLs (strings or objects)")
    tags: Optional[str] = None
    president_slug_from_voyage: Optional[str] = None

    @field_validator('source_urls', mode='before')
    @classmethod
    def normalize_sources(cls, v):
        return normalize_source_urls(v)

    # Boolean metadata flags
    has_photo: bool = False
    has_video: bool = False
    presidential_use: bool = False
    has_royalty: bool = False
    has_foreign_leader: bool = False
    mention_camp_david: bool = False
    mention_mount_vernon: bool = False
    mention_captain: bool = False
    mention_crew: bool = False
    mention_rmd: bool = False
    mention_yacht_spin: bool = False
    mention_menu: bool = False
    mention_drinks_wine: bool = False

    # Associated text fields
    presidential_initials: Optional[str] = None
    royalty_details: Optional[str] = None
    foreign_leader_country: Optional[str] = None

    # Legacy fields
    significant: bool = False
    royalty: bool = False


class VoyageUpdate(BaseModel):
    """Schema for updating an existing voyage (all fields optional)"""
    title: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_timestamp: Optional[str] = None
    end_timestamp: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_type: Optional[str] = None
    summary_markdown: Optional[str] = None
    notes_internal: Optional[str] = None
    additional_information: Optional[str] = None
    additional_sources: Optional[str] = None
    notes: Optional[str] = None
    spin: Optional[str] = None
    spin_source: Optional[str] = None
    source_urls: Optional[Union[List[str], List[Dict[str, str]]]] = None
    tags: Optional[str] = None
    president_slug_from_voyage: Optional[str] = None

    @field_validator('source_urls', mode='before')
    @classmethod
    def normalize_sources(cls, v):
        return normalize_source_urls(v)

    # Boolean metadata flags
    has_photo: Optional[bool] = None
    has_video: Optional[bool] = None
    presidential_use: Optional[bool] = None
    has_royalty: Optional[bool] = None
    has_foreign_leader: Optional[bool] = None
    mention_camp_david: Optional[bool] = None
    mention_mount_vernon: Optional[bool] = None
    mention_captain: Optional[bool] = None
    mention_crew: Optional[bool] = None
    mention_rmd: Optional[bool] = None
    mention_yacht_spin: Optional[bool] = None
    mention_menu: Optional[bool] = None
    mention_drinks_wine: Optional[bool] = None

    # Associated text fields
    presidential_initials: Optional[str] = None
    royalty_details: Optional[str] = None
    foreign_leader_country: Optional[str] = None

    # Legacy fields
    significant: Optional[bool] = None
    royalty: Optional[bool] = None


@router.post("/", response_model=Dict[str, Any])
def create_voyage(voyage: VoyageCreate) -> Dict[str, Any]:
    """Create a new voyage"""
    try:
        with db_cursor() as cur:
            # Auto-generate slug if not provided or empty string
            if not voyage.voyage_slug or voyage.voyage_slug.strip() == '':
                voyage.voyage_slug = generate_voyage_slug(
                    voyage.president_slug_from_voyage,
                    voyage.start_date,
                    cur
                )
                LOG.info(f"Auto-generated voyage slug: {voyage.voyage_slug}")
            else:
                # Check if manually provided slug already exists
                cur.execute(
                    "SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s",
                    (voyage.voyage_slug,)
                )
                if cur.fetchone():
                    raise HTTPException(
                        status_code=409,
                        detail=f"Voyage with slug '{voyage.voyage_slug}' already exists"
                    )

            # Validate voyage_type
            if voyage.voyage_type and voyage.voyage_type not in ['official', 'private', 'maintenance', 'other']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid voyage_type: {voyage.voyage_type}. Must be one of: official, private, maintenance, other"
                )

            # Insert the voyage (excluding legacy fields that don't exist in DB)
            voyage_data = voyage.model_dump(exclude={'significant', 'royalty'})

            # Combine date + time into timestamps if both are provided
            if voyage.start_date and voyage.start_time:
                voyage_data['start_timestamp'] = f"{voyage.start_date} {voyage.start_time}"
            if voyage.end_date and voyage.end_time:
                voyage_data['end_timestamp'] = f"{voyage.end_date} {voyage.end_time}"

            cur.execute("""
                INSERT INTO sequoia.voyages (
                    voyage_slug, title, start_date, end_date, start_time, end_time,
                    start_timestamp, end_timestamp, origin, destination,
                    start_location, end_location, vessel_name, voyage_type,
                    summary_markdown, notes_internal, additional_information,
                    additional_sources, notes, spin, spin_source,
                    source_urls, tags, president_slug_from_voyage,
                    has_photo, has_video, presidential_use, has_royalty, has_foreign_leader,
                    mention_camp_david, mention_mount_vernon, mention_captain, mention_crew,
                    mention_rmd, mention_yacht_spin, mention_menu, mention_drinks_wine,
                    presidential_initials, royalty_details, foreign_leader_country,
                    created_at, updated_at
                ) VALUES (
                    %(voyage_slug)s, %(title)s, %(start_date)s, %(end_date)s, %(start_time)s, %(end_time)s,
                    %(start_timestamp)s, %(end_timestamp)s, %(origin)s, %(destination)s,
                    %(start_location)s, %(end_location)s, %(vessel_name)s, %(voyage_type)s,
                    %(summary_markdown)s, %(notes_internal)s, %(additional_information)s,
                    %(additional_sources)s, %(notes)s, %(spin)s, %(spin_source)s,
                    %(source_urls)s, %(tags)s, %(president_slug_from_voyage)s,
                    %(has_photo)s, %(has_video)s, %(presidential_use)s, %(has_royalty)s, %(has_foreign_leader)s,
                    %(mention_camp_david)s, %(mention_mount_vernon)s, %(mention_captain)s, %(mention_crew)s,
                    %(mention_rmd)s, %(mention_yacht_spin)s, %(mention_menu)s, %(mention_drinks_wine)s,
                    %(presidential_initials)s, %(royalty_details)s, %(foreign_leader_country)s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING *
            """, voyage_data)

            row = cur.fetchone()
            LOG.info(f"Created voyage: {voyage.voyage_slug}")
            return parse_voyage_sources(dict(row))

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error creating voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.put("/{voyage_slug}", response_model=Dict[str, Any])
def update_voyage(voyage_slug: str, updates: VoyageUpdate) -> Dict[str, Any]:
    """Update an existing voyage"""
    try:
        with db_cursor() as cur:
            # Check if voyage exists and get current data
            cur.execute(
                "SELECT * FROM sequoia.voyages WHERE voyage_slug = %s",
                (voyage_slug,)
            )
            current_voyage = cur.fetchone()
            if not current_voyage:
                raise HTTPException(status_code=404, detail=f"Voyage '{voyage_slug}' not found")

            # Validate voyage_type if provided
            if updates.voyage_type and updates.voyage_type not in ['official', 'private', 'maintenance', 'other']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid voyage_type: {updates.voyage_type}. Must be one of: official, private, maintenance, other"
                )

            # Build dynamic UPDATE query for only provided fields
            update_data = {k: v for k, v in updates.model_dump(exclude_unset=True).items() if v is not None or k in updates.model_fields_set}

            if not update_data:
                raise HTTPException(status_code=400, detail="No fields to update")

            # Recalculate timestamps if date or time fields are being updated
            # Use updated values if provided, otherwise use current values
            start_date = update_data.get('start_date', current_voyage['start_date'])
            start_time = update_data.get('start_time', current_voyage['start_time'])
            end_date = update_data.get('end_date', current_voyage['end_date'])
            end_time = update_data.get('end_time', current_voyage['end_time'])

            if start_date and start_time:
                update_data['start_timestamp'] = f"{start_date} {start_time}"
            elif 'start_date' in update_data or 'start_time' in update_data:
                # One was updated but not both - clear timestamp if one is now missing
                if not (start_date and start_time):
                    update_data['start_timestamp'] = None

            if end_date and end_time:
                update_data['end_timestamp'] = f"{end_date} {end_time}"
            elif 'end_date' in update_data or 'end_time' in update_data:
                # One was updated but not both - clear timestamp if one is now missing
                if not (end_date and end_time):
                    update_data['end_timestamp'] = None

            set_clause = ", ".join([f"{k} = %({k})s" for k in update_data.keys()])
            update_data['voyage_slug'] = voyage_slug

            cur.execute(f"""
                UPDATE sequoia.voyages
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE voyage_slug = %(voyage_slug)s
                RETURNING *
            """, update_data)

            row = cur.fetchone()
            LOG.info(f"Updated voyage: {voyage_slug} ({len(update_data)} fields)")
            return parse_voyage_sources(dict(row))

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error updating voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/{voyage_slug}")
def delete_voyage(voyage_slug: str) -> Dict[str, Any]:
    """Delete a voyage and all its relationships (orphaned passengers are deleted, media is preserved)"""
    try:
        with db_cursor() as cur:
            # Check if voyage exists
            cur.execute(
                "SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s",
                (voyage_slug,)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Voyage '{voyage_slug}' not found")

            # Get all passengers linked to this voyage
            cur.execute(
                "SELECT person_slug FROM sequoia.voyage_passengers WHERE voyage_slug = %s",
                (voyage_slug,)
            )
            passenger_slugs = [row['person_slug'] for row in cur.fetchall()]

            # Delete passenger relationships
            cur.execute("DELETE FROM sequoia.voyage_passengers WHERE voyage_slug = %s", (voyage_slug,))
            passengers_unlinked = cur.rowcount

            # Delete orphaned passengers (those with no remaining voyage links)
            orphaned_passengers = 0
            for person_slug in passenger_slugs:
                cur.execute(
                    "SELECT COUNT(*) as count FROM sequoia.voyage_passengers WHERE person_slug = %s",
                    (person_slug,)
                )
                result = cur.fetchone()
                remaining_links = result['count'] if result else 0

                if remaining_links == 0:
                    cur.execute("DELETE FROM sequoia.people WHERE person_slug = %s", (person_slug,))
                    orphaned_passengers += 1
                    LOG.info(f"Deleted orphaned passenger: {person_slug}")

            # Delete media relationships (keep media in database)
            cur.execute("DELETE FROM sequoia.voyage_media WHERE voyage_slug = %s", (voyage_slug,))
            media_unlinked = cur.rowcount

            # Delete president relationships
            cur.execute("DELETE FROM sequoia.voyage_presidents WHERE voyage_slug = %s", (voyage_slug,))
            presidents_unlinked = cur.rowcount

            # Delete the voyage itself
            cur.execute("DELETE FROM sequoia.voyages WHERE voyage_slug = %s", (voyage_slug,))

            LOG.info(f"Deleted voyage: {voyage_slug} (passengers unlinked: {passengers_unlinked}, orphaned deleted: {orphaned_passengers}, media unlinked: {media_unlinked}, presidents unlinked: {presidents_unlinked})")

            return {
                "message": f"Voyage '{voyage_slug}' deleted successfully",
                "voyage_slug": voyage_slug,
                "passengers_unlinked": passengers_unlinked,
                "orphaned_passengers_deleted": orphaned_passengers,
                "media_unlinked": media_unlinked,
                "presidents_unlinked": presidents_unlinked
            }

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error deleting voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{voyage_slug}/duplicate", response_model=Dict[str, Any])
def duplicate_voyage(voyage_slug: str, new_slug: str = Body(..., embed=True)) -> Dict[str, Any]:
    """Duplicate an existing voyage with a new slug"""
    try:
        with db_cursor() as cur:
            # Check if source voyage exists
            cur.execute("SELECT * FROM sequoia.voyages WHERE voyage_slug = %s", (voyage_slug,))
            source = cur.fetchone()
            if not source:
                raise HTTPException(status_code=404, detail=f"Source voyage '{voyage_slug}' not found")

            # Check if new slug already exists
            cur.execute("SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s", (new_slug,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail=f"Voyage with slug '{new_slug}' already exists")

            # Create new voyage with all fields from source except slug and timestamps
            source_dict = dict(source)
            source_dict['voyage_slug'] = new_slug
            source_dict.pop('created_at', None)
            source_dict.pop('updated_at', None)

            # Insert the duplicated voyage
            columns = ', '.join(source_dict.keys())
            placeholders = ', '.join([f'%({k})s' for k in source_dict.keys()])

            cur.execute(f"""
                INSERT INTO sequoia.voyages ({columns}, created_at, updated_at)
                VALUES ({placeholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING *
            """, source_dict)

            new_voyage = cur.fetchone()

            # Optionally duplicate relationships (passengers, media, presidents)
            # Copy passengers
            cur.execute("""
                INSERT INTO sequoia.voyage_passengers (voyage_slug, person_slug, capacity_role, notes)
                SELECT %s, person_slug, capacity_role, notes
                FROM sequoia.voyage_passengers
                WHERE voyage_slug = %s
            """, (new_slug, voyage_slug))
            passengers_copied = cur.rowcount

            # Copy media
            cur.execute("""
                INSERT INTO sequoia.voyage_media (voyage_slug, media_slug, sort_order, notes)
                SELECT %s, media_slug, sort_order, notes
                FROM sequoia.voyage_media
                WHERE voyage_slug = %s
            """, (new_slug, voyage_slug))
            media_copied = cur.rowcount

            # Copy presidents
            cur.execute("""
                INSERT INTO sequoia.voyage_presidents (voyage_slug, president_slug)
                SELECT %s, president_slug
                FROM sequoia.voyage_presidents
                WHERE voyage_slug = %s
            """, (new_slug, voyage_slug))
            presidents_copied = cur.rowcount

            LOG.info(f"Duplicated voyage {voyage_slug} -> {new_slug} (passengers: {passengers_copied}, media: {media_copied}, presidents: {presidents_copied})")

            result = dict(new_voyage)
            result['_duplication_info'] = {
                "passengers_copied": passengers_copied,
                "media_copied": media_copied,
                "presidents_copied": presidents_copied
            }

            return result

    except HTTPException:
        raise
    except Exception as e:
        LOG.error(f"Error duplicating voyage: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
