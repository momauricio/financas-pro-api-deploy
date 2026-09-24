import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { goalController } from './goal.controller.js';

export async function goalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['goals'],
        summary: 'List goals for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => goalController.list(req, reply),
  );

  app.put(
    '/',
    {
      schema: {
        tags: ['goals'],
        summary: 'Upsert a single goal (user + monthId + category)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => goalController.upsert(req, reply),
  );

  app.put(
    '/batch',
    {
      schema: {
        tags: ['goals'],
        summary: 'Upsert multiple goals for a month (applyGoals / copy)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => goalController.upsertBatch(req, reply),
  );
}
