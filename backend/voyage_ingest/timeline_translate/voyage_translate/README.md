# USS Sequoia Voyage Markdown to JSON Converter

This script processes USS Sequoia voyage markdown files and converts them to structured JSON format using the Claude API (Opus 4.1 model).

## Installation

1. Install Python 3.7 or higher
2. Install required dependencies:
```bash
pip install -r requirements.txt
```

## Setup

1. Get your Anthropic API key from https://console.anthropic.com/
2. Set it as an environment variable or provide via --api-key flag:
```bash
export CLAUDE_API_KEY="your-api-key-here"
```

## Usage

### Process a single markdown file:
```bash
# Using environment variable
python voyage_markdown_to_json.py voyage.md output.json

# Or with explicit API key
python voyage_markdown_to_json.py voyage.md output.json --api-key YOUR_API_KEY
```

### Process a directory of markdown files:
```bash
python voyage_markdown_to_json.py ./voyages_directory/ combined_output.json
```

### Merge with existing JSON:
```bash
python voyage_markdown_to_json.py new_voyages.md output.json --merge-with existing.json
```

## Input Format

The script expects markdown files with voyage information in the format used in the USS Sequoia historical documents. Each markdown file should contain:

- President information (name and term dates)
- Voyage details (dates, times, locations)
- Passenger lists with titles and biographical links
- Media references (documents, photos)
- Additional notes and context

## Output Format

The script generates JSON with the following structure:

```json
{
  "president-lastname-firstname": {
    "term_start": "Month DD, YYYY",
    "term_end": "Month DD, YYYY",
    "info": "President Name (dates)",
    "voyages": [
      {
        "voyage": "president-key-YYYY-MM-DD",
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD",
        "start_time": "HH:MM",
        "end_time": "HH:MM",
        "origin": "location",
        "destination": "location",
        "passengers": [...],
        "media": [...],
        "notes": [...],
        "tags": [...],
        "missing_info": {...}
      }
    ]
  }
}
```

## Features

- **Automatic normalization**: Names are normalized to lastname-firstname format
- **Media categorization**: Links are categorized as drive/drop/other
- **Missing info tracking**: Automatically identifies and tracks missing fields
- **Tag extraction**: Generates searchable tags from voyage content
- **Batch processing**: Can process entire directories of markdown files
- **Merge capability**: Can merge new data with existing JSON files
- **Date sorting**: Voyages are automatically sorted chronologically

## Examples

### Example 1: Process President Ford's voyages
```bash
python voyage_markdown_to_json.py Gerald_Ford.md ford_voyages.json
```

### Example 2: Process multiple presidents and combine
```bash
python voyage_markdown_to_json.py ./president_markdowns/ all_voyages.json
```

### Example 3: Add new voyages to existing database
```bash
python voyage_markdown_to_json.py new_discoveries.md updated.json --merge-with sequoia_database.json
```

## Notes

- The script uses Claude Opus model for optimal accuracy in parsing complex historical documents
- API usage will incur costs based on Anthropic's pricing
- Large documents may take time to process due to API rate limits
- The script maintains the original order of passengers from the source documents
- All dates are converted to YYYY-MM-DD format for consistency

## Error Handling

The script will:
- Skip files that cannot be processed and continue with others
- Report which files succeeded or failed
- Save partial results even if some files fail
- Validate JSON structure before saving

## Support

For issues or questions about the USS Sequoia project, contact the project maintainers.
For API-related issues, refer to Anthropic's documentation at https://docs.anthropic.com/
