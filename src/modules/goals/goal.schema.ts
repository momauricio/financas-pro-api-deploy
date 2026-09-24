import { z } from 'zod';

/** YYYY-MM */
const monthIdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'monthId must be YYYY-MM');

const categorySchema = z.string().trim().min(1).max(120);

const amountSchema = z.coerce.number().finite();

export const upsertGoalBodySchema = z
  .object({
    monthId: monthIdSchema,
    category: categorySchema,
    amount: amountSchema,
  })
  .strict();

export const upsertGoalsBatchBodySchema = z
  .object({
    monthId: monthIdSchema,
    goals: z
      .array(
        z
          .object({
            category: categorySchema,
            amount: amountSchema,
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const listGoalsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(100),
    monthId: monthIdSchema.optional(),
  })
  .strict();

export type UpsertGoalBody = z.infer<typeof upsertGoalBodySchema>;
export type UpsertGoalsBatchBody = z.infer<typeof upsertGoalsBatchBodySchema>;
