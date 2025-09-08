#!/bin/bash

# Auto-deployment script for Sequoia Backend
# This script pulls latest changes and restarts the application

set -e

LOG_FILE="/var/log/sequoia-deploy.log"
APP_DIR="/home/ec2-user/sequoia-backend"
REPO_URL="https://github.com/luxempig/Sequoia-Backend.git"

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

log "Starting deployment..."

# Navigate to app directory
cd $APP_DIR

# Backup current state
log "Creating backup..."
cp -r . /tmp/sequoia-backup-$(date +%Y%m%d-%H%M%S) || true

# Pull latest changes
log "Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# Install dependencies if package.json changed
if git diff --name-only HEAD@{1} HEAD | grep -q "package.json\|package-lock.json"; then
    log "Installing dependencies..."
    npm install
fi

# Install Python dependencies if requirements changed
if git diff --name-only HEAD@{1} HEAD | grep -q "requirements.txt"; then
    log "Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Restart application with PM2
log "Restarting application..."
pm2 restart sequoia-backend || pm2 start ecosystem.config.js

# Health check
sleep 5
if pm2 list | grep -q "online"; then
    log "Deployment successful - application is running"
else
    log "ERROR: Application failed to start"
    exit 1
fi

log "Deployment completed successfully"