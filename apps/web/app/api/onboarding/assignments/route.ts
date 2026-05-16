import { z } from 'zod';
import { notify, prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// GET /api/onboarding/assignments?userId=
// - Employees see their own assignment(s).
// - Managers see assignments in their scope.
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const userIdFilter = url.searchParams.get('userId');

  let scopedUserIds: string[] | null = null;
  if (!isManager(ctx.scope.role)) {
    scopedUserIds = [ctx.userId];
  } else if (ctx.scope.teamIds !== null) {
    const members = await prisma.membership.findMany({
      where: { orgId: ctx.orgId, teamId: { in: ctx.scope.teamIds } },
      select: { userId: true },
    });
    scopedUserIds = members.map((m) => m.userId);
  }

  const finalFilter = userIdFilter
    ? scopedUserIds && !scopedUserIds.includes(userIdFilter)
      ? null
      : [userIdFilter]
    : scopedUserIds;

  if (finalFilter === null && userIdFilter) {
    return json(err('forbidden', 'Out of scope.'), { status: 403 });
  }

  const assignments = await prisma.onboardingAssignment.findMany({
    where: {
      orgId: ctx.orgId,
      ...(finalFilter ? { userId: { in: finalFilter } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      completedSteps: true,
      startedAt: true,
      completedAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      template: {
        select: { id: true, title: true, description: true, steps: true },
      },
    },
  });

  return json(ok(assignments));
}

// POST /api/onboarding/assignments — managers assign a template to a new hire.
const CreateBody = z.object({
  templateId: z.string().min(1),
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const [template, target] = await Promise.all([
    prisma.onboardingTemplate.findFirst({
      where: { id: parsed.data.templateId, orgId: ctx.orgId, archivedAt: null },
      select: { id: true, title: true },
    }),
    prisma.membership.findFirst({
      where: { userId: parsed.data.userId, orgId: ctx.orgId },
      select: { teamId: true },
    }),
  ]);
  if (!template) return json(err('not_found', 'Template not found.'), { status: 404 });
  if (!target) return json(err('not_found', 'User not in org.'), { status: 404 });
  if (
    ctx.scope.teamIds !== null &&
    target.teamId &&
    !ctx.scope.teamIds.includes(target.teamId)
  ) {
    return json(err('forbidden', 'Out of scope.'), { status: 403 });
  }

  const assignment = await prisma.onboardingAssignment.upsert({
    where: { templateId_userId: { templateId: template.id, userId: parsed.data.userId } },
    update: {},
    create: {
      orgId: ctx.orgId,
      templateId: template.id,
      userId: parsed.data.userId,
    },
  });

  if (parsed.data.userId !== ctx.userId) {
    await notify({
      orgId: ctx.orgId,
      userId: parsed.data.userId,
      kind: 'system',
      title: `You have a new onboarding: ${template.title}`,
      url: '/app/hr/onboarding',
    });
  }

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'onboarding.assigned',
    entity: 'OnboardingAssignment',
    entityId: assignment.id,
    metadata: { templateId: template.id, targetUserId: parsed.data.userId },
  });

  return json(ok(assignment), { status: 201 });
}
