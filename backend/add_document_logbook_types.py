#!/usr/bin/env python3
"""
Add 'document' and 'logbook' media types to the enum.
"""

import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from db import db_cursor

def add_media_types():
    """Add document and logbook to media_type enum"""

    with db_cursor() as cur:
        print("Adding 'document' media type...")
        try:
            cur.execute("ALTER TYPE sequoia.media_type ADD VALUE IF NOT EXISTS 'document'")
            print("✓ Added 'document' media type")
        except Exception as e:
            print(f"Note: {e}")

    # Need separate transaction for next enum value
    with db_cursor() as cur:
        print("Adding 'logbook' media type...")
        try:
            cur.execute("ALTER TYPE sequoia.media_type ADD VALUE IF NOT EXISTS 'logbook'")
            print("✓ Added 'logbook' media type")
        except Exception as e:
            print(f"Note: {e}")

    print("\n✅ Media types updated successfully!")
    print("\nAvailable media types now:")
    print("  - article")
    print("  - image")
    print("  - video")
    print("  - audio")
    print("  - book")
    print("  - document (NEW)")
    print("  - logbook (NEW)")
    print("  - other")

if __name__ == "__main__":
    confirm = input("Add 'document' and 'logbook' media types? (yes/no): ")
    if confirm.lower() == 'yes':
        add_media_types()
    else:
        print("Cancelled")
