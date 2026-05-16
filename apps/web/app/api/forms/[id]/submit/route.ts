import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import { type FormSchema, validateAnswers, validateFormSchema } from '@/lib/forms';

const Body = z.object({
  answers: z.record(z.unknown()),
  teamId: z.string().min(1).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const form = await prisma.formTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null, isActive: true },
    select: { id: true, teamId: true, schema: true },
  });
  if (!form) {
    return json(err('not_found', 'Form not available.'), { status: 404 });
  }

  // Employees can only submit forms scoped to their team (or org-wide).
  if (form.teamId && ctx.scope.teamIds !== null && !ctx.scope.teamIds.includes(form.teamId)) {
    return json(err('forbidden', 'You don’t have access to that form.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  // Default team for the submission row: the form's team, the user's team, or null.
  let teamId = parsed.data.teamId ?? form.teamId;
  if (!teamId && ctx.scope.role === 'EMPLOYEE') {
    const m = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: ctx.userId, orgId: ctx.orgId } },
      select: { teamId: true },
    });
    teamId = m?.teamId ?? null;
  }

  let schema: FormSchema;
  try {
    schema = validateFormSchema(form.schema);
  } catch (e) {
    return json(
      err('invalid_schema', e instanceof Error ? e.message : 'Form has invalid schema'),
      { status: 500 },
    );
  }

  const result = validateAnswers(schema, parsed.data.answers);
  if (!result.ok) {
    return json(
      err('invalid_answers', result.errors.map((e) => `${e.fieldId}: ${e.message}`).join('; ')),
      { status: 400 },
    );
  }

  const flagBelow = schema.scoring?.flagBelow;
  const shouldFlag =
    typeof flagBelow === 'number' && typeof result.score === 'number' && result.score < flagBelow;

  const submission = await prisma.formSubmission.create({
    data: {
      orgId: ctx.orgId,
      formId: form.id,
      userId: ctx.userId,
      teamId: teamId ?? null,
      answers: result.answers as never,
      score: result.score,
      maxScore: result.maxScore,
      status: shouldFlag ? 'FLAGGED' : 'SUBMITTED',
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'form.submitted',
    entity: 'FormSubmission',
    entityId: submission.id,
    metadata: { formId: form.id, flagged: shouldFlag, score: result.score },
  });

  return json(ok(submission), { status: 201 });
}
