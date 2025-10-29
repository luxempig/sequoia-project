#!/bin/bash

# Unified deployment script for Sequoia Frontend + Backend
# Detects changes in frontend/ and backend/ directories and deploys accordingly

set -e

LOG_FILE="/home/ec2-user/sequoia-deploy.log"
APP_DIR="/home/ec2-user/sequoia-project"  # This will be your unified repo
REPO_URL="https://github.com/your-username/sequoia-project.git"  # Update this
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"
NGINX_ROOT="/var/www/html/sequoia"

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting unified deployment..."

# Navigate to app directory
cd $APP_DIR

# Get current commit hash
OLD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "initial")

# Pull latest changes
log "Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

NEW_COMMIT=$(git rev-parse HEAD)

# Check what changed
FRONTEND_CHANGED=false
BACKEND_CHANGED=false

if [ "$OLD_COMMIT" != "initial" ]; then
    if git diff --name-only $OLD_COMMIT $NEW_COMMIT | grep -q "^frontend/"; then
        FRONTEND_CHANGED=true
        log "Frontend changes detected"
    fi
    
    if git diff --name-only $OLD_COMMIT $NEW_COMMIT | grep -q "^backend/"; then
        BACKEND_CHANGED=true
        log "Backend changes detected"
    fi
else
    FRONTEND_CHANGED=true
    BACKEND_CHANGED=true
    log "Initial deployment - building both frontend and backend"
fi

# Deploy backend if changed
if [ "$BACKEND_CHANGED" = true ]; then
    log "Deploying backend..."
    cd $BACKEND_DIR
    
    # Skip npm install for backend - this is Python-only
    # Backend uses Python dependencies only
    
    # Install Python dependencies if requirements changed
    if [ "$OLD_COMMIT" = "initial" ] || git diff --name-only $OLD_COMMIT $NEW_COMMIT | grep -q "backend/requirements.txt"; then
        log "Installing Python dependencies..."
        pip install -r requirements.txt
    fi
    
    # Create .env file mixing local non-secret values with GitHub secrets
    log "Creating .env file from local values and GitHub secrets..."
    cat > .env << EOF
# Database Configuration (mixed: local + secrets)
DB_HOST="sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com"
DB_PORT=5432
DB_NAME=sequoia_db
DB_USER=sequoia
DB_PASSWORD='$DB_PASSWORD'
DB_SCHEMA=sequoia

# AWS Configuration (mixed: local + secrets)
AWS_REGION=us-east-2
MEDIA_BUCKET=uss-sequoia-bucket
PUBLIC_BUCKET=sequoia-public
PRIVATE_BUCKET=sequoia-canonical
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

# Google Sheets Integration (disabled - no longer needed)
# DOC_ID=1brCftArb50GHRZfxDuvCJJkXFAfIE_UoP45xZV0TSdU
# SPREADSHEET_ID=1CDfPY4zi_pkfwyoYxOGPUoeD2ypkKTfFNe1z81klePQ

# Paths and Settings
GOOGLE_APPLICATION_CREDENTIALS="/home/ec2-user/sequoia-project/backend/keys/sequoia_credentials.json"
PRESIDENTS_SHEET_TITLE="presidents"

# Dropbox Configuration
DROPBOX_ACCESS_TOKEN=$DROPBOX_ACCESS_TOKEN
DROPBOX_TIMEOUT=60

# Canonical voyage data file path
CANONICAL_VOYAGES_FILE=canonical_voyages.json

# Redis configuration for Celery
REDIS_URL=redis://localhost:6379/0

# Async processing settings
ASYNC_THUMBNAILS=true
CELERY_WORKER_CONCURRENCY=2
CELERY_TASK_TIME_LIMIT=1800
EOF
    
    # Create keys directory and Google credentials file
    log "Creating keys directory and Google credentials..."
    mkdir -p keys
    echo "$GOOGLE_CREDENTIALS" > keys/sequoia_credentials.json
    
    if [ -f ".env" ] && [ -f "keys/sequoia_credentials.json" ]; then
        log ".env file and Google credentials created successfully"
    else
        log "ERROR: Failed to create .env file or Google credentials"
        exit 1
    fi
    
    # Clear Python cache to ensure fresh code loads
    log "Clearing Python cache..."
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true

    # Restart backend with PM2
    log "Restarting backend..."
    pm2 delete sequoia-backend 2>/dev/null || true
    pm2 start ../ecosystem.config.js --name sequoia-backend
fi

# Deploy frontend if build archive exists
cd $APP_DIR
log "Checking for frontend build archive..."
ls -la frontend-build.tar.gz 2>/dev/null || log "frontend-build.tar.gz not found"
if [ -f "frontend-build.tar.gz" ]; then
    log "Found frontend-build.tar.gz, deploying frontend from uploaded build..."
    
    # Install Certbot if not already installed
    if ! command -v certbot &> /dev/null; then
        log "Installing Certbot for SSL certificates..."
        sudo yum update -y
        sudo yum install -y certbot python3-certbot-nginx
    fi
    
    # Ensure nginx config is up to date
    sudo cp nginx-sequoia.conf /etc/nginx/conf.d/
    sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
    sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    sudo rm -f /etc/nginx/sites-available/default 2>/dev/null || true
    # Remove any other conflicting configs
    sudo find /etc/nginx/conf.d/ -name "*.conf" ! -name "nginx-sequoia.conf" -delete 2>/dev/null || true
    log "Updated nginx config, removed all conflicting configs"
    
    # Check if SSL certificate exists, if not, obtain one
    if [ ! -f "/etc/letsencrypt/live/uss-sequoia.com/fullchain.pem" ]; then
        log "Obtaining SSL certificate for uss-sequoia.com..."
        # First ensure nginx is running with HTTP config
        sudo systemctl reload nginx || sudo systemctl restart nginx
        # Obtain certificate
        sudo certbot --nginx -d uss-sequoia.com --non-interactive --agree-tos --email admin@uss-sequoia.com --redirect
        if [ $? -eq 0 ]; then
            log "SSL certificate obtained successfully"
        else
            log "Failed to obtain SSL certificate, continuing with HTTP only"
        fi
    else
        log "SSL certificate already exists, ensuring nginx config is updated"
        sudo certbot --nginx -d uss-sequoia.com --non-interactive --agree-tos --email admin@uss-sequoia.com --redirect
    fi
    
    # Set up automatic certificate renewal
    if command -v crontab &> /dev/null; then
        if ! sudo crontab -l 2>/dev/null | grep -q "certbot renew"; then
            log "Setting up automatic certificate renewal..."
            (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --nginx") | sudo crontab -
            log "Automatic renewal configured to run daily at noon"
        fi
    else
        log "crontab not available, but Certbot has built-in renewal (systemd timer)"
    fi
    
    log "Extracting frontend build..."
    sudo mkdir -p $NGINX_ROOT
    sudo rm -rf $NGINX_ROOT/*
    sudo tar -xzf frontend-build.tar.gz -C $NGINX_ROOT/

    # Generate and copy XML sitemap for SEO
    log "Generating XML sitemap..."
    cd $BACKEND_DIR
    source venv/bin/activate
    python3 generate_sitemap.py > ../frontend/public/sitemap.xml 2>&1 || log "WARNING: Sitemap generation failed"
    if [ -f "../frontend/public/sitemap.xml" ]; then
        sudo cp ../frontend/public/sitemap.xml $NGINX_ROOT/sitemap.xml
        log "Sitemap deployed successfully ($(grep -c '<url>' ../frontend/public/sitemap.xml) URLs)"
    else
        log "WARNING: Sitemap file not found, skipping sitemap deployment"
    fi
    cd $APP_DIR

    # Note: truman_translated.json removed from repository (no longer needed)

    # Debug: Check what files were deployed
    log "Files deployed to $NGINX_ROOT:"
    sudo ls -la $NGINX_ROOT/
    
    # Clean up
    rm frontend-build.tar.gz
    
    # Set proper permissions
    sudo chown -R nginx:nginx $NGINX_ROOT
    sudo chmod -R 755 $NGINX_ROOT
    
    # Test nginx config before reloading
    log "Testing nginx configuration..."
    if sudo nginx -t; then
        log "Nginx config is valid"
        # Check if nginx is running, start if not
        if sudo systemctl is-active nginx; then
            log "Nginx is running, reloading..."
            sudo systemctl reload nginx
        else
            log "Nginx is not running, starting..."
            sudo systemctl start nginx
        fi
        log "Nginx operation completed"
    else
        log "ERROR: Nginx config is invalid, attempting restart..."
        sudo systemctl restart nginx
    fi
    
    # Check nginx status and config
    log "Nginx status:"
    sudo systemctl status nginx --no-pager -l
    log "Active nginx config files:"
    sudo ls -la /etc/nginx/conf.d/
    log "Testing nginx access..."
    echo "Testing localhost access:"
    curl -I http://localhost/ 2>/dev/null || echo "Could not curl localhost"
    
    echo "Testing direct file access:"
    curl -I http://localhost/index.html 2>/dev/null || echo "Could not curl index.html"
    
    echo "Checking what's actually in index.html:"
    head -20 $NGINX_ROOT/index.html | grep -i isabel || echo "Isabel not found in index.html"
    
    echo "Checking external access issues:"
    echo "Public IP of this instance:"
    curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "Could not get public IP"
    
    echo "Security groups and firewall:"
    sudo iptables -L -n | grep :80 || echo "No iptables rules for port 80"
    
    echo "What DNS says about uss-sequoia.com:"
    nslookup uss-sequoia.com || dig uss-sequoia.com || echo "Could not resolve DNS"
    
    echo "Testing domain access from server:"
    curl -I -H "Host: uss-sequoia.com" http://localhost/ 2>/dev/null || echo "Could not curl with Host header"
    
    echo "Testing if server responds to domain name directly:"
    curl -I http://uss-sequoia.com/ 2>/dev/null || echo "Could not curl domain directly"
    
    echo "Current nginx service status:"
    sudo systemctl status nginx --no-pager -l
    
    echo "Current nginx processes:"
    ps aux | grep nginx
    
    echo "Port 80 listeners:"
    sudo netstat -tlnp | grep :80 || echo "No processes listening on port 80"
    
    echo "AWS instance metadata (to verify we're running):"
    curl -s http://169.254.169.254/latest/meta-data/instance-id || echo "Could not get instance metadata"
else
    log "No frontend build archive found, skipping frontend deployment"
fi

# Ensure .env file is up-to-date with environment variables (run even if backend didn't change)
log "Checking environment variables for .env update..."
if [ -n "$DB_PASSWORD" ] && [ -n "$AWS_ACCESS_KEY_ID" ]; then
    log "Environment variables available, updating .env file..."
    cd $BACKEND_DIR
    cat > .env << EOF
# Database Configuration (mixed: local + secrets)
DB_HOST="sequoia-prod.cricoy2ms8a0.us-east-2.rds.amazonaws.com"
DB_PORT=5432
DB_NAME=sequoia_db
DB_USER=sequoia
DB_PASSWORD='$DB_PASSWORD'
DB_SCHEMA=sequoia

# AWS Configuration (mixed: local + secrets)
AWS_REGION=us-east-2
MEDIA_BUCKET=uss-sequoia-bucket
PUBLIC_BUCKET=sequoia-public
PRIVATE_BUCKET=sequoia-canonical
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY

# Google Sheets Integration (disabled - no longer needed)
# DOC_ID=1brCftArb50GHRZfxDuvCJJkXFAfIE_UoP45xZV0TSdU
# SPREADSHEET_ID=1CDfPY4zi_pkfwyoYxOGPUoeD2ypkKTfFNe1z81klePQ

# Paths and Settings
GOOGLE_APPLICATION_CREDENTIALS="/home/ec2-user/sequoia-project/backend/keys/sequoia_credentials.json"
PRESIDENTS_SHEET_TITLE="presidents"

# Dropbox Configuration
DROPBOX_ACCESS_TOKEN=$DROPBOX_ACCESS_TOKEN
DROPBOX_TIMEOUT=60

# Canonical voyage data file path
CANONICAL_VOYAGES_FILE=canonical_voyages.json

# Redis configuration for Celery
REDIS_URL=redis://localhost:6379/0

# Async processing settings
ASYNC_THUMBNAILS=true
CELERY_WORKER_CONCURRENCY=2
CELERY_TASK_TIME_LIMIT=1800
EOF
    log ".env file updated successfully"
else
    log "WARNING: Required environment variables (DB_PASSWORD, AWS_ACCESS_KEY_ID) not available, skipping .env update"
fi

# Ensure Google credentials exist (run even if backend didn't change)
log "Checking Google credentials... File exists: $([ -f "$BACKEND_DIR/keys/sequoia_credentials.json" ] && echo 'yes' || echo 'no'), Variable set: $([ -n "$GOOGLE_CREDENTIALS" ] && echo 'yes' || echo 'no')"
if [ ! -f "$BACKEND_DIR/keys/sequoia_credentials.json" ]; then
    if [ -n "$GOOGLE_CREDENTIALS" ]; then
        log "Google credentials missing, creating from environment variable..."
        cd $BACKEND_DIR
        mkdir -p keys
        echo "$GOOGLE_CREDENTIALS" > keys/sequoia_credentials.json
        if [ -f "keys/sequoia_credentials.json" ] && [ -s "keys/sequoia_credentials.json" ]; then
            log "Google credentials created successfully (size: $(stat -c%s keys/sequoia_credentials.json 2>/dev/null || stat -f%z keys/sequoia_credentials.json) bytes)"
        else
            log "WARNING: Failed to create Google credentials file or file is empty"
        fi
    else
        log "WARNING: GOOGLE_CREDENTIALS environment variable is not set"
    fi
else
    log "Google credentials file already exists"
fi

# Health check
sleep 5
if [ "$BACKEND_CHANGED" = true ]; then
    if pm2 list | grep sequoia-backend | grep -q "online"; then
        log "Backend is running successfully"
    else
        log "ERROR: Backend failed to start"
        exit 1
    fi
fi

if [ "$FRONTEND_CHANGED" = true ]; then
    if [ -f "$NGINX_ROOT/index.html" ]; then
        log "Frontend deployed successfully"
    else
        log "ERROR: Frontend deployment failed"
        exit 1
    fi
fi

log "Deployment completed successfully"