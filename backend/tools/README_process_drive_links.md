# Google Drive Link Processor

This script processes Google Drive links found in voyage `source_urls` and `additional_sources` fields. It downloads the actual files, uploads them to S3, creates media records, and links them to voyages - exactly as if they were uploaded through the editor.

## What It Does

1. **Finds** all Google Drive links in voyage records
2. **Downloads** the actual files from Google Drive
3. **Parses** credit and date from filenames
4. **Uploads** files to S3 (canonical bucket) with proper organization
5. **Generates** thumbnails for images and PDFs
6. **Creates** media records in the `media` table
7. **Links** media to voyages via `voyage_media` table with correct section:
   - Links from `source_urls` → `media_category = 'source'`
   - Links from `additional_sources` → `media_category = 'additional_source'`
8. **Updates** voyage flags (`has_photos`, `has_videos`)
9. **Preserves** original Drive links in the database (does not delete/modify them)

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

- **image**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp`, `.tif`, `.tiff`
- **video**: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`, `.flv`
- **audio**: `.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`, `.aac`
- **article**: `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`
- **book**: `.epub`, `.mobi`, `.azw`, `.azw3`
- **other**: All other types

## S3 Storage Structure

Files are organized in S3 as:
```
s3://sequoia-canonical/{president-slug}/{media-type}/{filename}
s3://sequoia-public/{president-slug}/{media-type}/{filename}-thumb.jpg
```

Example:
```
s3://sequoia-canonical/franklin-d-roosevelt/article/fdr-day-by-day_1933-04-23_sequoia-logbook.pdf
s3://sequoia-public/franklin-d-roosevelt/article/fdr-day-by-day_1933-04-23_sequoia-logbook-thumb.jpg
```

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

Test without downloading files or making database changes:

```bash
python3 process_drive_links.py --dry-run
python3 process_drive_links.py --dry-run --voyage-slug herbert-hoover-3-1931-05-25
```

## Requirements

### Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Google service account credentials JSON file
- `AWS_REGION`: AWS region (default: `us-east-1`)
- `S3_PRIVATE_BUCKET`: S3 bucket for original files (default: `sequoia-canonical`)
- `S3_PUBLIC_BUCKET`: S3 bucket for public thumbnails (default: `sequoia-public`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: Database connection parameters

### Google Drive API Setup

1. Create a Google Cloud Project
2. Enable Google Drive API
3. Create a service account
4. Download the service account credentials JSON file
5. Set `GOOGLE_APPLICATION_CREDENTIALS` to the file path
6. Share your Google Drive folders/files with the service account email

### AWS S3 Setup

1. Configure AWS credentials with S3 write permissions
2. Ensure buckets exist: `sequoia-canonical` and `sequoia-public`
3. Set appropriate bucket policies for public thumbnails

## Output Example

```
Found 5 voyages with Google Drive links

================================================================================

[1933-04-23-fdr-mount-vernon-cruise-wit] (President: franklin-d-roosevelt)

  Processing 2 Drive URL(s) from SOURCES:
  Processing file: https://drive.google.com/file/d/ABC123.../view
    - 1933.04.23_FDR_Day_by_Day.pdf
      → credit: FDR Day by Day, date: 1933-04-23, type: article
      ✓ Uploaded to S3: s3://sequoia-canonical/franklin-d-roosevelt/article/...
      ✓ Generated thumbnail: https://sequoia-public.s3.amazonaws.com/...
      ✓ Created media record: fdr-day-by-day-a7b3c2d4
      ✓ Linked to voyage in 'source' section

  Processing file: https://drive.google.com/file/d/XYZ789.../view
    - 1933_White_House_Photo.jpg
      → credit: White House Photo, date: 1933, type: image
      ✓ Uploaded to S3: s3://sequoia-canonical/franklin-d-roosevelt/image/...
      ✓ Generated thumbnail: https://sequoia-public.s3.amazonaws.com/...
      ✓ Created media record: white-house-photo-e9f1a2b5
      ✓ Linked to voyage in 'source' section

  ✓ Updated voyage flags: has_photos=True, has_videos=False

================================================================================
SUMMARY: Processed 2 files total
```

## Database Changes

The script creates/updates these database records:

### `media` Table
```sql
INSERT INTO sequoia.media (
    media_slug,              -- Generated unique slug
    title,                   -- Original filename
    media_type,              -- Detected type (image, article, etc.)
    s3_url,                  -- S3 canonical URL
    public_derivative_url,   -- Public thumbnail URL
    credit,                  -- Parsed from filename
    date,                    -- Parsed from filename
    google_drive_link,       -- Original Drive URL
    created_at,
    updated_at
) VALUES (...)
```

### `voyage_media` Table
```sql
INSERT INTO sequoia.voyage_media (
    voyage_slug,             -- The voyage being processed
    media_slug,              -- The created media record
    sort_order,              -- Default: 999
    media_category           -- 'source' or 'additional_source'
) VALUES (...)
```

### `voyages` Table
```sql
UPDATE sequoia.voyages
SET has_photos = true/false,   -- If any image media linked
    has_videos = true/false    -- If any video media linked
WHERE voyage_slug = ...
```

## Features

- **Folder Support**: Processes entire Google Drive folders, extracting all files
- **Duplicate Prevention**: Skips files if media already exists
- **Category Preservation**: Maintains source vs. additional source distinction
- **Thumbnail Generation**: Auto-generates thumbnails for images and PDFs
- **Metadata Extraction**: Parses date and credit from standardized filenames
- **Error Handling**: Continues processing even if individual files fail
- **Dry-Run Mode**: Preview changes without modifying database

## Notes

- The script does NOT delete or modify the original Drive links in `source_urls` or `additional_sources`
- Files are downloaded once and stored permanently in S3
- Re-running the script on the same voyage will skip already-processed files
- Media slugs are auto-generated with UUID suffixes to ensure uniqueness
- Voyage must have a `president_slug_from_voyage` assigned (required for S3 path organization)
