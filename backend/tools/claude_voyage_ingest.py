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
from dotenv import load_dotenv
import anthropic
import psycopg2
from psycopg2.extras import execute_values

load_dotenv()

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
def find_existing_person(cur, full_name: str) -> Optional[str]:
    """Check if person exists by name or slug, return person_slug if found"""
    # Try exact name match first
    cur.execute("""
        SELECT person_slug FROM sequoia.people
        WHERE LOWER(full_name) = LOWER(%s)
        LIMIT 1
    """, (full_name,))
    result = cur.fetchone()
    if result:
        return result[0]

    # Try slug match
    slug = slugify(full_name)
    cur.execute("""
        SELECT person_slug FROM sequoia.people
        WHERE person_slug = %s
        LIMIT 1
    """, (slug,))
    result = cur.fetchone()
    if result:
        return result[0]

    # Try fuzzy match on last name
    last_name = full_name.split()[-1] if full_name.split() else ""
    if last_name:
        cur.execute("""
            SELECT person_slug, full_name FROM sequoia.people
            WHERE LOWER(full_name) LIKE %s
            LIMIT 5
        """, (f'%{last_name.lower()}%',))
        results = cur.fetchall()
        # If we find exactly one match with same last name, use it
        if len(results) == 1:
            return results[0][0]

    return None

def parse_with_claude(markdown_content: str, president_slug: Optional[str] = None) -> Dict:
    """Use Claude API to parse voyage markdown into structured JSON"""

    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

    prompt = f"""Parse this voyage markdown document into structured JSON. The document may be messy and inconsistently formatted.

Example of the format:
{markdown_content}

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
      {{"url": "url or text source", "media_type": "article/document/logbook/image/video/book/other"}}
    ],
    "additional_source_urls": [
      {{"url": "url or text source", "media_type": "article/document/logbook/image/video/book/other"}}
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
   - Format: [Name](url) (role), [Name](url) (role)
   - Extract full_name, role (from parentheses), and bio URL
   - Mark as is_crew: true if role mentions Captain, Crew, Steward, Cook, etc.

6. ADDITIONAL INFORMATION: Extract full text from "Additional Information:" section

7. SOURCES:
   - Extract from "Sources:" line
   - Classify as article, document, logbook, image, video, book, or other
   - Keep full URLs (Google Drive, Wikipedia, etc.)
   - For book references, include full citation

8. ADDITIONAL SOURCES:
   - Extract from "Additional Sources:" section
   - Same classification as Sources

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
            model="claude-3-5-sonnet-20241022",
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

def insert_voyage_to_db(parsed_data: Dict, dry_run: bool = False) -> str:
    """Insert parsed voyage data into database with passenger deduplication"""

    conn = get_db_connection()
    conn.autocommit = False

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
            # Convert source_urls to JSON
            source_urls_json = json.dumps(voyage_data.get('source_urls', [])) if voyage_data.get('source_urls') else None

            # Convert additional_source_urls to newline-separated JSON strings
            additional_sources = None
            if voyage_data.get('additional_source_urls'):
                additional_sources = '\n'.join([json.dumps(item) for item in voyage_data['additional_source_urls']])

            # Insert voyage
            cur.execute("""
                INSERT INTO sequoia.voyages (
                    voyage_slug, title, start_date, end_date, start_time, end_time,
                    start_location, end_location, vessel_name, voyage_type,
                    additional_information, notes, spin, spin_source,
                    source_urls, additional_sources, tags,
                    president_slug_from_voyage,
                    has_photo, has_video, presidential_use, presidential_initials,
                    has_royalty, royalty_details, has_foreign_leader, foreign_leader_country,
                    mention_camp_david, mention_mount_vernon, mention_captain, mention_crew,
                    mention_rmd, mention_yacht_spin, mention_menu, mention_drinks_wine
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
            """, (
                voyage_slug, voyage_data.get('title'), voyage_data['start_date'], voyage_data.get('end_date'),
                voyage_data.get('start_time'), voyage_data.get('end_time'),
                voyage_data.get('start_location'), voyage_data.get('end_location'),
                voyage_data.get('vessel_name', 'USS Sequoia'), voyage_data.get('voyage_type'),
                voyage_data.get('additional_information'), voyage_data.get('notes'),
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
                voyage_data.get('mention_menu', False), voyage_data.get('mention_drinks_wine', False)
            ))

        # Process passengers with deduplication
        print(f"\n{'[DRY RUN] ' if dry_run else ''}Processing {len(passengers_data)} passengers:")

        for passenger in passengers_data:
            full_name = passenger['full_name']

            # Check if person exists
            existing_slug = find_existing_person(cur, full_name)

            if existing_slug:
                print(f"  ✓ Found existing: {full_name} ({existing_slug})")
                person_slug = existing_slug
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
                        INSERT INTO sequoia.people (person_slug, full_name, role, bio)
                        VALUES (%s, %s, %s, %s)
                    """, (person_slug, full_name, passenger.get('role'), passenger.get('bio')))

            # Link person to voyage
            if not dry_run:
                cur.execute("""
                    INSERT INTO sequoia.voyage_passengers (voyage_slug, person_slug, is_crew)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (voyage_slug, person_slug) DO NOTHING
                """, (voyage_slug, person_slug, passenger.get('is_crew', False)))

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
    if not os.getenv('ANTHROPIC_API_KEY'):
        print("Error: ANTHROPIC_API_KEY not found in environment")
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

        # Insert to database
        voyage_slug = insert_voyage_to_db(parsed_data, dry_run=args.dry_run)

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
