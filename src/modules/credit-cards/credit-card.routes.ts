import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { creditCardController } from './credit-card.controller.js';

export async function creditCardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['credit-cards'],
        summary: 'List credit cards for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => creditCardController.list(req, reply),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['credit-cards'],
        summary: 'Create credit card',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => creditCardController.create(req, reply),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['credit-cards'],
        summary: 'Update credit card',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => creditCardController.update(req, reply),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['credit-cards'],
        summary: 'Delete credit card',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => creditCardController.remove(req, reply),
  );
}
