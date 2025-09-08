module.exports = {
  apps: [{
    name: 'sequoia-backend',
    script: 'server.js', // Adjust this to your main server file
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/sequoia-backend-error.log',
    out_file: '/var/log/sequoia-backend-out.log',
    log_file: '/var/log/sequoia-backend-combined.log',
    time: true
  }]
};