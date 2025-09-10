#!/usr/bin/env python3
"""
Timeline JSON to Markdown Converter
Converts JSON timeline data into professional markdown format suitable for Google Docs
"""

import json
import sys
from datetime import datetime
from collections import defaultdict, Counter
from pathlib import Path
import re


class TimelineMarkdownConverter:
    def __init__(self):
        self.content_types = defaultdict(list)
        self.stats = {
            'total_entries': 0,
            'content_types': Counter(),
            'participants': set(),
            'date_range': {'earliest': None, 'latest': None},
            'media_sources': Counter(),
            'entries_with_notes': 0,
            'entries_with_media': 0
        }
    
    def load_json_data(self, file_path):
        """Load and validate JSON data from file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                
            if not isinstance(data, list):
                raise ValueError("JSON data must be a list of timeline entries")
                
            return data
        except FileNotFoundError:
            raise FileNotFoundError(f"Timeline file not found: {file_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON format: {e}")
    
    def clean_text(self, text):
        """Clean text by removing emojis and extra whitespace"""
        if not text:
            return ""
        
        # Remove emojis using regex
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map symbols
            "\U0001F1E0-\U0001F1FF"  # flags (iOS)
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+", flags=re.UNICODE)
        
        cleaned = emoji_pattern.sub('', text)
        return ' '.join(cleaned.split())  # Remove extra whitespace
    
    def format_date(self, date_string):
        """Format date string for readability"""
        if not date_string:
            return "Date not specified"
        
        try:
            # Handle various date formats
            for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S']:
                try:
                    date_obj = datetime.strptime(date_string[:len(fmt)], fmt)
                    return date_obj.strftime('%B %d, %Y')
                except ValueError:
                    continue
            
            # If no format matches, return as-is
            return self.clean_text(date_string)
        
        except Exception:
            return self.clean_text(date_string)
    
    def format_time_range(self, time_range):
        """Format time range for readability"""
        if not time_range:
            return "Time not specified"
        
        if isinstance(time_range, str):
            return self.clean_text(time_range)
        
        if isinstance(time_range, dict):
            start = time_range.get('start', '')
            end = time_range.get('end', '')
            if start and end:
                return f"{start} - {end}"
            elif start:
                return f"Starting at {start}"
            elif end:
                return f"Ending at {end}"
        
        return "Time not specified"
    
    def format_participants(self, participants):
        """Format participants list with Wikipedia links"""
        if not participants:
            return ""
        
        formatted_participants = []
        for i, participant in enumerate(participants, 1):
            if isinstance(participant, dict):
                name = participant.get('name', 'Unknown')
                wikipedia = participant.get('wikipedia', '')
                
                if wikipedia:
                    formatted_participants.append(f"{i}. [{self.clean_text(name)}]({wikipedia})")
                else:
                    formatted_participants.append(f"{i}. {self.clean_text(name)}")
            else:
                formatted_participants.append(f"{i}. {self.clean_text(str(participant))}")
        
        return '\n'.join(formatted_participants)
    
    def format_notes(self, notes):
        """Format notes as organized bullet points"""
        if not notes:
            return ""
        
        if isinstance(notes, str):
            # Split by common separators and create bullet points
            note_lines = [line.strip() for line in notes.split('\n') if line.strip()]
            return '\n'.join(f"- {self.clean_text(line)}" for line in note_lines)
        
        if isinstance(notes, list):
            return '\n'.join(f"- {self.clean_text(str(note))}" for note in notes if note)
        
        return f"- {self.clean_text(str(notes))}"
    
    def format_media_sources(self, media_sources):
        """Format media sources grouped by type"""
        if not media_sources:
            return ""
        
        media_by_type = defaultdict(list)
        
        for source in media_sources:
            if isinstance(source, dict):
                media_type = source.get('type', 'Unknown').title()
                url = source.get('url', '')
                description = source.get('description', '')
                
                if url:
                    if description:
                        media_by_type[media_type].append(f"[{self.clean_text(description)}]({url})")
                    else:
                        media_by_type[media_type].append(f"[{media_type} Source]({url})")
                elif description:
                    media_by_type[media_type].append(self.clean_text(description))
            else:
                media_by_type['Other'].append(self.clean_text(str(source)))
        
        formatted_media = []
        for media_type, sources in media_by_type.items():
            formatted_media.append(f"**{media_type}:**")
            for source in sources:
                formatted_media.append(f"- {source}")
        
        return '\n'.join(formatted_media)
    
    def update_statistics(self, entry):
        """Update running statistics"""
        self.stats['total_entries'] += 1
        
        content_type = entry.get('content_type', 'unknown')
        self.stats['content_types'][content_type] += 1
        
        # Track participants
        participants = entry.get('participants', [])
        for participant in participants:
            if isinstance(participant, dict):
                name = participant.get('name', '')
                if name:
                    self.stats['participants'].add(self.clean_text(name))
            else:
                self.stats['participants'].add(self.clean_text(str(participant)))
        
        # Track date range
        date = entry.get('date')
        if date:
            try:
                for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S']:
                    try:
                        date_obj = datetime.strptime(date[:len(fmt)], fmt)
                        if not self.stats['date_range']['earliest'] or date_obj < self.stats['date_range']['earliest']:
                            self.stats['date_range']['earliest'] = date_obj
                        if not self.stats['date_range']['latest'] or date_obj > self.stats['date_range']['latest']:
                            self.stats['date_range']['latest'] = date_obj
                        break
                    except ValueError:
                        continue
            except Exception:
                pass
        
        # Track media sources
        media_sources = entry.get('media_sources', [])
        if media_sources:
            self.stats['entries_with_media'] += 1
            for source in media_sources:
                if isinstance(source, dict):
                    media_type = source.get('type', 'Unknown')
                    self.stats['media_sources'][media_type] += 1
        
        # Track notes
        notes = entry.get('notes')
        if notes:
            self.stats['entries_with_notes'] += 1
    
    def process_entry(self, entry):
        """Process a single timeline entry"""
        self.update_statistics(entry)
        
        content_type = entry.get('content_type', 'unknown')
        self.content_types[content_type].append(entry)
    
    def generate_table_of_contents(self):
        """Generate table of contents"""
        toc = ["# Table of Contents\n"]
        toc.append("1. [Summary Statistics](#summary-statistics)")
        
        section_num = 2
        for content_type in sorted(self.content_types.keys()):
            section_title = content_type.replace('_', ' ').title()
            toc.append(f"{section_num}. [{section_title}](#{content_type.lower().replace('_', '-')})")
            section_num += 1
        
        return '\n'.join(toc) + '\n\n---\n\n'
    
    def generate_summary_statistics(self):
        """Generate summary statistics section"""
        stats_section = ["# Summary Statistics\n"]
        
        stats_section.append(f"**Total Timeline Entries:** {self.stats['total_entries']}")
        stats_section.append(f"**Unique Participants:** {len(self.stats['participants'])}")
        stats_section.append(f"**Entries with Notes:** {self.stats['entries_with_notes']}")
        stats_section.append(f"**Entries with Media:** {self.stats['entries_with_media']}")
        
        if self.stats['date_range']['earliest'] and self.stats['date_range']['latest']:
            earliest = self.stats['date_range']['earliest'].strftime('%B %d, %Y')
            latest = self.stats['date_range']['latest'].strftime('%B %d, %Y')
            stats_section.append(f"**Date Range:** {earliest} to {latest}")
        
        stats_section.append("\n## Content Types Distribution\n")
        for content_type, count in self.stats['content_types'].most_common():
            stats_section.append(f"- **{content_type.replace('_', ' ').title()}:** {count} entries")
        
        if self.stats['media_sources']:
            stats_section.append("\n## Media Sources Distribution\n")
            for media_type, count in self.stats['media_sources'].most_common():
                stats_section.append(f"- **{media_type.title()}:** {count} sources")
        
        return '\n'.join(stats_section) + '\n\n---\n\n'
    
    def generate_content_section(self, content_type, entries):
        """Generate a section for a specific content type"""
        section_title = content_type.replace('_', ' ').title()
        section = [f"# {section_title}\n"]
        
        # Sort entries by date if available
        def get_date_for_sort(entry):
            date_str = entry.get('date', '')
            if not date_str:
                return datetime.min
            
            try:
                for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S']:
                    try:
                        return datetime.strptime(date_str[:len(fmt)], fmt)
                    except ValueError:
                        continue
                return datetime.min
            except Exception:
                return datetime.min
        
        sorted_entries = sorted(entries, key=get_date_for_sort)
        
        for i, entry in enumerate(sorted_entries, 1):
            section.append(f"## {section_title} Entry {i}\n")
            
            # Basic information
            date = self.format_date(entry.get('date'))
            section.append(f"**Date:** {date}")
            
            time_range = self.format_time_range(entry.get('time_range'))
            section.append(f"**Time:** {time_range}")
            
            # Voyage-specific information
            if content_type == 'voyage':
                location = entry.get('location', {})
                if isinstance(location, dict):
                    departure = location.get('departure', 'Not specified')
                    arrival = location.get('arrival', 'Not specified')
                    section.append(f"**Route:** {self.clean_text(departure)} → {self.clean_text(arrival)}")
                elif location:
                    section.append(f"**Location:** {self.clean_text(str(location))}")
                
                vessel = entry.get('vessel')
                if vessel:
                    if isinstance(vessel, dict):
                        name = vessel.get('name', 'Unknown vessel')
                        vessel_type = vessel.get('type', '')
                        if vessel_type:
                            section.append(f"**Vessel:** {self.clean_text(name)} ({self.clean_text(vessel_type)})")
                        else:
                            section.append(f"**Vessel:** {self.clean_text(name)}")
                    else:
                        section.append(f"**Vessel:** {self.clean_text(str(vessel))}")
            else:
                # Non-voyage location
                location = entry.get('location')
                if location:
                    section.append(f"**Location:** {self.clean_text(str(location))}")
            
            # Participants
            participants = self.format_participants(entry.get('participants', []))
            if participants:
                section.append(f"\n**Participants:**\n{participants}")
            
            # Notes
            notes = self.format_notes(entry.get('notes'))
            if notes:
                section.append(f"\n**Notes:**\n{notes}")
            
            # Media sources
            media = self.format_media_sources(entry.get('media_sources', []))
            if media:
                section.append(f"\n**Media Sources:**\n{media}")
            
            section.append("\n---\n")
        
        return '\n'.join(section) + '\n'
    
    def convert_to_markdown(self, json_data):
        """Convert JSON data to markdown format"""
        # Process all entries
        for entry in json_data:
            self.process_entry(entry)
        
        # Generate markdown sections
        markdown_content = []
        
        # Add title
        markdown_content.append("# Historical Timeline Documentation\n")
        markdown_content.append("*Generated from JSON timeline data*\n\n")
        
        # Table of contents
        markdown_content.append(self.generate_table_of_contents())
        
        # Summary statistics
        markdown_content.append(self.generate_summary_statistics())
        
        # Content sections
        for content_type in sorted(self.content_types.keys()):
            entries = self.content_types[content_type]
            markdown_content.append(self.generate_content_section(content_type, entries))
        
        return ''.join(markdown_content)
    
    def save_markdown(self, content, output_path):
        """Save markdown content to file"""
        try:
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f"Markdown file successfully created: {output_path}")
        except Exception as e:
            raise Exception(f"Error saving markdown file: {e}")


def main():
    """Main functio