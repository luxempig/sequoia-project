module.exports = {
  apps: [{
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
    error_file: '/var/log/sequoia-webhook-error.log',
    out_file: '/var/log/sequoia-webhook-out.log',
    log_file: '/var/log/sequoia-webhook-combined.log',
    time: true
  }]
};