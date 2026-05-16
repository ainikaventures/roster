import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './client';

// ---------------------------------------------------------------------------
// Helpers for creating in-app notifications.
// Email + push fan-out will plug in here in later phases.
// ---------------------------------------------------------------------------

export type NotifyInput = {
  orgId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  url?: string | null;
};

export async function notify(input: NotifyInput, client: PrismaClient = defaultPrisma) {
  return client.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
    },
  });
}

export async function notifyMany(
  inputs: NotifyInput[],
  client: PrismaClient = defaultPrisma,
) {
  if (inputs.length === 0) return { count: 0 };
  return client.notification.createMany({
    data: inputs.map((i) => ({
      orgId: i.orgId,
      userId: i.userId,
      kind: i.kind,
      title: i.title,
      body: i.body ?? null,
      url: i.url ?? null,
    })),
  });
}

/**
 * Notify everyone with a membership in a given team (employees) — useful for
 * publishing a schedule. Filters out the actor so they don't notify themselves.
 */
export async function notifyTeam(
  params: {
    orgId: string;
    teamId: string;
    actorUserId?: string;
    kind: string;
    title: string;
    body?: string | null;
    url?: string | null;
  },
  client: PrismaClient = defaultPrisma,
) {
  const members = await client.membership.findMany({
    where: { orgId: params.orgId, teamId: params.teamId },
    select: { userId: true },
  });
  const recipients = members
    .map((m) => m.userId)
    .filter((id) => id !== params.actorUserId);

  return notifyMany(
    recipients.map((userId) => ({
      orgId: params.orgId,
      userId,
      kind: params.kind,
      title: params.title,
      body: params.body ?? null,
      url: params.url ?? null,
    })),
    client,
  );
}
