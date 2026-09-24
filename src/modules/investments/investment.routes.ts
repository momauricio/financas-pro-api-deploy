import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { investmentController } from './investment.controller.js';

export async function investmentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/assets',
    {
      schema: {
        tags: ['investments'],
        summary: 'List investment assets for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.listAssets(req, reply),
  );

  app.post(
    '/assets',
    {
      schema: {
        tags: ['investments'],
        summary: 'Create investment asset',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.createAsset(req, reply),
  );

  app.patch(
    '/assets/:id',
    {
      schema: {
        tags: ['investments'],
        summary: 'Update investment asset (JWT ownership)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.updateAsset(req, reply),
  );

  app.delete(
    '/assets/:id',
    {
      schema: {
        tags: ['investments'],
        summary: 'Delete investment asset',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.deleteAsset(req, reply),
  );

  app.get(
    '/snapshots',
    {
      schema: {
        tags: ['investments'],
        summary: 'List investment snapshots (optional monthId)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.listSnapshots(req, reply),
  );

  app.put(
    '/snapshots',
    {
      schema: {
        tags: ['investments'],
        summary: 'Upsert snapshot (blocks future monthId)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.upsertSnapshot(req, reply),
  );

  app.post(
    '/aportes',
    {
      schema: {
        tags: ['investments'],
        summary: 'Apply aporte delta from investment-category expense',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.applyAporte(req, reply),
  );

  app.post(
    '/refresh-equity',
    {
      schema: {
        tags: ['investments'],
        summary: 'Mark-to-market auto equities (qty × price)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.refreshEquity(req, reply),
  );

  app.post(
    '/refresh-fixed-income',
    {
      schema: {
        tags: ['investments'],
        summary: 'Apply BCB/index factor; idempotent via rate_applied_month_id',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.refreshFixedIncome(req, reply),
  );

  app.post(
    '/ensure-month-snapshots',
    {
      schema: {
        tags: ['investments'],
        summary: 'Carry-forward seed snapshots from previous month',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => investmentController.ensureMonth(req, reply),
  );
}
