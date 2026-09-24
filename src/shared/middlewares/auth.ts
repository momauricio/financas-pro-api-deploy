import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../errors/index.js';

export type AuthUser = {
  id: string;
  email?: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const url = new URL('/auth/v1/.well-known/jwks.json', env().SUPABASE_URL);
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

function userFromPayload(payload: { sub?: string; email?: unknown }): AuthUser {
  const sub = payload.sub;
  if (!sub) {
    throw new UnauthorizedError('Token missing subject');
  }
  return {
    id: sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
  };
}

/**
 * Validates Supabase Auth JWT from Authorization: Bearer <token>.
 * Finanças-pro signs user tokens with ES256 — prefer JWKS.
 * Optional SUPABASE_JWT_SECRET enables HS256 for classic/legacy projects.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (env().AUTH_BYPASS_FOR_TESTS && env().NODE_ENV === 'test') {
    const bypassId = request.headers['x-test-user-id'];
    if (typeof bypassId === 'string' && bypassId.length > 0) {
      request.user = { id: bypassId, email: 'test@example.com' };
      return;
    }
  }

  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing Bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Empty Bearer token');
  }

  // Prefer JWKS (ES256) — this project's Auth signing keys.
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      algorithms: ['ES256'],
    });
    request.user = userFromPayload(payload);
    return;
  } catch {
    // fall through to optional HS256
  }

  const jwtSecret = env().SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });
      request.user = userFromPayload(payload);
      return;
    } catch {
      // invalid
    }
  }

  throw new UnauthorizedError('Invalid or expired token');
}
