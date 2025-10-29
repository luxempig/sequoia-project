#!/usr/bin/env python3
"""
Parse voyage markdown files using Claude API and add to database.
Handles messy formats from Google Doc with intelligent parsing.

Usage:
    python claude_voyage_ingest.py voyage.md [--president-slug hoover-herbert]
"""

import os
import sys
import json
import re
import argparse
from typing import Dict, List, Optional
from pathlib import Path
from dotenv import load_dotenv
import anthropic
import psycopg2
from psycopg2.extras import execute_values

# Load .env from backend directory
backend_dir = Path(__file__).parent.parent
load_dotenv(backend_dir / '.env')

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        port=os.getenv('DB_PORT'),
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )

# Generate slug from name
def slugify(name: str) -> str:
    """Generate slug from name"""
    # Remove titles and prefixes
    name = re.sub(r'^(mr\.?|mrs\.?|miss|ms\.?|dr\.?|prof\.?|col\.?|capt\.?|captain|sir|lady|president|senator|secretary|general)\s+', '', name.lower())
    # Remove parenthetical info
    name = re.sub(r'\([^)]*\)', '', name)
    # Clean and convert to slug
    name = re.sub(r'[^\w\s-]', '', name.strip())
    name = re.sub(r'\s+', '-', name)
    return name

# Check if person exists in database
def find_existing_person(cur, full_name: str, bio_url: Optional[str] = None) -> Optional[tuple]:
    """Check if person exists by exact name match or identical bio URL, return (person_slug, current_role_title) if found"""
    # Try exact name match (case-insensitive)
    cur.execute("""
        SELECT person_slug, role_title FROM sequoia.people
        WHERE LOWER(full_name) = LOWER(%s)
        LIMIT 1
    """, (full_name,))
    result = cur.fetchone()
    if result:
        return result  # (person_slug, role_title)

    # Try matching by bio URL if provided
    if bio_url:
        cur.execute("""
            SELECT person_slug, role_title FROM sequoia.people
            WHERE wikipedia_url = %s
            LIMIT 1
        """, (bio_url,))
        result = cur.fetchone()
        if result:
            return result  # (person_slug, role_title)

    return None

def rank_title_importance(title1: str, title2: str, person_name: str) -> str:
    """Use Claude API to determine which title is more important/notable for a person"""
    client = anthropic.Anthropic(api_key=os.getenv('CLAUDE_API_KEY'))

    prompt = f"""Compare these two titles/roles for {person_name} and determine which is MORE IMPORTANT or NOTABLE historically.

Title A: {title1 or "(no title)"}
Title B: {title2 or "(no title)"}

Consider:
- Higher political office (President > Vice President > Senator > Representative)
- National vs local positions
- Historical significance
- Public recognition

Respond with ONLY "A" or "B" - nothing else."""

    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",  # Use fast, cheap model for this
            max_tokens=10,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        answer = response.content[0].text.strip().upper()
        return title1 if answer == "A" else title2
    except Exception as e:
        print(f"  ⚠ Error ranking titles, keeping existing: {e}")
        return title1  # Default to keeping existing title on error

def parse_with_claude(markdown_content: str, president_slug: Optional[str] = None) -> Dict:
    """Use Claude API to parse voyage markdown into structured JSON"""

    client = anthropic.Anthropic(api_key=os.getenv('CLAUDE_API_KEY'))

    prompt = f"""You are a data extraction specialist. Parse the following voyage markdown document into structured JSON.

IMPORTANT: The markdown document below is the ACTUAL DATA to parse, not an example.

=== BEGIN VOYAGE DOCUMENT ===
{markdown_content}
=== END VOYAGE DOCUMENT ===

Extract and return JSON with this exact structure:
{{
  "voyage": {{
    "title": "Brief descriptive title",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD or null",
    "start_time": "HH:MM or null",
    "end_time": "HH:MM or null",
    "start_location": "Location text or null",
    "end_location": "Location text or null",
    "vessel_name": "USS Sequoia",
    "voyage_type": "official or private or null",
    "additional_information": "Summary/description text or null",
    "notes": "Public notes text or null",
    "spin": "Spin quote text (without quotes) or null",
    "spin_source": "Source for spin or null",
    "source_urls": [
      {{"url": "url or text source", "media_type": "unchecked"}}
    ],
    "additional_source_urls": [
      {{"url": "url or text source", "media_type": "unchecked"}}
    ],
    "tags": [],
    "president_slug_from_voyage": "{president_slug or 'null'}",

    // Boolean flags from top-line codes (extract from codes like (Photo), (Video), (CD), etc.)
    "has_photo": false,
    "has_video": false,
    "presidential_use": false,
    "presidential_initials": "null or FDR/HST/etc",
    "has_royalty": false,
    "royalty_details": "null or description",
    "has_foreign_leader": false,
    "foreign_leader_country": "null or country name",
    "mention_camp_david": false,
    "mention_mount_vernon": false,
    "mention_captain": false,
    "mention_crew": false,
    "mention_rmd": false,
    "mention_yacht_spin": false,
    "mention_menu": false,
    "mention_drinks_wine": false
  }},

  "passengers": [
    {{
      "full_name": "Person Name",
      "role": "Title/Role or null",
      "bio": "Wikipedia URL or bio URL or null",
      "is_crew": false
    }}
  ]
}}

PARSING INSTRUCTIONS:

1. TOP-LINE CODES (first line often has parenthetical codes):
   - (Photo) or (Photo(s)) -> has_photo: true
   - (Video) or (Video(s)) -> has_video: true
   - (HH) or (FDR) or (HST) etc -> presidential_use: true, presidential_initials: "HH"
   - (Royalty) -> has_royalty: true
   - (Foreign Leader) -> has_foreign_leader: true, extract country if mentioned
   - (CD) -> mention_camp_david: true
   - (MV) -> mention_mount_vernon: true
   - (Captain) -> mention_captain: true
   - (Crew) -> mention_crew: true
   - (RMD) -> mention_rmd: true
   - (Yacht Spin) -> mention_yacht_spin: true
   - (Menu) -> mention_menu: true
   - (Drinks/Wine) -> mention_drinks_wine: true

2. DATES: Look for patterns like:
   - "1931-04-25" (single day)
   - "1931-04-25 to 1931-04-27" (date range)
   - Extract start_date and end_date

3. LOCATION: Extract from "Location:" line
   - May include links, extract just the location name

4. TIME: Extract from "Time:" line
   - May be ranges like "12:15pm to 6:45pm"
   - Convert to 24-hour format HH:MM

5. PASSENGERS: Extract from "Passengers:" line
   - IMPORTANT: Maintain the EXACT ORDER of passengers as they appear in the markdown
   - ONLY extract individuals with actual names or Wikipedia links
   - Format: [Name](url) (role), [Name](url) (role)
   - DO NOT create passengers for vague descriptions like "Imperial Party", "and others", "guests", etc.
   - Extract full_name, role (from parentheses), and bio URL
   - Mark as is_crew: true if role mentions Captain, Crew, Steward, Cook, etc.

6. ADDITIONAL INFORMATION: Extract full text from "Additional Information:" section

7. SOURCES:
   - Extract from "Sources:" line
   - Set media_type to "unchecked" for ALL sources - DO NOT try to guess the type
   - Keep full URLs (Google Drive, Wikipedia, etc.)
   - For book references, include full citation as the URL

8. ADDITIONAL SOURCES:
   - Extract from "Additional Sources:" section
   - Set media_type to "unchecked" for ALL sources - DO NOT try to guess the type

9. NOTES: Extract from "Notes:" section (public notes)

10. SPIN: Extract from lines like "Spin from *Source*:"
    - Combine multiple bullet points into one text
    - Set spin_source to the source publication name

BE FLEXIBLE:
- Documents are messy and inconsistently formatted
- Field names may vary slightly
- Extract what you can, use null for missing fields
- Don't fail on formatting issues

Return ONLY valid JSON, no other text."""

    try:
        response = client.messages.create(
            model="claude-opus-4-1-20250805",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # Extract JSON from response
        response_text = response.content[0].text

        # Try to find JSON in the response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            parsed = json.loads(json_str)
            return parsed
        else:
            raise ValueError("No JSON found in Claude response")

    except Exception as e:
        print(f"Error parsing with Claude: {e}")
        print(f"Response: {response_text if 'response_text' in locals() else 'No response'}")
        raise

def insert_voyage_to_db(parsed_data: Dict, dry_run: bool = False, original_markdown: Optional[str] = None) -> str:
    """Insert parsed voyage data into database with passenger deduplication"""

    try:
        conn = get_db_connection()
        conn.autocommit = False
    except Exception as e:
        if dry_run:
            print(f"\n⚠ Cannot connect to database (expected for local dry-run): {e}")
            print("\n" + "="*60)
            print("DRY RUN MODE - DATABASE NOT AVAILABLE")
            print("="*60)
            # Show what would be created without database access
            voyage_data = parsed_data['voyage']
            passengers_data = parsed_data.get('passengers', [])

            start_date = voyage_data['start_date']
            title_slug = slugify(voyage_data.get('title', ''))[:30]
            voyage_slug = f"{start_date}-{title_slug}" if title_slug else start_date

            print(f"\nWould create voyage: {voyage_slug}")
            print(f"  Title: {voyage_data.get('title')}")
            print(f"  Date: {voyage_data['start_date']} to {voyage_data.get('end_date', 'same day')}")
            print(f"\nWould process {len(passengers_data)} passengers (deduplication requires database)")
            for passenger in passengers_data:
                print(f"  • {passenger['full_name']} ({passenger.get('role', 'no role')})")
            return voyage_slug
        else:
            raise

    try:
        cur = conn.cursor()

        voyage_data = parsed_data['voyage']
        passengers_data = parsed_data.get('passengers', [])

        # Generate voyage slug from date
        start_date = voyage_data['start_date']
        title_slug = slugify(voyage_data.get('title', ''))[:30]
        voyage_slug = f"{start_date}-{title_slug}" if title_slug else start_date

        # Check if voyage already exists
        cur.execute("SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s", (voyage_slug,))
        if cur.fetchone():
            # Make slug unique by adding counter
            counter = 2
            base_slug = voyage_slug
            while True:
                voyage_slug = f"{base_slug}-{counter}"
                cur.execute("SELECT voyage_slug FROM sequoia.voyages WHERE voyage_slug = %s", (voyage_slug,))
                if not cur.fetchone():
                    break
                counter += 1

        print(f"\n{'[DRY RUN] ' if dry_run else ''}Creating voyage: {voyage_slug}")
        print(f"  Title: {voyage_data.get('title')}")
        print(f"  Date: {voyage_data['start_date']} to {voyage_data.get('end_date', 'same day')}")

        if not dry_run:
            # Convert source_urls to text[] - each element is a JSON string
            source_urls_json = None
            if voyage_data.get('source_urls'):
                source_urls_json = [json.dumps(item) for item in voyage_data['source_urls']]

            # Convert additional_source_urls to newline-separated JSON strings
            additional_sources = None
            if voyage_data.get('additional_source_urls'):
                additional_sources = '\n'.join([json.dumps(item) for item in voyage_data['additional_source_urls']])

            # Insert voyage
            cur.execute("""
                INSERT INTO sequoia.voyages (
                    voyage_slug, title, start_date, end_date, start_time, end_time,
                    start_location, end_location, vessel_name, voyage_type,
                    additional_information, notes, notes_internal, spin, spin_source,
                    source_urls, additional_sources, tags,
                    president_slug_from_voyage,
                    has_photo, has_video, presidential_use, presidential_initials,
                    has_royalty, royalty_details, has_foreign_leader, foreign_leader_country,
                    mention_camp_david, mention_mount_vernon, mention_captain, mention_crew,
                    mention_rmd, mention_yacht_spin, mention_menu, mention_drinks_wine,
                    original_markdown
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s
                )
            """, (
                voyage_slug, voyage_data.get('title'), voyage_data['start_date'], voyage_data.get('end_date'),
                voyage_data.get('start_time'), voyage_data.get('end_time'),
                voyage_data.get('start_location'), voyage_data.get('end_location'),
                voyage_data.get('vessel_name', 'USS Sequoia'), voyage_data.get('voyage_type'),
                voyage_data.get('additional_information'), voyage_data.get('notes'), voyage_data.get('notes_internal'),
                voyage_data.get('spin'), voyage_data.get('spin_source'),
                source_urls_json, additional_sources, ','.join(voyage_data.get('tags', [])) if voyage_data.get('tags') else None,
                voyage_data.get('president_slug_from_voyage'),
                voyage_data.get('has_photo', False), voyage_data.get('has_video', False),
                voyage_data.get('presidential_use', False), voyage_data.get('presidential_initials'),
                voyage_data.get('has_royalty', False), voyage_data.get('royalty_details'),
                voyage_data.get('has_foreign_leader', False), voyage_data.get('foreign_leader_country'),
                voyage_data.get('mention_camp_david', False), voyage_data.get('mention_mount_vernon', False),
                voyage_data.get('mention_captain', False), voyage_data.get('mention_crew', False),
                voyage_data.get('mention_rmd', False), voyage_data.get('mention_yacht_spin', False),
                voyage_data.get('mention_menu', False), voyage_data.get('mention_drinks_wine', False),
                original_markdown
            ))

        # Process passengers with deduplication
        print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing {len(passengers_data)} passengers:")

        for sort_order, passenger in enumerate(passengers_data):
            full_name = passenger['full_name']
            bio_url = passenger.get('bio')
            voyage_role = passenger.get('role')  # Role on this specific voyage

            # Check if person exists (by exact name or identical bio URL)
            existing_person = find_existing_person(cur, full_name, bio_url)

            if existing_person:
                person_slug, current_role_title = existing_person
                print(f"  ✓ Found existing: {full_name} ({person_slug})")

                # Compare titles and update if new one is more important
                if voyage_role and current_role_title != voyage_role:
                    if not dry_run:
                        more_important = rank_title_importance(current_role_title, voyage_role, full_name)
                        if more_important != current_role_title:
                            print(f"    → Updating role_title: '{current_role_title}' → '{more_important}'")
                            cur.execute("""
                                UPDATE sequoia.people
                                SET role_title = %s
                                WHERE person_slug = %s
                            """, (more_important, person_slug))
                        else:
                            print(f"    ✓ Keeping existing role_title: '{current_role_title}'")
            else:
                # Create new person
                person_slug = slugify(full_name)

                # Ensure unique slug
                cur.execute("SELECT person_slug FROM sequoia.people WHERE person_slug = %s", (person_slug,))
                if cur.fetchone():
                    counter = 2
                    base_slug = person_slug
                    while True:
                        person_slug = f"{base_slug}-{counter}"
                        cur.execute("SELECT person_slug FROM sequoia.people WHERE person_slug = %s", (person_slug,))
                        if not cur.fetchone():
                            break
                        counter += 1

                print(f"  + Creating new: {full_name} ({person_slug})")

                if not dry_run:
                    cur.execute("""
                        INSERT INTO sequoia.people (person_slug, full_name, role_title, wikipedia_url)
                        VALUES (%s, %s, %s, %s)
                    """, (person_slug, full_name, voyage_role, passenger.get('bio')))

            # Link person to voyage with sort_order and capacity_role (voyage-specific role)
            if not dry_run:
                cur.execute("""
                    INSERT INTO sequoia.voyage_passengers (voyage_slug, person_slug, is_crew, sort_order, capacity_role)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (voyage_slug, person_slug) DO UPDATE
                    SET capacity_role = EXCLUDED.capacity_role, sort_order = EXCLUDED.sort_order
                """, (voyage_slug, person_slug, passenger.get('is_crew', False), sort_order, voyage_role))

        if dry_run:
            print("\n[DRY RUN] Rolling back changes...")
            conn.rollback()
        else:
            conn.commit()
            print(f"\n✓ Successfully created voyage: {voyage_slug}")

        cur.close()
        conn.close()

        return voyage_slug

    except Exception as e:
        conn.rollback()
        conn.close()
        raise e

def main():
    parser = argparse.ArgumentParser(description='Parse voyage markdown and add to database using Claude API')
    parser.add_argument('markdown_file', help='Path to voyage markdown file')
    parser.add_argument('--president-slug', help='President/owner slug (e.g., hoover-herbert)', default=None)
    parser.add_argument('--dry-run', action='store_true', help='Parse and validate but don\'t insert to database')

    args = parser.parse_args()

    # Check for API key
    if not os.getenv('CLAUDE_API_KEY'):
        print("Error: CLAUDE_API_KEY not found in environment")
        sys.exit(1)

    # Read markdown file
    try:
        with open(args.markdown_file, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        sys.exit(1)

    print(f"Parsing {args.markdown_file} with Claude API...")

    # Parse with Claude
    try:
        parsed_data = parse_with_claude(markdown_content, args.president_slug)

        # Show parsed data
        print("\n" + "="*60)
        print("PARSED DATA:")
        print("="*60)
        print(json.dumps(parsed_data, indent=2))
        print("="*60)

        # Insert to database with original markdown
        voyage_slug = insert_voyage_to_db(parsed_data, dry_run=args.dry_run, original_markdown=markdown_content)

        if not args.dry_run:
            print(f"\n✓ Voyage added successfully: {voyage_slug}")
        else:
            print(f"\n[DRY RUN] Would create voyage: {voyage_slug}")

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
