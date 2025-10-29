# Canonical Voyages JSON Schema

This document describes the expected structure of `backend/canonical_voyages.json`, which serves as the single source of truth for all voyage data.

## Overview

The canonical JSON file is structured by president, with each president containing an array of voyages. The ingestion process reads this file and syncs it to the PostgreSQL database when manually triggered via the curator interface.

## Top-Level Structure

```json
{
  "president-slug": {
    "term_start": "YYYY-MM-DD",
    "term_end": "YYYY-MM-DD",
    "info": "Descriptive text",
    "voyages": [ /* array of voyage objects */ ]
  }
}
```

## Voyage Object Schema

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `voyage` | string | Unique slug identifier | `"truman-harry-1945-05-14"` |
| `start_date` | string | Start date (YYYY-MM-DD or YYYY-MM-00) | `"1945-05-14"` |
| `end_date` | string | End date (YYYY-MM-DD or YYYY-MM-00) | `"1945-05-14"` |

### Date & Time Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `start_time` | string | Start time (HH:MM 24-hour format) | `"19:00"` |
| `end_time` | string | End time (HH:MM 24-hour format) | `"22:30"` |

**Note:** If provided, `start_time` and `end_time` will be combined with `start_date` and `end_date` to create `start_timestamp` and `end_timestamp` in the database.

### Location Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `origin` | string | Starting location | `"Potomac River"` |
| `destination` | string | Ending location | `"Potomac River"` |
| `start_location` | string | **NEW** - Preferred field for start location | `"Washington, D.C."` |
| `end_location` | string | **NEW** - Preferred field for end location | `"Chesapeake Bay"` |

**Note:** If `start_location` is not provided, the system will use `origin`. Same for `end_location` and `destination`.

### Content Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | string | Voyage title (optional) | `"Diplomatic Meeting with British Officials"` |
| `summary_markdown` | string | Brief summary (legacy field) | `"President met with..."` |
| `additional_information` | string | **NEW** - Public-facing additional details | `"This voyage was significant because..."` |
| `notes` | array | Internal notes (displayed publicly) | `["Note 1", "Note 2"]` |
| `additional_sources` | string | **NEW** - Additional source references | `"See also: Truman Library Archive XYZ"` |
| `tags` | array | Categorization tags | `["diplomacy", "World War II"]` |

### Metadata Fields (Categorization & Filtering)

**Boolean Flags:**

| Field | Type | Description | Display Tag |
|-------|------|-------------|-------------|
| `has_photo` | boolean | Voyage has associated photo(s) | Photo(s) |
| `has_video` | boolean | Voyage has associated video(s) | Video(s) |
| `presidential_use` | boolean | President was present/used the yacht | Presidential Use |
| `has_royalty` | boolean | Royalty was present on voyage | Royalty |
| `has_foreign_leader` | boolean | Foreign leader was present | Foreign Leader |
| `mention_camp_david` | boolean | Voyage mentions Camp David | CD |
| `mention_mount_vernon` | boolean | Voyage mentions Mount Vernon | MV |
| `mention_captain` | boolean | Voyage mentions captain | Captain |
| `mention_crew` | boolean | Voyage mentions crew member(s) | Crew |
| `mention_rmd` | boolean | Mentions Restoration, Maintenance, and/or Damage | RMD |
| `mention_yacht_spin` | boolean | Mentions Maintenance, Cost, Buy/Sell, and/or yacht spin | Yacht Spin |
| `mention_menu` | boolean | Voyage mentions menu | Menu |
| `mention_drinks_wine` | boolean | Voyage mentions drinks or wine | Drinks/Wine |

**Associated Text Fields (when boolean is true):**

| Field | Type | Description | Required When | Example |
|-------|------|-------------|---------------|---------|
| `presidential_initials` | string | President initials | `presidential_use = true` | `"HST"`, `"FDR"` |
| `royalty_details` | string | Names/details of royalty | `has_royalty = true` | `"Queen Elizabeth II"` |
| `foreign_leader_country` | string | Country of foreign leader | `has_foreign_leader = true` | `"United Kingdom"` |

### Passengers Array

Each passenger object in the `passengers` array:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Person slug | `"forrestal-james"` |
| `full_name` | string | Full display name | `"James Forrestal"` |
| `title` | string | Role/title during voyage | `"Secretary of the Navy"` |
| `role` | string | Alternative role field (legacy) | `""` |
| `bio` | string | Biography link (preferred) | `"https://en.wikipedia.org/wiki/..."` |

**Note:** The `bio` field is preferred over `wikipedia_url`. If `bio` is not provided, the system will fall back to `wikipedia_url`.

### Media Array

Each media object in the `media` array:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `media_name` | string | Media identifier | `"McCloy_diary_1945"` |
| `link` | string | Google Drive or Dropbox link | `"https://drive.google.com/..."` |
| `source` | string | Source attribution | `"Diary of John J. McCloy"` |
| `date` | string | Media date (YYYY or YYYY-MM-DD) | `"1945"` |
| `type` | string | Media type | `"pdf"`, `"image"`, `"video"` |
| `platform` | string | Source platform | `"drive"`, `"drop"` |

**Important:** During ingestion, media files are downloaded from Drive/Dropbox and uploaded to AWS S3. The frontend ONLY serves media from S3 buckets - external links are not used.

## Complete Example

```json
{
  "truman-harry": {
    "term_start": "April 12, 1945",
    "term_end": "January 20, 1953",
    "info": "Harry S. Truman (April 12, 1945 to January 20, 1953)",
    "voyages": [
      {
        "voyage": "truman-harry-1945-05-14",
        "start_date": "1945-05-14",
        "end_date": "1945-05-14",
        "start_time": "19:00",
        "end_time": "22:30",
        "origin": "Potomac River",
        "destination": "Potomac River",
        "start_location": "Washington, D.C.",
        "end_location": "Washington, D.C.",
        "title": "Meeting with British Officials",
        "additional_information": "Historic diplomatic meeting to discuss post-war strategy in the Pacific theater.",
        "has_photo": true,
        "has_video": false,
        "presidential_use": true,
        "presidential_initials": "HST",
        "has_royalty": false,
        "has_foreign_leader": true,
        "foreign_leader_country": "United Kingdom",
        "mention_camp_david": false,
        "mention_mount_vernon": false,
        "mention_captain": true,
        "mention_crew": false,
        "mention_rmd": false,
        "mention_yacht_spin": false,
        "mention_menu": true,
        "mention_drinks_wine": true,
        "passengers": [
          {
            "name": "forrestal-james",
            "full_name": "James Forrestal",
            "title": "Secretary of the Navy",
            "role": "",
            "bio": "https://en.wikipedia.org/wiki/James_Forrestal"
          },
          {
            "name": "eden-anthony",
            "full_name": "Anthony Eden",
            "title": "British Foreign Secretary",
            "role": "",
            "bio": "https://en.wikipedia.org/wiki/Anthony_Eden"
          }
        ],
        "media": [
          {
            "media_name": "McCloy_diary_1945",
            "link": "https://www.dropbox.com/...",
            "source": "Diary of John J. McCloy",
            "date": "1945",
            "type": "pdf",
            "platform": "drop"
          }
        ],
        "notes": [
          "Ending war with Japan",
          "McCloy tried to convince President Truman that an invasion of Japan was not sensible"
        ],
        "additional_sources": "See also: National Archives, RG 59, Box 123",
        "tags": [
          "atomic bomb",
          "World War II",
          "diplomacy"
        ]
      }
    ]
  }
}
```

## Field Mapping to Database

The ingestion process maps JSON fields to database columns as follows:

| JSON Field | Database Column | Notes |
|------------|----------------|-------|
| `start_date` + `start_time` | `start_timestamp` | Combined into PostgreSQL timestamp |
| `end_date` + `end_time` | `end_timestamp` | Combined into PostgreSQL timestamp |
| `origin` | `start_location` | Used if `start_location` not provided |
| `destination` | `end_location` | Used if `end_location` not provided |
| `notes` (array) | `notes_internal` | Joined with newlines into text |
| `additional_information` | `additional_information` | Displayed publicly |
| `additional_sources` | `additional_sources` | Source references |
| `summary_markdown` | `summary_markdown` | Legacy summary field |

## Migration Notes

- **Backward Compatible:** Existing JSON structure (`origin`, `destination`) continues to work
- **New Fields Optional:** `start_location`, `end_location`, `additional_information`, `additional_sources` are optional
- **Automatic Fallback:** System uses `origin` if `start_location` is missing, `destination` if `end_location` is missing
- **Notes Conversion:** Notes array automatically converted to newline-separated text for database storage

## Curator Workflow

1. Edit `canonical_voyages.json` using the curator interface at `/curator`
2. Save changes (updates JSON file immediately)
3. Click "Trigger Ingest" button to manually run ingestion
4. Monitor progress in real-time (takes ~4-5 minutes for full dataset)
5. Changes appear on public website immediately after ingestion completes

---

**Last Updated:** October 14, 2025
**Version:** 2.0 (with new location and information fields)
