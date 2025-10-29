# USS Sequoia Presidential Yacht Archive

A comprehensive digital archive documenting the USS Sequoia Presidential Yacht's rich history from 1933 to present. This full-stack web application preserves and presents historical voyages, passengers, media, and documents from the iconic vessel that served eight U.S. presidents from Herbert Hoover through Jimmy Carter.

**Live Site:** https://uss-sequoia.com

## Project Status

**Production Ready** - Fully deployed and operational with automated deployment pipeline and curator interface for ongoing content management.

### Current Statistics
- **460+ voyages** documented across 9 presidential administrations
- **362+ media items** (photos, documents, logs)
- **496+ unique passenger titles** (presidents, dignitaries, crew, guests)

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

**Triggered via Curator Interface:**
- Navigate to `/curator` page
- Make edits to voyages/media/passengers
- Click "Trigger Ingest" button to manually run ingestion
- Monitor progress in real-time via API status endpoint

### 6. SEO Optimization
**Documentation:** `SEO_OPTIMIZATIONS.md`

Comprehensive search engine optimization for maximum visibility:
- **Meta Tags**: Optimized title, description, keywords, Open Graph, Twitter Cards
- **Structured Data**: Schema.org JSON-LD (WebSite, HistoricalArchive, Vehicle)
- **XML Sitemap**: Auto-generated with 361+ URLs (voyages, people, presidents)
- **robots.txt**: Proper crawler directives with sitemap reference
- **Auto-Generation**: Sitemap regenerated on each deployment

Expected benefits:
- Top rankings for "USS Sequoia", "presidential yacht"
- Rich search results with knowledge panel
- Site search box in Google results
- Optimized social media previews

### 7. GitHub Actions Auto-Deploy
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

### 8. AWS Infrastructure
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

### 9. Data Consolidation
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
├── nginx-sequoia.conf                     # Web server config
├── ecosystem.config.js                    # PM2 configuration
├── SEO_OPTIMIZATIONS.md                   # SEO documentation
├── VOYAGE-JSON-SCHEMA.md                  # Data schema reference
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

## New Developer Onboarding

Welcome! This guide assumes you have:
- ✓ Access to the GitHub repository (via organization)
- ✓ AWS account with admin access to the project
- ✓ SSH key for EC2 server access

### Prerequisites

**Local Machine:**
- Node.js 18+ and npm
- Python 3.9+
- Git
- AWS CLI configured

**Access Checklist:**
- [ ] GitHub organization member with admin access to repository
- [ ] AWS IAM user credentials configured locally (`aws configure`)
- [ ] SSH private key file (`sequoia-key.pem`) saved locally
- [ ] Added to GitHub Secrets with permission to update them

### Secrets and Credentials Management

This project uses a **two-tier secrets approach**:

#### 1. GitHub Secrets (For Automated Deployments)

**Location:** Repository Settings → Secrets and variables → Actions

**Required Secrets:**
```
EC2_HOST=3.14.31.211
EC2_USER=ec2-user
EC2_SSH_KEY=<full private key from sequoia-key.pem>
AWS_ACCESS_KEY_ID=<AWS access key for S3>
AWS_SECRET_ACCESS_KEY=<AWS secret key>
DB_PASSWORD=<PostgreSQL RDS password>
GOOGLE_CREDENTIALS=<Google Drive service account JSON>
DROPBOX_ACCESS_TOKEN=<Dropbox API token>
```

These are injected into the deployment environment by GitHub Actions.

#### 2. AWS Resources (For Developers)

**S3 Buckets:**
- `sequoia-canonical` - Original media files (private)
- `sequoia-public` - Thumbnails and derivatives (public read)

**RDS PostgreSQL:**
- Host: `sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com`
- Port: `5432`
- Database: `sequoia_db`
- Schema: `sequoia`
- User: `sequoia`
- Password: Retrieve from GitHub Secrets or AWS Secrets Manager

**EC2 Instance:**
- IP: `3.14.31.211`
- OS: Amazon Linux 2
- Services: Nginx (port 80), FastAPI (port 8000 via PM2)
- SSH: `ssh -i sequoia-key.pem ec2-user@3.14.31.211`

**IAM Roles/Policies Needed:**
- S3: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on both buckets
- RDS: Network access (security group)
- EC2: SSH access (security group port 22)

### Initial Setup Steps

**1. Clone Repository:**
```bash
git clone git@github.com:YOUR-ORG/sequoia-project.git
cd sequoia-project
```

**2. Configure AWS CLI:**
```bash
aws configure
# Enter your IAM user access key ID
# Enter your secret access key
# Region: us-east-2
# Output format: json

# Test access
aws s3 ls s3://sequoia-canonical/
aws rds describe-db-instances --db-instance-identifier sequoia-prod
```

**3. Set Up SSH Access:**
```bash
# Save the SSH key (get from team or AWS)
chmod 400 sequoia-key.pem

# Test SSH connection
ssh -i sequoia-key.pem ec2-user@3.14.31.211
exit
```

**4. Create Local Environment File:**
```bash
# Create backend/.env file
cat > backend/.env << 'EOF'
# Database
DB_HOST=sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com
DB_PORT=5432
DB_NAME=sequoia_db
DB_USER=sequoia
DB_PASSWORD=<get from GitHub Secrets: DB_PASSWORD>

# AWS S3 (uses ~/.aws/credentials by default, or specify here)
AWS_ACCESS_KEY_ID=<your IAM user key>
AWS_SECRET_ACCESS_KEY=<your IAM user secret>
AWS_DEFAULT_REGION=us-east-2

# Google Drive API (optional for local dev)
GOOGLE_CREDENTIALS=<get from GitHub Secrets if needed>

# Dropbox API (optional for local dev)
DROPBOX_ACCESS_TOKEN=<get from GitHub Secrets if needed>
EOF

# IMPORTANT: Never commit this file!
```

**5. Install Dependencies:**
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**6. Test Local Development:**
```bash
# Terminal 1: Start backend
cd backend
source venv/bin/activate
cd app
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Start frontend
cd frontend
npm start

# Visit http://localhost:3000
```

### Understanding the Architecture

**Data Flow:**
```
canonical_voyages.json (source of truth)
         ↓
  [Manual Ingest via Curator Interface]
         ↓
  Voyage Ingest Pipeline:
    1. Validate JSON
    2. Download media from Google Drive/Dropbox
    3. Generate thumbnails
    4. Upload to S3
    5. Upsert to PostgreSQL
         ↓
  [FastAPI Backend] ← [React Frontend]
         ↓
  Public Website: https://uss-sequoia.com
```

**Deployment Flow:**
```
Developer pushes to main branch
         ↓
  GitHub Actions triggered
         ↓
  SSH into EC2 server
         ↓
  Pull latest code
         ↓
  Build frontend on server
         ↓
  Run deploy-unified.sh:
    - Install dependencies
    - Extract frontend build
    - Restart PM2 backend
    - Reload Nginx
         ↓
  Site updated in ~2 minutes
```

### Key Concepts

**1. Slugs**
Every entity has a URL-friendly slug:
- Voyages: `roosevelt-franklin-1938-01-01`
- People: `roosevelt-franklin-d-president`
- Media: `fdr-1938-photo-deck`

**2. Canonical JSON**
`backend/canonical_voyages.json` is the single source of truth. All edits via curator interface update this file.

**3. Two-Bucket S3 Architecture**
- `sequoia-canonical/president-name/media-type/credit_date_title.ext` (originals)
- `sequoia-public/president-name/media-type/credit_date_title-thumb.jpg` (thumbnails)

**4. Media Types**
- `article` - Articles, PDFs (📄)
- `image` - Photos, scans (🖼️)
- `video` - Video files (🎥)
- `audio` - Audio recordings (🎵)
- `book` - Books, manuscripts (📚)
- `other` - Other files (📎)

**5. Automatic Flags**
Voyages have `has_photos` and `has_videos` flags that auto-update when media is linked/unlinked.

### Common Development Tasks

**Add a New Feature:**
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes in frontend/ or backend/
# Test locally with npm start and uvicorn

# Commit and push
git add .
git commit -m "Add feature: description"
git push origin feature/your-feature-name

# Create pull request on GitHub
# Merge to main → auto-deploys to production
```

**Update Database Schema:**
```bash
# SSH into production
ssh -i sequoia-key.pem ec2-user@3.14.31.211

# Connect to database
PGPASSWORD='<get from GitHub Secrets>' psql \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db

# Run migration
ALTER TABLE sequoia.voyages ADD COLUMN new_field TEXT;
\q

# Update backend models in backend/app/routers/
# Commit and push changes
```

**Clear All Media Records:**
```bash
# On server
ssh -i sequoia-key.pem ec2-user@3.14.31.211
cd sequoia-project/backend
source venv/bin/activate
python3 clear_media_database.py
# Type: DELETE ALL MEDIA
```

**Manually Trigger Ingest:**
```bash
# On server
ssh -i sequoia-key.pem ec2-user@3.14.31.211
cd sequoia-project/backend
source venv/bin/activate
python3 -m voyage_ingest.main --source json --file canonical_voyages.json
```

**View Logs:**
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211

# Backend logs
pm2 logs sequoia-backend --lines 100

# Deployment logs
tail -f ~/sequoia-deploy.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**Restart Services:**
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211

# Restart backend
pm2 restart sequoia-backend

# Restart Nginx
sudo systemctl restart nginx

# Check status
pm2 status
sudo systemctl status nginx
```

### Updating GitHub Secrets

When AWS credentials rotate or change:

**1. Via GitHub Web UI:**
- Go to repository Settings → Secrets and variables → Actions
- Click on secret name (e.g., `AWS_SECRET_ACCESS_KEY`)
- Click "Update secret"
- Paste new value
- Click "Update secret"

**2. Via GitHub CLI:**
```bash
# Install GitHub CLI: https://cli.github.com/
gh auth login

# Update a secret
gh secret set AWS_SECRET_ACCESS_KEY < secret_value.txt

# List all secrets
gh secret list
```

**3. When to Update:**
- AWS credentials rotated (update `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- Database password changed (update `DB_PASSWORD`)
- SSH key regenerated (update `EC2_SSH_KEY`)
- API tokens refreshed (update `GOOGLE_CREDENTIALS`, `DROPBOX_ACCESS_TOKEN`)

### Production Access

**SSH into Server:**
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211
```

**Key Directories:**
- `/home/ec2-user/sequoia-project/` - Application code
- `/var/www/html/` - Frontend static files served by Nginx
- `/home/ec2-user/sequoia-project/logs/` - Application logs
- `/var/log/nginx/` - Nginx logs

**Important Files:**
- `ecosystem.config.js` - PM2 configuration
- `nginx-sequoia.conf` - Nginx configuration
- `deploy-unified.sh` - Deployment script
- `backend/canonical_voyages.json` - Data source of truth

### Emergency Procedures

**Site Down:**
```bash
# 1. Check services
ssh -i sequoia-key.pem ec2-user@3.14.31.211
pm2 status
sudo systemctl status nginx

# 2. Check logs for errors
pm2 logs sequoia-backend --err --lines 50
sudo tail -50 /var/log/nginx/error.log

# 3. Restart everything
pm2 restart sequoia-backend
sudo systemctl restart nginx

# 4. Test
curl http://3.14.31.211/api/voyages?limit=1
curl http://uss-sequoia.com
```

**Database Connection Issues:**
```bash
# Test from EC2
ssh -i sequoia-key.pem ec2-user@3.14.31.211
PGPASSWORD='<password>' psql \
  -h sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com \
  -U sequoia -d sequoia_db -c "SELECT COUNT(*) FROM sequoia.voyages;"

# Check RDS security group allows EC2 instance
# Check RDS is running in AWS console
```

**Rollback Deployment:**
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211
cd sequoia-project

# Find last working commit
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>

# Redeploy
bash deploy-unified.sh
```

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
1. Navigate to `/curator` page
2. Select president to filter voyages
3. Edit voyage details, add media, manage passengers
4. Click "Save Changes" (instant, updates `canonical_voyages.json`)
5. Click "Trigger Ingest" button to run ingestion manually
6. Monitor progress in real-time, changes appear on website immediately after ingest completes

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
tail -f ~/sequoia-deploy.log

# Backend application logs
pm2 logs sequoia-backend --lines 100
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
