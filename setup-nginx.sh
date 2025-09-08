#!/bin/bash

# Setup nginx for Sequoia application

# Install nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    sudo yum update -y
    sudo yum install -y nginx
fi

# Create nginx configuration
echo "Setting up nginx configuration..."
sudo cp nginx-sequoia.conf /etc/nginx/conf.d/sequoia.conf

# Remove default nginx config if it exists
sudo rm -f /etc/nginx/conf.d/default.conf

# Create web directory
sudo mkdir -p /var/www/html/sequoia

# Set proper permissions
sudo chown -R nginx:nginx /var/www/html/sequoia
sudo chmod -R 755 /var/www/html/sequoia

# Test nginx configuration
echo "Testing nginx configuration..."
sudo nginx -t

# Enable and start nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl reload nginx

echo "Nginx setup complete!"
echo "Your application will be served at: http://$(curl -s http://checkip.amazonaws.com/)"