import { z } from 'zod';

export const FREE_MAX_PRODUCTS = 5;
export const FREE_MAX_OFFERS = 3;

export const createProductBodySchema = z.object({
  sourceUrl: z.string().url(),
  title: z.string().min(1).max(500).optional(),
  searchQuery: z.string().max(500).optional().nullable(),
  avgWindowDays: z.union([z.literal(30), z.literal(90), z.literal(180)]).default(30),
  targetPrice: z.number().positive().optional().nullable(),
});

export const updateProductBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  searchQuery: z.string().max(500).optional().nullable(),
  avgWindowDays: z.union([z.literal(30), z.literal(90), z.literal(180)]).optional(),
  targetPrice: z.number().positive().optional().nullable(),
  active: z.boolean().optional(),
});

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const alertIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const offerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const offersQuerySchema = z.object({
  productIds: z.string().optional().default(''),
});

export const createOfferBodySchema = z.object({
  watchedProductId: z.string().uuid(),
  offerUrl: z.string().url(),
  store: z.string().min(1).max(64).optional(),
  offerTitle: z.string().max(500).optional(),
});

export const updateOfferBodySchema = z.object({
  matchStatus: z.enum(['confirmed', 'rejected', 'auto']),
});

export const productAverageQuerySchema = z.object({
  windowDays: z.coerce.number().int().positive().max(365).default(30),
});
