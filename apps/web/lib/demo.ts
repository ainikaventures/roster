import { prisma, seedOrganization } from '@roster/db';

// ---------------------------------------------------------------------------
// Demo-mode helpers.
//
// `DEMO_MODE=true` (env) flips on:
//   - A CredentialsProvider in auth.ts that lets anyone sign in as a seeded
//     demo user with one click (no email, no password).
//   - The /demo-login page with buttons for each canonical role.
//   - `ensureDemoData()` — idempotent seeding so the live instance always has
//     the Acme Hospitality org + the seven demo users ready.
//
// In production (DEMO_MODE unset), every demo affordance disappears and the
// app behaves like a real product.
// ---------------------------------------------------------------------------

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export const DEMO_USERS = [
  {
    email: 'owner@acme.test',
    name: 'Olivia Owner',
    role: 'OWNER' as const,
    description: 'Full org access. Best for poking around everything.',
  },
  {
    email: 'branch@acme.test',
    name: 'Bao Branch',
    role: 'BRANCH_MANAGER' as const,
    description: 'Manages the Downtown branch only.',
  },
  {
    email: 'kitchen.lead@acme.test',
    name: 'Kim Kitchen',
    role: 'TEAM_MANAGER' as const,
    description: 'Manages the Kitchen teams at both branches.',
  },
  {
    email: 'alex@acme.test',
    name: 'Alex Employee0',
    role: 'EMPLOYEE' as const,
    description: 'Employee on Downtown / Kitchen.',
  },
];

/**
 * Idempotent — if the Acme demo org already exists, this is a no-op.
 * Safe to call on every cold start in demo mode.
 */
export async function ensureDemoData(): Promise<void> {
  if (!isDemoMode()) return;

  const existing = await prisma.organization.findUnique({
    where: { slug: 'acme' },
    select: { id: true },
  });
  if (existing) return;

  // First user becomes the owner via seedOrganization.
  const owner = await prisma.user.upsert({
    where: { email: 'owner@acme.test' },
    update: { name: 'Olivia Owner', emailVerified: new Date() },
    create: { email: 'owner@acme.test', name: 'Olivia Owner', emailVerified: new Date() },
  });

  const { org } = await seedOrganization({
    userId: owner.id,
    orgName: 'Acme Hospitality',
    orgSlug: 'acme',
    branchName: 'Downtown',
    teamName: 'Kitchen',
    timezone: 'America/Los_Angeles',
  });

  // Add a second branch + team so the multi-branch / multi-team UI has data.
  const airport = await prisma.branch.create({
    data: { orgId: org.id, name: 'Airport', timezone: 'America/Los_Angeles' },
  });
  const downtown = await prisma.branch.findFirst({
    where: { orgId: org.id, name: 'Downtown' },
  });
  await prisma.team.update({
    where: { branchId_name: { branchId: downtown!.id, name: 'Kitchen' } },
    data: { color: '#ef4444' },
  });
  const fohDt = await prisma.team.create({
    data: { branchId: downtown!.id, name: 'Front of House', color: '#3b82f6' },
  });
  const kitchenAir = await prisma.team.create({
    data: { branchId: airport.id, name: 'Kitchen', color: '#f97316' },
  });
  const cleaning = await prisma.team.create({
    data: { branchId: airport.id, name: 'Cleaning', color: '#10b981' },
  });
  const kitchenDt = await prisma.team.findFirstOrThrow({
    where: { branchId: downtown!.id, name: 'Kitchen' },
  });

  // The branch + team manager + employees.
  const [branchMgr, teamMgr, alex, blair, casey, dana] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'branch@acme.test' },
      update: { name: 'Bao Branch', emailVerified: new Date() },
      create: { email: 'branch@acme.test', name: 'Bao Branch', emailVerified: new Date() },
    }),
    prisma.user.upsert({
      where: { email: 'kitchen.lead@acme.test' },
      update: { name: 'Kim Kitchen', emailVerified: new Date() },
      create: {
        email: 'kitchen.lead@acme.test',
        name: 'Kim Kitchen',
        emailVerified: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'alex@acme.test' },
      update: { name: 'Alex Employee0', emailVerified: new Date() },
      create: { email: 'alex@acme.test', name: 'Alex Employee0', emailVerified: new Date() },
    }),
    prisma.user.upsert({
      where: { email: 'blair@acme.test' },
      update: { name: 'Blair Employee1', emailVerified: new Date() },
      create: {
        email: 'blair@acme.test',
        name: 'Blair Employee1',
        emailVerified: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'casey@acme.test' },
      update: { name: 'Casey Employee2', emailVerified: new Date() },
      create: {
        email: 'casey@acme.test',
        name: 'Casey Employee2',
        emailVerified: new Date(),
      },
    }),
    prisma.user.upsert({
      where: { email: 'dana@acme.test' },
      update: { name: 'Dana Employee3', emailVerified: new Date() },
      create: {
        email: 'dana@acme.test',
        name: 'Dana Employee3',
        emailVerified: new Date(),
      },
    }),
  ]);

  await prisma.membership.createMany({
    data: [
      { userId: branchMgr.id, orgId: org.id, role: 'BRANCH_MANAGER' },
      { userId: teamMgr.id, orgId: org.id, role: 'TEAM_MANAGER' },
      { userId: alex.id, orgId: org.id, role: 'EMPLOYEE', teamId: kitchenDt.id },
      { userId: blair.id, orgId: org.id, role: 'EMPLOYEE', teamId: fohDt.id },
      { userId: casey.id, orgId: org.id, role: 'EMPLOYEE', teamId: kitchenAir.id },
      { userId: dana.id, orgId: org.id, role: 'EMPLOYEE', teamId: cleaning.id },
    ],
  });

  await prisma.managerAssignment.create({
    data: { userId: branchMgr.id, branchId: downtown!.id },
  });
  await prisma.managerAssignment.createMany({
    data: [
      { userId: teamMgr.id, teamId: kitchenDt.id },
      { userId: teamMgr.id, teamId: kitchenAir.id },
    ],
  });
}
