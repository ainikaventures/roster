import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, seedOrganization } from '@roster/db';
import { err, ok } from '@roster/types';
import { getServerAuthSession } from '@/lib/auth';

const Body = z.object({
  orgName: z.string().trim().min(2).max(80),
  orgSlug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and dashes only'),
  branchName: z.string().trim().min(1).max(80).optional(),
  teamName: z.string().trim().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json(err('unauthorized', 'Sign in first.'), { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      err('invalid_input', parsed.error.errors[0]?.message ?? 'Invalid input'),
      { status: 400 },
    );
  }

  const taken = await prisma.organization.findUnique({
    where: { slug: parsed.data.orgSlug },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      err('slug_taken', 'That workspace URL is already in use.'),
      { status: 409 },
    );
  }

  const { org, branch, team } = await seedOrganization({
    userId: session.user.id,
    orgName: parsed.data.orgName,
    orgSlug: parsed.data.orgSlug,
    branchName: parsed.data.branchName,
    teamName: parsed.data.teamName,
  });

  return NextResponse.json(ok({ orgId: org.id, branchId: branch.id, teamId: team.id }));
}
