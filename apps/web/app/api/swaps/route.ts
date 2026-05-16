import { prisma } from '@roster/db';
import { ctxOr401, isManager, json, ok } from '@/lib/api';

// GET /api/swaps — list swap requests the user can see or act on.
export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const teamFilter =
    ctx.scope.teamIds === null
      ? { shift: { team: { branch: { orgId: ctx.orgId } } } }
      : { shift: { teamId: { in: ctx.scope.teamIds } } };

  // Employees see swaps they requested or are addressed to.
  // Managers see everything in scope.
  const where = isManager(ctx.scope.role)
    ? { orgId: ctx.orgId, ...teamFilter }
    : {
        orgId: ctx.orgId,
        OR: [
          { requesterId: ctx.userId },
          { recipientId: ctx.userId },
        ],
      };

  const swaps = await prisma.shiftSwapRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      status: true,
      reason: true,
      reviewNotes: true,
      createdAt: true,
      reviewedAt: true,
      shift: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          team: { select: { id: true, name: true, color: true } },
        },
      },
      requester: { select: { id: true, name: true, email: true, avatarUrl: true } },
      recipient: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  return json(ok(swaps));
}
