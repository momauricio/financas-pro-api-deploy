import { z } from 'zod';

const dayOfMonth = z.coerce.number().int().min(1).max(31);

export const createCreditCardBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().min(1).max(64).nullable().optional(),
    limit: z.coerce.number().finite().min(0).default(0),
    closingDay: dayOfMonth,
    dueDay: dayOfMonth,
    active: z.boolean().default(true),
  })
  .strict();

export const updateCreditCardBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    brand: z.string().trim().min(1).max(64).nullable().optional(),
    limit: z.coerce.number().finite().min(0).optional(),
    closingDay: dayOfMonth.optional(),
    dueDay: dayOfMonth.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field required' });

export const creditCardIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listCreditCardsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    active: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  })
  .strict();

export type CreateCreditCardBody = z.infer<typeof createCreditCardBodySchema>;
export type UpdateCreditCardBody = z.infer<typeof updateCreditCardBodySchema>;
