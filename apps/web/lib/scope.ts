import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  prisma,
  resolveScope,
  type AccessScope,
} from '@roster/db';
import { getServerAuthSession } from './auth';
import { inAnyCidr } from './cidr';

// ---------------------------------------------------------------------------
// Server-only helpers for resolving the active session + scope.
// Use these at the top of any /app server component or route handler.
// ---------------------------------------------------------------------------

export type AuthenticatedContext = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  scope: AccessScope;
};

/**
 * Returns the current user's org scope, or redirects to /login or /signup/welcome
 * if they're unauthenticated / have no org yet.
 */
export async function requireScope(): Promise<AuthenticatedContext> {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');

  const userId = session.user.id;
  const email = session.user.email!;

  if (!session.user.activeOrgId) {
    redirect('/signup/welcome');
  }

  const scope = await resolveScope(userId, session.user.activeOrgId);
  if (!scope) {
    // Active org references a membership that no longer exists — push them
    // back to the welcome flow so they can pick or create a new workspace.
    redirect('/signup/welcome');
  }

  // Enterprise IP allowlist (Phase 8). Owners/admins are exempt so a
  // misconfiguration doesn't permanently lock the org out.
  if (scope.role !== 'OWNER' && scope.role !== 'ADMIN') {
    const allow = await prisma.ipAllowlistEntry.findMany({
      where: { orgId: session.user.activeOrgId },
      select: { cidr: true },
    });
    if (allow.length > 0) {
      const h = headers();
      const ip =
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        h.get('x-real-ip') ??
        '';
      if (!inAnyCidr(ip, allow.map((a) => a.cidr))) {
        redirect('/blocked');
      }
    }
  }

  return {
    userId,
    email,
    name: session.user.name ?? null,
    orgId: session.user.activeOrgId,
    scope,
  };
}

/**
 * Loads org + branch + team metadata for the user's current scope so the UI
 * can render selectors and breadcrumbs.
 */
export async function loadScopeContext(ctx: AuthenticatedContext) {
  const [org, memberships, branches, teams] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { id: true, name: true, slug: true, timezone: true, logoUrl: true },
    }),
    prisma.membership.findMany({
      where: { userId: ctx.userId },
      select: {
        orgId: true,
        org: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.branch.findMany({
      where: {
        orgId: ctx.orgId,
        // Branch managers see only their assigned branches; admins/owners see all.
        ...(ctx.scope.branchIds && ctx.scope.role !== 'EMPLOYEE'
          ? { id: { in: ctx.scope.branchIds } }
          : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.team.findMany({
      where: {
        branch: { orgId: ctx.orgId },
        ...(ctx.scope.teamIds ? { id: { in: ctx.scope.teamIds } } : {}),
      },
      select: { id: true, name: true, color: true, branchId: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    org,
    orgs: memberships.map((m) => m.org),
    branches,
    teams,
  };
}
