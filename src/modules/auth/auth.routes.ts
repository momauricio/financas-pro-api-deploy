import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/me',
    {
      preHandler: authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Return the authenticated user id/email from JWT',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => ({
      id: request.user!.id,
      email: request.user!.email ?? null,
    }),
  );
}
