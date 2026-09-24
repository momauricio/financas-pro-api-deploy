import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { money, moneyToNumber } from '../../shared/utils/money.js';

function dec(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return moneyToNumber(money(value.toString()));
}

export class PriceAlertsRepository {
  async countActiveProducts(userId: string): Promise<number> {
    return prisma.watchedProduct.count({
      where: { userId, active: true },
    });
  }

  async listProducts(userId: string) {
    return prisma.watchedProduct.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProduct(id: string, userId: string) {
    return prisma.watchedProduct.findFirst({ where: { id, userId } });
  }

  async createProduct(data: {
    userId: string;
    sourceUrl: string;
    title: string;
    searchQuery: string | null;
    avgWindowDays: number;
    targetPrice: number | null;
  }) {
    return prisma.watchedProduct.create({
      data: {
        userId: data.userId,
        sourceUrl: data.sourceUrl,
        title: data.title,
        searchQuery: data.searchQuery ?? undefined,
        avgWindowDays: data.avgWindowDays,
        targetPrice: data.targetPrice ?? undefined,
        active: true,
        discoverStatus: 'pending',
      },
    });
  }

  async updateProduct(
    id: string,
    userId: string,
    data: Partial<{
      title: string;
      searchQuery: string | null;
      avgWindowDays: number;
      targetPrice: number | null;
      active: boolean;
    }>,
  ) {
    const { searchQuery, targetPrice, ...rest } = data;
    await prisma.watchedProduct.updateMany({
      where: { id, userId },
      data: {
        ...rest,
        ...(searchQuery !== undefined ? { searchQuery: searchQuery ?? undefined } : {}),
        ...(targetPrice !== undefined ? { targetPrice: targetPrice ?? undefined } : {}),
      },
    });
    return this.findProduct(id, userId);
  }

  async listOffers(userId: string, productIds: string[]) {
    if (productIds.length === 0) return [];
    return prisma.productOffer.findMany({
      where: {
        userId,
        watchedProductId: { in: productIds },
        active: true,
        NOT: { matchStatus: 'rejected' },
      },
      orderBy: [{ isSource: 'desc' }, { lastSeenAt: 'desc' }],
    });
  }

  async findOffer(id: string, userId: string) {
    return prisma.productOffer.findFirst({ where: { id, userId } });
  }

  async countActiveOffers(userId: string, watchedProductId: string): Promise<number> {
    return prisma.productOffer.count({
      where: {
        userId,
        watchedProductId,
        active: true,
        NOT: { matchStatus: 'rejected' },
      },
    });
  }

  async createOffer(data: {
    userId: string;
    watchedProductId: string;
    store: string;
    offerUrl: string;
    offerTitle: string;
    matchStatus: string;
    isSource: boolean;
  }) {
    return prisma.productOffer.create({
      data: {
        userId: data.userId,
        watchedProductId: data.watchedProductId,
        store: data.store,
        offerUrl: data.offerUrl,
        offerTitle: data.offerTitle,
        matchStatus: data.matchStatus,
        isSource: data.isSource,
        active: true,
      },
    });
  }

  async updateOffer(
    id: string,
    userId: string,
    data: Partial<{ matchStatus: string; active: boolean }>,
  ) {
    await prisma.productOffer.updateMany({
      where: { id, userId },
      data,
    });
    return this.findOffer(id, userId);
  }

  async listOfferSnapshots(
    userId: string,
    offerIds: string[],
    since: Date,
  ) {
    if (offerIds.length === 0) return [];
    return prisma.offerSnapshot.findMany({
      where: {
        userId,
        offerId: { in: offerIds },
        scrapedAt: { gte: since },
      },
      select: { offerId: true, price: true, scrapedAt: true },
    });
  }

  async listAlerts(userId: string, limit = 50) {
    return prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { watchedProduct: { select: { title: true } } },
    });
  }

  async markAlertRead(id: string, userId: string) {
    await prisma.priceAlert.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return prisma.priceAlert.findFirst({ where: { id, userId } });
  }

  async getSettings(userId: string) {
    return prisma.userPriceSettings.findUnique({ where: { userId } });
  }

  async ensureSettings(userId: string) {
    const existing = await this.getSettings(userId);
    if (existing) return existing;
    return prisma.userPriceSettings.create({
      data: { userId, defaultAvgWindowDays: 30, emailAlertsEnabled: false },
    });
  }

  mapProduct(row: {
    id: string;
    userId: string;
    sourceUrl: string;
    title: string;
    searchQuery: string | null;
    imageUrl: string | null;
    avgWindowDays: number;
    targetPrice: Prisma.Decimal | null;
    active: boolean;
    discoverStatus: string | null;
    discoverError: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      userId: row.userId,
      sourceUrl: row.sourceUrl,
      title: row.title,
      searchQuery: row.searchQuery,
      imageUrl: row.imageUrl,
      avgWindowDays: row.avgWindowDays,
      targetPrice: dec(row.targetPrice),
      active: row.active,
      discoverStatus: row.discoverStatus,
      discoverError: row.discoverError,
      createdAt: row.createdAt.toISOString(),
    };
  }

  mapOffer(row: {
    id: string;
    watchedProductId: string;
    store: string | null;
    offerUrl: string;
    offerTitle: string | null;
    matchScore: Prisma.Decimal | null;
    matchStatus: string | null;
    isSource: boolean | null;
    lastPrice: Prisma.Decimal | null;
    lastSeenAt: Date | null;
    active: boolean | null;
  }) {
    return {
      id: row.id,
      watchedProductId: row.watchedProductId,
      store: row.store,
      offerUrl: row.offerUrl,
      offerTitle: row.offerTitle,
      matchScore: dec(row.matchScore),
      matchStatus: row.matchStatus,
      isSource: !!row.isSource,
      lastPrice: dec(row.lastPrice),
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      active: row.active ?? true,
    };
  }

  mapAlert(row: {
    id: string;
    watchedProductId: string;
    offerId: string | null;
    trigger: string;
    price: Prisma.Decimal;
    avgPrice: Prisma.Decimal | null;
    windowDays: number | null;
    notifiedEmailAt: Date | null;
    readAt: Date | null;
    createdAt: Date;
    watchedProduct?: { title: string } | null;
  }) {
    return {
      id: row.id,
      watchedProductId: row.watchedProductId,
      offerId: row.offerId,
      trigger: row.trigger,
      price: dec(row.price) ?? 0,
      avgPrice: dec(row.avgPrice),
      windowDays: row.windowDays,
      notifiedEmailAt: row.notifiedEmailAt?.toISOString() ?? null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      productTitle: row.watchedProduct?.title,
    };
  }
}
