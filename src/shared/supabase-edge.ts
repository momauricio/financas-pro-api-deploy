import { env } from '../config/env.js';
import { AppError, UpstreamError } from './errors/index.js';

function edgeApiKey(): string {
  const config = env();
  const key = config.SUPABASE_ANON_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new AppError(
      'Edge proxy misconfigured: set SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) on the API',
      503,
      'EDGE_PROXY_MISCONFIGURED',
    );
  }
  return key;
}

function edgeErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.error === 'string' && b.error.trim()) return b.error;
    if (typeof b.message === 'string' && b.message.trim()) return b.message;
    if (
      typeof b.error === 'object' &&
      b.error !== null &&
      typeof (b.error as { message?: unknown }).message === 'string'
    ) {
      return (b.error as { message: string }).message;
    }
  }
  return fallback;
}

/**
 * Server-side call to a Supabase Edge Function.
 * Forwards the caller's JWT so the edge still runs requireUser / ownership checks.
 * Secrets (APIFY_TOKEN, service role inside the edge) never leave the edge runtime.
 */
export async function invokeSupabaseEdge<T = unknown>(
  functionName: string,
  opts: {
    accessToken: string;
    body?: unknown;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  },
): Promise<T> {
  const config = env();
  const base = config.SUPABASE_URL.replace(/\/+$/, '');
  const url = `${base}/functions/v1/${functionName}`;

  const res = await fetch(url, {
    method: opts.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      apikey: edgeApiKey(),
      'Content-Type': 'application/json',
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text };
    }
  }

  if (!res.ok) {
    throw new UpstreamError(
      edgeErrorMessage(json, `Edge ${functionName} failed (${res.status})`),
      res.status >= 400 && res.status < 600 ? res.status : 502,
    );
  }

  return json as T;
}
