import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './client';

// ---------------------------------------------------------------------------
// Default-channel helpers.
//
// "Broadcast" channels (TEAM / BRANCH / ORG) are auto-created lazily — the
// first time someone hits a chat endpoint scoped to that team / branch / org,
// we ensure the channel exists and that every accessible user is a member.
//
// This keeps the seed flow simple (no chat assumptions baked into Phase 0).
// ---------------------------------------------------------------------------

export async function ensureTeamChannel(
  orgId: string,
  teamId: string,
  actorUserId?: string,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const team = await tx.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, branchId: true },
    });
    if (!team) throw new Error('Team not found');

    let channel = await tx.channel.findFirst({
      where: { orgId, kind: 'TEAM', teamId },
    });

    if (!channel) {
      channel = await tx.channel.create({
        data: {
          orgId,
          kind: 'TEAM',
          teamId,
          name: team.name,
          createdById: actorUserId,
        },
      });
    }

    // Sync membership: every Membership in the team should be a ChannelMember.
    const memberships = await tx.membership.findMany({
      where: { orgId, teamId },
      select: { userId: true },
    });
    const existing = await tx.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    });
    const have = new Set(existing.map((m) => m.userId));
    const missing = memberships.filter((m) => !have.has(m.userId));

    if (missing.length > 0) {
      await tx.channelMember.createMany({
        data: missing.map((m) => ({ channelId: channel!.id, userId: m.userId })),
        skipDuplicates: true,
      });
    }

    return channel;
  });
}

export async function ensureBranchChannel(
  orgId: string,
  branchId: string,
  actorUserId?: string,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, orgId: true },
    });
    if (!branch || branch.orgId !== orgId) throw new Error('Branch not found');

    let channel = await tx.channel.findFirst({
      where: { orgId, kind: 'BRANCH', branchId },
    });
    if (!channel) {
      channel = await tx.channel.create({
        data: {
          orgId,
          kind: 'BRANCH',
          branchId,
          name: branch.name,
          createdById: actorUserId,
        },
      });
    }

    // Members = every employee on a team in this branch + every manager
    // assigned to this branch / a team in this branch + admins/owners.
    const teamIds = (
      await tx.team.findMany({ where: { branchId }, select: { id: true } })
    ).map((t) => t.id);

    const eligibleUserIds = new Set<string>();

    const orgWide = await tx.membership.findMany({
      where: { orgId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    });
    orgWide.forEach((m) => eligibleUserIds.add(m.userId));

    const teamScoped = await tx.membership.findMany({
      where: { orgId, teamId: { in: teamIds } },
      select: { userId: true },
    });
    teamScoped.forEach((m) => eligibleUserIds.add(m.userId));

    const branchManagers = await tx.managerAssignment.findMany({
      where: { branchId },
      select: { userId: true },
    });
    branchManagers.forEach((m) => eligibleUserIds.add(m.userId));

    const teamManagers = await tx.managerAssignment.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true },
    });
    teamManagers.forEach((m) => eligibleUserIds.add(m.userId));

    const existing = await tx.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    });
    const have = new Set(existing.map((m) => m.userId));
    const missing = [...eligibleUserIds].filter((id) => !have.has(id));

    if (missing.length > 0) {
      await tx.channelMember.createMany({
        data: missing.map((userId) => ({ channelId: channel!.id, userId })),
        skipDuplicates: true,
      });
    }

    return channel;
  });
}

export async function ensureOrgChannel(
  orgId: string,
  actorUserId?: string,
  client: PrismaClient = defaultPrisma,
) {
  return client.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!org) throw new Error('Org not found');

    let channel = await tx.channel.findFirst({
      where: { orgId, kind: 'ORG', teamId: null, branchId: null },
    });
    if (!channel) {
      channel = await tx.channel.create({
        data: {
          orgId,
          kind: 'ORG',
          name: 'general',
          description: `Everyone in ${org.name}`,
          createdById: actorUserId,
        },
      });
    }

    const allMemberships = await tx.membership.findMany({
      where: { orgId },
      select: { userId: true },
    });
    const existing = await tx.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    });
    const have = new Set(existing.map((m) => m.userId));
    const missing = allMemberships.filter((m) => !have.has(m.userId));

    if (missing.length > 0) {
      await tx.channelMember.createMany({
        data: missing.map((m) => ({ channelId: channel!.id, userId: m.userId })),
        skipDuplicates: true,
      });
    }

    return channel;
  });
}
