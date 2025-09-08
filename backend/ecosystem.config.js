module.exports = {
  apps: [{
    name: 'sequoia-backend',
    script: 'uvicorn',
    args: 'app.main:app --host 0.0.0.0 --port 8000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    interpreter: 'python3',
    env: {
      PYTHONPATH: '/home/ec2-user/sequoia-project/backend',
      NODE_ENV: 'production'
    },
    error_file: '/var/log/sequoia-backend-error.log',
    out_file: '/var/log/sequoia-backend-out.log',
    log_file: '/var/log/sequoia-backend-combined.log',
    time: true
  }]
};