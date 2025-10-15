# USS Sequoia Presidential Yacht Archive

A comprehensive digital archive documenting the USS Sequoia Presidential Yacht's rich history from 1933 to present. This full-stack web application preserves and presents historical voyages, passengers, media, and documents from the iconic vessel that served eight U.S. presidents from Herbert Hoover through Jimmy Carter.

**Live Site:** https://uss-sequoia.com

## Project Status

**Production Ready** - Fully deployed and operational with automated deployment pipeline, nightly data ingestion, and curator interface for ongoing content management.

### Current Statistics
- **460+ voyages** documented across 9 presidential administrations
- **362+ media items** (photos, documents, logs)
- **496+ unique passenger titles** (presidents, dignitaries, crew, guests)
- **Automated nightly ingestion** at 3 AM EST

## Key Features

### 1. Interactive Voyage Timeline
**Location:** `frontend/src/components/HorizontalTimeline.tsx`

- Chronological timeline view of all voyages
- Filter by vessel owner/president, date range, significance, and royalty
- Clickable media thumbnails with lightbox for images, new tab for videos/documents
- Visual indicators for media types (▶ videos, 📄 documents)
- Real-time voyage count display

**Backend API:** `backend/app/routers/voyages.py`
- `/api/voyages` - List/filter voyages with full query support
- `/api/voyages/{slug}` - Detailed voyage information with passengers and media

### 2. Voyage List & Detail Views
**Location:** `frontend/src/components/VoyageList.tsx`, `frontend/src/components/VoyageDetail.tsx`

- Dual view: timeline and traditional list
- Comprehensive voyage details with location, purpose, historical notes
- Passenger manifests with roles and biographical links
- Media galleries with captions and metadata
- Tag-based categorization (diplomatic, recreation, significant events)

### 3. People Directory
**Location:** `frontend/src/components/PeopleDirectory.tsx`, `frontend/src/components/PersonDetail.tsx`

- Searchable directory of all passengers and crew
- Biographical information with birth/death dates, titles, notes
- Complete voyage history for each person
- Passenger statistics (unique titles, average voyages per person)

**Backend API:** `backend/app/routers/people.py`
- `/api/people` - Directory with search
- `/api/people/{slug}` - Person details with voyage participation
- `/api/people/stats` - Aggregate statistics

### 4. Curator Interface
**Location:** `frontend/src/components/JsonCuratorInterface.tsx`

Web-based JSON editor for managing voyage data:
- President selector with voyage filtering
- Voyage editor with date picker, location, tags
- Media manager for Google Drive/Dropbox links
- Passenger roster management
- Save changes instantly (no ingest triggered)
- Preview and validation before commit

**Backend API:** `backend/app/routers/curator.py`
- `GET /api/curator/canonical-voyages` - Fetch current data
- `POST /api/curator/canonical-voyages` - Save edits without triggering ingest
- `POST /api/curator/voyage-ingest` - Manually trigger full ingest with progress tracking

### 5. Automated Voyage Ingestion
**Location:** `backend/voyage_ingest/main.py`

Sophisticated data pipeline that processes canonical JSON into structured database:

**Components:**
- `validator.py` - JSON schema validation, date format checking, slug verification
- `drive_sync.py` - Download media from Google Drive and Dropbox with retry logic
- `s3_manager.py` - Upload to S3 (private originals, public derivatives), generate thumbnails
- `db_updater.py` - Upsert voyages, passengers, media with deduplication
- `slugger.py` - Generate URL-friendly slugs from names

**Workflow:**
1. Validate `canonical_voyages.json` structure and data integrity
2. Download media files from cloud storage (with caching)
3. Generate thumbnails for images (600x400px)
4. Upload to AWS S3 (two-bucket architecture)
5. Upsert to PostgreSQL database with foreign key management
6. Clean up orphaned records

**Manual Run:**
```bash
cd backend
python3 -m voyage_ingest.main --source json --file canonical_voyages.json
```

**Nightly Automation:**
- **Script:** `run-nightly-ingest.sh`
- **Schedule:** 3 AM EST via cron
- **Logs:** `logs/nightly-ingest-YYYY-MM-DD.log` (auto-cleanup after 7 days)
- **Documentation:** `README-CRON.md`

### 6. GitHub Actions Auto-Deploy
**Location:** `.github/workflows/deploy.yml`

**Trigger Paths:**
- `frontend/**` - React/TypeScript changes
- `backend/**` - Python/FastAPI changes
- `deploy-unified.sh` - Deployment script updates
- `nginx-sequoia.conf` - Web server config
- `canonical_voyages.json` - Data updates

**Workflow:**
1. Checkout code
2. SSH into EC2 instance
3. Pull latest code from GitHub
4. Build frontend on EC2 (`npm install && npm run build`)
5. Create tarball of frontend build
6. Run `deploy-unified.sh` which:
   - Detects changed directories
   - Installs Python dependencies if needed
   - Clears Python bytecode cache
   - Extracts frontend build to nginx directory
   - Deletes and recreates PM2 backend process
   - Reloads nginx

**Deployment Script:** `deploy-unified.sh`
- Smart change detection (frontend vs backend)
- Environment variable management (secrets from GitHub Actions)
- Health checks and validation
- Logging to `/home/ec2-user/sequoia-deploy.log`

**GitHub Secrets Required:**
- `EC2_HOST` - Server IP: `3.14.31.211`
- `EC2_USER` - SSH user: `ec2-user`
- `EC2_SSH_KEY` - Full private key from `sequoia-key.pem`
- `AWS_ACCESS_KEY_ID` - AWS credentials for S3
- `AWS_SECRET_ACCESS_KEY` - AWS secret
- `DB_PASSWORD` - PostgreSQL password
- `GOOGLE_CREDENTIALS` - Service account JSON
- `DROPBOX_ACCESS_TOKEN` - Dropbox API token

### 7. AWS Infrastructure
**S3 Buckets:**
- `sequoia-canonical-media` (private) - Original high-res files
- `sequoia-derivative-media` (public) - Thumbnails and web-optimized versions

**RDS PostgreSQL:**
- Host: `sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com`
- Database: `sequoia_db`
- Schema: `sequoia`

**EC2:**
- Instance: Amazon Linux 2
- Services: Nginx (port 80), FastAPI backend (port 8000), PM2 process manager
- Node.js v18, Python 3.9

### 8. Data Consolidation
**Location:** `backend/scripts/consolidate_duplicates.py`

Automated deduplication system that:
- Identifies duplicate passengers by name similarity
- Scores completeness (biographical data richness)
- Consolidates to most complete record
- Updates all voyage references
- Used to clean up 3 duplicates affecting 93 voyage references

## Repository Structure

```
sequoia-project/
├── frontend/                              # React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── HorizontalTimeline.tsx    # Timeline visualization
│   │   │   ├── VoyageList.tsx            # List view with filters
│   │   │   ├── VoyageDetail.tsx          # Individual voyage page
│   │   │   ├── PeopleDirectory.tsx       # Passenger directory
│   │   │   ├── PersonDetail.tsx          # Person profile page
│   │   │   ├── JsonCuratorInterface.tsx  # Data editing interface
│   │   │   ├── HomePage.tsx              # Landing page
│   │   │   └── Layout.tsx                # Navigation wrapper
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx           # Authentication state
│   │   ├── utils/
│   │   │   └── media.ts                  # Media type detection
│   │   ├── api.ts                        # API client with axios
│   │   └── types.ts                      # TypeScript interfaces
│   └── public/                           # Static assets
│
├── backend/                               # Python FastAPI
│   ├── app/
│   │   ├── routers/
│   │   │   ├── voyages.py                # Voyage API endpoints
│   │   │   ├── people.py                 # People API endpoints
│   │   │   ├── curator.py                # Curator interface API
│   │   │   └── presidents.py            # President/owner API
│   │   ├── db.py                         # PostgreSQL connection pool
│   │   └── main.py                       # FastAPI app initialization
│   │
│   ├── voyage_ingest/                     # ETL Pipeline
│   │   ├── main.py                       # Orchestrator
│   │   ├── validator.py                  # JSON validation
│   │   ├── drive_sync.py                 # Media download
│   │   ├── s3_manager.py                 # S3 upload/thumbnail generation
│   │   ├── db_updater.py                 # Database upsert logic
│   │   └── slugger.py                    # Slug generation
│   │
│   ├── scripts/
│   │   ├── consolidate_duplicates.py     # Deduplication utility
│   │   ├── debug_voyage_media.py         # Media troubleshooting
│   │   └── clear_s3_media.py             # S3 cleanup
│   │
│   └── canonical_voyages.json             # Single source of truth (460 voyages)
│
├── .github/workflows/
│   └── deploy.yml                         # Auto-deploy pipeline
│
├── deploy-unified.sh                      # Deployment orchestration
├── run-nightly-ingest.sh                  # Cron job script
├── nginx-sequoia.conf                     # Web server config
├── ecosystem.config.js                    # PM2 configuration
├── README-CRON.md                         # Nightly automation docs
├── EXTERNAL-ACCESS.md                     # Temp access guide
└── LICENSE.md                             # Proprietary license
```

## Database Schema

**Tables:**
- `presidents` - Vessel owners/presidents with term dates
- `voyages` - Core voyage data (date, location, purpose, tags)
- `people` - Passengers and crew with biographical info
- `media` - Media files with S3 URLs and metadata
- `voyage_passengers` - Many-to-many with role/capacity
- `voyage_media` - Many-to-many with caption and sort order

**Key Constraints:**
- Slugs are unique identifiers for all entities
- Foreign keys maintain referential integrity
- NOT NULL constraints on critical fields (dates, term_end)
- Cascading deletes for orphaned join table records

## Development Workflow

### Local Setup
```bash
# Clone repository
git clone https://github.com/luxempig/sequoia-project.git
cd sequoia-project

# Install dependencies
npm run install:all

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Start development servers
npm run dev                # Both frontend + backend
npm run dev:frontend       # React dev server (port 3000)
npm run dev:backend        # FastAPI with hot reload (port 8000)
```

### Curator Workflow
1. Navigate to `/curators` page
2. Select president to filter voyages
3. Edit voyage details, add media, manage passengers
4. Click "Save Changes" (instant, no ingest)
5. Edits persist in `canonical_voyages.json`
6. Nightly ingest at 3 AM updates database and website

### Making Code Changes
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes in `frontend/` or `backend/`
3. Test locally with `npm run dev`
4. Commit with descriptive message
5. Push to GitHub: `git push origin feature/your-feature`
6. Create pull request
7. Merge to `main` triggers auto-deploy to production

## Deployment Details

### Build Process
**Frontend:**
- React build: `npm run build` (creates optimized production bundle)
- Build time: ~17 seconds
- Output: `frontend/build/` directory
- Served by: Nginx from `/var/www/html/sequoia/`

**Backend:**
- No build step (Python interpreted)
- Dependencies: `pip install -r requirements.txt`
- Process manager: PM2
- Workers: 1 (fork mode)

### Deployment Triggers
Changes to these paths trigger auto-deploy:
- `frontend/**/*.{tsx,ts,jsx,js,css,html}`
- `backend/**/*.{py,json,txt}`
- `deploy-unified.sh`
- `nginx-sequoia.conf`
- `truman.json`, `truman_translated.json`

**Note:** Changes to `.github/workflows/deploy.yml` do NOT trigger deployment until a subsequent frontend/backend change is pushed.

### Health Monitoring
```bash
# SSH into EC2
ssh -i sequoia-key.pem ec2-user@3.14.31.211

# Check PM2 processes
pm2 list
pm2 logs sequoia-backend --lines 50

# Check Nginx
sudo systemctl status nginx
sudo nginx -t                    # Test config
sudo tail -f /var/log/nginx/error.log

# View deployment logs
tail -f ~/sequoia-project/logs/deploy-unified.log

# Check nightly ingest logs
ls -lth ~/sequoia-project/logs/nightly-ingest-*.log
tail -50 ~/sequoia-project/logs/nightly-ingest-2025-10-01.log
```

### Manual Deployment
If needed, deploy manually:
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211
cd sequoia-project
git pull
bash deploy-unified.sh
```

## Troubleshooting

### Frontend Not Updating
```bash
# Clear build cache and rebuild
ssh -i sequoia-key.pem ec2-user@3.14.31.211
cd sequoia-project/frontend
rm -rf node_modules/.cache build
npm install
npm run build

# Manually deploy
cd ..
tar -czf frontend-build.tar.gz -C frontend/build .
sudo tar -xzf frontend-build.tar.gz -C /var/www/html/sequoia/
sudo systemctl reload nginx
```

### Backend Errors
```bash
# Check Python cache
ssh -i sequoia-key.pem ec2-user@3.14.31.211
cd sequoia-project
find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find . -type f -name '*.pyc' -delete 2>/dev/null || true

# Restart backend
pm2 delete sequoia-backend
pm2 start ecosystem.config.js --name sequoia-backend
pm2 logs sequoia-backend
```

### Database Issues
```bash
# Connect to PostgreSQL
PGPASSWORD='H|X*2BtZ?muW7Wll$B#CQHOv!2*o' psql \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db -p 5432

# Check table counts
SELECT COUNT(*) FROM sequoia.voyages;
SELECT COUNT(*) FROM sequoia.people;
SELECT COUNT(*) FROM sequoia.media;
```

## API Documentation

### Voyages
- `GET /api/voyages?q=search&president_slug=fdr&significant=1&limit=500`
- `GET /api/voyages/{slug}` - Includes passengers and media

### People
- `GET /api/people?search=roosevelt&limit=100`
- `GET /api/people/{slug}` - Includes voyage history
- `GET /api/people/stats` - Aggregate statistics

### Presidents
- `GET /api/presidents` - List all vessel owners
- `GET /api/presidents/{slug}` - President details with stats

### Curator
- `GET /api/curator/canonical-voyages` - Full JSON data
- `POST /api/curator/canonical-voyages` - Save without ingest
- `POST /api/curator/voyage-ingest` - Trigger manual ingest

## Security

- **Proprietary License:** See `LICENSE.md` - All rights reserved, commercial use prohibited without permission
- **Authentication:** Login required for curator interface
- **SSH Keys:** Securely stored in GitHub Secrets
- **Database:** Credentials in `.env` (never committed)
- **AWS:** IAM roles with minimal permissions
- **Nginx:** Security headers, gzip compression, rate limiting

## Acknowledgments

This project preserves the legacy of the USS Sequoia and honors all who sailed aboard her. Special thanks to historians, archivists, and contributors who have helped document this important piece of American presidential history.

---

**Project by Daniel Freymann** | **Date:** October 2025
