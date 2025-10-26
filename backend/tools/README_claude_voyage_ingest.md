# Claude Voyage Ingest Tool

Parse voyage markdown files from Google Docs using Claude API and intelligently add them to the database.

## Features

- **Intelligent Parsing**: Uses Claude API to parse messy, inconsistently formatted voyage documents
- **Smart Passenger Deduplication**: Automatically detects existing passengers in database to avoid duplicates
- **Boolean Tag Extraction**: Parses top-line codes like (Photo), (Video), (CD), (HH) etc.
- **Flexible Format Handling**: Works with varied document formats and missing fields
- **Dry Run Mode**: Test parsing without modifying the database

## Setup

1. Add your Anthropic API key to `.env`:
```bash
echo 'ANTHROPIC_API_KEY=your-api-key-here' >> ../backend/.env
```

2. Install required packages (if not already installed):
```bash
pip install anthropic psycopg2-binary python-dotenv
```

## Usage

### Basic Usage

```bash
python claude_voyage_ingest.py voyage.md --president-slug hoover-herbert
```

### Dry Run (test without inserting)

```bash
python claude_voyage_ingest.py voyage.md --president-slug hoover-herbert --dry-run
```

### Example with Sample File

```bash
python claude_voyage_ingest.py ../../hoover_sample_voyage-2.md --president-slug hoover-herbert --dry-run
```

## Document Format

The script handles documents like this:

```markdown
(HH) (Yacht Spin)

## **1.	1931-04-25 to 1931-04-27**

Location: [Cape Henry, VA](https://en.wikipedia.org/wiki/Cape_Henry)
Time:
Passengers: [Herbert Hoover](https://en.wikipedia.org/wiki/Herbert_Hoover) (POTUS), ...
Additional Information: Ceremony commemorating...
Sources: *Sequoia*: Presidential Yacht, Giles Kelly, p. 15;
Additional Sources: [link](url)
Notes: Additional context
Spin from *Source*:
* Quote text here
```

## Top-Line Codes

The first line often contains codes in parentheses that map to database fields:

| Code | Database Field | Description |
|------|---------------|-------------|
| `(Photo)` or `(Photo(s))` | `has_photo` | Voyage has photos |
| `(Video)` or `(Video(s))` | `has_video` | Voyage has video |
| `(HH)`, `(FDR)`, `(HST)` etc. | `presidential_use`, `presidential_initials` | Presidential use with initials |
| `(Royalty)` | `has_royalty` | Royalty present |
| `(Foreign Leader)` | `has_foreign_leader`, `foreign_leader_country` | Foreign leader present |
| `(CD)` | `mention_camp_david` | Mentions Camp David |
| `(MV)` | `mention_mount_vernon` | Mentions Mount Vernon |
| `(Captain)` | `mention_captain` | Mentions captain |
| `(Crew)` | `mention_crew` | Mentions crew |
| `(RMD)` | `mention_rmd` | Mentions restoration/maintenance/damage |
| `(Yacht Spin)` | `mention_yacht_spin` | Mentions yacht spin/cost/buy/sell |
| `(Menu)` | `mention_menu` | Mentions menu |
| `(Drinks/Wine)` | `mention_drinks_wine` | Mentions drinks or wine |

## Fields Extracted

### Voyage Fields
- `title`: Auto-generated or extracted
- `start_date`, `end_date`: Date or date range
- `start_time`, `end_time`: Times in HH:MM format
- `start_location`, `end_location`: Locations
- `additional_information`: Summary text
- `notes`: Public notes
- `spin`: Spin quote text
- `spin_source`: Source of spin quote
- `source_urls`: Primary sources (JSON array)
- `additional_source_urls`: Additional sources
- All boolean tag fields

### Passenger Fields
- `full_name`: Person's name
- `role`: Title/role from document
- `bio`: Wikipedia or bio URL
- `is_crew`: Boolean (auto-detected from role)

## Passenger Deduplication

The script intelligently avoids creating duplicate passengers:

1. **Exact Name Match**: Checks for existing person with same full name
2. **Slug Match**: Checks for existing slug
3. **Fuzzy Last Name Match**: For single matches on last name
4. **Smart Creation**: Only creates new person if no match found

Examples:
- "Herbert Hoover" → Finds existing `hoover-herbert`
- "Captain John Smith" → Checks for "john-smith" or "smith-john"
- New person "Jane Doe" → Creates `doe-jane` slug

## Output

The script shows:
```
Parsing voyage.md with Claude API...

============================================================
PARSED DATA:
============================================================
{
  "voyage": { ... },
  "passengers": [ ... ]
}
============================================================

[DRY RUN] Creating voyage: 1931-04-25-ceremony-commemorating
  Title: Cape Henry Ceremony
  Date: 1931-04-25 to 1931-04-27

[DRY RUN] Processing 9 passengers:
  ✓ Found existing: Herbert Hoover (hoover-herbert)
  ✓ Found existing: Lou Hoover (hoover-lou)
  + Creating new: Vernon Kellogg (kellogg-vernon)
  ...

[DRY RUN] Rolling back changes...
[DRY RUN] Would create voyage: 1931-04-25-ceremony-commemorating
```

## Error Handling

The script handles:
- Missing or malformed fields
- Inconsistent formatting
- Missing API key (error message)
- Duplicate voyage slugs (auto-increments)
- Database connection errors

## Notes

- Uses `claude-3-5-sonnet-20241022` model
- Processes documents flexibly - doesn't require rigid formatting
- Preserves all source URLs (Google Drive, Wikipedia, etc.) as-is
- Creates voyage slugs from date + title
- All database operations are transactional (rollback on error)
