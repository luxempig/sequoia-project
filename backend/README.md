# USS Sequoia Archive - Backend

FastAPI backend providing REST API and data ingestion pipeline for the USS Sequoia Presidential Yacht Archive.

## Tech Stack

- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Relational database (AWS RDS)
- **psycopg2** - PostgreSQL adapter
- **AWS S3** - Media storage
- **Boto3** - AWS SDK for Python
- **Pillow** - Image processing for thumbnails
- **Google Drive API** - Media downloads
- **Dropbox API** - Media downloads
- **PM2** - Process manager (production)

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app initialization
│   ├── db.py                # PostgreSQL connection pool
│   └── routers/             # API endpoint modules
│       ├── voyages.py       # Voyage CRUD and search
│       ├── people.py        # People directory and stats
│       ├── presidents.py    # President/owner endpoints
│       ├── media.py         # Media endpoints
│       ├── curator.py       # Curator interface API
│       ├── curator_voyages.py  # Voyage editing
│       ├── curator_people.py   # People editing
│       ├── curator_media.py    # Media management
│       ├── ingest.py        # Ingest progress tracking
│       ├── analytics.py     # Usage analytics
│       └── meta.py          # Health check, version
│
├── voyage_ingest/           # ETL Pipeline
│   ├── main.py              # Orchestrator
│   ├── validator.py         # JSON schema validation
│   ├── drive_sync.py        # Download from Google Drive/Dropbox
│   ├── s3_manager.py        # S3 upload and thumbnails
│   ├── db_updater.py        # Database upsert logic
│   └── slugger.py           # URL-friendly slug generation
│
├── scripts/                 # Utility scripts
│   ├── consolidate_duplicates.py  # Merge duplicate people
│   ├── debug_voyage_media.py      # Media troubleshooting
│   ├── clear_s3_media.py          # S3 cleanup
│   ├── fix_voyage_search.py       # Search fixes
│   └── populate_sample_media.py   # Sample data generation
│
├── tools/                   # Data processing tools
│   ├── process_drive_links.py     # Google Drive extraction
│   ├── process_dropbox_links.py   # Dropbox extraction
│   ├── transform_voyages.py       # Data transformation
│   └── claude_voyage_ingest.py    # AI-assisted ingestion
│
├── keys/                    # Service account credentials
│   └── .gitkeep             # (actual keys in .gitignore)
│
├── canonical_voyages.json   # Single source of truth (460+ voyages)
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (gitignored)
└── README.md               # This file
```

## Database Schema

### Tables

**presidents**
```sql
CREATE TABLE sequoia.presidents (
    president_id SERIAL PRIMARY KEY,
    president_slug TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    term_start DATE,
    term_end DATE NOT NULL,  -- '9999-12-31' for current owner
    party TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**voyages**
```sql
CREATE TABLE sequoia.voyages (
    voyage_id SERIAL PRIMARY KEY,
    voyage_slug TEXT UNIQUE NOT NULL,
    president_id INTEGER REFERENCES sequoia.presidents(president_id),
    start_date DATE NOT NULL,
    end_date DATE,
    location TEXT,
    purpose TEXT,
    historical_notes TEXT,
    significant BOOLEAN DEFAULT FALSE,
    has_royalty BOOLEAN DEFAULT FALSE,
    has_photos BOOLEAN DEFAULT FALSE,
    has_videos BOOLEAN DEFAULT FALSE,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**people**
```sql
CREATE TABLE sequoia.people (
    person_id SERIAL PRIMARY KEY,
    person_slug TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    birth_date DATE,
    death_date DATE,
    title TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**media**
```sql
CREATE TABLE sequoia.media (
    media_id SERIAL PRIMARY KEY,
    media_slug TEXT UNIQUE NOT NULL,
    media_type TEXT NOT NULL,  -- 'image', 'video', 'article', 'audio', 'book', 'other'
    title TEXT,
    s3_url TEXT NOT NULL,
    thumbnail_url TEXT,
    credit TEXT,
    date_taken DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**voyage_passengers** (many-to-many)
```sql
CREATE TABLE sequoia.voyage_passengers (
    voyage_id INTEGER REFERENCES sequoia.voyages(voyage_id) ON DELETE CASCADE,
    person_id INTEGER REFERENCES sequoia.people(person_id) ON DELETE CASCADE,
    role_title TEXT,
    PRIMARY KEY (voyage_id, person_id)
);
```

**voyage_media** (many-to-many)
```sql
CREATE TABLE sequoia.voyage_media (
    voyage_id INTEGER REFERENCES sequoia.voyages(voyage_id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES sequoia.media(media_id) ON DELETE CASCADE,
    caption TEXT,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (voyage_id, media_id)
);
```

## API Endpoints

### Voyages

**List/Search Voyages**
```
GET /api/voyages
Query params:
  - q: Search query (title, location, purpose)
  - president_slug: Filter by president
  - significant: Boolean filter
  - has_royalty: Boolean filter
  - start_date: Min date (YYYY-MM-DD)
  - end_date: Max date (YYYY-MM-DD)
  - limit: Max results (default: 500)
  - offset: Pagination offset
```

**Get Voyage Details**
```
GET /api/voyages/{voyage_slug}
Returns: Voyage with passengers (role + person details) and media
```

### People

**List People**
```
GET /api/people
Query params:
  - search: Name search
  - limit: Max results (default: 500)
  - offset: Pagination
```

**Get Person Details**
```
GET /api/people/{person_slug}
Returns: Person with all voyages they participated in
```

**Get People Statistics**
```
GET /api/people/stats
Returns: { total_people, unique_titles, avg_voyages_per_person }
```

### Presidents

**List Presidents**
```
GET /api/presidents
Returns: All presidents with term dates
```

**Get President Details**
```
GET /api/presidents/{president_slug}
Returns: President with voyage count and statistics
```

### Media

**Get Media by Voyage**
```
GET /api/media/by-voyage/{voyage_slug}
Returns: All media for a specific voyage
```

**Get Media Details**
```
GET /api/media/{media_slug}
Returns: Media item with metadata
```

### Curator Interface

**Get Canonical JSON**
```
GET /api/curator/canonical-voyages
Returns: Full canonical_voyages.json content
```

**Save Canonical JSON**
```
POST /api/curator/canonical-voyages
Body: { voyages: [...] }
Note: Saves to file, does NOT trigger ingest
```

**Trigger Manual Ingest**
```
POST /api/curator/voyage-ingest
Returns: { ingest_id, status: 'started' }
```

**Get Ingest Status**
```
GET /api/ingest/status/{ingest_id}
Returns: Progress and status updates
```

### Health & Metadata

**Health Check**
```
GET /api/health
Returns: { status: 'healthy', database: 'connected', timestamp: ... }
```

**Version Info**
```
GET /api/version
Returns: { version: '1.0', build_date: ... }
```

## Development

### Prerequisites
- Python 3.9+
- PostgreSQL (or access to AWS RDS)
- AWS credentials for S3 access
- Google Cloud service account (for Drive API)
- Dropbox API token

### Setup

**1. Create Virtual Environment**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

**2. Install Dependencies**
```bash
pip install -r requirements.txt
```

**3. Create Environment File**
```bash
cat > .env << 'EOF'
# Database
DB_HOST=sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=sequoia_db
DB_USER=sequoia
DB_PASSWORD=your_password_here

# AWS S3
AWS_REGION=us-east-2
MEDIA_BUCKET=uss-sequoia-bucket
PUBLIC_BUCKET=sequoia-public
PRIVATE_BUCKET=sequoia-canonical
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here

# Google Drive API
GOOGLE_APPLICATION_CREDENTIALS=/path/to/keys/sequoia_credentials.json
PRESIDENTS_SHEET_TITLE=presidents

# Dropbox API
DROPBOX_ACCESS_TOKEN=your_token_here
DROPBOX_TIMEOUT=60

# Canonical data file
CANONICAL_VOYAGES_FILE=canonical_voyages.json

# Redis (for async tasks)
REDIS_URL=redis://localhost:6379/0

# Async processing
ASYNC_THUMBNAILS=true
CELERY_WORKER_CONCURRENCY=2
CELERY_TASK_TIME_LIMIT=1800
EOF
```

**4. Set Up Service Account Keys**
```bash
mkdir -p keys
# Copy your Google service account JSON to keys/sequoia_credentials.json
```

### Running Locally

**Development Server (with hot reload)**
```bash
cd app
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at: http://localhost:8000
Interactive docs: http://localhost:8000/docs

**Production Server**
```bash
cd app
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Data Ingestion Pipeline

The voyage ingest pipeline processes `canonical_voyages.json` into the database:

### Manual Ingestion

```bash
cd backend
source venv/bin/activate
python3 -m voyage_ingest.main --source json --file canonical_voyages.json
```

### Automated Nightly Ingestion

Runs at 3 AM EST via cron:
```bash
0 8 * * * /home/ec2-user/sequoia-project/run-nightly-ingest.sh
```

Logs to: `logs/nightly-ingest-YYYY-MM-DD.log`

### Ingestion Workflow

1. **Validation** (`validator.py`)
   - JSON schema validation
   - Date format checking
   - Slug uniqueness verification
   - Required field validation

2. **Media Download** (`drive_sync.py`)
   - Download from Google Drive
   - Download from Dropbox
   - Local caching to avoid re-downloads
   - Retry logic with exponential backoff

3. **S3 Upload** (`s3_manager.py`)
   - Upload originals to `sequoia-canonical/`
   - Generate thumbnails (600x400px for images)
   - Upload thumbnails to `sequoia-public/`
   - Return S3 URLs

4. **Database Upsert** (`db_updater.py`)
   - Insert/update presidents
   - Insert/update voyages
   - Insert/update people (with deduplication)
   - Insert/update media
   - Link voyages to passengers (many-to-many)
   - Link voyages to media (many-to-many)
   - Update auto-flags (has_photos, has_videos)

5. **Cleanup**
   - Remove orphaned records
   - Delete temporary files
   - Log summary statistics

## Utility Scripts

### Consolidate Duplicate People
```bash
python3 scripts/consolidate_duplicates.py
```
Merges duplicate person records, consolidating to the most complete entry.

### Clear S3 Media
```bash
python3 scripts/clear_s3_media.py
```
Deletes all media from S3 buckets (use with caution!).

### Debug Voyage Media
```bash
python3 scripts/debug_voyage_media.py
```
Checks for media issues on specific voyages.

### Populate Sample Media
```bash
python3 scripts/populate_sample_media.py
```
Generates sample media records for testing.

### Fix Voyage Search
```bash
python3 scripts/fix_voyage_search.py
```
Repairs search-related database issues.

## Data Processing Tools

### Process Google Drive Links
```bash
python3 tools/process_drive_links.py
```
Extracts media from Google Drive shared links and uploads to S3.

### Process Dropbox Links
```bash
python3 tools/process_dropbox_links.py
```
Extracts media from Dropbox shared links and uploads to S3.

### Transform Voyages
```bash
python3 tools/transform_voyages.py
```
Transforms external voyage data into canonical format.

## Testing

### Run API Tests
```bash
pytest app/tests/
```

### Test Database Connection
```bash
python3 -c "from app.db import db_cursor; \
with db_cursor() as cur: \
    cur.execute('SELECT COUNT(*) FROM sequoia.voyages'); \
    print(f'Voyages: {cur.fetchone()[0]}')"
```

### Test S3 Access
```bash
aws s3 ls s3://sequoia-canonical/ --profile sequoia
```

## Deployment

### Production (PM2)

**Start Backend**
```bash
cd backend
pm2 start ../ecosystem.config.js --name sequoia-backend
```

**Restart Backend**
```bash
pm2 restart sequoia-backend
```

**View Logs**
```bash
pm2 logs sequoia-backend --lines 100
```

**Monitor**
```bash
pm2 monit
```

### Environment Variables (Production)

Production environment variables are managed by `deploy-unified.sh` which:
1. Receives secrets from GitHub Actions
2. Creates `.env` file on EC2 server
3. Creates `keys/sequoia_credentials.json` from base64-encoded secret

## Database Maintenance

### Backup Database
```bash
PGPASSWORD='password' pg_dump \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db -n sequoia \
  > backup-$(date +%Y%m%d).sql
```

### Restore Database
```bash
PGPASSWORD='password' psql \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db \
  < backup-20251029.sql
```

### Run Migrations
```bash
# Connect to database
PGPASSWORD='password' psql \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db

# Run migration SQL
ALTER TABLE sequoia.voyages ADD COLUMN new_field TEXT;
```

### View Table Statistics
```sql
SELECT
    'voyages' as table_name, COUNT(*) as count
FROM sequoia.voyages
UNION ALL
SELECT 'people', COUNT(*) FROM sequoia.people
UNION ALL
SELECT 'media', COUNT(*) FROM sequoia.media
UNION ALL
SELECT 'presidents', COUNT(*) FROM sequoia.presidents;
```

## Troubleshooting

### Backend Won't Start
```bash
# Check Python cache
find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find . -type f -name '*.pyc' -delete

# Check logs
pm2 logs sequoia-backend --err --lines 50

# Verify environment
source venv/bin/activate
python3 -c "import sys; print(sys.path)"
```

### Database Connection Errors
```bash
# Test connection
PGPASSWORD='password' psql \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db -c "SELECT 1;"

# Check RDS security group allows EC2 IP
# Check .env has correct DB_PASSWORD
```

### S3 Upload Failures
```bash
# Test AWS credentials
aws s3 ls s3://sequoia-canonical/

# Check boto3 can access
python3 -c "import boto3; s3 = boto3.client('s3'); print(s3.list_buckets())"

# Verify IAM permissions include:
# - s3:GetObject
# - s3:PutObject
# - s3:DeleteObject
```

### Media Download Issues
```bash
# Test Google Drive API
python3 -c "from google.oauth2 import service_account; \
creds = service_account.Credentials.from_service_account_file('keys/sequoia_credentials.json'); \
print('✓ Credentials loaded')"

# Test Dropbox API
python3 -c "import dropbox; import os; \
dbx = dropbox.Dropbox(os.getenv('DROPBOX_ACCESS_TOKEN')); \
print('✓ Dropbox connected')"
```

## Performance Optimization

### Database Indexes
```sql
-- Voyage search performance
CREATE INDEX idx_voyages_start_date ON sequoia.voyages(start_date);
CREATE INDEX idx_voyages_president ON sequoia.voyages(president_id);
CREATE INDEX idx_voyages_slug ON sequoia.voyages(voyage_slug);

-- People search
CREATE INDEX idx_people_name ON sequoia.people(full_name);
CREATE INDEX idx_people_slug ON sequoia.people(person_slug);

-- Media lookups
CREATE INDEX idx_media_slug ON sequoia.media(media_slug);
CREATE INDEX idx_media_type ON sequoia.media(media_type);
```

### Connection Pooling
The app uses psycopg2 connection pooling:
- Min connections: 1
- Max connections: 10
- Connection timeout: 30s

### Caching Strategies
- Media files cached locally during ingest
- S3 URLs cached in database (no runtime S3 calls)
- Database query results cached in browser

## Security

### Secrets Management
- `.env` file never committed to git
- GitHub Secrets used for CI/CD
- AWS IAM roles with minimal permissions
- Database password rotated regularly

### API Security
- CORS configured for production domain only
- Rate limiting on endpoints (future)
- Input validation on all endpoints
- SQL injection prevention via parameterized queries

### S3 Bucket Security
- `sequoia-canonical/`: Private, access via IAM only
- `sequoia-public/`: Public read, write via IAM only

## Contributing

1. Create feature branch
2. Make changes in `app/routers/` or `voyage_ingest/`
3. Test locally with `uvicorn` and `pytest`
4. Commit and push
5. Merge to `main` triggers auto-deploy

---

**Built with FastAPI + PostgreSQL + AWS**
**API Docs:** https://uss-sequoia.com/api/docs
