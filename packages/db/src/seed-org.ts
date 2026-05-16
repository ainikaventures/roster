import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './client';

// ---------------------------------------------------------------------------
// Used on first signup. Creates an org with one branch and one team,
// and assigns the signing-up user as OWNER.
//
// Idempotent on slug — if the slug is taken, throws so the caller can prompt
// for a different one.
// ---------------------------------------------------------------------------

export type SeedOrgInput = {
  userId: string;
  orgName: string;
  orgSlug: string;
  branchName?: string;
  teamName?: string;
  timezone?: string;
};

export async function seedOrganization(
  input: SeedOrgInput,
  client: PrismaClient = defaultPrisma,
) {
  const {
    userId,
    orgName,
    orgSlug,
    branchName = 'Main',
    teamName = 'Team 1',
    timezone = 'UTC',
  } = input;

  return client.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName, slug: orgSlug, timezone },
    });

    const branch = await tx.branch.create({
      data: { orgId: org.id, name: branchName, timezone },
    });

    const team = await tx.team.create({
      data: { branchId: branch.id, name: teamName },
    });

    await tx.membership.create({
      data: { userId, orgId: org.id, role: 'OWNER' },
    });

    await tx.auditLog.create({
      data: {
        orgId: org.id,
        userId,
        action: 'org.created',
        entity: 'Organization',
        entityId: org.id,
        metadata: { branchId: branch.id, teamId: team.id },
      },
    });

    return { org, branch, team };
  });
}
