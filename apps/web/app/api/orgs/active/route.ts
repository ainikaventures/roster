import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@roster/db';
import { err, ok } from '@roster/types';
import { getServerAuthSession } from '@/lib/auth';

const Body = z.object({ orgId: z.string().min(1) });

/**
 * Active org for the workspace switcher.
 *
 * Phase-0 implementation: validates the user belongs to the requested org,
 * touches the membership's updatedAt so it becomes the most-recent — which is
 * the rule `auth.ts` uses to pick the active org in the session callback.
 *
 * Later we'll move this to a proper cookie / per-session value.
 */
export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json(err('unauthorized', 'Sign in first.'), { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: { userId: session.user.id, orgId: parsed.data.orgId },
    },
    select: { id: true },
  });

  if (!membership) {
    return NextResponse.json(err('forbidden', 'Not a member of that org.'), {
      status: 403,
    });
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(ok({ orgId: parsed.data.orgId }));
}
