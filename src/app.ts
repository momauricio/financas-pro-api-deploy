import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { categoryRoutes } from './modules/categories/category.routes.js';
import { creditCardRoutes } from './modules/credit-cards/credit-card.routes.js';
import { invoicePaymentRoutes } from './modules/invoice-payments/invoice-payment.routes.js';
import { goalRoutes } from './modules/goals/goal.routes.js';
import { profileRoutes } from './modules/profile/profile.routes.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { investmentRoutes } from './modules/investments/investment.routes.js';
import { aggregatesRoutes } from './modules/aggregates/aggregates.routes.js';
import { priceAlertsRoutes } from './modules/price-alerts/price-alerts.routes.js';

export async function buildApp() {
  const config = env();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'body.password',
          'body.token',
          'body.amount',
          'body.initialBalance',
          'body.creditLimit',
          'body.limit',
          'body.deltaBRL',
          'body.lastPrice',
          'body.fixedIncomeRate',
          'body.targetPrice',
        ],
        censor: '[redacted]',
      },
    },
  });

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
  });

  const origins = config.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  await app.register(cors, {
    origin: origins,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: config.NODE_ENV === 'production' ? 120 : 1000,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Finanças Pro API',
        description:
          'Backend Node (Fastify) — business logic migrated from the React client. Auth via Supabase JWT.',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'financas-pro-api',
    time: new Date().toISOString(),
  }));

  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' });
  await app.register(creditCardRoutes, { prefix: '/api/v1/credit-cards' });
  await app.register(invoicePaymentRoutes, { prefix: '/api/v1/invoice-payments' });
  await app.register(goalRoutes, { prefix: '/api/v1/goals' });
  await app.register(profileRoutes, { prefix: '/api/v1/profile' });
  await app.register(transactionRoutes, { prefix: '/api/v1/transactions' });
  await app.register(investmentRoutes, { prefix: '/api/v1/investments' });
  await app.register(aggregatesRoutes, { prefix: '/api/v1/aggregates' });
  await app.register(priceAlertsRoutes, { prefix: '/api/v1/price-alerts' });

  return app;
}
