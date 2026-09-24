import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { aggregatesController } from './aggregates.controller.js';

/**
 * Read-only aggregates / projections / financial-alerts.
 * JWT ownership enforced in repository (userId scope).
 * Cash invoice lag is unified (see cash-projection.ts).
 */
export async function aggregatesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/summary',
    {
      schema: {
        tags: ['aggregates'],
        summary:
          'Dashboard summary cards (caixa, entradas, saídas, saldo) — unified invoice lag',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.summary(req, reply),
  );

  app.get(
    '/forecast',
    {
      schema: {
        tags: ['aggregates'],
        summary:
          'Cash forecast 30/60/90 — same invoice lag as /summary (unified)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.forecast(req, reply),
  );

  app.get(
    '/financial-alerts',
    {
      schema: {
        tags: ['aggregates'],
        summary: 'Derived financial alerts for the month (dismiss stays client-side)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.financialAlerts(req, reply),
  );

  app.get(
    '/baselines',
    {
      schema: {
        tags: ['aggregates'],
        summary: 'Category spend baselines for comparison / goal allocation',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.baselines(req, reply),
  );

  app.get(
    '/investment-summary',
    {
      schema: {
        tags: ['aggregates'],
        summary: 'Investment vs spending counts for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.investmentSummary(req, reply),
  );

  // Back-compat with stub POST that accepted client payloads
  app.post(
    '/investment-summary',
    {
      schema: {
        tags: ['aggregates'],
        summary: 'Deprecated stub — prefer GET /investment-summary (server data)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.investmentSummary(req, reply),
  );

  app.get(
    '/health-rules',
    {
      schema: {
        tags: ['aggregates'],
        summary: 'Category classification helpers for front parity checks',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => aggregatesController.healthRules(req, reply),
  );
}
