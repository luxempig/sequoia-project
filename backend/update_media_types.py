#!/usr/bin/env python3
"""
Update media_type_enum to: article, image, video, audio, book, other
Migrate existing 'pdf' entries to 'article'
"""
from app.db import db_cursor
import logging

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger(__name__)


def update_media_types():
    """Update media type enum and migrate existing data"""

    LOG.info("Starting media type migration...")

    # Step 1: Update existing 'pdf' entries to 'other' (temporary)
    with db_cursor() as cur:
        cur.execute("""
            UPDATE sequoia.media
            SET media_type = 'other'
            WHERE media_type = 'pdf'
        """)
        pdf_count = cur.rowcount
        LOG.info(f"Temporarily changed {pdf_count} 'pdf' entries to 'other'")

    # Step 2: Add new enum values (must be in separate transactions)
    with db_cursor() as cur:
        LOG.info("Adding 'article' to enum...")
        cur.execute("ALTER TYPE sequoia.media_type_enum ADD VALUE IF NOT EXISTS 'article'")

    with db_cursor() as cur:
        LOG.info("Adding 'book' to enum...")
        cur.execute("ALTER TYPE sequoia.media_type_enum ADD VALUE IF NOT EXISTS 'book'")

    # Step 3: Update the temporarily changed entries to 'article'
    with db_cursor() as cur:
        cur.execute("""
            UPDATE sequoia.media
            SET media_type = 'article'
            WHERE media_type = 'other' AND (
                s3_url LIKE '%.pdf' OR
                public_derivative_url LIKE '%.pdf' OR
                google_drive_link LIKE '%.pdf'
            )
        """)
        article_count = cur.rowcount
        LOG.info(f"Migrated {article_count} PDF entries to 'article'")

    # Note: We cannot remove 'pdf' from the enum without recreating it
    # PostgreSQL doesn't support removing enum values
    # The 'pdf' value will remain in the enum but won't be used

    LOG.info("✓ Migration complete!")
    LOG.info("Note: 'pdf' remains in enum (PostgreSQL limitation) but won't be used")
    LOG.info("New types available: article, image, video, audio, book, other")


if __name__ == "__main__":
    LOG.info("Updating media type enum...")
    update_media_types()
    LOG.info("Done!")
