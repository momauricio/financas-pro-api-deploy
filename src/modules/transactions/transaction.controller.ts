import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  createTransactionBodySchema,
  deleteTransactionBodySchema,
  listTransactionsQuerySchema,
  replicateTransactionBodySchema,
  transactionIdParamsSchema,
  updateTransactionBodySchema,
} from './transaction.schema.js';
import { TransactionRepository } from './transaction.repository.js';
import { TransactionService } from './transaction.service.js';

const service = new TransactionService(new TransactionRepository());

export class TransactionController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listTransactionsQuerySchema.parse(request.query);
    const result = await service.list(request.user!.id, query);
    return reply.send(result);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createTransactionBodySchema.parse(request.body);
    const created = await service.create(request.user!.id, body);
    return reply.status(201).send({ items: created });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = transactionIdParamsSchema.parse(request.params);
    const body = updateTransactionBodySchema.parse(request.body);
    const result = await service.update(request.user!.id, id, body);
    return reply.send(result);
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = transactionIdParamsSchema.parse(request.params);
    const body =
      request.body && typeof request.body === 'object'
        ? deleteTransactionBodySchema.parse(request.body)
        : deleteTransactionBodySchema.parse({});
    const result = await service.delete(request.user!.id, id, body.scope);
    return reply.send(result);
  }

  async replicate(request: FastifyRequest, reply: FastifyReply) {
    const { id } = transactionIdParamsSchema.parse(request.params);
    const body = replicateTransactionBodySchema.parse(request.body);
    const result = await service.replicate(request.user!.id, id, body);
    return reply.status(201).send(result);
  }
}

export const transactionController = new TransactionController();
