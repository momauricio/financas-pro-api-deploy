import 'dotenv/config';
import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadEnv();
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`API listening on http://${config.HOST}:${config.PORT}`);
    app.log.info(`OpenAPI UI at http://${config.HOST}:${config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
