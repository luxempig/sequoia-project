#!/usr/bin/env python3
"""
Generate sitemap.xml for USS Sequoia website.
This helps search engines discover and index all pages.

Usage:
    python generate_sitemap.py > ../frontend/public/sitemap.xml
"""

import sys
from datetime import datetime
from typing import List, Dict
from app.db import db_cursor

BASE_URL = "https://uss-sequoia.com"

def generate_sitemap():
    """Generate XML sitemap for the website"""

    urls: List[Dict[str, str]] = []

    # Static pages
    urls.extend([
        {
            'loc': f'{BASE_URL}/',
            'changefreq': 'weekly',
            'priority': '1.0',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': f'{BASE_URL}/voyages',
            'changefreq': 'weekly',
            'priority': '0.9',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': f'{BASE_URL}/timeline',
            'changefreq': 'weekly',
            'priority': '0.9',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': f'{BASE_URL}/people',
            'changefreq': 'monthly',
            'priority': '0.8',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'loc': f'{BASE_URL}/presidents',
            'changefreq': 'monthly',
            'priority': '0.8',
            'lastmod': datetime.now().strftime('%Y-%m-%d')
        },
    ])

    # Dynamic pages - Voyages
    with db_cursor(read_only=True) as cur:
        cur.execute("""
            SELECT voyage_slug, updated_at
            FROM sequoia.voyages
            ORDER BY start_date DESC
        """)

        voyages = cur.fetchall()
        for voyage in voyages:
            urls.append({
                'loc': f"{BASE_URL}/voyages/{voyage['voyage_slug']}",
                'changefreq': 'monthly',
                'priority': '0.7',
                'lastmod': voyage['updated_at'].strftime('%Y-%m-%d') if voyage.get('updated_at') else datetime.now().strftime('%Y-%m-%d')
            })

    # Dynamic pages - People
    with db_cursor(read_only=True) as cur:
        cur.execute("""
            SELECT person_slug, updated_at
            FROM sequoia.people
            ORDER BY full_name
        """)

        people = cur.fetchall()
        for person in people:
            urls.append({
                'loc': f"{BASE_URL}/people/{person['person_slug']}",
                'changefreq': 'monthly',
                'priority': '0.6',
                'lastmod': person['updated_at'].strftime('%Y-%m-%d') if person.get('updated_at') else datetime.now().strftime('%Y-%m-%d')
            })

    # Dynamic pages - Presidents
    with db_cursor(read_only=True) as cur:
        cur.execute("""
            SELECT president_slug, updated_at
            FROM sequoia.presidents
            ORDER BY term_start
        """)

        presidents = cur.fetchall()
        for president in presidents:
            urls.append({
                'loc': f"{BASE_URL}/presidents/{president['president_slug']}",
                'changefreq': 'monthly',
                'priority': '0.8',
                'lastmod': president['updated_at'].strftime('%Y-%m-%d') if president.get('updated_at') else datetime.now().strftime('%Y-%m-%d')
            })

    # Generate XML
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
        '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
        ''
    ]

    for url in urls:
        xml_lines.extend([
            '  <url>',
            f'    <loc>{url["loc"]}</loc>',
            f'    <lastmod>{url["lastmod"]}</lastmod>',
            f'    <changefreq>{url["changefreq"]}</changefreq>',
            f'    <priority>{url["priority"]}</priority>',
            '  </url>',
        ])

    xml_lines.extend([
        '</urlset>'
    ])

    return '\n'.join(xml_lines)

if __name__ == '__main__':
    try:
        sitemap_xml = generate_sitemap()
        print(sitemap_xml)

        # Write to file if not being piped
        if sys.stdout.isatty():
            output_path = '../frontend/public/sitemap.xml'
            with open(output_path, 'w') as f:
                f.write(sitemap_xml)
            print(f"\n✓ Sitemap written to {output_path}", file=sys.stderr)
            print(f"✓ Generated {sitemap_xml.count('<url>')} URLs", file=sys.stderr)
    except Exception as e:
        print(f"Error generating sitemap: {e}", file=sys.stderr)
        sys.exit(1)
