import { z } from 'zod';
import { prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// POST /api/notifications/read
//   { ids?: string[] }   → mark specific notifications as read
//   { all: true }        → mark all as read
// ---------------------------------------------------------------------------

const Body = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  const now = new Date();

  const result = await prisma.notification.updateMany({
    where: {
      userId: ctx.userId,
      orgId: ctx.orgId,
      readAt: null,
      ...('ids' in parsed.data ? { id: { in: parsed.data.ids } } : {}),
    },
    data: { readAt: now },
  });

  return json(ok({ updated: result.count }));
}
