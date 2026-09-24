import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { invoicePaymentController } from './invoice-payment.controller.js';

export async function invoicePaymentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['invoice-payments'],
        summary: 'List invoice payment flags for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => invoicePaymentController.list(req, reply),
  );

  app.put(
    '/',
    {
      schema: {
        tags: ['invoice-payments'],
        summary: 'Upsert invoice paid flag (cardId + monthId)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => invoicePaymentController.upsert(req, reply),
  );
}
