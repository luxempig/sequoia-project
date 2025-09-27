#!/usr/bin/env python3
"""
Voyage Markdown to JSON Converter using Claude API
Processes USS Sequoia voyage markdown files and converts them to structured JSON format
"""

import os
import json
import glob
import argparse
from pathlib import Path
from typing import Dict, List, Any
import anthropic
from datetime import datetime
import re
import sys
import time

class VoyageProcessor:
    def __init__(self, api_key: str):
        """Initialize the processor with Claude API credentials"""
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-opus-4-1-20250805"  # Using Opus 3 as 4.1 may not be available via API yet
        self.max_chunk_size = 8000  # Conservative estimate for input tokens to avoid hitting limits

        # Define the expected JSON structure
        self.json_structure_prompt = """
        Convert the following USS Sequoia voyage markdown into a structured JSON object following this EXACT format:
        
        {
          "president-key": {
            "term_start": "Month DD, YYYY",
            "term_end": "Month DD, YYYY", 
            "info": "President Name (term dates)",
            "voyages": [
              {
                "voyage": "president-key-YYYY-MM-DD",
                "start_date": "YYYY-MM-DD",
                "end_date": "YYYY-MM-DD",
                "start_time": "HH:MM",
                "end_time": "HH:MM",
                "origin": "location",
                "destination": "location",
                "passengers": [
                  {
                    "name": "lastname-firstname",
                    "full_name": "Full Name",
                    "title": "Their title if provided",
                    "role": "",
                    "bio": "URL if provided"
                  }
                ],
                "media": [
                  {
                    "media_name": "source-name-year",
                    "link": "URL",
                    "source": "Source Name",
                    "date": "date if available",
                    "type": "file extension",
                    "platform": "drive|drop|other"
                  }
                ],
                "notes": ["list of distinct notes"],
                "tags": ["keywords describing voyage"],
                "missing_info": {
                  "field": "description of what's missing",
                  "media.date": "media filename has no extractable date",
                  "passenger.title": "passenger has no title specified"
                }
              }
            ]
          }
        }
        
        IMPORTANT RULES:
        1. President key format: lastname-firstname (lowercase, hyphenated)
        2. Passenger names: normalized lastname-firstname format (remove non-letters, separate with hyphens)
        3. Media platform: "drive" for Google Drive links, "drop" for Dropbox, "other" for all others
        4. Role field: always empty string "" (title contains the position)
        5. Missing_info: use dot notation to specify exactly what's missing (e.g., "media.date", "passenger.title", "voyage.end_time")
        6. Maintain passenger order from the document
        7. Notes: convert to list if multiple distinct notes exist
        8. Tags: extract keywords that define the voyage
        9. Dates in voyage ID: YYYY-MM-DD format (use 00 for unknown day/month)
        10. Media date extraction: Extract dates from filename patterns AND populate date field:
            - "source-name-YYYY" format: keep full name in media_name, extract YYYY to date field
            - "name-files-location-YYYY" format: keep full name in media_name, extract YYYY to date field
            - Any filename ending with 4-digit year: keep full filename in media_name, extract year to date field
            - IMPORTANT: Do NOT remove the year from media_name, but DO extract it to the date field
            - If no date pattern found, leave date field empty
        
        Process the markdown and return ONLY the JSON object, no explanation.
        """

    def print_progress(self, current: int, total: int, filename: str = ""):
        """Print a simple progress bar"""
        percent = (current / total) * 100
        bar_length = 40
        filled_length = int(bar_length * current // total)
        bar = '█' * filled_length + '░' * (bar_length - filled_length)
        print(f'\r[{bar}] {percent:.1f}% ({current}/{total}) {filename}', end='', flush=True)

    def extract_voyages_from_markdown(self, content: str) -> List[str]:
        """Extract individual voyage sections from markdown content"""
        # Split content into lines
        lines = content.split('\n')
        voyages = []
        current_voyage = []
        in_voyage = False

        # Common voyage indicators
        voyage_indicators = [
            r'^\s*#{1,6}\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}',  # Date headers like ## 1945-05-14
            r'^\s*#{1,6}\s*\w+\s+\d{1,2},?\s+\d{4}',      # Date headers like ## May 14, 1945
            r'^\s*\*\*Date\*\*:',                          # **Date**: format
            r'^\s*Date\s*:',                               # Date: format
            r'^\s*\d{4}[-/]\d{1,2}[-/]\d{1,2}',           # Standalone dates
            r'voyage|cruise|trip|aboard.*sequoia',         # Voyage-related content
        ]

        # Content that indicates end of voyage or irrelevant content
        end_indicators = [
            r'^\s*#{1,6}\s*bibliography',
            r'^\s*#{1,6}\s*sources',
            r'^\s*#{1,6}\s*references',
            r'^\s*#{1,6}\s*notes',
            r'^\s*#{1,6}\s*appendix',
        ]

        for line in lines:
            line_lower = line.lower()

            # Check if this line indicates end of voyage content
            if any(re.search(pattern, line_lower) for pattern in end_indicators):
                if current_voyage:
                    voyages.append('\n'.join(current_voyage))
                    current_voyage = []
                in_voyage = False
                continue

            # Check if this line starts a new voyage
            if any(re.search(pattern, line_lower) for pattern in voyage_indicators):
                # Save previous voyage if exists
                if current_voyage:
                    voyages.append('\n'.join(current_voyage))
                current_voyage = [line]
                in_voyage = True
                continue

            # Add line to current voyage if we're in one
            if in_voyage:
                current_voyage.append(line)
            # If we're not in a voyage but the line contains relevant voyage content, start a new voyage
            elif any(keyword in line_lower for keyword in ['sequoia', 'potomac', 'cruise', 'forrestal', 'truman']):
                current_voyage = [line]
                in_voyage = True

        # Add the last voyage if exists
        if current_voyage:
            voyages.append('\n'.join(current_voyage))

        # Filter out very short voyages (likely not real voyage data)
        voyages = [v for v in voyages if len(v.strip()) > 100]

        return voyages

    def split_large_content(self, content: str) -> List[str]:
        """Split large content into smaller chunks that fit within token limits"""
        # First try to extract individual voyages
        voyages = self.extract_voyages_from_markdown(content)

        chunks = []
        current_chunk = ""

        for voyage in voyages:
            # If adding this voyage would exceed chunk size, start a new chunk
            if len(current_chunk) + len(voyage) > self.max_chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = voyage
            else:
                if current_chunk:
                    current_chunk += "\n\n" + voyage
                else:
                    current_chunk = voyage

        # Add the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        # If no chunks were created (no voyage structure detected), split by character count
        if not chunks:
            for i in range(0, len(content), self.max_chunk_size):
                chunk = content[i:i + self.max_chunk_size]
                if chunk.strip():
                    chunks.append(chunk.strip())

        return chunks

    def process_single_voyage(self, markdown_content: str) -> Dict[str, Any]:
        """Process a single voyage markdown file using Claude API"""

        # Check if content is too large and needs splitting
        if len(markdown_content) > self.max_chunk_size:
            print(f"\nContent too large ({len(markdown_content)} chars), splitting into chunks...")
            chunks = self.split_large_content(markdown_content)
            print(f"Split into {len(chunks)} chunks")

            # Process each chunk and merge results
            all_voyage_data = []
            for i, chunk in enumerate(chunks, 1):
                print(f"Processing chunk {i}/{len(chunks)}...")
                chunk_result = self._process_chunk(chunk)
                if chunk_result:
                    all_voyage_data.append(chunk_result)

                # Add delay between chunks to avoid API overload
                if i < len(chunks):  # Don't delay after the last chunk
                    print(f"Waiting 2 seconds before next chunk...")
                    time.sleep(2)

            # Merge all chunk results
            return self.merge_voyages(all_voyage_data)
        else:
            # Process normally for small files
            return self._process_chunk(markdown_content)

    def _process_chunk(self, markdown_content: str) -> Dict[str, Any]:
        """Process a single chunk of markdown content"""

        prompt = f"{self.json_structure_prompt}\n\nMarkdown content to process:\n\n{markdown_content}"
        
        try:
            # Use streaming for large requests to avoid timeout
            json_text = ""
            with self.client.messages.stream(
                model=self.model,
                max_tokens=32000,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            ) as stream:
                for text in stream.text_stream:
                    json_text += text
            
            # Clean up the response if needed
            json_text = json_text.strip()
            if json_text.startswith("```json"):
                json_text = json_text[7:]
            if json_text.endswith("```"):
                json_text = json_text[:-3]
            json_text = json_text.strip()

            # Parse JSON with better error handling
            try:
                voyage_data = json.loads(json_text)
                return voyage_data
            except json.JSONDecodeError as e:
                print(f"\nJSON parsing error at line {e.lineno}, column {e.colno}: {e.msg}")
                print(f"Problematic JSON snippet around error:")
                lines = json_text.split('\n')
                start_line = max(0, e.lineno - 3)
                end_line = min(len(lines), e.lineno + 2)
                for i in range(start_line, end_line):
                    marker = " -> " if i == e.lineno - 1 else "    "
                    print(f"{marker}{i+1:3}: {lines[i] if i < len(lines) else ''}")

                # Try to save the problematic JSON for debugging
                debug_file = "debug_json_output.txt"
                with open(debug_file, 'w', encoding='utf-8') as f:
                    f.write(json_text)
                print(f"\nSaved problematic JSON to {debug_file} for debugging")
                return None
            
        except Exception as e:
            print(f"Error processing voyage: {e}")
            return None
    
    def merge_voyages(self, voyage_jsons: List[Dict]) -> Dict:
        """Merge multiple voyage JSONs into a single structure"""
        merged = {}
        
        for voyage_json in voyage_jsons:
            if not voyage_json:
                continue
                
            for president_key, president_data in voyage_json.items():
                if president_key not in merged:
                    merged[president_key] = {
                        "term_start": president_data.get("term_start", ""),
                        "term_end": president_data.get("term_end", ""),
                        "info": president_data.get("info", ""),
                        "voyages": []
                    }
                
                # Add voyages from this file
                if "voyages" in president_data:
                    merged[president_key]["voyages"].extend(president_data["voyages"])
        
        # Sort voyages by date for each president
        for president_key in merged:
            merged[president_key]["voyages"].sort(key=lambda x: x.get("start_date", ""))
        
        return merged
    
    def process_directory(self, directory: str) -> Dict:
        """Process all markdown files in a directory"""
        markdown_files = glob.glob(os.path.join(directory, "*.md"))

        if not markdown_files:
            print(f"No markdown files found in {directory}")
            return {}

        print(f"Found {len(markdown_files)} markdown files to process")
        print()  # Add blank line before progress bar

        voyage_jsons = []
        for i, md_file in enumerate(markdown_files, 1):
            filename = os.path.basename(md_file)
            self.print_progress(i-1, len(markdown_files), f"Starting {filename}")

            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check if file needs to be split
            if len(content) > self.max_chunk_size:
                print(f"\n{filename} is large ({len(content)} chars), will split into chunks")

            voyage_json = self.process_single_voyage(content)
            if voyage_json:
                voyage_jsons.append(voyage_json)
                self.print_progress(i, len(markdown_files), f"✓ {filename}")
            else:
                self.print_progress(i, len(markdown_files), f"✗ {filename}")

        # Complete progress bar with newline
        print()  # Move to next line after progress bar

        # Merge all voyages
        merged_data = self.merge_voyages(voyage_jsons)
        return merged_data
    
    def save_json(self, data: Dict, output_file: str):
        """Save the processed data to a JSON file"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved JSON to {output_file}")


def main():
    parser = argparse.ArgumentParser(description='Convert USS Sequoia voyage markdown files to JSON using Claude API')
    parser.add_argument('input', help='Input markdown file or directory containing markdown files')
    parser.add_argument('output', help='Output JSON file path')
    parser.add_argument('--api-key', required=True, help='Anthropic API key')
    parser.add_argument('--merge-with', help='Existing JSON file to merge with')
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = VoyageProcessor(args.api_key)
    
    # Check if input is file or directory
    input_path = Path(args.input)
    
    if input_path.is_file():
        # Process single file
        print(f"Processing single file: {input_path}")
        with open(input_path, 'r', encoding='utf-8') as f:
            content = f.read()
        result = processor.process_single_voyage(content)
    elif input_path.is_dir():
        # Process directory
        print(f"Processing directory: {input_path}")
        result = processor.process_directory(str(input_path))
    else:
        print(f"Error: {input_path} is not a valid file or directory")
        return
    
    # Merge with existing JSON if specified
    if args.merge_with and os.path.exists(args.merge_with):
        print(f"Merging with existing JSON: {args.merge_with}")
        with open(args.merge_with, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        
        # Merge the data
        for president_key, president_data in result.items():
            if president_key in existing_data:
                # Merge voyages
                existing_voyages = {v['voyage']: v for v in existing_data[president_key].get('voyages', [])}
                new_voyages = {v['voyage']: v for v in president_data.get('voyages', [])}
                existing_voyages.update(new_voyages)
                existing_data[president_key]['voyages'] = list(existing_voyages.values())
                # Sort by date
                existing_data[president_key]['voyages'].sort(key=lambda x: x.get('start_date', ''))
            else:
                existing_data[president_key] = president_data
        
        result = existing_data
    
    # Save result
    processor.save_json(result, args.output)
    
    # Print summary
    total_voyages = sum(len(p.get('voyages', [])) for p in result.values())
    print(f"\nSummary:")
    print(f"  Presidents: {len(result)}")
    print(f"  Total voyages: {total_voyages}")
    
    for president_key, data in result.items():
        voyage_count = len(data.get('voyages', []))
        print(f"  {president_key}: {voyage_count} voyages")


if __name__ == "__main__":
    main()
