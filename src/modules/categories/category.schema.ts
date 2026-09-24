import { z } from 'zod';

export const categoryTypeSchema = z.enum(['income', 'expense']);

export const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: categoryTypeSchema,
    color: z.string().trim().min(1).max(32).default('#4f46e5'),
    active: z.boolean().default(true),
  })
  .strict();

export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    type: categoryTypeSchema.optional(),
    color: z.string().trim().min(1).max(32).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'At least one field required' });

export const categoryIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listCategoriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    active: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  })
  .strict();

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
