/**
 * Price-alerts encapsulation — CRUD + reads + Edge proxy for discover/check.
 *
 * Scraping stays on Supabase Edge (`price-discover`, `price-check`, `price-ingest`).
 * The browser never calls those edges when using the API; JWT is required here and
 * the API forwards the user token server-side (service/anon key stays on the VPS).
 */

import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/auth.js';
import { priceAlertsController } from './price-alerts.controller.js';

export async function priceAlertsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/products',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'List watched products for the authenticated user',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.listProducts(req, reply),
  );

  app.post(
    '/products',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Create watched product (Free cap enforced server-side)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.createProduct(req, reply),
  );

  app.patch(
    '/products/:id',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Update watched product (ownership enforced)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.updateProduct(req, reply),
  );

  app.delete(
    '/products/:id',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Deactivate watched product',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.removeProduct(req, reply),
  );

  app.get(
    '/products/:id/average',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Rolling average of best daily prices for a product',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.productAverage(req, reply),
  );

  app.get(
    '/offers',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'List offers for given product ids (query: productIds=a,b)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.listOffers(req, reply),
  );

  app.post(
    '/offers',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Add manual offer (Free cap enforced server-side)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.createOffer(req, reply),
  );

  app.patch(
    '/offers/:id',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Update offer match status (confirmed/rejected)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.updateOffer(req, reply),
  );

  app.get(
    '/alerts',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'List recent price alerts',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.listAlerts(req, reply),
  );

  app.post(
    '/alerts/:id/read',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Mark alert as read',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.markAlertRead(req, reply),
  );

  app.get(
    '/settings',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Get user price settings',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.getSettings(req, reply),
  );

  app.post(
    '/discover',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Discover product offers (proxies Edge price-discover)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.discover(req, reply),
  );

  app.post(
    '/check',
    {
      schema: {
        tags: ['price-alerts'],
        summary: 'Manual price refresh (proxies Edge price-check)',
        security: [{ bearerAuth: [] }],
      },
    },
    (req, reply) => priceAlertsController.check(req, reply),
  );
}
