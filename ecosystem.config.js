module.exports = {
  apps: [
    {
      name: 'sequoia-backend',
      script: 'python3',
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8000',
      cwd: '/home/ec2-user/sequoia-project/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
        PYTHONPATH: '/home/ec2-user/sequoia-project/backend'
      },
      error_file: './logs/sequoia-backend-error.log',
      out_file: './logs/sequoia-backend-out.log',
      log_file: './logs/sequoia-backend-combined.log',
      time: true,
      kill_timeout: 3000,
      restart_delay: 1000
    },
    {
      name: 'sequoia-webhook',
      script: 'webhook-server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 9000,
        GITHUB_WEBHOOK_SECRET: 'your-webhook-secret-here'
      },
      error_file: './logs/sequoia-webhook-error.log',
      out_file: './logs/sequoia-webhook-out.log',
      log_file: './logs/sequoia-webhook-combined.log',
      time: true
    }
  ]
};