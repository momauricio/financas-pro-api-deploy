import type { InvestmentAsset, InvestmentSnapshot, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type {
  AssetCreateInput,
  AssetRecord,
  AssetUpdateData,
  InvestmentRepositoryPort,
  SnapshotRecord,
  SnapshotUpsertInput,
} from './investment.repo-port.js';

function mapAsset(row: InvestmentAsset): AssetRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    type: row.type,
    institution: row.institution,
    currency: row.currency,
    ticker: row.ticker,
    quantity: row.quantity,
    priceSource: row.priceSource,
    lastPrice: row.lastPrice,
    lastPriceAt: row.lastPriceAt,
    fixedIncomeIndex: row.fixedIncomeIndex,
    fixedIncomeRate: row.fixedIncomeRate,
    fixedIncomeMode: row.fixedIncomeMode,
    maturityDate: row.maturityDate,
    liquidity: row.liquidity,
    liquidityDate: row.liquidityDate,
    targetAllocationPct: row.targetAllocationPct,
    targetBuyPrice: row.targetBuyPrice,
    targetSellPrice: row.targetSellPrice,
    createdAt: row.createdAt,
  };
}

function mapSnap(row: InvestmentSnapshot): SnapshotRecord {
  return {
    id: row.id,
    assetId: row.assetId,
    userId: row.userId,
    monthId: row.monthId,
    amount: row.amount,
    usdRate: row.usdRate,
    yieldAmount: row.yieldAmount,
    manualOverride: row.manualOverride,
    rateAppliedMonthId: row.rateAppliedMonthId,
    createdAt: row.createdAt,
  };
}

export class InvestmentRepository implements InvestmentRepositoryPort {
  async listAssets(userId: string): Promise<AssetRecord[]> {
    const rows = await prisma.investmentAsset.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return rows.map(mapAsset);
  }

  async findAssetById(id: string, userId: string): Promise<AssetRecord | null> {
    const row = await prisma.investmentAsset.findFirst({ where: { id, userId } });
    return row ? mapAsset(row) : null;
  }

  async createAsset(data: AssetCreateInput): Promise<AssetRecord> {
    const row = await prisma.investmentAsset.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: data.type,
        institution: data.institution,
        currency: data.currency,
        ticker: data.ticker ?? null,
        quantity: data.quantity ?? null,
        priceSource: data.priceSource ?? null,
        lastPrice: data.lastPrice ?? null,
        lastPriceAt: data.lastPriceAt ?? null,
        fixedIncomeIndex: data.fixedIncomeIndex ?? null,
        fixedIncomeRate: data.fixedIncomeRate ?? null,
        fixedIncomeMode: data.fixedIncomeMode ?? null,
        maturityDate: data.maturityDate ?? null,
        liquidity: data.liquidity ?? null,
        liquidityDate: data.liquidityDate ?? null,
        targetAllocationPct: data.targetAllocationPct ?? null,
        targetBuyPrice: data.targetBuyPrice ?? null,
        targetSellPrice: data.targetSellPrice ?? null,
      },
    });
    return mapAsset(row);
  }

  async updateAsset(
    id: string,
    userId: string,
    data: AssetUpdateData,
  ): Promise<AssetRecord | null> {
    await prisma.investmentAsset.updateMany({
      where: { id, userId },
      data: data as Prisma.InvestmentAssetUpdateManyMutationInput,
    });
    return this.findAssetById(id, userId);
  }

  async deleteAsset(id: string, userId: string): Promise<boolean> {
    const result = await prisma.investmentAsset.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }

  async listSnapshots(
    userId: string,
    opts?: { monthId?: string; assetIds?: string[] },
  ): Promise<SnapshotRecord[]> {
    const rows = await prisma.investmentSnapshot.findMany({
      where: {
        userId,
        ...(opts?.monthId ? { monthId: opts.monthId } : {}),
        ...(opts?.assetIds?.length ? { assetId: { in: opts.assetIds } } : {}),
      },
      orderBy: [{ monthId: 'asc' }, { assetId: 'asc' }],
    });
    return rows.map(mapSnap);
  }

  async findSnapshot(
    assetId: string,
    monthId: string,
    userId: string,
  ): Promise<SnapshotRecord | null> {
    const row = await prisma.investmentSnapshot.findFirst({
      where: { assetId, monthId, userId },
    });
    return row ? mapSnap(row) : null;
  }

  async upsertSnapshot(data: SnapshotUpsertInput): Promise<SnapshotRecord> {
    const row = await prisma.investmentSnapshot.upsert({
      where: {
        assetId_monthId: { assetId: data.assetId, monthId: data.monthId },
      },
      create: {
        userId: data.userId,
        assetId: data.assetId,
        monthId: data.monthId,
        amount: data.amount,
        usdRate: data.usdRate ?? '0',
        yieldAmount: data.yieldAmount ?? '0',
        manualOverride: data.manualOverride ?? false,
        rateAppliedMonthId: data.rateAppliedMonthId ?? null,
      },
      update: {
        amount: data.amount,
        ...(data.usdRate !== undefined ? { usdRate: data.usdRate } : {}),
        ...(data.yieldAmount !== undefined ? { yieldAmount: data.yieldAmount } : {}),
        ...(data.manualOverride !== undefined ? { manualOverride: data.manualOverride } : {}),
        ...(data.rateAppliedMonthId !== undefined
          ? { rateAppliedMonthId: data.rateAppliedMonthId }
          : {}),
      },
    });
    return mapSnap(row);
  }

  async insertSnapshotsIgnoreDuplicates(rows: SnapshotUpsertInput[]): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await prisma.investmentSnapshot.createMany({
      data: rows.map((r) => ({
        userId: r.userId,
        assetId: r.assetId,
        monthId: r.monthId,
        amount: r.amount,
        usdRate: r.usdRate ?? '0',
        yieldAmount: r.yieldAmount ?? '0',
        manualOverride: r.manualOverride ?? false,
        rateAppliedMonthId: r.rateAppliedMonthId ?? null,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async deleteFutureSnapshots(userId: string, todayMonthId: string): Promise<number> {
    const result = await prisma.investmentSnapshot.deleteMany({
      where: { userId, monthId: { gt: todayMonthId } },
    });
    return result.count;
  }
}
