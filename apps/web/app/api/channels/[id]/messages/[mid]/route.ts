import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';

const Patch = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; mid: string } },
) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const message = await prisma.message.findFirst({
    where: { id: params.mid, channelId: params.id, channel: { orgId: ctx.orgId } },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) {
    return json(err('not_found', 'Message not found.'), { status: 404 });
  }
  if (message.userId !== ctx.userId) {
    return json(err('forbidden', 'You can’t edit someone else’s message.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Message body required'), { status: 400 });
  }

  const updated = await prisma.message.update({
    where: { id: params.mid },
    data: { body: parsed.data.body, editedAt: new Date() },
    select: {
      id: true,
      channelId: true,
      userId: true,
      body: true,
      editedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reactions: { select: { emoji: true, userId: true } },
    },
  });

  return json(ok(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; mid: string } },
) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const message = await prisma.message.findFirst({
    where: { id: params.mid, channelId: params.id, channel: { orgId: ctx.orgId } },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) {
    return json(err('not_found', 'Message not found.'), { status: 404 });
  }

  // Authors can delete their own; managers can moderate others.
  if (message.userId !== ctx.userId && !isManager(ctx.scope.role)) {
    return json(err('forbidden', 'You can’t delete that message.'), { status: 403 });
  }

  await prisma.message.update({
    where: { id: params.mid },
    data: { deletedAt: new Date() },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'message.deleted',
    entity: 'Message',
    entityId: params.mid,
    metadata: { channelId: params.id, byAuthor: message.userId === ctx.userId },
  });

  return json(ok({ id: params.mid }));
}
