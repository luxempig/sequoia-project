#!/usr/bin/env python3
"""
Timeline to Markdown Converter

Converts JSON timeline data into a well-formatted markdown file suitable for Google Docs.
Handles voyage and non-voyage content with proper formatting and organization.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter
import re

class TimelineToMarkdownConverter:
    def __init__(self, json_file_path: str):
        """Initialize the converter with JSON data."""
        self.json_file_path = json_file_path
        self.data = self._load_json_data()
        self.markdown_content = []
        
    def _load_json_data(self) -> Dict:
        """Load and validate JSON data from file."""
        try:
            with open(self.json_file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                if not isinstance(data, dict) or 'timeline' not in data:
                    raise ValueError("Invalid JSON structure: 'timeline' key not found")
                return data
        except FileNotFoundError:
            raise FileNotFoundError(f"JSON file not found: {self.json_file_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {e}")
    
    def _format_date(self, date_str: str) -> str:
        """Format date string for better readability."""
        if not date_str:
            return "Date not specified"
        
        try:
            # Try to parse as ISO format
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.strftime("%B %d, %Y")
        except ValueError:
            # Return original if parsing fails
            return date_str
    
    def _format_time(self, time_str: str) -> str:
        """Format time string for better readability."""
        if not time_str:
            return "Time not specified"
        
        try:
            # Handle various time formats
            if ':' in time_str:
                time_obj = datetime.strptime(time_str, "%H:%M").time()
                return time_obj.strftime("%I:%M %p").lstrip('0')
            return time_str
        except ValueError:
            return time_str
    
    def _create_wikipedia_link(self, name: str) -> str:
        """Create a Wikipedia link for a person's name."""
        if not name:
            return "Unknown"
        
        # Create Wikipedia URL format
        wiki_name = name.replace(' ', '_')
        return f"[{name}](https://en.wikipedia.org/wiki/{wiki_name})"
    
    def _format_participants(self, participants: List[str]) -> str:
        """Format participants list with Wikipedia links."""
        if not participants:
            return "No participants listed"
        
        formatted_participants = []
        for i, participant in enumerate(participants, 1):
            wiki_link = self._create_wikipedia_link(participant.strip())
            formatted_participants.append(f"{i}. {wiki_link}")
        
        return '\n'.join(formatted_participants)
    
    def _format_notes(self, notes: List[str]) -> str:
        """Format notes as organized bullet points."""
        if not notes:
            return "No additional notes"
        
        formatted_notes = []
        for note in notes:
            if note.strip():
                # Clean up the note text
                clean_note = re.sub(r'\s+', ' ', note.strip())
                formatted_notes.append(f"- {clean_note}")
        
        return '\n'.join(formatted_notes) if formatted_notes else "No additional notes"
    
    def _group_media_sources(self, sources: List[Dict]) -> Dict[str, List[Dict]]:
        """Group media sources by type."""
        if not sources:
            return {}
        
        grouped = defaultdict(list)
        for source in sources:
            media_type = source.get('type', 'unknown').lower()
            grouped[media_type].append(source)
        
        return dict(grouped)
    
    def _format_media_sources(self, sources: List[Dict]) -> str:
        """Format media sources by type."""
        if not sources:
            return "No media sources available"
        
        grouped_sources = self._group_media_sources(sources)
        formatted_sections = []
        
        for media_type, type_sources in grouped_sources.items():
            formatted_sections.append(f"**{media_type.title()} Sources:**")
            for i, source in enumerate(type_sources, 1):
                title = source.get('title', 'Untitled')
                url = source.get('url', '')
                description = source.get('description', '')
                
                source_line = f"{i}. {title}"
                if url:
                    source_line = f"{i}. [{title}]({url})"
                if description:
                    source_line += f" - {description}"
                
                formatted_sections.append(f"   {source_line}")
            formatted_sections.append("")  # Add spacing between types
        
        return '\n'.join(formatted_sections).rstrip()
    
    def _format_voyage_entry(self, entry: Dict) -> str:
        """Format a voyage entry."""
        voyage_id = entry.get('id', 'Unknown ID')
        title = entry.get('title', 'Untitled Voyage')
        departure_date = self._format_date(entry.get('departure_date', ''))
        arrival_date = self._format_date(entry.get('arrival_date', ''))
        departure_location = entry.get('departure_location', 'Unknown departure')
        arrival_location = entry.get('arrival_location', 'Unknown arrival')
        
        content = [
            f"### {title}",
            f"**Voyage ID:** {voyage_id}",
            f"**Departure:** {departure_date} from {departure_location}",
            f"**Arrival:** {arrival_date} at {arrival_location}",
            "",
            "**Participants:**",
            self._format_participants(entry.get('participants', [])),
            "",
            "**Notes:**",
            self._format_notes(entry.get('notes', [])),
            "",
            "**Sources:**",
            self._format_media_sources(entry.get('sources', [])),
            "",
            "---",
            ""
        ]
        
        return '\n'.join(content)
    
    def _format_non_voyage_entry(self, entry: Dict) -> str:
        """Format a non-voyage entry."""
        title = entry.get('title', 'Untitled Entry')
        date = self._format_date(entry.get('date', ''))
        time = self._format_time(entry.get('time', ''))
        location = entry.get('location', 'Location not specified')
        
        content = [
            f"### {title}",
            f"**Date:** {date}",
            f"**Time:** {time}",
            f"**Location:** {location}",
            "",
            "**Participants:**",
            self._format_participants(entry.get('participants', [])),
            "",
            "**Notes:**",
            self._format_notes(entry.get('notes', [])),
            "",
            "**Sources:**",
            self._format_media_sources(entry.get('sources', [])),
            "",
            "---",
            ""
        ]
        
        return '\n'.join(content)
    
    def _generate_statistics(self) -> str:
        """Generate summary statistics for the timeline."""
        timeline_entries = self.data.get('timeline', [])
        
        if not timeline_entries:
            return "No timeline entries found"
        
        stats = {
            'total_entries': len(timeline_entries),
            'voyage_entries': 0,
            'non_voyage_entries': 0,
            'entries_with_participants': 0,
            'entries_with_sources': 0,
            'total_participants': set(),
            'source_types': Counter(),
            'locations': set()
        }
        
        for entry in timeline_entries:
            content_type = entry.get('content_type', '').lower()
            
            if content_type == 'voyage':
                stats['voyage_entries'] += 1
                # Add locations for voyages
                if entry.get('departure_location'):
                    stats['locations'].add(entry['departure_location'])
                if entry.get('arrival_location'):
                    stats['locations'].add(entry['arrival_location'])
            else:
                stats['non_voyage_entries'] += 1
                # Add location for non-voyage entries
                if entry.get('location'):
                    stats['locations'].add(entry['location'])
            
            # Count participants
            participants = entry.get('participants', [])
            if participants:
                stats['entries_with_participants'] += 1
                stats['total_participants'].update(participants)
            
            # Count sources
            sources = entry.get('sources', [])
            if sources:
                stats['entries_with_sources'] += 1
                for source in sources:
                    source_type = source.get('type', 'unknown').lower()
                    stats['source_types'][source_type] += 1
        
        # Format statistics
        content = [
            "## Summary Statistics",
            "",
            f"**Total Entries:** {stats['total_entries']}",
            f"**Voyage Entries:** {stats['voyage_entries']}",
            f"**Non-Voyage Entries:** {stats['non_voyage_entries']}",
            f"**Entries with Participants:** {stats['entries_with_participants']}",
            f"**Entries with Sources:** {stats['entries_with_sources']}",
            f"**Total Unique Participants:** {len(stats['total_participants'])}",
            f"**Total Unique Locations:** {len(stats['locations'])}",
            ""
        ]
        
        if stats['source_types']:
            content.extend([
                "**Source Types:**",
                ""
            ])
            for source_type, count in stats['source_types'].most_common():
                content.append(f"- {source_type.title()}: {count}")
            content.append("")
        
        return '\n'.join(content)
    
    def _generate_table_of_contents(self) -> str:
        """Generate table of contents based on timeline entries."""
        timeline_entries = self.data.get('timeline', [])
        
        if not timeline_entries:
            return "## Table of Contents\n\nNo entries found\n"
        
        toc_content = [
            "## Table of Contents",
            "",
            "1. [Summary Statistics](#summary-statistics)",
            "2. [Timeline Entries](#timeline-entries)"
        ]
        
        voyage_count = 0
        non_voyage_count = 0
        
        for entry in timeline_entries:
            content_type = entry.get('content_type', '').lower()
            if content_type == 'voyage':
                voyage_count += 1
            else:
                non_voyage_count += 1
        
        if voyage_count > 0:
            toc_content.append("   - [Voyage Entries](#voyage-entries)")
        if non_voyage_count > 0:
            toc_content.append("   - [Non-Voyage Entries](#non-voyage-entries)")
        
        toc_content.extend(["", "---", ""])
        
        return '\n'.join(toc_content)
    
    def convert(self) -> str:
        """Convert JSON timeline to markdown format."""
        timeline_entries = self.data.get('timeline', [])
        
        if not timeline_entries:
            return "# Timeline\n\nNo timeline entries found in the provided data."
        
        # Start building markdown content
        self.markdown_content = [
            "# Historical Timeline Documentation",
            "",
            f"*Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}*",
            "",
            self._generate_table_of_contents(),
            self._generate_statistics(),
            "## Timeline Entries",
            ""
        ]
        
        # Separate entries by type
        voyage_entries = []
        non_voyage_entries = []
        
        for entry in timeline_entries:
            content_type = entry.get('content_type', '').lower()
            if content_type == 'voyage':
                voyage_entries.append(entry)
            else:
                non_voyage_entries.append(entry)
        
        # Add voyage entries
        if voyage_entries:
            self.markdown_content.extend([
                "### Voyage Entries",
                f"*{len(voyage_entries)} voyage{'s' if len(voyage_entries) != 1 else ''} documented*",
                ""
            ])
            
            for entry in voyage_entries:
                self.markdown_content.append(self._format_voyage_entry(entry))
        
        # Add non-voyage entries
        if non_voyage_entries:
            self.markdown_content.extend([
                "### Non-Voyage Entries",
                f"*{len(non_voyage_entries)} event{'s' if len(non_voyage_entries) != 1 else ''} documented*",
                ""
            ])
            
            for entry in non_voyage_entries:
                self.markdown_content.append(self._format_non_voyage_entry(entry))
        
        # Add footer
        self.markdown_content.extend([
            "---",
            "",
            "*This document was automatically generated from timeline data.*",
            f"*Source file: {Path(self.json_file_path).name}*"
        ])
        
        return '\n'.join(self.markdown_content)
    
    def save_markdown(self, output_path: str) -> None:
        """Save the converted markdown to a file."""
        markdown_content = self.convert()
        
        try:
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(markdown_content)
            print(f"Markdown file successfully saved to: {output_path}")
        except IOError as e:
            raise IOError(f"Failed to save markdown file: {e}")

def main():
    """Main function to handle command line execution."""
    if len(sys.argv) < 2:
        print("Usage: python timeline_converter.py <input_json_file> [output_markdown_file]")
        print("Example: python timeline_converter.py timeline.json timeline.md")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "timeline_output.md"
    
    try:
        # Create converter instance
        converter = TimelineToMarkdownConverter(input_file)
        
        # Convert and save
        converter.save_markdown(output_file)
        
        # Print success message with file info
        input_path = Path(input_file)
        output_path = Path(output_file)
        
        print(f"\nConversion completed successfully!")
        print(f"Input:  {input_path.resolve()}")
        print(f"Output: {output_path.resolve()}")
        print(f"Output file size: {output_path.stat().st_size:,} bytes")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()