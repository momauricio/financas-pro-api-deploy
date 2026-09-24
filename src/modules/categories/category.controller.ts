import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  categoryIdParamsSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from './category.schema.js';
import { CategoryService } from './category.service.js';

const service = new CategoryService();

export class CategoryController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listCategoriesQuerySchema.parse(request.query);
    const result = await service.list(request.user!.id, query);
    return reply.send(result);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createCategoryBodySchema.parse(request.body);
    const created = await service.create(request.user!.id, body);
    return reply.status(201).send(created);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = categoryIdParamsSchema.parse(request.params);
    const body = updateCategoryBodySchema.parse(request.body);
    const updated = await service.update(request.user!.id, id, body);
    return reply.send(updated);
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = categoryIdParamsSchema.parse(request.params);
    await service.delete(request.user!.id, id);
    return reply.status(204).send();
  }
}

export const categoryController = new CategoryController();
