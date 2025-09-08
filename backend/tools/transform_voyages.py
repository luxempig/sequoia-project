#!/usr/bin/env python3
"""
Script to transform messy voyage markdown format to structured YAML-like format.

Converts from:
## **1933-04-21**
Location: Potomac River  
Time: 16:30 - 18:25  
Passengers: [Henry L. Roosevelt](https://en.wikipedia.org/wiki/Henry_L._Roosevelt) (Assistant Secretary of the Navy)  
Sources: [Sequoia Logbook 1933 (page 5)](https://drive.google.com/file/d/1ArrE6smmcCFXzVwaGP7WJuwiFsJGuxiX/view?usp=sharing#page=6)  

To:
## Voyage
title: Voyage with Henry L. Roosevelt
start_date: 1933-04-21
origin: Potomac River
vessel_name: USS Sequoia
tags: fdr

## Passengers
- slug: roosevelt-henry-l
  full_name: Henry L. Roosevelt
  role_title: Assistant Secretary of the Navy
  wikipedia_url: https://en.wikipedia.org/wiki/Henry_L._Roosevelt

## Media
- title: Media 1
  credit: Sequoia Logbook p5
  date: 1933
  description: ""
  tags:
  google_drive_link: https://drive.google.com/file/d/1ArrE6smmcCFXzVwaGP7WJuwiFsJGuxiX/view?usp=sharing#page=6
"""

import re
import sys
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from urllib.parse import urlparse

@dataclass
class Passenger:
    full_name: str
    role_title: str = ""
    wikipedia_url: str = ""
    
    @property
    def slug(self) -> str:
        """Generate slug from name"""
        name = self.full_name.lower()
        # Remove common prefixes/titles
        name = re.sub(r'^(mr\.?|mrs\.?|miss|ms\.?|dr\.?|prof\.?|col\.?|capt\.?|sir|lady)\s+', '', name)
        # Handle parenthetical info
        name = re.sub(r'\([^)]*\)', '', name)
        # Clean and convert to slug
        name = re.sub(r'[^\w\s-]', '', name.strip())
        name = re.sub(r'\s+', '-', name)
        return name

@dataclass 
class MediaItem:
    title: str
    credit: str = ""
    date: str = ""
    description: str = ""
    tags: str = ""
    google_drive_link: str = ""

@dataclass
class Voyage:
    title: str
    start_date: str
    end_date: Optional[str] = None
    origin: str = ""
    destination: str = ""
    vessel_name: str = "USS Sequoia"
    summary: str = ""
    tags: str = "fdr"
    passengers: List[Passenger] = None
    media: List[MediaItem] = None
    non_drive_refs: List[str] = None
    
    def __post_init__(self):
        if self.passengers is None:
            self.passengers = []
        if self.media is None:
            self.media = []
        if self.non_drive_refs is None:
            self.non_drive_refs = []

class VoyageParser:
    def __init__(self):
        self.voyage_pattern = re.compile(r'^##\s*\*?\*?.*?(\d{4}-\d{2}-\d{2})\*?\*?', re.MULTILINE)
        self.drive_link_pattern = re.compile(r'https://drive\.google\.com/[^\s\)]+')
        self.wikipedia_pattern = re.compile(r'\[([^\]]+)\]\((https://en\.wikipedia\.org/[^\)]+)\)')
        
    def extract_passengers(self, text: str) -> List[Passenger]:
        """Extract passengers from the Passengers line"""
        passengers = []
        
        # Find the Passengers: line
        passengers_match = re.search(r'Passengers:\s*(.*?)(?=\n[A-Za-z]+:|\n\n|\nAdditional|\nSources:|\n##|\Z)', text, re.DOTALL)
        if not passengers_match:
            return passengers
            
        passengers_text = passengers_match.group(1).strip()
        
        # Find all Wikipedia links and their descriptions
        wiki_matches = self.wikipedia_pattern.findall(passengers_text)
        
        for name, wiki_url in wiki_matches:
            # Extract role from parentheses after the link
            role_match = re.search(rf'\[{re.escape(name)}\][^)]*\)\s*\(([^)]+)\)', passengers_text)
            role = role_match.group(1) if role_match else ""
            
            passenger = Passenger(
                full_name=name,
                role_title=role,
                wikipedia_url=wiki_url
            )
            passengers.append(passenger)
            
        return passengers
    
    def extract_media_items(self, text: str) -> Tuple[List[MediaItem], List[str]]:
        """Extract media items from Sources lines and collect non-drive references"""
        media_items = []
        non_drive_refs = []
        
        # Find all Google Drive links
        drive_links = self.drive_link_pattern.findall(text)
        
        for i, link in enumerate(drive_links, 1):
            # Try to extract context around the link for title/credit
            link_context = re.search(rf'([^[\n]*)\[([^]]*)\]\({re.escape(link)}[^)]*\)', text)
            
            if link_context:
                title_part = link_context.group(2)
                credit = title_part
            else:
                title_part = f"Media {i}"
                credit = ""
            
            # Extract year from the text or link context
            year_match = re.search(r'(\d{4})', title_part) or re.search(r'(\d{4})', link)
            year = year_match.group(1) if year_match else ""
            
            media_item = MediaItem(
                title=f"Media {i}",
                credit=credit,
                date=year,
                description="",
                tags="",
                google_drive_link=link
            )
            media_items.append(media_item)
        
        # Find non-drive URLs (for documentation)
        all_links = re.findall(r'https?://[^\s\)]+', text)
        for link in all_links:
            if 'drive.google.com' not in link and link not in non_drive_refs:
                non_drive_refs.append(link)
            
        return media_items, non_drive_refs
    
    def extract_voyage_details(self, text: str, date: str) -> Voyage:
        """Extract voyage details from a voyage section"""
        
        # Extract location/origin
        origin_match = re.search(r'Location:\s*([^\n]+)', text)
        origin = origin_match.group(1).strip() if origin_match else ""
        
        # Extract additional information for summary
        info_match = re.search(r'Additional Information:\s*(.*?)(?=\nSources:|\nAdditional Sources:|\n##|\Z)', text, re.DOTALL)
        summary = ""
        if info_match:
            summary = info_match.group(1).strip()
            # Clean up the summary - remove trailing semicolons and extra whitespace
            summary = re.sub(r';\s*$', '', summary)
            summary = re.sub(r'\s+', ' ', summary).strip()
        
        # Extract passengers  
        passengers = self.extract_passengers(text)
        
        # Generate title from passengers or summary
        if passengers:
            main_passenger = passengers[0].full_name
            title = f"Voyage with {main_passenger}"
            if len(passengers) > 1:
                title += f" and {len(passengers)-1} others"
        elif summary:
            title = summary[:80] + "..." if len(summary) > 80 else summary
        else:
            title = f"Voyage on {date}"
            
        # Extract media items and non-drive references
        media_items, non_drive_refs = self.extract_media_items(text)
        
        voyage = Voyage(
            title=title,
            start_date=date,
            origin=origin,
            summary=summary,
            passengers=passengers,
            media=media_items,
            non_drive_refs=non_drive_refs
        )
        
        return voyage
    
    def parse_voyages(self, input_text: str) -> List[Voyage]:
        """Parse all voyages from the input text"""
        voyages = []
        
        # Find all voyage headers with dates
        voyage_matches = list(self.voyage_pattern.finditer(input_text))
        
        for i, match in enumerate(voyage_matches):
            date = match.group(1)
            start_pos = match.start()
            
            # Find end position (start of next voyage or end of text)
            if i + 1 < len(voyage_matches):
                end_pos = voyage_matches[i + 1].start()
            else:
                end_pos = len(input_text)
                
            voyage_text = input_text[start_pos:end_pos]
            
            try:
                voyage = self.extract_voyage_details(voyage_text, date)
                voyages.append(voyage)
            except Exception as e:
                print(f"Error parsing voyage {date}: {e}", file=sys.stderr)
                continue
                
        return voyages
    
    def format_voyage_output(self, voyage: Voyage) -> str:
        """Format a voyage into structured markdown output"""
        output = []
        
        # Voyage section
        output.append("## Voyage")
        output.append("")
        output.append(f"title: {voyage.title}")
        output.append(f"start_date: {voyage.start_date}")
        if voyage.end_date:
            output.append(f"end_date: {voyage.end_date}")
        if voyage.origin:
            output.append(f"origin: {voyage.origin}")
        if voyage.destination:
            output.append(f"destination: {voyage.destination}")
        output.append(f"vessel_name: {voyage.vessel_name}")
        if voyage.summary:
            # For single line summaries, use simple format
            if '\n' not in voyage.summary and len(voyage.summary) < 120:
                output.append(f"summary: {voyage.summary}")
            else:
                output.append("summary: |")
                for line in voyage.summary.split('\n'):
                    output.append(f"{line}")
        output.append(f"tags: {voyage.tags}")
        output.append("")
        output.append("---")
        
        # Passengers section
        if voyage.passengers:
            output.append("## Passengers")
            output.append("")
            for passenger in voyage.passengers:
                output.append(f"- slug: {passenger.slug}")
                output.append(f"  full_name: {passenger.full_name}")
                output.append(f"  role_title: {passenger.role_title}")
                output.append(f"  wikipedia_url: {passenger.wikipedia_url}")
                output.append("")
            output.append("---")
        
        # Media section
        if voyage.media:
            output.append("## Media")
            output.append("")
            for media in voyage.media:
                output.append(f"- title: {media.title}")
                output.append(f"  credit: {media.credit}")
                output.append(f"  date: {media.date}")
                output.append(f'  description: "{media.description}"')
                output.append(f"  tags: {media.tags}")
                output.append(f"  google_drive_link: {media.google_drive_link}")
                output.append("")
            
            # Add non-drive references as comments
            if voyage.non_drive_refs:
                output.append("<!-- Non-Drive references for this voyage (ignored by ingest):")
                for ref in voyage.non_drive_refs:
                    output.append(ref)
                output.append("-->")
                output.append("")
            
            output.append("---")
        
        return '\n'.join(output)

def main():
    if len(sys.argv) != 3:
        print("Usage: python transform_voyages.py input.md output.md")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # Read input
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            input_text = f.read()
    except Exception as e:
        print(f"Error reading input file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Parse voyages
    parser = VoyageParser()
    voyages = parser.parse_voyages(input_text)
    
    print(f"Parsed {len(voyages)} voyages", file=sys.stderr)
    
    # Generate output
    output_sections = []
    for voyage in voyages:
        output_sections.append(parser.format_voyage_output(voyage))
    
    output_text = '\n'.join(output_sections)
    
    # Write output
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(output_text)
        print(f"Successfully wrote structured voyages to {output_file}")
    except Exception as e:
        print(f"Error writing output file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()