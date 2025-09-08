#!/bin/bash

# EC2 Setup Script for Sequoia Unified Deployment
# Run this script on your EC2 instance to set up the environment

set -e

echo "🚀 Setting up EC2 environment for Sequoia unified deployment..."

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install Node.js and npm
echo "📦 Installing Node.js..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts

# Install Python3 and pip
echo "🐍 Installing Python3..."
sudo yum install python3 python3-pip -y

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install nginx
echo "🌐 Installing Nginx..."
sudo yum install nginx -y

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /home/ec2-user/sequoia-project

# Clone the repository (you'll need to update the URL)
echo "📥 Cloning repository..."
cd /home/ec2-user
git clone https://github.com/luxempig/sequoia-project.git

# Set up nginx configuration
echo "🌐 Setting up Nginx configuration..."
sudo cp /home/ec2-user/sequoia-project/nginx-sequoia.conf /etc/nginx/conf.d/
sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Create log directories
echo "📋 Creating log directories..."
sudo mkdir -p /var/log/pm2
sudo chown ec2-user:ec2-user /var/log/pm2

# Create web root
echo "🌐 Creating web root..."
sudo mkdir -p /var/www/html/sequoia
sudo chown nginx:nginx /var/www/html/sequoia

# Set up backend virtual environment
echo "🐍 Setting up Python virtual environment..."
cd /home/ec2-user/sequoia-project/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd /home/ec2-user/sequoia-project/frontend
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Deploy initial build
echo "🚀 Deploying initial build..."
cd /home/ec2-user/sequoia-project
./deploy-unified.sh

# Start services
echo "🔄 Starting services..."
sudo systemctl enable nginx
sudo systemctl start nginx
pm2 startup
pm2 save

# Set up PM2 to restart on boot
echo "🔄 Setting up PM2 auto-restart..."
sudo env PATH=$PATH:/home/ec2-user/.nvm/versions/node/$(nvm current)/bin /home/ec2-user/.nvm/versions/node/$(nvm current)/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user

echo "✅ EC2 setup complete!"
echo ""
echo "Next steps:"
echo "1. Update the repository URL in this script and deploy-unified.sh"
echo "2. Add your domain name to nginx-sequoia.conf"
echo "3. Set up GitHub secrets: EC2_HOST, EC2_USER, EC2_SSH_KEY"
echo "4. Test the deployment by pushing to main branch"
echo ""
echo "Services status:"
sudo systemctl status nginx --no-pager -l
pm2 status