import { prisma } from '@roster/db';
import { ctxOr401, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/notifications — list current user's notifications (50 most recent).
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: ctx.userId, orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({
      where: { userId: ctx.userId, orgId: ctx.orgId, readAt: null },
    }),
  ]);

  return json(ok({ items, unread }));
}
