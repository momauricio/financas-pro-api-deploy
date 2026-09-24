/**
 * PM2 process file — Finanças Pro API
 *
 * On the VPS (after cloning + npm ci + prisma generate + npm run build):
 *   cp .env.example .env   # fill secrets — never commit
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'financas-pro-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 3001,
      },
      // Prefer loading secrets from .env next to the app (dotenv in process).
      // Do NOT put DATABASE_URL / BRAPI_TOKEN here.
      max_memory_restart: '512M',
      time: true,
      merge_logs: true,
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
    },
  ],
};
