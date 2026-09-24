import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  baselinesQuerySchema,
  healthRulesQuerySchema,
  monthIdQuerySchema,
} from './aggregates.schema.js';
import { AggregatesService } from './aggregates.service.js';

const service = new AggregatesService();

export class AggregatesController {
  async summary(request: FastifyRequest, reply: FastifyReply) {
    const query = monthIdQuerySchema.parse(request.query);
    const result = await service.getSummary(request.user!.id, query.monthId);
    return reply.send(result);
  }

  async forecast(request: FastifyRequest, reply: FastifyReply) {
    const query = monthIdQuerySchema.parse(request.query);
    const result = await service.getForecast(request.user!.id, query.monthId);
    return reply.send(result);
  }

  async financialAlerts(request: FastifyRequest, reply: FastifyReply) {
    const query = monthIdQuerySchema.parse(request.query);
    const result = await service.getFinancialAlerts(
      request.user!.id,
      query.monthId,
    );
    return reply.send(result);
  }

  async baselines(request: FastifyRequest, reply: FastifyReply) {
    const query = baselinesQuerySchema.parse(request.query);
    const result = await service.getBaselines(
      request.user!.id,
      query.monthId,
      query.period,
    );
    return reply.send(result);
  }

  async investmentSummary(request: FastifyRequest, reply: FastifyReply) {
    const result = await service.investmentSummary(request.user!.id);
    return reply.send(result);
  }

  async healthRules(request: FastifyRequest, reply: FastifyReply) {
    const query = healthRulesQuerySchema.parse(request.query);
    return reply.send(service.healthRules(query.category));
  }
}

export const aggregatesController = new AggregatesController();
