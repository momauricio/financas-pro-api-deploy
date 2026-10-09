import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { transactionController } from './transaction.controller.js';

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['transactions'],
        summary: 'List transactions for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.list(req, reply),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['transactions'],
        summary:
          'Create transaction(s) — expands fixed (×12) or installments; partial refunds via refundOfTransactionId + amount ≤ remaining',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.create(req, reply),
  );

  app.get(
    '/:id/refundable',
    {
      schema: {
        tags: ['transactions'],
        summary:
          'Remaining refundable amount for a purchase (sum of prior refunds via refundOfTransactionId)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.refundable(req, reply),
  );

  app.post(
    '/:id/cancel-refund',
    {
      schema: {
        tags: ['transactions'],
        summary:
          'Cancel (undo) a refund transaction — deletes the refund row and restores remaining on the original',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.cancelRefund(req, reply),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Update transaction (scope: current|future|past|all)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.update(req, reply),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Delete transaction (optional body.scope)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.remove(req, reply),
  );

  app.post(
    '/:id/replicate',
    {
      schema: {
        tags: ['transactions'],
        summary: 'Replicate transaction into other months (day clamp)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => transactionController.replicate(req, reply),
  );
}
