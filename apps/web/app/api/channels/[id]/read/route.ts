import { prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';

// POST /api/channels/:id/read — mark this channel as fully read up to now.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const membership = await prisma.channelMember.findFirst({
    where: { channelId: params.id, userId: ctx.userId, channel: { orgId: ctx.orgId } },
    select: { id: true },
  });
  if (!membership) {
    return json(err('forbidden', 'You don’t have access to that channel.'), { status: 403 });
  }

  const now = new Date();
  await prisma.channelMember.update({
    where: { id: membership.id },
    data: { lastReadAt: now },
  });

  return json(ok({ readAt: now.toISOString() }));
}
