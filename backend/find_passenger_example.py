#!/usr/bin/env python3
"""Find a good example of a passenger with multiple voyages and different roles"""

from app.db import db_cursor

with db_cursor() as cur:
    # Find people with multiple voyages and different roles
    cur.execute("""
        SELECT
            p.person_slug,
            p.full_name,
            p.role_title as global_role,
            COUNT(DISTINCT vp.voyage_slug) as voyage_count,
            ARRAY_AGG(DISTINCT vp.capacity_role) FILTER (WHERE vp.capacity_role IS NOT NULL) as voyage_roles
        FROM sequoia.people p
        JOIN sequoia.voyage_passengers vp ON vp.person_slug = p.person_slug
        WHERE p.role_title IS NOT NULL
        GROUP BY p.person_slug, p.full_name, p.role_title
        HAVING COUNT(DISTINCT vp.voyage_slug) > 2
        ORDER BY COUNT(DISTINCT vp.voyage_slug) DESC
        LIMIT 10
    """)

    results = cur.fetchall()

    print("Top passengers with multiple voyages:\n")
    for row in results:
        print(f"{row['full_name']}")
        print(f"  Global role title: {row['global_role']}")
        print(f"  Voyages: {row['voyage_count']}")
        print(f"  Voyage-specific roles: {', '.join(row['voyage_roles']) if row['voyage_roles'] else 'None'}")
        print(f"  Slug: {row['person_slug']}")
        print()

# Now get detailed voyage info for the first person
with db_cursor() as cur:
    cur.execute("""
        SELECT
            p.person_slug,
            p.full_name,
            p.role_title as global_role
        FROM sequoia.people p
        JOIN sequoia.voyage_passengers vp ON vp.person_slug = p.person_slug
        WHERE p.role_title IS NOT NULL
        GROUP BY p.person_slug, p.full_name, p.role_title
        HAVING COUNT(DISTINCT vp.voyage_slug) > 3
        ORDER BY COUNT(DISTINCT vp.voyage_slug) DESC
        LIMIT 1
    """)

    person = cur.fetchone()

    if person:
        print(f"\n{'='*80}")
        print(f"DETAILED EXAMPLE: {person['full_name']}")
        print(f"{'='*80}\n")
        print(f"Global role title (in people table): {person['global_role']}\n")

        # Get all voyages for this person
        cur.execute("""
            SELECT
                v.voyage_slug,
                v.title,
                v.start_date,
                vp.capacity_role,
                vp.sort_order
            FROM sequoia.voyage_passengers vp
            JOIN sequoia.voyages v ON v.voyage_slug = vp.voyage_slug
            WHERE vp.person_slug = %s
            ORDER BY v.start_date, vp.sort_order
        """, (person['person_slug'],))

        voyages = cur.fetchall()

        print(f"Appears in {len(voyages)} voyages:")
        print()

        for v in voyages:
            date_str = v['start_date'].strftime('%Y-%m-%d') if v['start_date'] else 'No date'
            role = v['capacity_role'] or '(no specific role)'
            print(f"  • {date_str}: {v['title']}")
            print(f"    Role on this voyage: {role}")
            print()
