import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

// GET /api/pto?userId= — fetch the current user's balance, or (for managers)
// any user in scope.
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const target = url.searchParams.get('userId') ?? ctx.userId;
  if (target !== ctx.userId && !isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Not allowed.'), { status: 403 });
  }

  const balance = await prisma.ptoBalance.findUnique({
    where: { userId: target },
    select: {
      userId: true,
      balanceMinutes: true,
      accrualPerWeek: true,
      lastAccruedAt: true,
      updatedAt: true,
    },
  });

  return json(
    ok(
      balance ?? {
        userId: target,
        balanceMinutes: 0,
        accrualPerWeek: 0,
        lastAccruedAt: null,
        updatedAt: null,
      },
    ),
  );
}

// PATCH /api/pto — managers adjust a user's balance or accrual rate.
const Patch = z.object({
  userId: z.string().min(1),
  balanceMinutes: z.number().int().optional(),
  /** Minutes to add (positive) or subtract (negative). */
  adjust: z.number().int().optional(),
  accrualPerWeek: z.number().int().min(0).optional(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  // Scope check on the target user.
  const target = await prisma.membership.findFirst({
    where: { userId: parsed.data.userId, orgId: ctx.orgId },
    select: { teamId: true },
  });
  if (!target) return json(err('not_found', 'User not in org.'), { status: 404 });
  if (
    ctx.scope.teamIds !== null &&
    target.teamId &&
    !ctx.scope.teamIds.includes(target.teamId)
  ) {
    return json(err('forbidden', 'Out of scope.'), { status: 403 });
  }

  const updated = await prisma.ptoBalance.upsert({
    where: { userId: parsed.data.userId },
    update: {
      ...(parsed.data.balanceMinutes !== undefined
        ? { balanceMinutes: parsed.data.balanceMinutes }
        : {}),
      ...(parsed.data.adjust !== undefined
        ? { balanceMinutes: { increment: parsed.data.adjust } }
        : {}),
      ...(parsed.data.accrualPerWeek !== undefined
        ? { accrualPerWeek: parsed.data.accrualPerWeek }
        : {}),
    },
    create: {
      orgId: ctx.orgId,
      userId: parsed.data.userId,
      balanceMinutes:
        parsed.data.balanceMinutes ?? parsed.data.adjust ?? 0,
      accrualPerWeek: parsed.data.accrualPerWeek ?? 0,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'pto.adjusted',
    entity: 'PtoBalance',
    entityId: updated.id,
    metadata: {
      targetUserId: parsed.data.userId,
      adjust: parsed.data.adjust,
      reason: parsed.data.reason,
    },
  });

  return json(ok(updated));
}
