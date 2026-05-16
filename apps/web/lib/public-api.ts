import { NextResponse } from 'next/server';
import { type AccessScope, resolveScope } from '@roster/db';
import { err, ok, type ApiResult } from '@roster/types';
import { verifyApiKey, type VerifiedKey } from './api-keys';
import { getServerAuthSession } from './auth';

// ---------------------------------------------------------------------------
// Auth helper for public-API routes under /api/v1.
//
// Resolves either:
//   - A Bearer API key (preferred for server-to-server callers), or
//   - An authenticated browser session (so the dashboard can hit /api/v1).
//
// Returns an `AccessScope` so the same query helpers work as on internal routes.
// ---------------------------------------------------------------------------

export type PublicCtx = {
  source: 'api_key' | 'session';
  orgId: string;
  scope: AccessScope;
  /** Set for session callers; null for API key callers. */
  userId: string | null;
  apiKey: VerifiedKey | null;
};

export async function authPublic(req: Request): Promise<PublicCtx | Response> {
  // 1) Bearer token.
  const authHeader = req.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = await verifyApiKey(token);
    if (!verified) {
      return NextResponse.json(err('unauthorized', 'Invalid API key.'), { status: 401 });
    }
    // API keys are owner-scoped: full org-wide read. Writes still respect
    // scope checks via canWriteToTeam (no team filter, so always allowed).
    const scope: AccessScope = {
      orgId: verified.orgId,
      role: 'OWNER',
      teamIds: null,
      branchIds: null,
    };
    return {
      source: 'api_key',
      orgId: verified.orgId,
      scope,
      userId: null,
      apiKey: verified,
    };
  }

  // 2) Browser session fallback.
  const session = await getServerAuthSession();
  if (!session?.user?.activeOrgId) {
    return NextResponse.json(err('unauthorized', 'Sign in or provide a valid API key.'), {
      status: 401,
    });
  }
  const scope = await resolveScope(session.user.id, session.user.activeOrgId);
  if (!scope) {
    return NextResponse.json(err('forbidden', 'Not a member of that workspace.'), {
      status: 403,
    });
  }
  return {
    source: 'session',
    orgId: session.user.activeOrgId,
    scope,
    userId: session.user.id,
    apiKey: null,
  };
}

export function publicJson<T>(body: ApiResult<T>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export { ok, err };

export function requireScope(ctx: PublicCtx, scope: string): Response | null {
  if (ctx.source !== 'api_key') return null;
  const scopes = ctx.apiKey?.scopes ?? [];
  // Empty scopes = full access (legacy / first-party tooling).
  if (scopes.length === 0) return null;
  if (!scopes.includes(scope)) {
    return publicJson(err('forbidden', `API key missing scope: ${scope}`), { status: 403 });
  }
  return null;
}
