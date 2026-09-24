import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { profileController } from './profile.controller.js';

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['profile'],
        summary: 'Get authenticated user profile (initial balance)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => profileController.get(req, reply),
  );

  app.put(
    '/initial-balance',
    {
      schema: {
        tags: ['profile'],
        summary: 'Upsert initial balance for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => profileController.updateInitialBalance(req, reply),
  );
}
