# Dropbox Link Processing Setup

This guide explains how to set up and use `process_dropbox_links.py` to extract media from Dropbox links in voyage sources.

## Setup

### 1. Install Dropbox SDK

```bash
pip install dropbox
```

### 2. Get Dropbox Access Token

1. Go to https://www.dropbox.com/developers/apps
2. Click "Create app"
3. Choose:
   - **API**: Scoped access
   - **Access type**: Full Dropbox
   - **App name**: Something like "Sequoia Media Processor"
4. Click "Create app"
5. In the app settings, go to the "Permissions" tab and enable:
   - `files.content.read` - Read file content
   - `files.metadata.read` - Read file metadata
   - `sharing.read` - Access shared links
6. Click "Submit" to save permissions
7. Go to the "Settings" tab
8. Under "OAuth 2", click "Generate access token"
9. Copy the generated token

### 3. Add to Environment

Add the token to your `.env` file:

```bash
DROPBOX_ACCESS_TOKEN=sl.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Usage

### Process All Voyages with Dropbox Links

```bash
python tools/process_dropbox_links.py
```

### Process Specific Voyage

```bash
python tools/process_dropbox_links.py --voyage-slug "1933-04-23-fdr-hosts-uk-prime-minister-ma"
```

### Dry Run (Preview Without Changes)

```bash
python tools/process_dropbox_links.py --dry-run
```

## Supported Dropbox URL Formats

The script handles all common Dropbox URL formats:

### Shared File Links

```
https://www.dropbox.com/s/abc123xyz/document.pdf?dl=0
https://www.dropbox.com/scl/fi/abc123xyz/photo.jpg?rlkey=xyz&dl=0
```

### Shared Folder Links

```
https://www.dropbox.com/sh/abc123xyz/folder?dl=0
https://www.dropbox.com/scl/fo/abc123xyz/photos?rlkey=xyz&dl=0
```

The script will:
- Download all files from folders (non-recursively)
- Skip subfolders within shared folders
- Process each file individually

### Direct Paths (Less Common)

```
/folder/subfolder/file.pdf
```

Only works if you have full Dropbox access.

## How It Works

1. **Scans voyages** for Dropbox links in `source_urls` and `additional_sources`
2. **Parses URLs** to determine if they're files or folders
3. **Downloads files** from Dropbox
4. **Uploads to S3**:
   - Original files → `sequoia-canonical` bucket
   - Thumbnails → `sequoia-public` bucket
5. **Extracts metadata** from filenames:
   - Date: `1933.04.23` or `1933-04-23`
   - Credit: Text before or after date
6. **Creates database records** in `sequoia.media` table
7. **Links to voyages** in `sequoia.voyage_media` table
8. **Updates flags** (`has_photos`, `has_videos`) on voyages

## Filename Conventions

For best results, name files with this pattern:

```
YYYY.MM.DD_Credit_Name_Description.ext
```

Examples:
- `1933.04.23_FDR_Day_by_Day.pdf`
- `1933-04-24_The_Baltimore_Sun_pg2.jpg`
- `1933_White_House_Photo.jpg`

The script will parse:
- **Date**: Extracted and stored in `media.date`
- **Credit**: Extracted and stored in `media.credit`
- **Type**: Determined by file extension/MIME type

## Media Type Detection

Files are automatically categorized:

| Type | Extensions |
|------|-----------|
| **image** | .jpg, .jpeg, .png, .gif, .webp, .svg, .bmp, .tif, .tiff |
| **video** | .mp4, .mov, .avi, .mkv, .webm, .flv |
| **audio** | .mp3, .wav, .ogg, .flac, .m4a, .aac |
| **article** | .pdf, .doc, .docx, .txt, .rtf |
| **book** | .epub, .mobi, .azw, .azw3 |
| **other** | Everything else |

## Thumbnail Generation

Thumbnails are automatically generated for:
- **Images**: Resized to 400x400 max
- **PDFs**: First page rendered as JPEG (requires PyMuPDF)

Thumbnails are uploaded to the public S3 bucket for fast loading.

## Output

The script provides detailed progress:

```
Found 5 voyages with Dropbox links

================================================================================

[1933-04-23-fdr-hosts-uk-prime-minister-ma] (President: franklin-d-roosevelt)

  Processing 2 Dropbox URL(s) from SOURCES:
  Processing shared folder: https://www.dropbox.com/sh/abc123/folder?dl=0
    Found 3 items in folder
    - document1.pdf
      → credit: Document 1, date: None, type: article
      ✓ Uploaded to S3: s3://sequoia-canonical/franklin-d-roosevelt/article/...
      ✓ Generated thumbnail: https://sequoia-public.s3.amazonaws.com/...
      ✓ Created media record: document1-a1b2c3d4
      ✓ Linked to voyage in 'source' section

  ✓ Updated voyage flags: has_photos=True, has_videos=False

================================================================================
SUMMARY: Processed 8 files total
```

## Troubleshooting

### "DROPBOX_ACCESS_TOKEN not set"

Make sure you've added the token to `.env` and restarted your terminal/server.

### "Failed to download: permission denied"

Check that your Dropbox app has the required permissions:
- `files.content.read`
- `files.metadata.read`
- `sharing.read`

### "Could not parse Dropbox URL"

Make sure the URL is a valid Dropbox link. The script supports:
- `dropbox.com/s/...` (shared files)
- `dropbox.com/sh/...` (shared folders)
- `dropbox.com/scl/fi/...` (new shared files)
- `dropbox.com/scl/fo/...` (new shared folders)

### Thumbnails Not Generating for PDFs

Install PyMuPDF for PDF thumbnail support:

```bash
pip install PyMuPDF
```

## Comparison with Google Drive Script

| Feature | Google Drive | Dropbox |
|---------|-------------|---------|
| Authentication | Service account JSON | Access token |
| Folder recursion | No | No |
| Shared links | ✓ | ✓ |
| Direct paths | File ID | File path |
| MIME types | Provided by API | Inferred from extension |
| Rate limits | Higher | Lower (be cautious) |

## Notes

- The script stores Dropbox URLs in the `google_drive_link` field (since there's no dedicated Dropbox field)
- Files are organized in S3 by: `president-slug/media-type/filename`
- Existing media records with the same slug are updated (idempotent)
- The script is safe to run multiple times - it won't create duplicates
