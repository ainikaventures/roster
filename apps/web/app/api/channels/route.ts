import {
  prisma,
  ensureBranchChannel,
  ensureOrgChannel,
  ensureTeamChannel,
} from '@roster/db';
import { ctxOr401, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/channels
//
// Returns every channel visible to the current user, with an unread count
// and last-message preview. Broadcast channels (TEAM/BRANCH/ORG) are
// auto-created lazily based on the user's scope.
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  // Lazily materialize the channels for the user's scope.
  if (ctx.scope.role === 'OWNER' || ctx.scope.role === 'ADMIN') {
    await ensureOrgChannel(ctx.orgId, ctx.userId);
  }
  if (ctx.scope.branchIds && ctx.scope.branchIds.length > 0) {
    for (const branchId of ctx.scope.branchIds) {
      await ensureBranchChannel(ctx.orgId, branchId, ctx.userId);
    }
  }
  if (ctx.scope.teamIds === null) {
    // OWNER/ADMIN: ensure a team channel for every team in the org.
    const teams = await prisma.team.findMany({
      where: { branch: { orgId: ctx.orgId } },
      select: { id: true },
    });
    for (const t of teams) await ensureTeamChannel(ctx.orgId, t.id, ctx.userId);
  } else if (ctx.scope.teamIds.length > 0) {
    for (const teamId of ctx.scope.teamIds) {
      await ensureTeamChannel(ctx.orgId, teamId, ctx.userId);
    }
  }

  // Load every channel the user is a member of.
  const memberships = await prisma.channelMember.findMany({
    where: { userId: ctx.userId, channel: { orgId: ctx.orgId, archivedAt: null } },
    select: {
      lastReadAt: true,
      channel: {
        select: {
          id: true,
          kind: true,
          name: true,
          description: true,
          teamId: true,
          branchId: true,
          team: { select: { id: true, name: true, color: true } },
          branch: { select: { id: true, name: true } },
        },
      },
    },
  });

  const channelIds = memberships.map((m) => m.channel.id);

  // For each channel, fetch the latest message and count unread (after lastReadAt).
  const latest = channelIds.length
    ? await prisma.message.findMany({
        where: { channelId: { in: channelIds }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        distinct: ['channelId'],
        select: {
          id: true,
          channelId: true,
          createdAt: true,
          body: true,
          user: { select: { id: true, name: true, email: true } },
        },
      })
    : [];
  const latestByChannel = new Map(latest.map((m) => [m.channelId, m]));

  const unreadCounts = await Promise.all(
    memberships.map(async (m) => {
      const count = await prisma.message.count({
        where: {
          channelId: m.channel.id,
          deletedAt: null,
          userId: { not: ctx.userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });
      return [m.channel.id, count] as const;
    }),
  );
  const unreadByChannel = new Map(unreadCounts);

  // Sort: TEAM channels first (most relevant), then BRANCH, ORG, then DMs/groups.
  // Within a kind, sort by latest message timestamp.
  const kindRank: Record<string, number> = { TEAM: 0, BRANCH: 1, ORG: 2, GROUP: 3, DM: 4 };
  const channels = memberships
    .map((m) => ({
      ...m.channel,
      lastReadAt: m.lastReadAt,
      unread: unreadByChannel.get(m.channel.id) ?? 0,
      latest: latestByChannel.get(m.channel.id) ?? null,
    }))
    .sort((a, b) => {
      // kindRank covers every ChannelKind; the fallback is just a TS guard.
      const rk = (kindRank[a.kind] ?? 99) - (kindRank[b.kind] ?? 99);
      if (rk !== 0) return rk;
      const at = a.latest?.createdAt?.getTime() ?? 0;
      const bt = b.latest?.createdAt?.getTime() ?? 0;
      return bt - at;
    });

  return json(ok(channels));
}
