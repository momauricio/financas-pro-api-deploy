import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  /** Comma-separated allowlist of front-end origins. */
  CORS_ORIGIN: z.string().min(1),
  /** Prefer Supabase pooler :6543 + ?pgbouncer=true&sslmode=require */
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  /**
   * Optional. Finanças-pro Auth uses ES256 JWKS — leave empty and verify via
   * `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Set only for HS256 legacy.
   */
  SUPABASE_JWT_SECRET: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === '' || v.startsWith('YOUR_')) return undefined;
      return v;
    }),
  AUTH_BYPASS_FOR_TESTS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — clears memoized env. */
export function resetEnvCache(): void {
  cached = null;
}

export function env(): Env {
  if (!cached) {
    return loadEnv();
  }
  return cached;
}
