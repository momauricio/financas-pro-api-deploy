import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  alertIdParamsSchema,
  createOfferBodySchema,
  createProductBodySchema,
  offerIdParamsSchema,
  offersQuerySchema,
  productAverageQuerySchema,
  productIdParamsSchema,
  updateOfferBodySchema,
  updateProductBodySchema,
} from './price-alerts.schema.js';
import { PriceAlertsService } from './price-alerts.service.js';

const service = new PriceAlertsService();

export class PriceAlertsController {
  async listProducts(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.listProducts(request.user!.id));
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    const body = createProductBodySchema.parse(request.body);
    const created = await service.createProduct(request.user!.id, body);
    return reply.status(201).send(created);
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = productIdParamsSchema.parse(request.params);
    const body = updateProductBodySchema.parse(request.body);
    return reply.send(await service.updateProduct(request.user!.id, id, body));
  }

  async removeProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id } = productIdParamsSchema.parse(request.params);
    await service.removeProduct(request.user!.id, id);
    return reply.status(204).send();
  }

  async listOffers(request: FastifyRequest, reply: FastifyReply) {
    const query = offersQuerySchema.parse(request.query);
    return reply.send(
      await service.listOffers(request.user!.id, query.productIds),
    );
  }

  async createOffer(request: FastifyRequest, reply: FastifyReply) {
    const body = createOfferBodySchema.parse(request.body);
    const created = await service.createOffer(request.user!.id, body);
    return reply.status(201).send(created);
  }

  async updateOffer(request: FastifyRequest, reply: FastifyReply) {
    const { id } = offerIdParamsSchema.parse(request.params);
    const body = updateOfferBodySchema.parse(request.body);
    return reply.send(await service.updateOffer(request.user!.id, id, body));
  }

  async productAverage(request: FastifyRequest, reply: FastifyReply) {
    const { id } = productIdParamsSchema.parse(request.params);
    const query = productAverageQuerySchema.parse(request.query);
    return reply.send(
      await service.productAverage(request.user!.id, id, query.windowDays),
    );
  }

  async listAlerts(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.listAlerts(request.user!.id));
  }

  async markAlertRead(request: FastifyRequest, reply: FastifyReply) {
    const { id } = alertIdParamsSchema.parse(request.params);
    return reply.send(await service.markAlertRead(request.user!.id, id));
  }

  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await service.getSettings(request.user!.id));
  }
}

export const priceAlertsController = new PriceAlertsController();
