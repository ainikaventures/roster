import { z } from 'zod';
import { prisma } from '@roster/db';
import { ctxOr401, err, isManager, json, ok } from '@/lib/api';

// ---------------------------------------------------------------------------
// GET /api/forms/submissions?formId=&mine=
// Employees: only their own submissions.
// Managers: submissions across their scope.
// ---------------------------------------------------------------------------

const Query = z.object({
  formId: z.string().min(1).optional(),
  mine: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    formId: url.searchParams.get('formId') ?? undefined,
    mine: url.searchParams.get('mine') ?? undefined,
  });
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const scopeFilter =
    isManager(ctx.scope.role) && !parsed.data.mine
      ? ctx.scope.teamIds === null
        ? {}
        : { OR: [{ teamId: { in: ctx.scope.teamIds } }, { teamId: null }] }
      : { userId: ctx.userId };

  const submissions = await prisma.formSubmission.findMany({
    where: {
      orgId: ctx.orgId,
      ...(parsed.data.formId ? { formId: parsed.data.formId } : {}),
      ...scopeFilter,
    },
    orderBy: { submittedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      formId: true,
      userId: true,
      teamId: true,
      score: true,
      maxScore: true,
      status: true,
      submittedAt: true,
      form: { select: { id: true, title: true } },
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      team: { select: { id: true, name: true, color: true } },
    },
  });

  return json(ok(submissions));
}
