#!/usr/bin/env python3
"""
Timeline JSON to Markdown Converter

This script converts JSON timeline data into a well-formatted markdown file
suitable for Google Docs and professional historical documentation.
"""

import json
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, List, Any, Optional


class TimelineMarkdownConverter:
    """Converts timeline JSON data to formatted markdown."""
    
    def __init__(self):
        self.stats = {
            'total_entries': 0,
            'voyage_entries': 0,
            'non_voyage_entries': 0,
            'total_participants': 0,
            'unique_participants': set(),
            'media_sources': 0,
            'date_range': {'earliest': None, 'latest': None}
        }
        
    def load_json(self, file_path: str) -> Dict[str, Any]:
        """Load and validate JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if 'timeline' not in data:
                raise ValueError("JSON file must contain a 'timeline' key")
            
            return data
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: {file_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {e}")
        except Exception as e:
            raise Exception(f"Error loading file: {e}")

    def format_date(self, date_str: str) -> str:
        """Format date string for readability."""
        if not date_str:
            return "Date not specified"
        
        try:
            # Try to parse ISO format
            if 'T' in date_str:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                return dt.strftime("%B %d, %Y at %I:%M %p UTC")
            else:
                # Assume date only
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                return dt.strftime("%B %d, %Y")
        except (ValueError, AttributeError):
            # Return original if parsing fails
            return str(date_str)

    def update_date_stats(self, date_str: str):
        """Update date statistics."""
        if not date_str:
            return
            
        try:
            if 'T' in date_str:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            
            if not self.stats['date_range']['earliest'] or dt < self.stats['date_range']['earliest']:
                self.stats['date_range']['earliest'] = dt
            if not self.stats['date_range']['latest'] or dt > self.stats['date_range']['latest']:
                self.stats['date_range']['latest'] = dt
                
        except (ValueError, AttributeError):
            pass

    def format_participants(self, participants: List[Dict[str, Any]]) -> str:
        """Format participants list with numbering and Wikipedia links."""
        if not participants:
            return "No participants listed"
        
        formatted_participants = []
        for i, participant in enumerate(participants, 1):
            name = participant.get('name', 'Unknown')
            role = participant.get('role', '')
            wikipedia_url = participant.get('wikipedia_url', '')
            
            # Update statistics
            self.stats['unique_participants'].add(name)
            self.stats['total_participants'] += 1
            
            # Format participant entry
            if wikipedia_url:
                if role:
                    entry = f"{i}. [{name}]({wikipedia_url}) - {role}"
                else:
                    entry = f"{i}. [{name}]({wikipedia_url})"
            else:
                if role:
                    entry = f"{i}. {name} - {role}"
                else:
                    entry = f"{i}. {name}"
            
            formatted_participants.append(entry)
        
        return '\n'.join(formatted_participants)

    def format_notes(self, notes: List[str]) -> str:
        """Format notes as organized bullet points."""
        if not notes:
            return "No additional notes"
        
        formatted_notes = []
        for note in notes:
            if note and note.strip():
                formatted_notes.append(f"- {note.strip()}")
        
        return '\n'.join(formatted_notes) if formatted_notes else "No additional notes"

    def format_media_sources(self, media_sources: List[Dict[str, Any]]) -> str:
        """Format media sources grouped by type."""
        if not media_sources:
            return "No media sources available"
        
        # Group sources by type
        sources_by_type = defaultdict(list)
        for source in media_sources:
            source_type = source.get('type', 'Unknown').title()
            sources_by_type[source_type].append(source)
            self.stats['media_sources'] += 1
        
        formatted_sections = []
        for source_type, sources in sorted(sources_by_type.items()):
            formatted_sections.append(f"**{source_type} Sources:**")
            
            for source in sources:
                title = source.get('title', 'Untitled')
                url = source.get('url', '')
                description = source.get('description', '')
                
                if url:
                    source_line = f"- [{title}]({url})"
                else:
                    source_line = f"- {title}"
                
                if description:
                    source_line += f" - {description}"
                
                formatted_sections.append(source_line)
            
            formatted_sections.append("")  # Add spacing between types
        
        return '\n'.join(formatted_sections).strip()

    def format_timeline_entry(self, entry: Dict[str, Any]) -> str:
        """Format a single timeline entry."""
        content_type = entry.get('content_type', 'unknown')
        title = entry.get('title', 'Untitled Entry')
        date = entry.get('date', '')
        location = entry.get('location', '')
        description = entry.get('description', '')
        participants = entry.get('participants', [])
        notes = entry.get('notes', [])
        media_sources = entry.get('media_sources', [])
        
        # Update statistics
        self.stats['total_entries'] += 1
        if content_type == 'voyage':
            self.stats['voyage_entries'] += 1
        else:
            self.stats['non_voyage_entries'] += 1
        
        self.update_date_stats(date)
        
        # Build entry markdown
        entry_md = []
        entry_md.append(f"### {title}")
        entry_md.append("")
        
        # Basic information
        entry_md.append("**Details:**")
        entry_md.append(f"- **Date:** {self.format_date(date)}")
        entry_md.append(f"- **Type:** {content_type.title()}")
        
        if location:
            entry_md.append(f"- **Location:** {location}")
        
        entry_md.append("")
        
        # Description
        if description:
            entry_md.append("**Description:**")
            entry_md.append(description)
            entry_md.append("")
        
        # Participants
        entry_md.append("**Participants:**")
        entry_md.append(self.format_participants(participants))
        entry_md.append("")
        
        # Notes
        if notes:
            entry_md.append("**Notes:**")
            entry_md.append(self.format_notes(notes))
            entry_md.append("")
        
        # Media sources
        if media_sources:
            entry_md.append("**Media Sources:**")
            entry_md.append(self.format_media_sources(media_sources))
            entry_md.append("")
        
        entry_md.append("---")
        entry_md.append("")
        
        return '\n'.join(entry_md)

    def generate_table_of_contents(self, timeline_data: List[Dict[str, Any]]) -> str:
        """Generate table of contents."""
        toc = []
        toc.append("## Table of Contents")
        toc.append("")
        toc.append("1. [Summary Statistics](#summary-statistics)")
        toc.append("2. [Voyage Entries](#voyage-entries)")
        toc.append("3. [Non-Voyage Entries](#non-voyage-entries)")
        toc.append("4. [All Entries (Chronological)](#all-entries-chronological)")
        toc.append("")
        
        return '\n'.join(toc)

    def generate_summary_statistics(self) -> str:
        """Generate summary statistics section."""
        stats_md = []
        stats_md.append("## Summary Statistics")
        stats_md.append("")
        stats_md.append(f"- **Total Entries:** {self.stats['total_entries']}")
        stats_md.append(f"- **Voyage Entries:** {self.stats['voyage_entries']}")
        stats_md.append(f"- **Non-Voyage Entries:** {self.stats['non_voyage_entries']}")
        stats_md.append(f"- **Total Participants:** {self.stats['total_participants']}")
        stats_md.append(f"- **Unique Participants:** {len(self.stats['unique_participants'])}")
        stats_md.append(f"- **Media Sources:** {self.stats['media_sources']}")
        
        # Date range
        if self.stats['date_range']['earliest'] and self.stats['date_range']['latest']:
            earliest = self.stats['date_range']['earliest'].strftime("%B %d, %Y")
            latest = self.stats['date_range']['latest'].strftime("%B %d, %Y")
            stats_md.append(f"- **Date Range:** {earliest} to {latest}")
        
        stats_md.append("")
        
        return '\n'.join(stats_md)

    def convert_to_markdown(self, json_file_path: str, output_file_path: str = None) -> str:
        """Convert JSON timeline to markdown format."""
        try:
            # Load JSON data
            data = self.load_json(json_file_path)
            timeline_data = data['timeline']
            
            if not timeline_data:
                raise ValueError("Timeline data is empty")
            
            # Start building markdown
            markdown_content = []
            
            # Title and metadata
            title = data.get('title', 'Historical Timeline')
            markdown_content.append(f"# {title}")
            markdown_content.append("")
            
            if 'description' in data:
                markdown_content.append(data['description'])
                markdown_content.append("")
            
            # Generate TOC (placeholder for now)
            markdown_content.append(self.generate_table_of_contents(timeline_data))
            
            # Separate entries by type
            voyage_entries = [entry for entry in timeline_data if entry.get('content_type') == 'voyage']
            non_voyage_entries = [entry for entry in timeline_data if entry.get('content_type') != 'voyage']
            
            # Sort entries by date
            def sort_by_date(entries):
                def date_key(entry):
                    date_str = entry.get('date', '')
                    if not date_str:
                        return datetime.min
                    try:
                        if 'T' in date_str:
                            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        else:
                            return datetime.strptime(date_str, "%Y-%m-%d")
                    except (ValueError, AttributeError):
                        return datetime.min
                return sorted(entries, key=date_key)
            
            voyage_entries = sort_by_date(voyage_entries)
            non_voyage_entries = sort_by_date(non_voyage_entries)
            all_entries = sort_by_date(timeline_data)
            
            # Process all entries to collect statistics
            for entry in all_entries:
                # This will update our statistics
                self.format_timeline_entry(entry)
            
            # Clear the stats for actual processing
            temp_stats = self.stats.copy()
            self.__init__()
            
            # Add summary statistics
            self.stats = temp_stats
            markdown_content.append(self.generate_summary_statistics())
            
            # Add Voyage Entries section
            if voyage_entries:
                markdown_content.append("## Voyage Entries")
                markdown_content.append("")
                for entry in voyage_entries:
                    # Reset stats counting for clean processing
                    formatted_entry = self.format_timeline_entry(entry)
                    markdown_content.append(formatted_entry)
            
            # Add Non-Voyage Entries section
            if non_voyage_entries:
                markdown_content.append("## Non-Voyage Entries")
                markdown_content.append("")
                for entry in non_voyage_entries:
                    formatted_entry = self.format_timeline_entry(entry)
                    markdown_content.append(formatted_entry)
            
            # Add All Entries (Chronological) section
            markdown_content.append("## All Entries (Chronological)")
            markdown_content.append("")
            for entry in all_entries:
                formatted_entry = self.format_timeline_entry(entry)
                markdown_content.append(formatted_entry)
            
            # Join all content
            final_markdown = '\n'.join(markdown_content)
            
            # Write to output file if specified
            if output_file_path:
                with open(output_file_path, 'w', encoding='utf-8') as f:
                    f.write(final_markdown)
                print(f"Markdown file successfully created: {output_file_path}")
            
            return final_markdown
            
        except Exception as e:
            print(f"Error converting timeline: {e}", file=sys.stderr)
            raise


def main():
    """Main function to handle command line usage."""
    if len(sys.argv) < 2:
        print("Usage: python timeline_converter.py <input_json_file> [output_markdown_file]")
        print("Example: python timeline_converter.py timeline.json timeline.md")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Generate output filename if not provided
    if output_file is None:
        input_path = Path(input_file)
        output_file = input_path.with_suffix('.md').name
    
    try:
        converter = TimelineMarkdownConverter()
        markdown_content = converter.convert_to_markdown(input_file, output_file)
        
        print("Conversion completed successfully!")
        print(f"Statistics:")
        print(f"  - Total entries: {converter.stats['total_entries']}")
        print(f"  - Voyage entries: {converter.stats['voyage_entries']}")
        print(f"  - Non-voyage entries: {converter.stats['non_voyage_entries']}")
        print(f"  - Unique participants: {len(converter.stats['unique_participants'])}")
        print(f"  - Media sources: {converter.stats['media_sources']}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()