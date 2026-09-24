import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createCreditCardBodySchema,
  creditCardIdParamsSchema,
  listCreditCardsQuerySchema,
  updateCreditCardBodySchema,
} from './credit-card.schema.js';
import { CreditCardService } from './credit-card.service.js';

const service = new CreditCardService();

export class CreditCardController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listCreditCardsQuerySchema.parse(request.query);
    const result = await service.list(request.user!.id, query);
    return reply.send(result);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createCreditCardBodySchema.parse(request.body);
    const created = await service.create(request.user!.id, body);
    return reply.status(201).send(created);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = creditCardIdParamsSchema.parse(request.params);
    const body = updateCreditCardBodySchema.parse(request.body);
    const updated = await service.update(request.user!.id, id, body);
    return reply.send(updated);
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = creditCardIdParamsSchema.parse(request.params);
    await service.delete(request.user!.id, id);
    return reply.status(204).send();
  }
}

export const creditCardController = new CreditCardController();
