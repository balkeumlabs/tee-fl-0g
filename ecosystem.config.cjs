/**
 * PM2 Ecosystem Configuration
 * 
 * Used to manage the backend server process on AWS EC2
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
    apps: [{
        name: 'tee-fl-0g-api',
        script: 'server/index.js',
        instances: 1,
        exec_mode: 'fork',
        env: {
            NODE_ENV: 'production',
            PORT: 3000,
            HOST: '0.0.0.0'
        },
        error_file: './logs/pm2-error.log',
        out_file: './logs/pm2-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        watch: false,
        ignore_watch: ['node_modules', 'logs', '*.log']
    }]
};

