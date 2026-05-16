import { z } from 'zod';
import { prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';

// GET /api/audit-log?action=&entity=&userId=&from=&to=&cursor=
// Org admins only.
const Query = z.object({
  action: z.string().min(1).optional(),
  entity: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    action: url.searchParams.get('action') ?? undefined,
    entity: url.searchParams.get('entity') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  });
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const where: Record<string, unknown> = { orgId: ctx.orgId };
  if (parsed.data.action) where.action = { contains: parsed.data.action };
  if (parsed.data.entity) where.entity = parsed.data.entity;
  if (parsed.data.userId) where.userId = parsed.data.userId;
  if (parsed.data.from || parsed.data.to) {
    where.createdAt = {
      ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
      ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
    };
  }

  const PAGE = 100;
  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: PAGE + 1,
    ...(parsed.data.cursor
      ? { cursor: { id: parsed.data.cursor }, skip: 1 }
      : {}),
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  const nextCursor = items.length > PAGE ? items[PAGE]!.id : null;
  return json(ok({ items: items.slice(0, PAGE), nextCursor }));
}
