import { z } from 'zod';

const monthIdSchema = z.string().regex(/^\d{4}-\d{2}$/);
const uuidSchema = z.string().uuid();
const moneySchema = z.number().finite();
const optionalMoney = z.number().finite().nullable().optional();

export const investmentTypeSchema = z.enum(['Renda Fixa', 'Renda Variável', 'Cripto']);
export const currencySchema = z.enum(['BRL', 'USD']);
export const fixedIncomeIndexSchema = z.enum(['cdi', 'selic', 'ipca', 'pre']);
export const fixedIncomeModeSchema = z.enum(['auto', 'manual']);
export const priceSourceSchema = z.enum(['manual', 'brapi']);
export const liquiditySchema = z.enum(['daily', 'maturity', 'after_date']);

export const createAssetBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: investmentTypeSchema,
    institution: z.string().trim().min(1).max(200),
    currency: currencySchema.default('BRL'),
    ticker: z.string().trim().max(32).nullable().optional(),
    quantity: optionalMoney,
    priceSource: priceSourceSchema.nullable().optional(),
    lastPrice: optionalMoney,
    lastPriceAt: z.string().datetime().nullable().optional(),
    fixedIncomeIndex: fixedIncomeIndexSchema.nullable().optional(),
    fixedIncomeRate: optionalMoney,
    fixedIncomeMode: fixedIncomeModeSchema.nullable().optional(),
    maturityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    liquidity: liquiditySchema.nullable().optional(),
    liquidityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    targetAllocationPct: optionalMoney,
    targetBuyPrice: optionalMoney,
    targetSellPrice: optionalMoney,
  })
  .strict();

export const updateAssetBodySchema = createAssetBodySchema
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field required' });

export const assetIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const listSnapshotsQuerySchema = z
  .object({
    monthId: monthIdSchema.optional(),
  })
  .strict();

export const upsertSnapshotBodySchema = z
  .object({
    assetId: uuidSchema,
    monthId: monthIdSchema,
    amount: moneySchema,
    usdRate: z.number().finite().optional().default(0),
    yieldAmount: z.number().finite().optional().default(0),
    manualOverride: z.boolean().optional().default(false),
    rateAppliedMonthId: monthIdSchema.nullable().optional(),
  })
  .strict();

export const applyAporteBodySchema = z
  .object({
    assetId: uuidSchema,
    monthId: monthIdSchema,
    deltaBRL: z.number().finite(),
    purchaseUsdRate: z.number().finite().positive().nullable().optional(),
    sharesBought: z.number().finite().nullable().optional(),
    /** Optional: category of source expense — validated as investment when present. */
    category: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const refreshEquityBodySchema = z
  .object({
    /** Optional pre-fetched quotes (tests / offline). When omitted, QuotesProvider is used. */
    quotes: z
      .array(
        z.object({
          symbol: z.string().trim().min(1),
          price: z.number().finite().nullable(),
          market: z.enum(['B3', 'US']).optional(),
          error: z.string().optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const refreshFixedIncomeBodySchema = z
  .object({
    monthId: monthIdSchema.optional(),
    /** Optional override rates (tests). When omitted, RatesProvider (BCB) is used. */
    rates: z
      .object({
        cdi: z.number().finite().nullable(),
        selic: z.number().finite().nullable(),
        ipca: z.number().finite().nullable(),
      })
      .optional(),
  })
  .strict();

export const ensureMonthBodySchema = z
  .object({
    monthId: monthIdSchema,
  })
  .strict();

export type CreateAssetBody = z.infer<typeof createAssetBodySchema>;
export type UpdateAssetBody = z.infer<typeof updateAssetBodySchema>;
export type UpsertSnapshotBody = z.infer<typeof upsertSnapshotBodySchema>;
export type ApplyAporteBody = z.infer<typeof applyAporteBodySchema>;
export type RefreshEquityBody = z.infer<typeof refreshEquityBodySchema>;
export type RefreshFixedIncomeBody = z.infer<typeof refreshFixedIncomeBodySchema>;
export type EnsureMonthBody = z.infer<typeof ensureMonthBodySchema>;
