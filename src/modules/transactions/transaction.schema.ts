import { z } from 'zod';

const dateIdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'date must be YYYY-MM-DD');

const monthIdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'monthId must be YYYY-MM');

const uuidSchema = z.string().uuid();

const paymentMethodSchema = z.enum(['Crédito', 'Débito', 'Pix', 'Dinheiro']);

const installmentsInputSchema = z
  .object({
    total: z.coerce.number().int().min(1).max(360),
  })
  .strict();

export const createTransactionBodySchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    amount: z.coerce.number().finite(),
    category: z.string().trim().min(1).max(120),
    date: dateIdSchema,
    isPaid: z.boolean().default(false),
    type: z.enum(['income', 'expense']),
    isFixed: z.boolean().default(false),
    installments: installmentsInputSchema.optional(),
    paymentMethod: paymentMethodSchema.optional().nullable(),
    cardId: uuidSchema.optional().nullable(),
    invoiceMonthId: monthIdSchema.optional().nullable(),
    refundOfTransactionId: uuidSchema.optional().nullable(),
    investmentAssetId: uuidSchema.optional().nullable(),
    purchaseUsdRate: z.coerce.number().finite().positive().optional().nullable(),
    sharesBought: z.coerce.number().finite().optional().nullable(),
    /** Client-generated key for create idempotency (optional). */
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict()
  .refine((b) => !(b.isFixed && b.installments && b.installments.total > 1), {
    message: 'isFixed and installments.total > 1 are mutually exclusive',
  });

export const updateTransactionBodySchema = z
  .object({
    description: z.string().trim().min(1).max(500).optional(),
    amount: z.coerce.number().finite().optional(),
    category: z.string().trim().min(1).max(120).optional(),
    date: dateIdSchema.optional(),
    isPaid: z.boolean().optional(),
    type: z.enum(['income', 'expense']).optional(),
    isFixed: z.boolean().optional(),
    installments: z
      .object({
        current: z.coerce.number().int().min(1),
        total: z.coerce.number().int().min(1).max(360),
      })
      .strict()
      .optional()
      .nullable(),
    paymentMethod: paymentMethodSchema.optional().nullable(),
    cardId: uuidSchema.optional().nullable(),
    invoiceMonthId: monthIdSchema.optional().nullable(),
    refundOfTransactionId: uuidSchema.optional().nullable(),
    investmentAssetId: uuidSchema.optional().nullable(),
    purchaseUsdRate: z.coerce.number().finite().positive().optional().nullable(),
    sharesBought: z.coerce.number().finite().optional().nullable(),
    scope: z.enum(['current', 'future', 'past', 'all']).default('current'),
  })
  .strict()
  .refine(
    (b) =>
      Object.keys(b).some((k) => k !== 'scope'),
    { message: 'At least one field required' },
  );

export const deleteTransactionBodySchema = z
  .object({
    scope: z.enum(['current', 'future', 'past', 'all']).default('current'),
  })
  .strict();

export const replicateTransactionBodySchema = z
  .object({
    monthIds: z.array(monthIdSchema).min(1).max(36),
  })
  .strict();

export const transactionIdParamsSchema = z
  .object({
    id: uuidSchema,
  })
  .strict();

export const listTransactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(100),
    monthId: monthIdSchema.optional(),
    invoiceMonthId: monthIdSchema.optional(),
  })
  .strict();

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;
export type UpdateTransactionBody = z.infer<typeof updateTransactionBodySchema>;
export type DeleteTransactionBody = z.infer<typeof deleteTransactionBodySchema>;
export type ReplicateTransactionBody = z.infer<typeof replicateTransactionBodySchema>;
