import { z } from 'zod';

/** YYYY-MM */
const monthIdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'monthId must be YYYY-MM');

export const upsertInvoicePaymentBodySchema = z
  .object({
    cardId: z.string().uuid(),
    monthId: monthIdSchema,
    isPaid: z.boolean(),
  })
  .strict();

export const listInvoicePaymentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(100),
    monthId: monthIdSchema.optional(),
    cardId: z.string().uuid().optional(),
  })
  .strict();

export type UpsertInvoicePaymentBody = z.infer<typeof upsertInvoicePaymentBodySchema>;
