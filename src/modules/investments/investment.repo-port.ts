export type DecimalLike = { toString(): string } | string | number;

export type AssetRecord = {
  id: string;
  userId: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  ticker: string | null;
  quantity: DecimalLike | null;
  priceSource: string | null;
  lastPrice: DecimalLike | null;
  lastPriceAt: Date | string | null;
  fixedIncomeIndex: string | null;
  fixedIncomeRate: DecimalLike | null;
  fixedIncomeMode: string | null;
  maturityDate: Date | string | null;
  liquidity: string | null;
  liquidityDate: Date | string | null;
  targetAllocationPct: DecimalLike | null;
  targetBuyPrice: DecimalLike | null;
  targetSellPrice: DecimalLike | null;
  createdAt?: Date | string | null;
};

export type SnapshotRecord = {
  id: string;
  assetId: string;
  userId: string;
  monthId: string;
  amount: DecimalLike;
  usdRate: DecimalLike | null;
  yieldAmount: DecimalLike | null;
  manualOverride: boolean | null;
  rateAppliedMonthId: string | null;
  createdAt?: Date | string | null;
};

export type AssetCreateInput = {
  userId: string;
  name: string;
  type: string;
  institution: string;
  currency: string;
  ticker?: string | null;
  quantity?: string | null;
  priceSource?: string | null;
  lastPrice?: string | null;
  lastPriceAt?: Date | null;
  fixedIncomeIndex?: string | null;
  fixedIncomeRate?: string | null;
  fixedIncomeMode?: string | null;
  maturityDate?: Date | null;
  liquidity?: string | null;
  liquidityDate?: Date | null;
  targetAllocationPct?: string | null;
  targetBuyPrice?: string | null;
  targetSellPrice?: string | null;
};

export type AssetUpdateData = Partial<{
  name: string;
  type: string;
  institution: string;
  currency: string;
  ticker: string | null;
  quantity: string | null;
  priceSource: string | null;
  lastPrice: string | null;
  lastPriceAt: Date | null;
  fixedIncomeIndex: string | null;
  fixedIncomeRate: string | null;
  fixedIncomeMode: string | null;
  maturityDate: Date | null;
  liquidity: string | null;
  liquidityDate: Date | null;
  targetAllocationPct: string | null;
  targetBuyPrice: string | null;
  targetSellPrice: string | null;
}>;

export type SnapshotUpsertInput = {
  userId: string;
  assetId: string;
  monthId: string;
  amount: string;
  usdRate?: string | null;
  yieldAmount?: string | null;
  manualOverride?: boolean;
  rateAppliedMonthId?: string | null;
};

export interface InvestmentRepositoryPort {
  listAssets(userId: string): Promise<AssetRecord[]>;
  findAssetById(id: string, userId: string): Promise<AssetRecord | null>;
  createAsset(data: AssetCreateInput): Promise<AssetRecord>;
  updateAsset(id: string, userId: string, data: AssetUpdateData): Promise<AssetRecord | null>;
  deleteAsset(id: string, userId: string): Promise<boolean>;

  listSnapshots(
    userId: string,
    opts?: { monthId?: string; assetIds?: string[] },
  ): Promise<SnapshotRecord[]>;
  findSnapshot(
    assetId: string,
    monthId: string,
    userId: string,
  ): Promise<SnapshotRecord | null>;
  upsertSnapshot(data: SnapshotUpsertInput): Promise<SnapshotRecord>;
  insertSnapshotsIgnoreDuplicates(rows: SnapshotUpsertInput[]): Promise<number>;
  deleteFutureSnapshots(userId: string, todayMonthId: string): Promise<number>;
}

export type MarketQuote = {
  symbol: string;
  price: number | null;
  market?: 'B3' | 'US';
  error?: string;
};

export type QuotesProvider = {
  fetchQuotes(
    requests: { symbol: string; market: 'B3' | 'US' }[],
  ): Promise<MarketQuote[]>;
};

export type RatesProvider = {
  fetchMonthRates(monthId: string): Promise<{
    monthId: string;
    cdi: number | null;
    selic: number | null;
    ipca: number | null;
  }>;
};
