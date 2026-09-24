import type { FastifyReply, FastifyRequest } from 'fastify';
import { updateInitialBalanceBodySchema } from './profile.schema.js';
import { ProfileService } from './profile.service.js';

const service = new ProfileService();

export class ProfileController {
  async get(request: FastifyRequest, reply: FastifyReply) {
    const profile = await service.get(request.user!.id);
    return reply.send(profile);
  }

  async updateInitialBalance(request: FastifyRequest, reply: FastifyReply) {
    const body = updateInitialBalanceBodySchema.parse(request.body);
    const profile = await service.updateInitialBalance(request.user!.id, body);
    return reply.send(profile);
  }
}

export const profileController = new ProfileController();
