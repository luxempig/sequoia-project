#!/usr/bin/env python3
"""
JSON Timeline to Markdown Converter
Converts JSON timeline data into a professional markdown document suitable for Google Docs.
"""

import json
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter
import re

class TimelineToMarkdownConverter:
    def __init__(self):
        self.content_sections = defaultdict(list)
        self.statistics = {
            'total_entries': 0,
            'content_types': Counter(),
            'date_range': {'earliest': None, 'latest': None},
            'participants': set(),
            'media_sources': Counter(),
            'total_notes': 0
        }

    def load_json(self, file_path: str) -> Dict[str, Any]:
        """Load and parse JSON file with error handling."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                if not isinstance(data, dict) or 'timeline' not in data:
                    raise ValueError("JSON must contain a 'timeline' object")
                return data
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: {file_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {e}")
        except Exception as e:
            raise Exception(f"Error loading JSON file: {e}")

    def format_date(self, date_str: str) -> str:
        """Format date string for better readability."""
        if not date_str:
            return "Date not specified"
        
        try:
            # Try parsing ISO format first
            if 'T' in date_str:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                return dt.strftime("%B %d, %Y at %H:%M UTC")
            else:
                # Try parsing date-only format
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                return dt.strftime("%B %d, %Y")
        except ValueError:
            # Return original string if parsing fails
            return date_str

    def format_participants(self, participants: List[Dict[str, Any]]) -> str:
        """Format participants list with Wikipedia links."""
        if not participants:
            return "No participants listed"
        
        formatted_participants = []
        for i, participant in enumerate(participants, 1):
            name = participant.get('name', 'Unknown')
            wikipedia_url = participant.get('wikipedia_url', '')
            
            if wikipedia_url:
                formatted_participants.append(f"{i}. [{name}]({wikipedia_url})")
            else:
                formatted_participants.append(f"{i}. {name}")
            
            # Track for statistics
            self.statistics['participants'].add(name)
        
        return '\n'.join(formatted_participants)

    def format_notes(self, notes: List[str]) -> str:
        """Format notes as organized bullet points."""
        if not notes:
            return "No additional notes"
        
        formatted_notes = []
        for note in notes:
            # Clean up note text
            clean_note = note.strip()
            if clean_note:
                formatted_notes.append(f"- {clean_note}")
                self.statistics['total_notes'] += 1
        
        return '\n'.join(formatted_notes) if formatted_notes else "No additional notes"

    def format_media_sources(self, sources: List[Dict[str, Any]]) -> str:
        """Group and format media sources by type."""
        if not sources:
            return "No media sources available"
        
        sources_by_type = defaultdict(list)
        
        for source in sources:
            source_type = source.get('type', 'unknown').lower()
            url = source.get('url', '')
            description = source.get('description', 'No description')
            
            if url:
                sources_by_type[source_type].append(f"  - [{description}]({url})")
            else:
                sources_by_type[source_type].append(f"  - {description}")
            
            # Track for statistics
            self.statistics['media_sources'][source_type] += 1
        
        formatted_sources = []
        for source_type, source_list in sorted(sources_by_type.items()):
            formatted_sources.append(f"**{source_type.title()}:**")
            formatted_sources.extend(source_list)
        
        return '\n'.join(formatted_sources)

    def update_date_statistics(self, date_str: str):
        """Update date range statistics."""
        if not date_str:
            return
        
        try:
            if 'T' in date_str:
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            
            if self.statistics['date_range']['earliest'] is None or dt < self.statistics['date_range']['earliest']:
                self.statistics['date_range']['earliest'] = dt
            
            if self.statistics['date_range']['latest'] is None or dt > self.statistics['date_range']['latest']:
                self.statistics['date_range']['latest'] = dt
        
        except ValueError:
            pass  # Skip invalid dates

    def process_entry(self, entry_id: str, entry_data: Dict[str, Any]):
        """Process a single timeline entry."""
        content_type = entry_data.get('content_type', 'unknown')
        title = entry_data.get('title', f'Entry {entry_id}')
        date = entry_data.get('date', '')
        description = entry_data.get('description', '')
        participants = entry_data.get('participants', [])
        notes = entry_data.get('notes', [])
        media_sources = entry_data.get('media_sources', [])
        
        # Update statistics
        self.statistics['total_entries'] += 1
        self.statistics['content_types'][content_type] += 1
        self.update_date_statistics(date)
        
        # Format entry
        formatted_entry = []
        formatted_entry.append(f"### {title}")
        formatted_entry.append("")
        formatted_entry.append(f"**Date:** {self.format_date(date)}")
        formatted_entry.append("")
        
        if description:
            formatted_entry.append(f"**Description:**")
            formatted_entry.append(description)
            formatted_entry.append("")
        
        formatted_entry.append("**Participants:**")
        formatted_entry.append(self.format_participants(participants))
        formatted_entry.append("")
        
        formatted_entry.append("**Notes:**")
        formatted_entry.append(self.format_notes(notes))
        formatted_entry.append("")
        
        formatted_entry.append("**Media Sources:**")
        formatted_entry.append(self.format_media_sources(media_sources))
        formatted_entry.append("")
        formatted_entry.append("---")
        formatted_entry.append("")
        
        # Add to appropriate section
        self.content_sections[content_type].append('\n'.join(formatted_entry))

    def generate_table_of_contents(self) -> str:
        """Generate table of contents."""
        toc = ["## Table of Contents", ""]
        toc.append("1. [Summary Statistics](#summary-statistics)")
        
        section_num = 2
        for content_type in sorted(self.content_sections.keys()):
            section_title = content_type.replace('_', ' ').title()
            section_anchor = content_type.lower().replace(' ', '-').replace('_', '-')
            toc.append(f"{section_num}. [{section_title}](#{section_anchor})")
            section_num += 1
        
        toc.append("")
        return '\n'.join(toc)

    def generate_summary_statistics(self) -> str:
        """Generate summary statistics section."""
        stats = ["## Summary Statistics", ""]
        stats.append(f"**Total Entries:** {self.statistics['total_entries']}")
        stats.append(f"**Total Participants:** {len(self.statistics['participants'])}")
        stats.append(f"**Total Notes:** {self.statistics['total_notes']}")
        stats.append("")
        
        # Date range
        if self.statistics['date_range']['earliest'] and self.statistics['date_range']['latest']:
            earliest = self.statistics['date_range']['earliest'].strftime("%B %d, %Y")
            latest = self.statistics['date_range']['latest'].strftime("%B %d, %Y")
            stats.append(f"**Date Range:** {earliest} to {latest}")
        else:
            stats.append("**Date Range:** Not available")
        stats.append("")
        
        # Content types breakdown
        if self.statistics['content_types']:
            stats.append("**Content Types:**")
            for content_type, count in sorted(self.statistics['content_types'].items()):
                stats.append(f"- {content_type.replace('_', ' ').title()}: {count} entries")
            stats.append("")
        
        # Media sources breakdown
        if self.statistics['media_sources']:
            stats.append("**Media Sources:**")
            for source_type, count in sorted(self.statistics['media_sources'].items()):
                stats.append(f"- {source_type.title()}: {count} sources")
            stats.append("")
        
        stats.append("---")
        stats.append("")
        return '\n'.join(stats)

    def generate_content_sections(self) -> str:
        """Generate formatted content sections."""
        sections = []
        
        for content_type in sorted(self.content_sections.keys()):
            section_title = content_type.replace('_', ' ').title()
            sections.append(f"## {section_title}")
            sections.append("")
            
            # Add entries for this content type
            sections.extend(self.content_sections[content_type])
        
        return '\n'.join(sections)

    def convert_to_markdown(self, json_data: Dict[str, Any]) -> str:
        """Convert JSON timeline data to markdown."""
        timeline_data = json_data.get('timeline', {})
        
        if not timeline_data:
            raise ValueError("No timeline data found in JSON")
        
        # Process all entries
        for entry_id, entry_data in timeline_data.items():
            if isinstance(entry_data, dict):
                self.process_entry(entry_id, entry_data)
        
        if self.statistics['total_entries'] == 0:
            raise ValueError("No valid timeline entries found")
        
        # Generate markdown document
        markdown_parts = []
        
        # Header
        markdown_parts.append("# Historical Timeline Documentation")
        markdown_parts.append("")
        markdown_parts.append(f"*Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}*")
        markdown_parts.append("")
        
        # Table of contents
        markdown_parts.append(self.generate_table_of_contents())
        
        # Summary statistics
        markdown_parts.append(self.generate_summary_statistics())
        
        # Content sections
        markdown_parts.append(self.generate_content_sections())
        
        return '\n'.join(markdown_parts)

    def save_markdown(self, markdown_content: str, output_file: str):
        """Save markdown content to file."""
        try:
            with open(output_file, 'w', encoding='utf-8') as file:
                file.write(markdown_content)
            print(f"Markdown file successfully created: {output_file}")
        except Exception as e:
            raise Exception(f"Error saving markdown file: {e}")

def main():
    """Main function to handle command line execution."""
    if len(sys.argv) != 3:
        print("Usage: python timeline_converter.py <input_json_file> <output_markdown_file>")
        print("Example: python timeline_converter.py timeline.json timeline.md")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    converter = TimelineToMarkdownConverter()
    
    try:
        # Load JSON data
        print(f"Loading JSON data from {input_file}...")
        json_data = converter.load_json(input_file)
        
        # Convert to markdown
        print("Converting to markdown...")
        markdown_content = converter.convert_to_markdown(json_data)
        
        # Save markdown file
        print(f"Saving markdown to {output_file}...")
        converter.save_markdown(markdown_content, output_file)
        
        # Print summary
        print(f"\nConversion completed successfully!")
        print(f"Processed {converter.statistics['total_entries']} timeline entries")
        print(f"Found {len(converter.statistics['participants'])} unique participants")
        print(f"Organized into {len(converter.content_sections)} content sections")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()