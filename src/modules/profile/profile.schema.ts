import { z } from 'zod';

export const updateInitialBalanceBodySchema = z
  .object({
    initialBalance: z.coerce.number().finite(),
  })
  .strict();

export type UpdateInitialBalanceBody = z.infer<typeof updateInitialBalanceBodySchema>;
