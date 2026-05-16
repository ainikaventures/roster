import { prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: params.id, orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      event: true,
      status: true,
      statusCode: true,
      responseBody: true,
      errorMessage: true,
      attemptCount: true,
      attemptedAt: true,
      createdAt: true,
    },
  });

  return json(ok(deliveries));
}
