import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  listGoalsQuerySchema,
  upsertGoalBodySchema,
  upsertGoalsBatchBodySchema,
} from './goal.schema.js';
import { GoalService } from './goal.service.js';

const service = new GoalService();

export class GoalController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listGoalsQuerySchema.parse(request.query);
    const result = await service.list(request.user!.id, query);
    return reply.send(result);
  }

  async upsert(request: FastifyRequest, reply: FastifyReply) {
    const body = upsertGoalBodySchema.parse(request.body);
    const saved = await service.upsert(request.user!.id, body);
    return reply.send(saved);
  }

  async upsertBatch(request: FastifyRequest, reply: FastifyReply) {
    const body = upsertGoalsBatchBodySchema.parse(request.body);
    const saved = await service.upsertBatch(request.user!.id, body);
    return reply.send({ items: saved });
  }
}

export const goalController = new GoalController();
