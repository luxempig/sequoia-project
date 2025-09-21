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

class VoyageProcessor:
    def __init__(self, api_key: str):
        """Initialize the processor with Claude API credentials"""
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-3-opus-20240229"  # Using Opus 3 as 4.1 may not be available via API yet
        
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
                  "field": "value for missing fields"
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
        5. Missing_info: include any fields that are blank/missing
        6. Maintain passenger order from the document
        7. Notes: convert to list if multiple distinct notes exist
        8. Tags: extract keywords that define the voyage
        9. Dates in voyage ID: YYYY-MM-DD format (use 00 for unknown day/month)
        
        Process the markdown and return ONLY the JSON object, no explanation.
        """
    
    def process_single_voyage(self, markdown_content: str) -> Dict[str, Any]:
        """Process a single voyage markdown file using Claude API"""
        
        prompt = f"{self.json_structure_prompt}\n\nMarkdown content to process:\n\n{markdown_content}"
        
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Extract JSON from response
            json_text = response.content[0].text
            
            # Clean up the response if needed
            json_text = json_text.strip()
            if json_text.startswith("```json"):
                json_text = json_text[7:]
            if json_text.endswith("```"):
                json_text = json_text[:-3]
            
            # Parse JSON
            voyage_data = json.loads(json_text)
            return voyage_data
            
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
        
        voyage_jsons = []
        for i, md_file in enumerate(markdown_files, 1):
            print(f"Processing file {i}/{len(markdown_files)}: {os.path.basename(md_file)}")
            
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            voyage_json = self.process_single_voyage(content)
            if voyage_json:
                voyage_jsons.append(voyage_json)
                print(f"  ✓ Successfully processed")
            else:
                print(f"  ✗ Failed to process")
        
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
