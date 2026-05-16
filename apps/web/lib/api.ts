import { NextResponse } from 'next/server';
import { type AccessScope, type Role, prisma, resolveScope } from '@roster/db';
import { err, ok, type ApiResult } from '@roster/types';
import { getServerAuthSession } from './auth';

// ---------------------------------------------------------------------------
// Thin helpers used by every API route. Keeps the routes themselves to just
// validation + business logic.
// ---------------------------------------------------------------------------

export type Ctx = {
  userId: string;
  email: string;
  orgId: string;
  scope: AccessScope;
};

/**
 * Resolves the authenticated user + active org + scope, or returns a 401/400.
 * Throws a typed `Response` that route handlers can pass through.
 */
export async function ctxOr401(): Promise<Ctx | Response> {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json(err('unauthorized', 'Sign in first.'), { status: 401 });
  }
  if (!session.user.activeOrgId) {
    return NextResponse.json(err('no_org', 'No active workspace.'), { status: 400 });
  }
  const scope = await resolveScope(session.user.id, session.user.activeOrgId);
  if (!scope) {
    return NextResponse.json(err('forbidden', 'Not a member of that workspace.'), {
      status: 403,
    });
  }
  return {
    userId: session.user.id,
    email: session.user.email!,
    orgId: session.user.activeOrgId,
    scope,
  };
}

export function isManager(role: Role): boolean {
  return role !== 'EMPLOYEE';
}

export function canWriteToTeam(scope: AccessScope, teamId: string): boolean {
  if (!isManager(scope.role)) return false;
  if (scope.teamIds === null) return true; // OWNER / ADMIN
  return scope.teamIds.includes(teamId);
}

export function json<T>(body: ApiResult<T>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export { ok, err };

// Audit log shortcut. Always returns void — never blocks the caller.
export async function audit(input: {
  orgId: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata as never,
      },
    });
  } catch {
    // Audit failures must never surface to the user.
  }
}
