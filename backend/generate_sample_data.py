#!/usr/bin/env python3
"""
Generate comprehensive sample voyage data for all presidents/owners.
Creates 5 voyages per president demonstrating all database fields and website functionality.
"""

import json
import random
from datetime import datetime, timedelta
from typing import List, Dict

# Sample data pools for realistic content
LOCATIONS = [
    "Washington Navy Yard", "Potomac River", "Mount Vernon", "Camp David dock",
    "Anacostia River", "Indian Head", "Quantico", "Alexandria waterfront",
    "Georgetown harbor", "Fort Washington", "Chesapeake Bay", "St. Michaels MD"
]

FOREIGN_LEADERS = [
    {"name": "Winston Churchill", "country": "United Kingdom", "title": "Prime Minister"},
    {"name": "Charles de Gaulle", "country": "France", "title": "President"},
    {"name": "Konrad Adenauer", "country": "West Germany", "title": "Chancellor"},
    {"name": "Nikita Khrushchev", "country": "Soviet Union", "title": "Premier"},
    {"name": "Harold Macmillan", "country": "United Kingdom", "title": "Prime Minister"},
    {"name": "Margaret Thatcher", "country": "United Kingdom", "title": "Prime Minister"},
    {"name": "Helmut Schmidt", "country": "West Germany", "title": "Chancellor"},
    {"name": "François Mitterrand", "country": "France", "title": "President"},
]

ROYALTY = [
    {"name": "King George VI", "country": "United Kingdom", "details": "King of the United Kingdom"},
    {"name": "Queen Elizabeth II", "country": "United Kingdom", "details": "Queen of the United Kingdom"},
    {"name": "Prince Philip", "country": "United Kingdom", "details": "Duke of Edinburgh"},
    {"name": "King Baudouin", "country": "Belgium", "details": "King of the Belgians"},
    {"name": "Crown Prince Akihito", "country": "Japan", "details": "Crown Prince of Japan"},
]

CABINET_MEMBERS = [
    {"name": "Dean Acheson", "title": "Secretary of State"},
    {"name": "George Marshall", "title": "Secretary of Defense"},
    {"name": "James Forrestal", "title": "Secretary of the Navy"},
    {"name": "Henry Stimson", "title": "Secretary of War"},
    {"name": "Robert McNamara", "title": "Secretary of Defense"},
    {"name": "Henry Kissinger", "title": "Secretary of State"},
    {"name": "Cyrus Vance", "title": "Secretary of State"},
    {"name": "Caspar Weinberger", "title": "Secretary of Defense"},
]

SENATORS_REPS = [
    {"name": "Sam Rayburn", "title": "Speaker of the House"},
    {"name": "Lyndon Johnson", "title": "Senate Majority Leader"},
    {"name": "Everett Dirksen", "title": "Senate Minority Leader"},
    {"name": "Carl Albert", "title": "House Majority Leader"},
    {"name": "Gerald Ford", "title": "House Minority Leader"},
]

MEDIA_LINKS = [
    "https://drive.google.com/file/d/1abc123def456/view",
    "https://drive.google.com/file/d/1def456ghi789/view",
    "https://drive.google.com/file/d/1ghi789jkl012/view",
    "https://drive.google.com/file/d/1jkl012mno345/view",
    "https://drive.google.com/file/d/1mno345pqr678/view",
]

VOYAGE_TYPES = [
    "official", "official", "private", "official",
    "other"
]

def generate_slug(text: str) -> str:
    """Convert text to slug format"""
    return text.lower().replace(" ", "-").replace("'", "").replace(".", "")

def random_date(start_year: int, end_year: int) -> str:
    """Generate random date in YYYY-MM-DD format"""
    year = random.randint(start_year, end_year)
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year:04d}-{month:02d}-{day:02d}"

def random_time() -> str:
    """Generate random time"""
    hour = random.randint(8, 18)
    minute = random.choice([0, 15, 30, 45])
    return f"{hour:02d}:{minute:02d}:00"

def generate_sample_voyages_for_president(
    president_slug: str,
    president_name: str,
    term_start_year: int,
    term_end_year: int,
    num_voyages: int = 5
) -> List[Dict]:
    """Generate sample voyages for a president with all fields populated"""

    voyages = []

    for i in range(num_voyages):
        voyage_num = i + 1
        voyage_slug = f"{president_slug}-{random.randint(term_start_year, term_end_year)}-{voyage_num:02d}"

        # Randomly select which metadata flags to enable
        has_photo = random.choice([True, False])
        has_video = random.choice([True, False]) if term_start_year >= 1950 else False
        presidential_use = True
        has_royalty = i == 0  # First voyage has royalty
        has_foreign_leader = i == 1  # Second voyage has foreign leader
        mention_camp_david = i == 2  # Third mentions Camp David
        mention_mount_vernon = i == 3  # Fourth mentions Mount Vernon
        mention_captain = random.choice([True, False])
        mention_crew = random.choice([True, False])
        mention_rmd = random.choice([True, False])
        mention_yacht_spin = i == 4  # Fifth mentions yacht spin
        mention_menu = random.choice([True, False])
        mention_drinks_wine = random.choice([True, False])

        # Generate date/time
        start_date = random_date(term_start_year, term_end_year)
        start_time = random_time()
        # End date is same day, different time
        end_time_hour = int(start_time[:2]) + random.randint(2, 6)
        end_time = f"{end_time_hour:02d}:{random.choice([0, 15, 30, 45]):02d}:00"

        # Select locations
        start_location = random.choice(LOCATIONS)
        end_location = random.choice([loc for loc in LOCATIONS if loc != start_location])

        # Build voyage data
        voyage = {
            "voyage": voyage_slug,  # Parser expects "voyage" field, not "voyage_slug"
            "title": f"{president_name} {['Diplomatic Cruise', 'Strategy Session', 'Recreation Voyage', 'Official Business', 'State Reception'][i]}",
            "start_date": start_date,
            "end_date": start_date,  # Same day
            "start_time": start_time,
            "end_time": end_time,
            "start_location": start_location,
            "end_location": end_location,
            "origin": start_location,  # Legacy field
            "destination": end_location,  # Legacy field
            "vessel_name": "USS Sequoia",
            "voyage_type": VOYAGE_TYPES[i],
            "summary_markdown": f"## {['Diplomatic Meeting', 'Strategy Conference', 'Recreation Cruise', 'Policy Discussion', 'Ceremonial Voyage'][i]}\n\n"
                              f"President {president_name} hosted {'an important diplomatic meeting' if i == 1 else 'a strategic planning session' if i == 2 else 'a recreational cruise' if i == 3 else 'an official business meeting' if i == 4 else 'a state reception'} "
                              f"aboard the USS Sequoia. The voyage {'included discussions on foreign policy and national security matters' if i <= 1 else 'focused on domestic policy initiatives and legislative strategy' if i == 2 else 'provided an opportunity for informal discussions with key advisors' if i == 3 else 'featured ceremonial activities and photo opportunities'}.\n\n"
                              f"{'The menu included prime rib, lobster tail, and fine wines from the presidential cellar.' if mention_menu else ''}"
                              f"{'The yacht spun in the Potomac River for optimal views.' if mention_yacht_spin else ''}"
                              f"{'Captain Anderson expertly navigated the vessel through challenging conditions.' if mention_captain else ''}"
                              f"{'The crew provided exceptional service throughout the voyage.' if mention_crew else ''}",
            "source_urls": [f"National Archives", f"Presidential Papers", f"{president_name} Library"],  # Array for PostgreSQL
            "tags": ", ".join([VOYAGE_TYPES[i], "documented", "significant"]),
            "president_slug": president_slug,
            "notes": [
                f"Sample voyage #{voyage_num} for {president_name}",
                f"Generated to demonstrate all database fields and website functionality",
                f"This voyage showcases: {', '.join([k for k, v in {'photos': has_photo, 'video': has_video, 'royalty': has_royalty, 'foreign leader': has_foreign_leader}.items() if v])}"
            ],
            "additional_information": f"This voyage is notable for {'hosting foreign dignitaries' if has_foreign_leader else 'including members of the royal family' if has_royalty else 'featuring important policy discussions' if i == 2 else 'providing recreational opportunities for the president' if i == 3 else 'ceremonial significance'}. "
                                    f"{'Departure point was near Camp David.' if mention_camp_david else ''}"
                                    f"{'The voyage passed by Mount Vernon.' if mention_mount_vernon else ''}"
                                    f"{'Representatives from the Recreation and Morale Division were present.' if mention_rmd else ''}",
            "additional_sources": f"See also: {president_name} Presidential Library Archives, Daily Diary entries for {start_date}",

            # Metadata flags
            "has_photo": has_photo,
            "has_video": has_video,
            "presidential_use": presidential_use,
            "has_royalty": has_royalty,
            "has_foreign_leader": has_foreign_leader,
            "mention_camp_david": mention_camp_david,
            "mention_mount_vernon": mention_mount_vernon,
            "mention_captain": mention_captain,
            "mention_crew": mention_crew,
            "mention_rmd": mention_rmd,
            "mention_yacht_spin": mention_yacht_spin,
            "mention_menu": mention_menu,
            "mention_drinks_wine": mention_drinks_wine,

            # Associated text fields
            "presidential_initials": president_name.split()[0][0] + (president_name.split()[1][0] if len(president_name.split()) > 1 else ""),
            "royalty_details": ROYALTY[i % len(ROYALTY)]["details"] if has_royalty else None,
            "foreign_leader_country": FOREIGN_LEADERS[i % len(FOREIGN_LEADERS)]["country"] if has_foreign_leader else None,

            # Passengers
            "passengers": []
        }

        # Add passengers based on voyage characteristics
        if has_royalty:
            royal = ROYALTY[i % len(ROYALTY)]
            voyage["passengers"].append({
                "name": generate_slug(royal["name"]),  # Parser expects "name" field
                "full_name": royal["name"],
                "title": royal["details"],
                "role_title": "Guest of Honor",
                "organization": royal["country"],
                "bio": f"https://en.wikipedia.org/wiki/{royal['name'].replace(' ', '_')}"
            })

        if has_foreign_leader:
            leader = FOREIGN_LEADERS[i % len(FOREIGN_LEADERS)]
            voyage["passengers"].append({
                "name": generate_slug(leader["name"]),  # Parser expects "name" field
                "full_name": leader["name"],
                "title": leader["title"],
                "role_title": "Foreign Dignitary",
                "organization": leader["country"],
                "bio": f"https://en.wikipedia.org/wiki/{leader['name'].replace(' ', '_')}"
            })

        # Add cabinet members
        for j in range(random.randint(2, 4)):
            cabinet = CABINET_MEMBERS[j % len(CABINET_MEMBERS)]
            voyage["passengers"].append({
                "name": generate_slug(cabinet["name"]),  # Parser expects "name" field
                "full_name": cabinet["name"],
                "title": cabinet["title"],
                "role_title": cabinet["title"],
                "organization": "U.S. Government",
                "bio": f"https://en.wikipedia.org/wiki/{cabinet['name'].replace(' ', '_')}"
            })

        # Skip media for now - would need real Google Drive links for S3 upload to work
        # Media can be added later via the curator interface
        voyage["media"] = []

        voyages.append(voyage)

    return voyages

# President data with their term years
PRESIDENTS = [
    {"slug": "roosevelt-franklin", "name": "Franklin D. Roosevelt", "start": 1933, "end": 1945},
    {"slug": "truman-harry", "name": "Harry S. Truman", "start": 1945, "end": 1953},
    {"slug": "eisenhower-dwight", "name": "Dwight D. Eisenhower", "start": 1953, "end": 1961},
    {"slug": "kennedy-john", "name": "John F. Kennedy", "start": 1961, "end": 1963},
    {"slug": "johnson-lyndon", "name": "Lyndon B. Johnson", "start": 1963, "end": 1969},
    {"slug": "nixon-richard", "name": "Richard M. Nixon", "start": 1969, "end": 1974},
    {"slug": "ford-gerald", "name": "Gerald R. Ford", "start": 1974, "end": 1977},
    {"slug": "carter-jimmy", "name": "Jimmy Carter", "start": 1977, "end": 1981},
]

# Private owners
OWNERS = [
    {"slug": "hoover-herbert", "name": "Herbert Hoover", "start": 1929, "end": 1933},
    {"slug": "dunning-william", "name": "William Dunning", "start": 1925, "end": 1929},
    {"slug": "cadwalader-emily", "name": "Emily Cadwalader", "start": 1921, "end": 1925},
]

def main():
    """Generate sample data for all presidents and owners"""

    all_data = {}

    # Generate for presidents
    print("Generating sample voyages for presidents...")
    for pres in PRESIDENTS:
        print(f"  - {pres['name']}")
        voyages = generate_sample_voyages_for_president(
            pres["slug"], pres["name"], pres["start"], pres["end"]
        )
        all_data[pres["slug"]] = {
            "term_start": f"{pres['start']}-01-20",
            "term_end": f"{pres['end']}-01-20",
            "info": f"{pres['name']} ({pres['start']} to {pres['end']})",
            "voyages": voyages
        }

    # Generate for owners
    print("\nGenerating sample voyages for private owners...")
    for owner in OWNERS:
        print(f"  - {owner['name']}")
        voyages = generate_sample_voyages_for_president(
            owner["slug"], owner["name"], owner["start"], owner["end"]
        )
        all_data[owner["slug"]] = {
            "term_start": f"{owner['start']}-01-01",
            "term_end": f"{owner['end']}-12-31",
            "info": f"{owner['name']} (Owner {owner['start']} to {owner['end']})",
            "voyages": voyages
        }

    # Write to file
    output_file = "/Users/daniel/sequoia-project/backend/sample_voyages.json"
    with open(output_file, 'w') as f:
        json.dump(all_data, f, indent=2)

    print(f"\n✓ Generated sample data written to: {output_file}")
    print(f"  Total presidents/owners: {len(all_data)}")
    print(f"  Total voyages: {sum(len(p['voyages']) for p in all_data.values())}")
    print(f"  Total passengers: {sum(sum(len(v['passengers']) for v in p['voyages']) for p in all_data.values())}")
    print(f"  Total media items: {sum(sum(len(v['media']) for v in p['voyages']) for p in all_data.values())}")

if __name__ == "__main__":
    main()
