import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { categoryController } from './category.controller.js';

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['categories'],
        summary: 'List categories for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => categoryController.list(req, reply),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['categories'],
        summary: 'Create category',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => categoryController.create(req, reply),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['categories'],
        summary: 'Update category (renames cascade to transactions/goals)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => categoryController.update(req, reply),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['categories'],
        summary: 'Delete category',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => categoryController.remove(req, reply),
  );
}
