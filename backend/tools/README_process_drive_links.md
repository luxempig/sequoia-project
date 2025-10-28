# Google Drive Link Processor

This script processes Google Drive links found in voyage `source_urls` and `additional_sources` fields, downloads the files, extracts metadata from filenames, and adds them back to the voyage sources.

## Features

- **Automatic Discovery**: Finds all Google Drive links in voyage records
- **Folder Support**: Processes entire Google Drive folders, extracting all files
- **Filename Parsing**: Extracts date and credit information from filenames
- **Media Type Detection**: Automatically determines media type (image, video, audio, article)
- **Batch Processing**: Can process all voyages or a specific voyage
- **Dry-Run Mode**: Test mode to preview changes without modifying the database

## Filename Parsing Patterns

The script recognizes these filename patterns:

| Pattern | Example | Extracted Date | Extracted Credit |
|---------|---------|----------------|------------------|
| `YYYY.MM.DD_Credit_Name.ext` | `1933.04.23_FDR_Day_by_Day.pdf` | `1933-04-23` | `FDR Day by Day` |
| `YYYY-MM-DD_Credit_Name.ext` | `1933-04-23_Time_Magazine.pdf` | `1933-04-23` | `Time Magazine` |
| `YYYY_Credit_Name.ext` | `1933_White_House_Photo.jpg` | `1933` | `White House Photo` |
| `Credit_Name.ext` | `Some_Document.pdf` | `None` | `Some Document` |

Page numbers (e.g., `pg2`, `p2`, `page 2`) are automatically removed from credits.

## Media Type Detection

Media types are determined by file extension and MIME type:

- **image**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- **video**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`
- **audio**: `.mp3`, `.wav`, `.ogg`, `.m4a`
- **article**: `.pdf`
- **unchecked**: All other types (default)

## Usage

### Process All Voyages

Process all voyages that have Google Drive links:

```bash
cd backend
set -a && source .env && set +a
cd tools
source ../venv/bin/activate
python3 process_drive_links.py
```

### Process Specific Voyage

Process a single voyage by slug:

```bash
python3 process_drive_links.py --voyage-slug herbert-hoover-3-1931-05-25
```

### Dry-Run Mode

Test without making database changes:

```bash
python3 process_drive_links.py --dry-run
python3 process_drive_links.py --dry-run --voyage-slug herbert-hoover-3-1931-05-25
```

## Requirements

### Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Google service account credentials JSON file
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Database connection parameters

### Google Drive API Setup

1. Create a Google Cloud Project
2. Enable Google Drive API
3. Create a service account
4. Download the service account credentials JSON file
5. Set `GOOGLE_APPLICATION_CREDENTIALS` to the file path
6. Share your Google Drive folders/files with the service account email

## Output Example

```
Found 5 voyages with Google Drive links

================================================================================

[1933-04-23-fdr-mount-vernon-cruise-wit]
  Found 2 Drive URL(s)
  Processing file: https://drive.google.com/file/d/ABC123.../view
    - 1933.04.23_FDR_Day_by_Day.pdf
      → credit: FDR Day by Day, date: 1933-04-23, type: article
    - 1933.04.23_The_Baltimore_Sun_pg2.jpg
      → credit: The Baltimore Sun, date: 1933-04-23, type: image
  + Added: 1933.04.23_FDR_Day_by_Day.pdf (article)
  + Added: 1933.04.23_The_Baltimore_Sun_pg2.jpg (image)
  ✓ Added 2 new sources to 1933-04-23-fdr-mount-vernon-cruise-wit
```

## How It Works

1. **Query Database**: Finds voyages with Google Drive links in `source_urls` or `additional_sources`
2. **Extract URLs**: Parses Google Drive file and folder URLs from both fields
3. **Process URLs**:
   - For files: Gets metadata (name, MIME type) from Google Drive API
   - For folders: Lists all files in the folder and processes each
4. **Parse Metadata**: Extracts date and credit from filename using regex patterns
5. **Determine Type**: Identifies media type based on file extension and MIME type
6. **Update Database**: Adds new entries to voyage's `source_urls` field (if not in dry-run mode)

## Database Schema

The script updates the `source_urls` JSONB field in the `voyages` table:

```sql
source_urls JSONB  -- Array of objects: [{"url": "...", "media_type": "article"}, ...]
```

## Notes

- Duplicate URLs are automatically skipped
- The script preserves existing sources and only adds new ones
- In dry-run mode, the script shows what would be done without modifying the database
- The script does not download file contents - it only retrieves metadata for cataloging
