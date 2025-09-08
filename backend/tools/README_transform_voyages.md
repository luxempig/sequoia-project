# Voyage Markdown Transformation Script

This script transforms messy voyage markdown format to structured YAML-like format suitable for database ingestion.

## Usage

```bash
python transform_voyages.py input.md output.md
```

## Input Format

The script expects markdown with voyage entries like:

```markdown
## **1933-04-21**

Location: Potomac River  
Time: 16:30 - 18:25  
Passengers: [Henry L. Roosevelt](https://en.wikipedia.org/wiki/Henry_L._Roosevelt) (Assistant Secretary of the Navy)  
Additional Information: Discussion of war debts, currency stabilization  
Sources: [Sequoia Logbook 1933 (page 5)](https://drive.google.com/file/d/1ArrE6smmcCFXzVwaGP7WJuwiFsJGuxiX/view?usp=sharing#page=6)  
```

## Output Format

The script produces structured YAML-like format:

```markdown
## Voyage

title: Voyage with Henry L. Roosevelt
start_date: 1933-04-21
origin: Potomac River
vessel_name: USS Sequoia
summary: Discussion of war debts, currency stabilization
tags: fdr

---
## Passengers

- slug: henry-l-roosevelt
  full_name: Henry L. Roosevelt
  role_title: Assistant Secretary of the Navy
  wikipedia_url: https://en.wikipedia.org/wiki/Henry_L._Roosevelt

---
## Media

- title: Media 1
  credit: Sequoia Logbook p5
  date: 1933
  description: ""
  tags: 
  google_drive_link: https://drive.google.com/file/d/1ArrE6smmcCFXzVwaGP7WJuwiFsJGuxiX/view?usp=sharing#page=6

<!-- Non-Drive references for this voyage (ignored by ingest):
http://www.arlingtoncemetery.net/henrylat.htm
-->
```

## Features

- **Flexible Date Parsing**: Handles various date formats including numbered entries (e.g., "1. 1933-04-23")
- **Passenger Extraction**: Parses Wikipedia links and role information from passenger lists
- **Media Processing**: Extracts Google Drive links and creates media items with metadata
- **Slug Generation**: Creates URL-friendly slugs for passenger names
- **Summary Extraction**: Pulls "Additional Information" content for voyage summaries
- **Non-Drive References**: Captures non-Google Drive URLs as comments for documentation

## Output Statistics

- **Total Voyages Parsed**: 86 voyages from the input file
- **Data Extracted**: Passengers, media items, voyage details, and metadata
- **Format**: Structured for easy database ingestion and processing

## Technical Details

- Written in Python 3
- Uses regex patterns for flexible parsing
- Handles UTF-8 encoding properly
- Produces clean YAML-like output format
- Validates and cleans extracted data

The output is ready for use with database ingestion tools that expect the structured format shown in `output_fixed.md`.