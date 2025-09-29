#!/usr/bin/env python3
"""
Debug script to check why media isn't showing for a specific voyage.
Usage: python3 scripts/debug_voyage_media.py nixon-richard-1971-08-02
"""
import sys
import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/debug_voyage_media.py <voyage-slug>")
        sys.exit(1)

    voyage_slug = sys.argv[1]

    # Database connection
    db_host = os.environ.get("DB_HOST", "localhost")
    db_name = os.environ.get("DB_NAME", "sequoia_db")
    db_user = os.environ.get("DB_USER", "sequoia")
    db_password = os.environ.get("DB_PASSWORD", "")

    print("=" * 70)
    print(f"DEBUGGING MEDIA FOR VOYAGE: {voyage_slug}")
    print("=" * 70)

    # 1. Check canonical JSON
    print("\n[1] CANONICAL JSON:")
    print("-" * 70)
    try:
        with open('canonical_voyages.json') as f:
            data = json.load(f)

        found_voyage = None
        for president_key, president_data in data.items():
            voyages = president_data.get('voyages', [])
            for v in voyages:
                if v.get('voyage') == voyage_slug:
                    found_voyage = v
                    break
            if found_voyage:
                break

        if found_voyage:
            print(f"✓ Found in JSON")
            media_items = found_voyage.get('media', [])
            print(f"  Media count: {len(media_items)}")
            for idx, m in enumerate(media_items, 1):
                print(f"\n  Media #{idx}:")
                print(f"    media_name: {m.get('media_name')}")
                print(f"    link: {m.get('link', '')[:80]}")
                print(f"    platform: {m.get('platform')}")
                print(f"    source: {m.get('source')}")
                print(f"    date: {m.get('date') or '(empty)'}")
        else:
            print(f"✗ Voyage '{voyage_slug}' not found in canonical_voyages.json")
    except Exception as e:
        print(f"✗ Error reading JSON: {e}")

    # 2. Check database
    print("\n\n[2] DATABASE:")
    print("-" * 70)
    try:
        conn = psycopg2.connect(
            host=db_host,
            database=db_name,
            user=db_user,
            password=db_password
        )
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Check voyage exists
        cur.execute("SELECT * FROM voyages WHERE voyage_slug = %s", (voyage_slug,))
        voyage_row = cur.fetchone()

        if voyage_row:
            print(f"✓ Voyage found in database")
            print(f"  Title: {voyage_row.get('title')}")
            print(f"  Start date: {voyage_row.get('start_date')}")
        else:
            print(f"✗ Voyage '{voyage_slug}' not found in database")
            conn.close()
            return

        # Check media in database
        cur.execute("""
            SELECT m.*, vm.sort_order, vm.voyage_media_notes
            FROM media m
            INNER JOIN voyage_media vm ON vm.media_slug = m.media_slug
            WHERE vm.voyage_slug = %s
            ORDER BY vm.sort_order NULLS LAST, m.media_slug
        """, (voyage_slug,))
        media_rows = cur.fetchall()

        print(f"\n  Media in database: {len(media_rows)}")

        if media_rows:
            for idx, m in enumerate(media_rows, 1):
                print(f"\n  Media #{idx}:")
                print(f"    media_slug: {m['media_slug']}")
                print(f"    title: {m.get('title')}")
                print(f"    media_type: {m.get('media_type')}")
                print(f"    date: {m.get('date') or '(null)'}")
                print(f"    s3_url: {m.get('s3_url') or '(null)'}")
                print(f"    public_derivative_url: {m.get('public_derivative_url') or '(null)'}")
                print(f"    google_drive_link: {(m.get('google_drive_link') or '')[:80]}")
                print(f"    url (API): {m.get('public_derivative_url') or m.get('google_drive_link') or m.get('s3_url') or '(none)'}")
        else:
            print("  ✗ No media found in database for this voyage")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"✗ Database error: {e}")

    print("\n" + "=" * 70)
    print("DIAGNOSIS COMPLETE")
    print("=" * 70)

if __name__ == '__main__':
    main()