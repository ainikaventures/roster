import { z } from 'zod';
import { notifyMany, prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';
import { mentionedUserIds, stripMentions } from '@/lib/mentions';

// ---------------------------------------------------------------------------
// GET /api/channels/:id/messages?before=<iso>&limit=50
// Returns messages newest-first. Use `before` to paginate older messages.
// Also supports ?after=<iso> for "incremental refresh" polling.
// ---------------------------------------------------------------------------

const ListQuery = z.object({
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10) || 50, 1), 200) : 50)),
});

async function assertMember(channelId: string, userId: string, orgId: string) {
  const membership = await prisma.channelMember.findFirst({
    where: { channelId, userId, channel: { orgId } },
    select: { id: true },
  });
  return !!membership;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  if (!(await assertMember(params.id, ctx.userId, ctx.orgId))) {
    return json(err('forbidden', 'You don’t have access to that channel.'), { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = ListQuery.safeParse({
    before: url.searchParams.get('before') ?? undefined,
    after: url.searchParams.get('after') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid pagination cursor'), { status: 400 });
  }

  const messages = await prisma.message.findMany({
    where: {
      channelId: params.id,
      deletedAt: null,
      ...(parsed.data.before ? { createdAt: { lt: new Date(parsed.data.before) } } : {}),
      ...(parsed.data.after ? { createdAt: { gt: new Date(parsed.data.after) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: parsed.data.limit,
    select: {
      id: true,
      channelId: true,
      userId: true,
      body: true,
      editedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reactions: {
        select: { emoji: true, userId: true },
      },
    },
  });

  // Return oldest → newest so the UI can render in order.
  return json(ok(messages.reverse()));
}

// ---------------------------------------------------------------------------
// POST /api/channels/:id/messages
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  if (!(await assertMember(params.id, ctx.userId, ctx.orgId))) {
    return json(err('forbidden', 'You don’t have access to that channel.'), { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Message body required'), { status: 400 });
  }

  const channel = await prisma.channel.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, kind: true },
  });
  if (!channel) return json(err('not_found', 'Channel not found.'), { status: 404 });

  const message = await prisma.message.create({
    data: {
      channelId: params.id,
      userId: ctx.userId,
      body: parsed.data.body,
    },
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

  // Notify mentioned users that are channel members (filter out self).
  const ids = mentionedUserIds(parsed.data.body).filter((id) => id !== ctx.userId);
  if (ids.length > 0) {
    const memberMentions = await prisma.channelMember.findMany({
      where: { channelId: params.id, userId: { in: ids } },
      select: { userId: true },
    });
    const recipients = memberMentions.map((m) => m.userId);

    const preview = stripMentions(parsed.data.body).slice(0, 140);
    const senderName = message.user.name ?? message.user.email;

    await notifyMany(
      recipients.map((userId) => ({
        orgId: ctx.orgId,
        userId,
        kind: 'mention',
        title: `${senderName} mentioned you in ${channelDisplayName(channel)}`,
        body: preview,
        url: `/app/chat?channel=${params.id}`,
      })),
    );
  }

  return json(ok(message), { status: 201 });
}

function channelDisplayName(channel: { kind: string; name: string | null }): string {
  return channel.name ?? channel.kind.toLowerCase();
}
