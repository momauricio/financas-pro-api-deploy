import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import {
  FREE_MAX_OFFERS,
  FREE_MAX_PRODUCTS,
  type createOfferBodySchema,
  type createProductBodySchema,
  type updateOfferBodySchema,
  type updateProductBodySchema,
} from './price-alerts.schema.js';
import { PriceAlertsRepository } from './price-alerts.repository.js';
import type { z } from 'zod';
import { money, moneyToNumber } from '../../shared/utils/money.js';

type CreateBody = z.infer<typeof createProductBodySchema>;
type UpdateBody = z.infer<typeof updateProductBodySchema>;
type CreateOfferBody = z.infer<typeof createOfferBodySchema>;
type UpdateOfferBody = z.infer<typeof updateOfferBodySchema>;

export class PriceAlertsService {
  constructor(
    private readonly repo: PriceAlertsRepository = new PriceAlertsRepository(),
  ) {}

  async listProducts(userId: string) {
    const rows = await this.repo.listProducts(userId);
    return { items: rows.map((r) => this.repo.mapProduct(r)) };
  }

  async createProduct(userId: string, body: CreateBody) {
    const count = await this.repo.countActiveProducts(userId);
    if (count >= FREE_MAX_PRODUCTS) {
      throw new ValidationError(
        `Limite Free de ${FREE_MAX_PRODUCTS} produtos atingido`,
      );
    }
    const created = await this.repo.createProduct({
      userId,
      sourceUrl: body.sourceUrl,
      title: body.title?.trim() || body.sourceUrl,
      searchQuery: body.searchQuery ?? null,
      avgWindowDays: body.avgWindowDays,
      targetPrice: body.targetPrice ?? null,
    });
    return this.repo.mapProduct(created);
  }

  async updateProduct(userId: string, id: string, body: UpdateBody) {
    const current = await this.repo.findProduct(id, userId);
    if (!current) throw new NotFoundError('Product not found');
    const updated = await this.repo.updateProduct(id, userId, body);
    if (!updated) throw new NotFoundError('Product not found');
    return this.repo.mapProduct(updated);
  }

  async removeProduct(userId: string, id: string) {
    const current = await this.repo.findProduct(id, userId);
    if (!current) throw new NotFoundError('Product not found');
    await this.repo.updateProduct(id, userId, { active: false });
  }

  async listOffers(userId: string, productIdsCsv: string) {
    const productIds = productIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = await this.repo.listOffers(userId, productIds);
    return { items: rows.map((r) => this.repo.mapOffer(r)) };
  }

  async createOffer(userId: string, body: CreateOfferBody) {
    const product = await this.repo.findProduct(body.watchedProductId, userId);
    if (!product) throw new NotFoundError('Product not found');

    const count = await this.repo.countActiveOffers(userId, body.watchedProductId);
    if (count >= FREE_MAX_OFFERS) {
      throw new ValidationError(
        `Limite Free: no máximo ${FREE_MAX_OFFERS} ofertas por produto.`,
      );
    }

    const created = await this.repo.createOffer({
      userId,
      watchedProductId: body.watchedProductId,
      store: body.store?.trim() || 'other',
      offerUrl: body.offerUrl.trim(),
      offerTitle: body.offerTitle?.trim() || 'Oferta manual',
      matchStatus: 'confirmed',
      isSource: false,
    });
    return this.repo.mapOffer(created);
  }

  async updateOffer(userId: string, id: string, body: UpdateOfferBody) {
    const current = await this.repo.findOffer(id, userId);
    if (!current) throw new NotFoundError('Offer not found');

    const updated = await this.repo.updateOffer(id, userId, {
      matchStatus: body.matchStatus,
      ...(body.matchStatus === 'rejected' ? { active: false } : {}),
    });
    if (!updated) throw new NotFoundError('Offer not found');
    return this.repo.mapOffer(updated);
  }

  async productAverage(userId: string, productId: string, windowDays: number) {
    const product = await this.repo.findProduct(productId, userId);
    if (!product) throw new NotFoundError('Product not found');

    const offers = await this.repo.listOffers(userId, [productId]);
    const priced = offers
      .map((o) => ({
        price: o.lastPrice != null ? moneyToNumber(money(o.lastPrice.toString())) : null,
        url: o.offerUrl,
        store: o.store,
        title: o.offerTitle,
      }))
      .filter((o) => o.price != null)
      .map((o) => ({
        price: o.price as number,
        url: o.url,
        store: o.store,
        title: o.title,
      }))
      .sort((a, b) => a.price - b.price);

    const best = priced[0] ?? null;
    const bestNow = best?.price ?? null;
    const bestOfferUrl = best?.url ?? null;
    const bestOfferStore = best?.store ?? null;
    const bestOfferTitle = best?.title ?? null;

    if (offers.length === 0) {
      return {
        avg: null,
        days: 0,
        bestNow,
        bestOfferUrl,
        bestOfferStore,
        bestOfferTitle,
      };
    }

    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const snaps = await this.repo.listOfferSnapshots(
      userId,
      offers.map((o) => o.id),
      since,
    );

    const byDay: Record<string, number> = {};
    for (const s of snaps) {
      const day = s.scrapedAt.toISOString().slice(0, 10);
      const p = moneyToNumber(money(s.price.toString()));
      byDay[day] = byDay[day] == null ? p : Math.min(byDay[day], p);
    }
    const values = Object.values(byDay);
    if (!values.length) {
      return {
        avg: null,
        days: 0,
        bestNow,
        bestOfferUrl,
        bestOfferStore,
        bestOfferTitle,
      };
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      avg: Math.round(avg * 100) / 100,
      days: values.length,
      bestNow,
      bestOfferUrl,
      bestOfferStore,
      bestOfferTitle,
    };
  }

  async listAlerts(userId: string) {
    const rows = await this.repo.listAlerts(userId);
    return { items: rows.map((r) => this.repo.mapAlert(r)) };
  }

  async markAlertRead(userId: string, id: string) {
    const row = await this.repo.markAlertRead(id, userId);
    if (!row) throw new NotFoundError('Alert not found');
    return this.repo.mapAlert(row);
  }

  async getSettings(userId: string) {
    const row = await this.repo.ensureSettings(userId);
    return {
      userId: row.userId,
      defaultAvgWindowDays: row.defaultAvgWindowDays,
      emailAlertsEnabled: row.emailAlertsEnabled,
      manualRefreshCount: row.manualRefreshCount,
      manualRefreshDay: row.manualRefreshDay,
    };
  }
}
