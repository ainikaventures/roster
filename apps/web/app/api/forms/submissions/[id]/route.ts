import { prisma } from '@roster/db';
import { ctxOr401, err, isManager, json, ok } from '@/lib/api';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const submission = await prisma.formSubmission.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      formId: true,
      userId: true,
      teamId: true,
      answers: true,
      score: true,
      maxScore: true,
      status: true,
      reviewNotes: true,
      reviewedAt: true,
      submittedAt: true,
      form: { select: { id: true, title: true, schema: true } },
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      team: { select: { id: true, name: true, color: true } },
    },
  });

  if (!submission) return json(err('not_found', 'Submission not found.'), { status: 404 });

  // Authors always see their own. Managers see submissions in their scope.
  if (submission.userId !== ctx.userId) {
    if (!isManager(ctx.scope.role)) {
      return json(err('forbidden', 'Not yours.'), { status: 403 });
    }
    if (
      ctx.scope.teamIds !== null &&
      submission.teamId &&
      !ctx.scope.teamIds.includes(submission.teamId)
    ) {
      return json(err('forbidden', 'Out of scope.'), { status: 403 });
    }
  }

  return json(ok(submission));
}
