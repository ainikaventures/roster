import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';

function isAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

const Patch = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).max(40).optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(280).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const hook = await prisma.webhook.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!hook) return json(err('not_found', 'Webhook not found.'), { status: 404 });

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.url !== undefined) data.url = parsed.data.url;
  if (parsed.data.events !== undefined) data.events = parsed.data.events as never;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;

  const updated = await prisma.webhook.update({ where: { id: hook.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'webhook.updated',
    entity: 'Webhook',
    entityId: hook.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isAdmin(ctx.scope.role)) {
    return json(err('forbidden', 'Admins only.'), { status: 403 });
  }

  const hook = await prisma.webhook.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true },
  });
  if (!hook) return json(err('not_found', 'Webhook not found.'), { status: 404 });

  await prisma.webhook.delete({ where: { id: hook.id } });
  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'webhook.deleted',
    entity: 'Webhook',
    entityId: hook.id,
  });

  return json(ok({ id: hook.id }));
}
