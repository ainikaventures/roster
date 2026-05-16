import { z } from 'zod';
import { notifyMany, prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/announcements — announcements visible to the current user.
// Visible if scope = ORG (always), BRANCH (user has access to that branch),
// TEAM (user has access to that team).
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  // Build OR filter from the user's accessible scope.
  const scopeFilters: Array<Record<string, unknown>> = [{ scope: 'ORG' }];
  if (ctx.scope.branchIds === null) {
    scopeFilters.push({ scope: 'BRANCH' });
  } else if (ctx.scope.branchIds.length > 0) {
    scopeFilters.push({ scope: 'BRANCH', scopeId: { in: ctx.scope.branchIds } });
  }
  if (ctx.scope.teamIds === null) {
    scopeFilters.push({ scope: 'TEAM' });
  } else if (ctx.scope.teamIds.length > 0) {
    scopeFilters.push({ scope: 'TEAM', scopeId: { in: ctx.scope.teamIds } });
  }

  const items = await prisma.announcement.findMany({
    where: {
      orgId: ctx.orgId,
      archivedAt: null,
      OR: scopeFilters,
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      body: true,
      scope: true,
      scopeId: true,
      publishedAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reads: { where: { userId: ctx.userId }, select: { readAt: true } },
      _count: { select: { reads: true } },
    },
  });

  return json(
    ok(
      items.map((a) => ({
        ...a,
        readAt: a.reads[0]?.readAt ?? null,
        reads: undefined,
        readCount: a._count.reads,
        _count: undefined,
      })),
    ),
  );
}

// ---------------------------------------------------------------------------
// POST /api/announcements — managers+ can create.
// ---------------------------------------------------------------------------

const CreateBody = z
  .object({
    scope: z.enum(['ORG', 'BRANCH', 'TEAM']),
    scopeId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(140),
    body: z.string().trim().min(1).max(10_000),
  })
  .refine(
    (v) => (v.scope === 'ORG' ? !v.scopeId : !!v.scopeId),
    { message: 'scopeId is required unless scope=ORG', path: ['scopeId'] },
  );

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Only managers can post announcements.'), { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'), {
      status: 400,
    });
  }

  // Org-wide requires admin/owner.
  if (parsed.data.scope === 'ORG' && !['OWNER', 'ADMIN'].includes(ctx.scope.role)) {
    return json(err('forbidden', 'Only admins can post org-wide.'), { status: 403 });
  }
  // Branch-scoped requires branch access.
  if (parsed.data.scope === 'BRANCH') {
    if (ctx.scope.branchIds !== null && !ctx.scope.branchIds.includes(parsed.data.scopeId!)) {
      return json(err('forbidden', 'You don’t manage that branch.'), { status: 403 });
    }
  }
  // Team-scoped requires team write access.
  if (parsed.data.scope === 'TEAM') {
    if (!canWriteToTeam(ctx.scope, parsed.data.scopeId!)) {
      return json(err('forbidden', 'You don’t manage that team.'), { status: 403 });
    }
  }

  const announcement = await prisma.announcement.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      scope: parsed.data.scope,
      scopeId: parsed.data.scopeId ?? null,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });

  // Fan-out notifications.
  const recipients = await recipientsFor(
    ctx.orgId,
    parsed.data.scope,
    parsed.data.scopeId ?? null,
    ctx.userId,
  );
  if (recipients.length > 0) {
    await notifyMany(
      recipients.map((userId) => ({
        orgId: ctx.orgId,
        userId,
        kind: 'announcement.posted',
        title: announcement.title,
        body: announcement.body.slice(0, 140),
        url: '/app/updates',
      })),
    );
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'announcement.created',
    entity: 'Announcement',
    entityId: announcement.id,
    metadata: { scope: announcement.scope, scopeId: announcement.scopeId, recipients: recipients.length },
  });

  return json(ok(announcement), { status: 201 });
}

async function recipientsFor(
  orgId: string,
  scope: 'ORG' | 'BRANCH' | 'TEAM',
  scopeId: string | null,
  actorUserId: string,
): Promise<string[]> {
  if (scope === 'ORG') {
    const members = await prisma.membership.findMany({
      where: { orgId },
      select: { userId: true },
    });
    return members.map((m) => m.userId).filter((id) => id !== actorUserId);
  }
  if (scope === 'TEAM' && scopeId) {
    const members = await prisma.membership.findMany({
      where: { orgId, teamId: scopeId },
      select: { userId: true },
    });
    return members.map((m) => m.userId).filter((id) => id !== actorUserId);
  }
  if (scope === 'BRANCH' && scopeId) {
    const teams = await prisma.team.findMany({
      where: { branchId: scopeId },
      select: { id: true },
    });
    const teamIds = teams.map((t) => t.id);
    const members = await prisma.membership.findMany({
      where: { orgId, teamId: { in: teamIds } },
      select: { userId: true },
    });
    return members.map((m) => m.userId).filter((id) => id !== actorUserId);
  }
  return [];
}
