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
    
    # Install backend dependencies if package.json changed
    if [ "$OLD_COMMIT" = "initial" ] || git diff --name-only $OLD_COMMIT $NEW_COMMIT | grep -q "backend/package.json\|backend/package-lock.json"; then
        log "Installing backend dependencies..."
        npm install
    fi
    
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

# Google Sheets Integration (local values)
DOC_ID=1brCftArb50GHRZfxDuvCJJkXFAfIE_UoP45xZV0TSdU
SPREADSHEET_ID=1CDfPY4zi_pkfwyoYxOGPUoeD2ypkKTfFNe1z81klePQ

# Paths and Settings
GOOGLE_APPLICATION_CREDENTIALS="/home/ec2-user/sequoia-project/backend/keys/sequoia_credentials.json"
PRESIDENTS_SHEET_TITLE="presidents"
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
    
    # Restart backend with PM2
    log "Restarting backend..."
    pm2 restart sequoia-backend || pm2 start ecosystem.config.js --name sequoia-backend
fi

# Deploy frontend if build archive exists
cd $APP_DIR
if [ -f "frontend-build.tar.gz" ]; then
    log "Deploying frontend from uploaded build..."
    
    # Ensure nginx config is up to date
    sudo cp nginx-sequoia.conf /etc/nginx/conf.d/
    sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
    
    log "Extracting frontend build..."
    sudo mkdir -p $NGINX_ROOT
    sudo rm -rf $NGINX_ROOT/*
    sudo tar -xzf frontend-build.tar.gz -C $NGINX_ROOT/
    
    # Debug: Check what files were deployed
    log "Files deployed to $NGINX_ROOT:"
    sudo ls -la $NGINX_ROOT/
    
    # Clean up
    rm frontend-build.tar.gz
    
    # Set proper permissions
    sudo chown -R nginx:nginx $NGINX_ROOT
    sudo chmod -R 755 $NGINX_ROOT
    
    # Test nginx config before reloading
    if sudo nginx -t; then
        log "Nginx config is valid, reloading..."
        sudo systemctl reload nginx
        log "Frontend deployed from build archive"
    else
        log "ERROR: Nginx config is invalid, attempting restart..."
        sudo systemctl restart nginx
        if sudo systemctl is-active nginx; then
            log "Nginx restarted successfully"
        else
            log "ERROR: Nginx failed to start"
            sudo systemctl status nginx
        fi
    fi
else
    log "No frontend build archive found, skipping frontend deployment"
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