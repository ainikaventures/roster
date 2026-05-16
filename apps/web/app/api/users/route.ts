import { z } from 'zod';
import { prisma } from '@roster/db';
import { ctxOr401, err, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/users — directory of people visible to the current scope.
// Used by the directory page and the shift-assignee dropdown.
// ---------------------------------------------------------------------------

const Query = z.object({
  teamId: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    teamId: url.searchParams.get('teamId') ?? undefined,
  });
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  // Restrict to memberships within the user's team scope.
  // Admins/owners see everyone in the org.
  const teamFilter = ctx.scope.teamIds === null ? {} : { teamId: { in: ctx.scope.teamIds } };

  const memberships = await prisma.membership.findMany({
    where: {
      orgId: ctx.orgId,
      ...(parsed.data.teamId ? { teamId: parsed.data.teamId } : teamFilter),
    },
    select: {
      role: true,
      teamId: true,
      team: { select: { id: true, name: true, color: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  return json(ok(memberships));
}
