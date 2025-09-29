# USS Sequoia Presidential Yacht Archive

A comprehensive digital archive of the USS Sequoia Presidential Yacht, documenting its rich history from 1933 to the present day. This project preserves and presents historical voyages, passengers, media, and documents from this iconic vessel that served as the presidential yacht for Herbert Hoover through Jimmy Carter.

## About the USS Sequoia

The USS Sequoia is a historic presidential yacht that served eight U.S. presidents and hosted countless dignitaries, world leaders, and distinguished guests. This archive aims to:

- **Preserve History**: Document all known voyages with passengers, dates, locations, and historical context
- **Curate Media**: Organize photos, documents, logs, and other historical materials
- **Enable Research**: Provide searchable access to voyage records and passenger information
- **Honor Legacy**: Celebrate the yacht's role in American presidential history

## Project Overview

This is a full-stack web application combining modern frontend technologies with a robust backend system for data management and automated content ingestion.

## Features

### Frontend (React/TypeScript)
- **Voyage Timeline**: Interactive timeline view of all historical voyages
- **Passenger Directory**: Searchable database of all passengers with biographical information
- **Media Gallery**: High-quality images, documents, and historical materials
- **Tag-based Filtering**: Filter voyages by themes, events, and categories
- **President Grouping**: Voyages organized by presidential administrations
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

### Backend (Python/FastAPI)
- **Automated Ingest**: Process canonical JSON data into structured database
- **Media Pipeline**: Download, process, and generate thumbnails from Drive/Dropbox
- **S3 Integration**: Manage media storage in AWS S3 (public/private buckets)
- **PostgreSQL Database**: Robust relational data model for voyages, passengers, media
- **RESTful API**: Clean API endpoints for all data access
- **Curator Interface**: Web-based editor for managing voyage data

### Deployment & Infrastructure
- **Auto-deploy**: GitHub Actions workflow deploys on push to main
- **EC2 Hosting**: Production environment on AWS EC2
- **Nginx**: Reverse proxy and static file serving
- **PM2**: Process management for backend services

## Repository Structure

```
sequoia-project/
├── frontend/                     # React/TypeScript frontend
│   ├── src/
│   │   ├── components/          # React components (Timeline, Voyages, People, etc.)
│   │   ├── api.ts               # API client
│   │   └── types.ts             # TypeScript type definitions
│   └── public/                  # Static assets
├── backend/                      # Python FastAPI backend
│   ├── app/                     # FastAPI application
│   │   ├── routers/            # API route handlers
│   │   └── db.py               # Database connection
│   ├── voyage_ingest/           # Data ingestion system
│   │   ├── main.py             # Main ingest orchestrator
│   │   ├── validator.py        # JSON validation
│   │   ├── drive_sync.py       # Media download/processing
│   │   ├── db_updater.py       # Database upsert logic
│   │   └── slugger.py          # Slug generation utilities
│   ├── scripts/                 # Utility scripts
│   │   ├── debug_voyage_media.py  # Debug media issues
│   │   └── clear_s3_media.py      # S3 cleanup utility
│   └── canonical_voyages.json   # Source of truth for all voyage data
├── .github/workflows/           # CI/CD pipelines
├── deploy-unified.sh            # Automated deployment script
└── nginx-sequoia.conf           # Web server configuration
```

## Setup Instructions

### 1. EC2 Instance Setup

Run the setup script on your EC2 instance:

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Download and run the setup script
curl -O https://raw.githubusercontent.com/your-username/sequoia-project/main/setup-ec2.sh
chmod +x setup-ec2.sh
./setup-ec2.sh
```

### 2. GitHub Repository Setup

#### Required GitHub Secrets

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `EC2_HOST` | Your EC2 instance public IP or domain | `12.34.56.78` or `your-domain.com` |
| `EC2_USER` | EC2 username | `ec2-user` |
| `EC2_SSH_KEY` | Private SSH key content | Contents of your `.pem` file |

#### Setting up SSH Key Secret

1. Copy your EC2 SSH private key:
   ```bash
   cat your-ec2-key.pem
   ```
2. Copy the entire content (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
3. Add it as the `EC2_SSH_KEY` secret in GitHub

### 3. Update Configuration Files

Before deploying, update these files with your specific values:

#### `deploy-unified.sh`
```bash
REPO_URL="https://github.com/your-username/sequoia-project.git"  # Update this
```

#### `nginx-sequoia.conf`
```nginx
server_name your-domain.com;  # Replace with your domain or EC2 public IP
```

#### `setup-ec2.sh`
```bash
git clone https://github.com/your-username/sequoia-project.git  # Update this
```

### 4. Initial Deployment

1. Push your code to the `main` branch
2. GitHub Actions will automatically trigger the deployment
3. The workflow will SSH into your EC2 instance and run the deployment script

## Development

### Local Development Setup

```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend in development mode
npm run dev

# Or start them individually
npm run dev:frontend  # Starts React dev server
npm run dev:backend   # Starts FastAPI with hot reload
```

### Available Scripts

- `npm run install:all` - Install dependencies for both frontend and backend
- `npm run dev` - Start both services in development mode
- `npm run build:frontend` - Build frontend for production
- `npm run deploy` - Run deployment script locally
- `npm run clean:frontend` - Clean frontend build files
- `npm run clean:backend` - Clean Python cache files

## Deployment Process

The deployment system works as follows:

1. **Trigger**: Push to `main` branch or merged PR
2. **Detection**: GitHub Actions detects changes in `frontend/` or `backend/` directories
3. **SSH**: Actions SSH into EC2 instance using provided credentials
4. **Pull**: Latest code is pulled from GitHub
5. **Deploy**: `deploy-unified.sh` script runs, which:
   - Detects what changed (frontend/backend)
   - Installs dependencies if needed
   - Builds frontend if changed
   - Restarts backend with PM2 if changed
   - Updates nginx content if frontend changed
   - Performs health checks

## Services

### Backend (Port 8000)
- Python FastAPI application
- Managed by PM2
- Proxied through nginx at `/api/` path

### Frontend
- React/TypeScript application
- Built and served statically by nginx
- Served from nginx root `/`

### Webhook Server (Port 9000)
- Handles GitHub webhooks (if needed)
- Managed by PM2

## Monitoring

### Check Service Status
```bash
# PM2 processes
pm2 status

# Nginx status
sudo systemctl status nginx

# View logs
pm2 logs sequoia-backend
tail -f /var/log/sequoia-deploy.log
```

### Health Checks
- Backend health: `http://your-domain.com/health`
- Frontend: `http://your-domain.com/`

## Troubleshooting

### Common Issues

1. **Deployment fails with SSH errors**
   - Verify `EC2_SSH_KEY` secret contains the full private key
   - Ensure EC2 security group allows SSH (port 22) from GitHub Actions IPs

2. **Backend not starting**
   - Check PM2 logs: `pm2 logs sequoia-backend`
   - Verify Python dependencies: `cd backend && source venv/bin/activate && pip install -r requirements.txt`

3. **Frontend not updating**
   - Check if build completed: `ls -la frontend/build/` or `frontend/dist/`
   - Verify nginx permissions: `sudo chown -R nginx:nginx /var/www/html/sequoia`

4. **Nginx not serving correctly**
   - Check nginx config: `sudo nginx -t`
   - Restart nginx: `sudo systemctl restart nginx`

### Log Locations
- Deployment: `/var/log/sequoia-deploy.log`
- Backend: `/var/log/pm2/sequoia-backend-*.log`
- Webhook: `/var/log/pm2/sequoia-webhook-*.log`
- Nginx: `/var/log/nginx/error.log`

## Security Notes

- SSH key is stored securely in GitHub Secrets
- Environment variables should be managed via `.env` files (not committed)
- Nginx configuration includes security headers and gzip compression
- PM2 processes run with limited privileges

## Data Model

### Core Entities

- **Presidents**: U.S. presidents and yacht owners (Hoover through Carter, plus post-presidential era)
- **Voyages**: Individual trips with dates, locations, purposes, and tags
- **People**: Passengers and crew with biographical information and roles
- **Media**: Photos, documents, PDFs, and other historical materials
- **Voyage-Passengers**: Many-to-many join with role/capacity information
- **Voyage-Media**: Many-to-many join with captions and sort order

### Data Ingestion Flow

1. **Canonical JSON**: Single source of truth (`canonical_voyages.json`)
2. **Validation**: Strict validation of dates, slugs, and required fields
3. **Media Download**: Fetch files from Google Drive and Dropbox
4. **S3 Upload**: Store originals (private) and thumbnails (public)
5. **Database Upsert**: Insert or update voyages, passengers, media
6. **Frontend API**: Serve data via RESTful endpoints

## Contributing

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Test locally using `npm run dev`
4. Push to GitHub
5. Create pull request
6. On merge to `main`, auto-deploy triggers

### Data Curation

To add or update voyage data:

1. Edit `backend/canonical_voyages.json` via curator interface or direct edit
2. Ensure all dates follow `YYYY-MM-DD` format
3. Add media links (Google Drive or Dropbox)
4. Push changes - ingest runs automatically on deploy
5. Verify on production site

### Coding Standards

- **Frontend**: ESLint + Prettier, TypeScript strict mode
- **Backend**: Black formatter, type hints, docstrings
- **Git**: Conventional commit messages
- **Testing**: Test changes locally before pushing

## Acknowledgments

This project preserves the legacy of the USS Sequoia and honors all who sailed aboard her. Special thanks to historians, archivists, and contributors who have helped document this important piece of American presidential history.