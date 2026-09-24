import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  applyAporteBodySchema,
  assetIdParamsSchema,
  createAssetBodySchema,
  ensureMonthBodySchema,
  listSnapshotsQuerySchema,
  refreshEquityBodySchema,
  refreshFixedIncomeBodySchema,
  updateAssetBodySchema,
  upsertSnapshotBodySchema,
} from './investment.schema.js';
import { InvestmentService } from './investment.service.js';
import { InvestmentRepository } from './investment.repository.js';
import { BcbRatesProvider } from './bcb-rates.provider.js';
import { MarketQuotesProvider } from './market-quotes.provider.js';

const service = new InvestmentService(
  new InvestmentRepository(),
  new MarketQuotesProvider(),
  new BcbRatesProvider(),
);

export class InvestmentController {
  async listAssets(request: FastifyRequest, reply: FastifyReply) {
    const items = await service.listAssets(request.user!.id);
    return reply.send({ items });
  }

  async createAsset(request: FastifyRequest, reply: FastifyReply) {
    const body = createAssetBodySchema.parse(request.body);
    const created = await service.createAsset(request.user!.id, body);
    return reply.status(201).send(created);
  }

  async updateAsset(request: FastifyRequest, reply: FastifyReply) {
    const { id } = assetIdParamsSchema.parse(request.params);
    const body = updateAssetBodySchema.parse(request.body);
    const updated = await service.updateAsset(request.user!.id, id, body);
    return reply.send(updated);
  }

  async deleteAsset(request: FastifyRequest, reply: FastifyReply) {
    const { id } = assetIdParamsSchema.parse(request.params);
    await service.deleteAsset(request.user!.id, id);
    return reply.status(204).send();
  }

  async listSnapshots(request: FastifyRequest, reply: FastifyReply) {
    const query = listSnapshotsQuerySchema.parse(request.query);
    const items = await service.listSnapshots(request.user!.id, query.monthId);
    return reply.send({ items });
  }

  async upsertSnapshot(request: FastifyRequest, reply: FastifyReply) {
    const body = upsertSnapshotBodySchema.parse(request.body);
    const saved = await service.upsertSnapshot(request.user!.id, body);
    if (!saved) {
      return reply.status(204).send();
    }
    return reply.send(saved);
  }

  async applyAporte(request: FastifyRequest, reply: FastifyReply) {
    const body = applyAporteBodySchema.parse(request.body);
    const snap = await service.applyAporte(request.user!.id, body);
    return reply.send(snap);
  }

  async refreshEquity(request: FastifyRequest, reply: FastifyReply) {
    const body = refreshEquityBodySchema.parse(request.body ?? {});
    const result = await service.refreshEquityQuotes(request.user!.id, body);
    return reply.send(result);
  }

  async refreshFixedIncome(request: FastifyRequest, reply: FastifyReply) {
    const body = refreshFixedIncomeBodySchema.parse(request.body ?? {});
    const result = await service.refreshFixedIncome(request.user!.id, body);
    return reply.send(result);
  }

  async ensureMonth(request: FastifyRequest, reply: FastifyReply) {
    const body = ensureMonthBodySchema.parse(request.body);
    const result = await service.ensureMonthSnapshots(request.user!.id, body);
    return reply.send(result);
  }
}

export const investmentController = new InvestmentController();
