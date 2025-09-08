# Sequoia Unified Repository Structure

Your unified repository should follow this structure:

```
sequoia-app/
├── frontend/                 # React/Vue/Angular frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ... (frontend files)
│
├── backend/                  # Node.js/Express backend
│   ├── src/ or routes/
│   ├── server.js            # Main server file
│   ├── package.json
│   ├── .env
│   └── ... (backend files)
│
├── deploy-unified.sh        # Deployment script
├── ecosystem.unified.config.js  # PM2 configuration
├── webhook-server.js        # GitHub webhook handler
├── nginx-sequoia.conf       # Nginx configuration
├── setup-nginx.sh          # Nginx setup script
├── .github/
│   └── workflows/
│       └── deploy-unified.yml
└── README.md
```

## Setup Steps:

1. **Create your unified repository structure**
2. **Move this backend code to backend/ directory**
3. **Move your frontend code to frontend/ directory**
4. **Update the deployment script paths in deploy-unified.sh**
5. **Run the nginx setup: `./setup-nginx.sh`**
6. **Start PM2 processes: `pm2 start ecosystem.unified.config.js`**

## How it works:

- **Frontend changes** → Builds and deploys to nginx static files
- **Backend changes** → Restarts PM2 backend process
- **Both** → Nginx serves frontend on port 80, proxies /api/* to backend on port 3001