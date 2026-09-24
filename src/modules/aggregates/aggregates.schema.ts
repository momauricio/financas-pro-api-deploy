import { z } from 'zod';

export const monthIdQuerySchema = z.object({
  monthId: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'monthId must be YYYY-MM')
    .optional(),
});

export const baselinesQuerySchema = monthIdQuerySchema.extend({
  period: z
    .enum(['last60d', 'last90d', 'last6', 'last9', 'last12', 'lastYear'])
    .default('last6'),
});

export const healthRulesQuerySchema = z.object({
  category: z.string().optional().default(''),
});
