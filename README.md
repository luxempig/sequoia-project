# Sequoia Project - Unified Repository

This is the unified repository for the Sequoia project, combining both frontend and backend codebases with automated deployment to EC2.

## Repository Structure

```
sequoia-project/
├── frontend/                 # React/TypeScript frontend
├── backend/                  # Python FastAPI backend
├── .github/workflows/        # GitHub Actions workflows
├── deploy-unified.sh         # Unified deployment script
├── setup-ec2.sh             # EC2 environment setup script
├── ecosystem.config.js       # PM2 configuration
├── nginx-sequoia.conf        # Nginx configuration
├── webhook-server.js         # GitHub webhook server
└── package.json             # Root package.json for monorepo management
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

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test locally using `npm run dev`
4. Push to GitHub - deployment will automatically trigger on merge to `main`