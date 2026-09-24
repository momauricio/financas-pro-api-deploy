import { writeAuditLog } from '../../shared/middlewares/audit.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { money, moneyToNumber, moneyToString } from '../../shared/utils/money.js';
import { prevMonthId, toMonthId } from '../../shared/utils/dates.js';
import {
  isInvestmentCategory,
  monthFactor,
  type FixedIncomeIndex,
  type MonthIndexRates,
} from './fixed-income.js';
import type {
  ApplyAporteBody,
  CreateAssetBody,
  EnsureMonthBody,
  RefreshEquityBody,
  RefreshFixedIncomeBody,
  UpdateAssetBody,
  UpsertSnapshotBody,
} from './investment.schema.js';
import type {
  AssetRecord,
  InvestmentRepositoryPort,
  MarketQuote,
  QuotesProvider,
  RatesProvider,
  SnapshotRecord,
} from './investment.repo-port.js';

function decNum(v: { toString(): string } | string | number | null | undefined): number {
  if (v == null) return 0;
  return Number(typeof v === 'object' ? v.toString() : v) || 0;
}

function toDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(`${s}T12:00:00`);
}

function dateIdOrNull(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.substring(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type AssetDto = {
  id: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  ticker: string | null;
  quantity: number | null;
  priceSource: string | null;
  lastPrice: number | null;
  lastPriceAt: string | null;
  fixedIncomeIndex: string | null;
  fixedIncomeRate: number | null;
  fixedIncomeMode: string | null;
  maturityDate: string | null;
  liquidity: string | null;
  liquidityDate: string | null;
  targetAllocationPct: number | null;
  targetBuyPrice: number | null;
  targetSellPrice: number | null;
};

export type SnapshotDto = {
  id: string;
  assetId: string;
  monthId: string;
  amount: number;
  usdRate: number;
  yieldAmount: number;
  manualOverride: boolean;
  rateAppliedMonthId: string | null;
};

function toAssetDto(row: AssetRecord): AssetDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution,
    currency: row.currency,
    ticker: row.ticker,
    quantity: row.quantity != null ? decNum(row.quantity) : null,
    priceSource: row.priceSource,
    lastPrice: row.lastPrice != null ? decNum(row.lastPrice) : null,
    lastPriceAt:
      row.lastPriceAt instanceof Date
        ? row.lastPriceAt.toISOString()
        : (row.lastPriceAt as string | null),
    fixedIncomeIndex: row.fixedIncomeIndex,
    fixedIncomeRate: row.fixedIncomeRate != null ? decNum(row.fixedIncomeRate) : null,
    fixedIncomeMode: row.fixedIncomeMode,
    maturityDate: dateIdOrNull(row.maturityDate),
    liquidity: row.liquidity,
    liquidityDate: dateIdOrNull(row.liquidityDate),
    targetAllocationPct:
      row.targetAllocationPct != null ? decNum(row.targetAllocationPct) : null,
    targetBuyPrice: row.targetBuyPrice != null ? decNum(row.targetBuyPrice) : null,
    targetSellPrice: row.targetSellPrice != null ? decNum(row.targetSellPrice) : null,
  };
}

function toSnapshotDto(row: SnapshotRecord): SnapshotDto {
  return {
    id: row.id,
    assetId: row.assetId,
    monthId: row.monthId,
    amount: moneyToNumber(money(decNum(row.amount))),
    usdRate: moneyToNumber(money(decNum(row.usdRate))),
    yieldAmount: moneyToNumber(money(decNum(row.yieldAmount))),
    manualOverride: Boolean(row.manualOverride),
    rateAppliedMonthId: row.rateAppliedMonthId,
  };
}

function supportsPriceTargets(type: string): boolean {
  return type === 'Renda Variável' || type === 'Cripto';
}

function isAutoEquity(asset: AssetRecord): boolean {
  return (
    asset.type === 'Renda Variável' &&
    (asset.currency === 'BRL' || asset.currency === 'USD') &&
    asset.priceSource === 'brapi' &&
    Boolean(asset.ticker && String(asset.ticker).trim())
  );
}

function isAutoFixedIncome(asset: AssetRecord): boolean {
  return (
    asset.type === 'Renda Fixa' &&
    asset.currency === 'BRL' &&
    asset.fixedIncomeMode === 'auto' &&
    Boolean(asset.fixedIncomeIndex) &&
    asset.fixedIncomeRate != null &&
    decNum(asset.fixedIncomeRate) > 0
  );
}

const noopQuotes: QuotesProvider = {
  async fetchQuotes() {
    return [];
  },
};

const noopRates: RatesProvider = {
  async fetchMonthRates(monthId) {
    return { monthId, cdi: null, selic: null, ipca: null };
  },
};

export class InvestmentService {
  constructor(
    private readonly repo: InvestmentRepositoryPort,
    private readonly quotes: QuotesProvider = noopQuotes,
    private readonly rates: RatesProvider = noopRates,
    private readonly todayMonthIdFn: () => string = () => toMonthId(new Date()),
  ) {}

  async listAssets(userId: string): Promise<AssetDto[]> {
    const rows = await this.repo.listAssets(userId);
    return rows.map(toAssetDto);
  }

  async createAsset(userId: string, body: CreateAssetBody): Promise<AssetDto> {
    const type = body.type;
    const created = await this.repo.createAsset({
      userId,
      name: body.name.trim(),
      type,
      institution: body.institution.trim(),
      currency: body.currency,
      ticker: body.ticker?.trim().toUpperCase() || null,
      quantity: body.quantity != null ? moneyToString(money(body.quantity), 6) : null,
      priceSource: body.priceSource ?? null,
      lastPrice: body.lastPrice != null ? moneyToString(money(body.lastPrice)) : null,
      lastPriceAt: body.lastPriceAt ? new Date(body.lastPriceAt) : null,
      fixedIncomeIndex: body.fixedIncomeIndex ?? null,
      fixedIncomeRate:
        body.fixedIncomeRate != null ? moneyToString(money(body.fixedIncomeRate), 6) : null,
      fixedIncomeMode: body.fixedIncomeMode ?? null,
      maturityDate: toDateOrNull(body.maturityDate ?? null),
      liquidity: body.liquidity ?? null,
      liquidityDate: toDateOrNull(body.liquidityDate ?? null),
      targetAllocationPct:
        body.targetAllocationPct != null
          ? moneyToString(money(body.targetAllocationPct), 4)
          : null,
      targetBuyPrice:
        supportsPriceTargets(type) && body.targetBuyPrice != null
          ? moneyToString(money(body.targetBuyPrice))
          : null,
      targetSellPrice:
        supportsPriceTargets(type) && body.targetSellPrice != null
          ? moneyToString(money(body.targetSellPrice))
          : null,
    });
    await writeAuditLog({
      userId,
      action: 'create',
      entityType: 'investment_asset',
      entityId: created.id,
      metadata: { type },
    });
    return toAssetDto(created);
  }

  async updateAsset(userId: string, id: string, body: UpdateAssetBody): Promise<AssetDto> {
    const current = await this.repo.findAssetById(id, userId);
    if (!current) throw new NotFoundError('Investment asset not found');

    const nextType = body.type ?? current.type;
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.type !== undefined) data.type = body.type;
    if (body.institution !== undefined) data.institution = body.institution.trim();
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.ticker !== undefined) data.ticker = body.ticker?.trim().toUpperCase() || null;
    if (body.quantity !== undefined) {
      data.quantity = body.quantity != null ? moneyToString(money(body.quantity), 6) : null;
    }
    if (body.priceSource !== undefined) data.priceSource = body.priceSource;
    if (body.lastPrice !== undefined) {
      data.lastPrice = body.lastPrice != null ? moneyToString(money(body.lastPrice)) : null;
    }
    if (body.lastPriceAt !== undefined) {
      data.lastPriceAt = body.lastPriceAt ? new Date(body.lastPriceAt) : null;
    }
    if (body.fixedIncomeIndex !== undefined) data.fixedIncomeIndex = body.fixedIncomeIndex;
    if (body.fixedIncomeRate !== undefined) {
      data.fixedIncomeRate =
        body.fixedIncomeRate != null ? moneyToString(money(body.fixedIncomeRate), 6) : null;
    }
    if (body.fixedIncomeMode !== undefined) data.fixedIncomeMode = body.fixedIncomeMode;
    if (body.maturityDate !== undefined) data.maturityDate = toDateOrNull(body.maturityDate);
    if (body.liquidity !== undefined) data.liquidity = body.liquidity;
    if (body.liquidityDate !== undefined) data.liquidityDate = toDateOrNull(body.liquidityDate);
    if (body.targetAllocationPct !== undefined) {
      data.targetAllocationPct =
        body.targetAllocationPct != null
          ? moneyToString(money(body.targetAllocationPct), 4)
          : null;
    }
    if (body.targetBuyPrice !== undefined) {
      data.targetBuyPrice =
        body.targetBuyPrice != null ? moneyToString(money(body.targetBuyPrice)) : null;
    }
    if (body.targetSellPrice !== undefined) {
      data.targetSellPrice =
        body.targetSellPrice != null ? moneyToString(money(body.targetSellPrice)) : null;
    }
    if (nextType === 'Renda Fixa') {
      data.targetBuyPrice = null;
      data.targetSellPrice = null;
    }

    const updated = await this.repo.updateAsset(id, userId, data);
    if (!updated) throw new NotFoundError('Investment asset not found');
    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'investment_asset',
      entityId: id,
      metadata: null,
    });
    return toAssetDto(updated);
  }

  async deleteAsset(userId: string, id: string): Promise<void> {
    const current = await this.repo.findAssetById(id, userId);
    if (!current) throw new NotFoundError('Investment asset not found');
    const ok = await this.repo.deleteAsset(id, userId);
    if (!ok) throw new NotFoundError('Investment asset not found');
    await writeAuditLog({
      userId,
      action: 'delete',
      entityType: 'investment_asset',
      entityId: id,
      metadata: null,
    });
  }

  async listSnapshots(userId: string, monthId?: string): Promise<SnapshotDto[]> {
    const rows = await this.repo.listSnapshots(userId, { monthId });
    return rows.map(toSnapshotDto);
  }

  async upsertSnapshot(userId: string, body: UpsertSnapshotBody): Promise<SnapshotDto | null> {
    const today = this.todayMonthIdFn();
    if (body.monthId > today) {
      // Future months: display-only — do not persist (parity with store)
      return null;
    }
    const asset = await this.repo.findAssetById(body.assetId, userId);
    if (!asset) throw new NotFoundError('Investment asset not found');

    const saved = await this.repo.upsertSnapshot({
      userId,
      assetId: body.assetId,
      monthId: body.monthId,
      amount: moneyToString(money(body.amount)),
      usdRate: moneyToString(money(body.usdRate ?? 0)),
      yieldAmount: moneyToString(money(body.yieldAmount ?? 0)),
      manualOverride: body.manualOverride ?? false,
      rateAppliedMonthId: body.rateAppliedMonthId ?? null,
    });
    await writeAuditLog({
      userId,
      action: 'update',
      entityType: 'investment_snapshot',
      entityId: saved.id,
      metadata: { monthId: body.monthId },
    });
    return toSnapshotDto(saved);
  }

  /**
   * Sync portfolio from investment-category expense aporte.
   * Decimal money; ownership enforced via asset lookup.
   */
  async applyAporte(userId: string, body: ApplyAporteBody): Promise<SnapshotDto> {
    if (body.category != null && !isInvestmentCategory(body.category)) {
      throw new ValidationError('Category is not an investment aporte');
    }
    const deltaBRL = body.deltaBRL;
    const sharesBought = body.sharesBought;
    if (
      (!(deltaBRL && Number.isFinite(deltaBRL)) || deltaBRL === 0) &&
      !(sharesBought != null && sharesBought !== 0)
    ) {
      throw new ValidationError('deltaBRL or sharesBought required');
    }

    const asset = await this.repo.findAssetById(body.assetId, userId);
    if (!asset) throw new NotFoundError('Investment asset not found');

    const monthId = body.monthId;
    const currency = asset.currency;

    // Auto equity (brapi): adjust quantity then amount = qty × price
    if (
      asset.priceSource === 'brapi' &&
      asset.ticker &&
      (currency === 'BRL' || currency === 'USD')
    ) {
      let shareDelta =
        sharesBought != null && Number.isFinite(Number(sharesBought))
          ? Number(sharesBought)
          : null;
      if (shareDelta == null) {
        const px = asset.lastPrice != null && decNum(asset.lastPrice) > 0 ? decNum(asset.lastPrice) : null;
        if (px && deltaBRL) {
          if (currency === 'USD') {
            const rate =
              body.purchaseUsdRate != null && body.purchaseUsdRate > 0
                ? body.purchaseUsdRate
                : 5.5;
            shareDelta = money(deltaBRL).div(rate).div(px).toNumber();
          } else {
            shareDelta = money(deltaBRL).div(px).toNumber();
          }
        }
      }
      if (shareDelta == null || !Number.isFinite(shareDelta)) {
        throw new ValidationError('sharesBought required for auto equity aporte');
      }

      const prevQty = decNum(asset.quantity);
      const nextQty = Math.max(
        0,
        money(prevQty).plus(shareDelta).toDecimalPlaces(6).toNumber(),
      );
      let unitPrice =
        asset.lastPrice != null && decNum(asset.lastPrice) > 0 ? decNum(asset.lastPrice) : 0;
      if (!(unitPrice > 0) && Math.abs(shareDelta) > 1e-9) {
        if (currency === 'USD') {
          const rate =
            body.purchaseUsdRate != null && body.purchaseUsdRate > 0
              ? body.purchaseUsdRate
              : 5.5;
          unitPrice = money(deltaBRL).div(rate).div(shareDelta).abs().toNumber();
        } else {
          unitPrice = money(deltaBRL).div(shareDelta).abs().toNumber();
        }
      }
      const nextAmount = moneyToNumber(
        money(Math.max(0, money(nextQty).mul(unitPrice).toNumber())),
      );

      await this.repo.updateAsset(asset.id, userId, {
        quantity: moneyToString(money(nextQty), 6),
      });

      const existing = await this.repo.findSnapshot(asset.id, monthId, userId);
      let snapUsdRate = 0;
      if (currency === 'USD') {
        if (existing && decNum(existing.usdRate) > 0) {
          snapUsdRate = decNum(existing.usdRate);
        } else {
          const prev = await this.repo.findSnapshot(asset.id, prevMonthId(monthId), userId);
          snapUsdRate =
            prev && decNum(prev.usdRate) > 0 ? decNum(prev.usdRate) : 5.5;
        }
      }

      const saved = await this.repo.upsertSnapshot({
        userId,
        assetId: asset.id,
        monthId,
        amount: moneyToString(money(nextAmount)),
        usdRate: moneyToString(money(snapUsdRate)),
        yieldAmount: existing ? moneyToString(money(decNum(existing.yieldAmount))) : '0.00',
        manualOverride: existing?.manualOverride ?? false,
        rateAppliedMonthId: existing?.rateAppliedMonthId ?? null,
      });
      return toSnapshotDto(saved);
    }

    // Cash / RF / manual: amount += delta (USD converts via purchase rate)
    const existing = await this.repo.findSnapshot(asset.id, monthId, userId);
    const existingAmount = existing ? decNum(existing.amount) : null;
    const needsInherit = !existing || existingAmount === 0;

    let prevAmount = 0;
    let prevUsdRate: number | null = null;
    if (needsInherit) {
      const prev = await this.repo.findSnapshot(asset.id, prevMonthId(monthId), userId);
      if (prev) {
        prevAmount = decNum(prev.amount);
        if (decNum(prev.usdRate) > 0) prevUsdRate = decNum(prev.usdRate);
      }
    }

    const marketRate =
      existing && decNum(existing.usdRate) > 0
        ? decNum(existing.usdRate)
        : prevUsdRate != null && prevUsdRate > 0
          ? prevUsdRate
          : 5.5;

    const convertRate =
      body.purchaseUsdRate != null && body.purchaseUsdRate > 0
        ? body.purchaseUsdRate
        : marketRate > 0
          ? marketRate
          : 5.5;

    const currentAmount =
      existingAmount != null && existingAmount > 0 ? existingAmount : prevAmount;
    const deltaAmount =
      currency === 'USD' ? money(deltaBRL).div(convertRate).toNumber() : deltaBRL;
    const nextAmount = moneyToNumber(
      money(Math.max(0, money(currentAmount).plus(deltaAmount).toNumber())),
    );

    const saved = await this.repo.upsertSnapshot({
      userId,
      assetId: asset.id,
      monthId,
      amount: moneyToString(money(nextAmount)),
      usdRate: moneyToString(money(currency === 'USD' ? marketRate : 0)),
      yieldAmount: existing ? moneyToString(money(decNum(existing.yieldAmount))) : '0.00',
      manualOverride: existing?.manualOverride ?? false,
      rateAppliedMonthId: existing?.rateAppliedMonthId ?? null,
    });
    return toSnapshotDto(saved);
  }

  async refreshEquityQuotes(
    userId: string,
    body: RefreshEquityBody = {},
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    const todayMonthId = this.todayMonthIdFn();
    const assets = (await this.repo.listAssets(userId)).filter(isAutoEquity);
    if (assets.length === 0) return { updated: 0, errors: [] };

    let quotes: MarketQuote[] = body.quotes ?? [];
    if (!body.quotes) {
      quotes = await this.quotes.fetchQuotes(
        assets.map((a) => ({
          symbol: String(a.ticker).trim().toUpperCase(),
          market: a.currency === 'USD' ? ('US' as const) : ('B3' as const),
        })),
      );
    }

    const byKey = new Map(
      quotes.map((q) => [`${q.market || 'B3'}:${q.symbol.toUpperCase()}`, q]),
    );

    const usdAssets = assets.filter((a) => a.currency === 'USD');
    const existingUsdRates = new Map<string, number>();
    if (usdAssets.length > 0) {
      const snaps = await this.repo.listSnapshots(userId, {
        monthId: todayMonthId,
        assetIds: usdAssets.map((a) => a.id),
      });
      for (const s of snaps) {
        if (decNum(s.usdRate) > 0) existingUsdRates.set(s.assetId, decNum(s.usdRate));
      }
      if (existingUsdRates.size === 0) {
        const prevSnaps = await this.repo.listSnapshots(userId, {
          monthId: prevMonthId(todayMonthId),
          assetIds: usdAssets.map((a) => a.id),
        });
        for (const s of prevSnaps) {
          if (decNum(s.usdRate) > 0) existingUsdRates.set(s.assetId, decNum(s.usdRate));
        }
      }
    }
    const fallbackUsdRate =
      [...existingUsdRates.values()].find((r) => r > 0) ?? 5.5;

    let updated = 0;
    const now = new Date();
    for (const asset of assets) {
      const ticker = String(asset.ticker).trim().toUpperCase();
      const market = asset.currency === 'USD' ? 'US' : 'B3';
      const q = byKey.get(`${market}:${ticker}`);
      if (!q || q.price == null || !(q.price > 0)) {
        errors.push(`${ticker}: ${q?.error || 'sem preço'}`);
        continue;
      }
      const qty = decNum(asset.quantity);
      const nextAmount = moneyToNumber(money(qty).mul(q.price));
      const snapUsdRate =
        asset.currency === 'USD'
          ? existingUsdRates.get(asset.id) && existingUsdRates.get(asset.id)! > 0
            ? existingUsdRates.get(asset.id)!
            : fallbackUsdRate
          : 0;

      await this.repo.updateAsset(asset.id, userId, {
        lastPrice: moneyToString(money(q.price)),
        lastPriceAt: now,
      });
      await this.repo.upsertSnapshot({
        userId,
        assetId: asset.id,
        monthId: todayMonthId,
        amount: moneyToString(money(nextAmount)),
        usdRate: moneyToString(money(snapUsdRate)),
        yieldAmount: '0.00',
      });
      updated += 1;
    }
    return { updated, errors };
  }

  /**
   * Apply BCB (or injected) index factor to auto RF assets.
   * Idempotent via rate_applied_month_id === todayMonthId.
   */
  async refreshFixedIncome(
    userId: string,
    body: RefreshFixedIncomeBody = {},
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    const todayMonthId = body.monthId ?? this.todayMonthIdFn();
    const prevId = prevMonthId(todayMonthId);
    const assets = (await this.repo.listAssets(userId)).filter(isAutoFixedIncome);
    if (assets.length === 0) return { updated: 0, errors: [] };

    let rates: MonthIndexRates;
    if (body.rates) {
      rates = { monthId: todayMonthId, ...body.rates };
    } else {
      const fetched = await this.rates.fetchMonthRates(todayMonthId);
      rates = fetched;
    }

    const snaps = await this.repo.listSnapshots(userId, {
      // filter in memory for both months
    });
    const snapFor = (assetId: string, monthId: string) =>
      snaps.find((s) => s.assetId === assetId && s.monthId === monthId);

    let updated = 0;
    for (const asset of assets) {
      const index = asset.fixedIncomeIndex as FixedIncomeIndex;
      const ratePct = decNum(asset.fixedIncomeRate);
      const cur = snapFor(asset.id, todayMonthId);
      if (cur?.manualOverride) continue;
      if (cur?.rateAppliedMonthId === todayMonthId) continue; // idempotent

      const factor = monthFactor(index, ratePct, rates);
      if (factor == null) {
        errors.push(`${asset.name}: índice ${index} indisponível para ${todayMonthId}`);
        continue;
      }

      const prev = snapFor(asset.id, prevId);
      const prevAmount = prev != null ? decNum(prev.amount) : 0;
      if (!(prevAmount > 0) && !(cur && decNum(cur.amount) > 0)) continue;

      const base =
        cur && decNum(cur.amount) > 0 && cur.rateAppliedMonthId !== todayMonthId
          ? (() => {
              const curAmt = decNum(cur.amount);
              const aportesExtra = Math.max(0, money(curAmt).minus(prevAmount).toNumber());
              return money(prevAmount).mul(money(1).plus(factor)).plus(aportesExtra).toNumber();
            })()
          : money(prevAmount).mul(money(1).plus(factor)).toNumber();

      const nextAmount = moneyToNumber(money(base));
      const yieldAmount = moneyToNumber(money(nextAmount).minus(prevAmount));

      await this.repo.upsertSnapshot({
        userId,
        assetId: asset.id,
        monthId: todayMonthId,
        amount: moneyToString(money(nextAmount)),
        usdRate: '0.00',
        yieldAmount: moneyToString(money(yieldAmount)),
        manualOverride: false,
        rateAppliedMonthId: todayMonthId,
      });
      updated += 1;
    }
    return { updated, errors };
  }

  async ensureMonthSnapshots(
    userId: string,
    body: EnsureMonthBody,
  ): Promise<{ seeded: number; deletedFuture: number }> {
    const todayMonthId = this.todayMonthIdFn();
    const deletedFuture = await this.repo.deleteFutureSnapshots(userId, todayMonthId);
    if (body.monthId > todayMonthId) {
      return { seeded: 0, deletedFuture };
    }

    const prevId = prevMonthId(body.monthId);
    const [assets, prevSnaps, currSnaps] = await Promise.all([
      this.repo.listAssets(userId),
      this.repo.listSnapshots(userId, { monthId: prevId }),
      this.repo.listSnapshots(userId, { monthId: body.monthId }),
    ]);
    if (!assets.length || !prevSnaps.length) {
      return { seeded: 0, deletedFuture };
    }

    const assetIds = new Set(assets.map((a) => a.id));
    const currByAsset = new Map(currSnaps.map((s) => [s.assetId, s]));
    const toInsert = [];
    for (const prev of prevSnaps) {
      if (!assetIds.has(prev.assetId)) continue;
      const prevAmount = decNum(prev.amount);
      if (prevAmount <= 0) continue;
      if (currByAsset.has(prev.assetId)) continue;
      toInsert.push({
        userId,
        assetId: prev.assetId,
        monthId: body.monthId,
        amount: moneyToString(money(prevAmount)),
        usdRate: moneyToString(money(decNum(prev.usdRate))),
        yieldAmount: '0.00',
      });
    }
    const seeded =
      toInsert.length > 0 ? await this.repo.insertSnapshotsIgnoreDuplicates(toInsert) : 0;
    return { seeded, deletedFuture };
  }
}
