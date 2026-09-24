import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  listInvoicePaymentsQuerySchema,
  upsertInvoicePaymentBodySchema,
} from './invoice-payment.schema.js';
import { InvoicePaymentService } from './invoice-payment.service.js';

const service = new InvoicePaymentService();

export class InvoicePaymentController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listInvoicePaymentsQuerySchema.parse(request.query);
    const result = await service.list(request.user!.id, query);
    return reply.send(result);
  }

  async upsert(request: FastifyRequest, reply: FastifyReply) {
    const body = upsertInvoicePaymentBodySchema.parse(request.body);
    const saved = await service.upsert(request.user!.id, body);
    return reply.send(saved);
  }
}

export const invoicePaymentController = new InvoicePaymentController();
