/**
 * Demo seed — creates one org with two branches, four teams,
 * and a handful of users at every role level. Useful for local dev.
 *
 * Run with: `npm run db:seed --workspace @roster/db`
 */
import { prisma } from '../src/client';

async function main() {
  console.log('Seeding demo data...');

  const existing = await prisma.organization.findUnique({
    where: { slug: 'acme' },
  });
  if (existing) {
    console.log('Demo org "acme" already exists. Skipping seed.');
    return;
  }

  const owner = await prisma.user.create({
    data: {
      email: 'owner@acme.test',
      name: 'Olivia Owner',
      emailVerified: new Date(),
    },
  });

  const branchManager = await prisma.user.create({
    data: {
      email: 'branch@acme.test',
      name: 'Bao Branch',
      emailVerified: new Date(),
    },
  });

  const teamManagerKitchen = await prisma.user.create({
    data: {
      email: 'kitchen.lead@acme.test',
      name: 'Kim Kitchen',
      emailVerified: new Date(),
    },
  });

  const employees = await Promise.all(
    ['Alex', 'Blair', 'Casey', 'Dana'].map((name, idx) =>
      prisma.user.create({
        data: {
          email: `${name.toLowerCase()}@acme.test`,
          name: `${name} Employee${idx}`,
          emailVerified: new Date(),
        },
      }),
    ),
  );

  const org = await prisma.organization.create({
    data: {
      name: 'Acme Hospitality',
      slug: 'acme',
      timezone: 'America/Los_Angeles',
    },
  });

  const [downtown, airport] = await Promise.all([
    prisma.branch.create({
      data: { orgId: org.id, name: 'Downtown', timezone: 'America/Los_Angeles' },
    }),
    prisma.branch.create({
      data: { orgId: org.id, name: 'Airport', timezone: 'America/Los_Angeles' },
    }),
  ]);

  const [kitchenDt, fohDt, kitchenAir, cleaning] = await Promise.all([
    prisma.team.create({ data: { branchId: downtown.id, name: 'Kitchen', color: '#ef4444' } }),
    prisma.team.create({ data: { branchId: downtown.id, name: 'Front of House', color: '#3b82f6' } }),
    prisma.team.create({ data: { branchId: airport.id, name: 'Kitchen', color: '#f97316' } }),
    prisma.team.create({ data: { branchId: airport.id, name: 'Cleaning', color: '#10b981' } }),
  ]);

  // Owner membership
  await prisma.membership.create({
    data: { userId: owner.id, orgId: org.id, role: 'OWNER' },
  });

  // Branch manager — manages Downtown only
  await prisma.membership.create({
    data: { userId: branchManager.id, orgId: org.id, role: 'BRANCH_MANAGER' },
  });
  await prisma.managerAssignment.create({
    data: { userId: branchManager.id, branchId: downtown.id },
  });

  // Team manager — manages Kitchen at Downtown and Airport
  await prisma.membership.create({
    data: { userId: teamManagerKitchen.id, orgId: org.id, role: 'TEAM_MANAGER' },
  });
  await prisma.managerAssignment.createMany({
    data: [
      { userId: teamManagerKitchen.id, teamId: kitchenDt.id },
      { userId: teamManagerKitchen.id, teamId: kitchenAir.id },
    ],
  });

  // Employees — one per team
  const employeeTeamIds = [kitchenDt.id, fohDt.id, kitchenAir.id, cleaning.id];
  await Promise.all(
    employees.map((u, i) =>
      prisma.membership.create({
        data: {
          userId: u.id,
          orgId: org.id,
          role: 'EMPLOYEE',
          teamId: employeeTeamIds[i],
        },
      }),
    ),
  );

  console.log('Seed complete.');
  console.log(`  Org: ${org.name} (slug=${org.slug})`);
  console.log(`  Branches: Downtown, Airport`);
  console.log(`  Teams: 4`);
  console.log(`  Users: 1 owner, 1 branch manager, 1 team manager, 4 employees`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
