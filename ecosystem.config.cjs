/**
 * PM2 — MatuCall API (producción)
 * App: https://call.api.matubyte.com
 */
const APP_DIR = '/root/apps/call-api';

module.exports = {
  apps: [
    {
      name: 'matucall-api',
      cwd: APP_DIR,
      script: 'dist/index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4110,
      },
    },
  ],
};
