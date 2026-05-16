import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { newWebhookSecret } from '@/lib/webhooks';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const hooks = await prisma.webhook.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      description: true,
      createdAt: true,
      _count: { select: { deliveries: true } },
    },
  });

  return json(ok(hooks));
}

const Body = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1).max(60)).max(40).default([]),
  description: z.string().max(280).optional(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const secret = newWebhookSecret();
  const hook = await prisma.webhook.create({
    data: {
      orgId: ctx.orgId,
      createdById: ctx.userId,
      url: parsed.data.url,
      events: parsed.data.events as never,
      description: parsed.data.description ?? null,
      secret,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'webhook.created',
    entity: 'Webhook',
    entityId: hook.id,
    metadata: { url: hook.url },
  });

  return json(
    ok({
      id: hook.id,
      url: hook.url,
      events: parsed.data.events,
      // Show the signing secret exactly once.
      secret,
    }),
    { status: 201 },
  );
}
