import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { type CompletedSteps, validateOnboardingSchema } from '@/lib/onboarding';

const Body = z.object({
  stepId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

// POST /api/onboarding/assignments/:id/step
// Marks a single step complete on an assignment. Auto-completes the whole
// assignment when every step in the template has been recorded.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const assignment = await prisma.onboardingAssignment.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: {
      id: true,
      userId: true,
      status: true,
      completedSteps: true,
      template: { select: { steps: true } },
    },
  });
  if (!assignment) return json(err('not_found', 'Assignment not found.'), { status: 404 });

  // Only the assignee can self-complete a step; managers can mark on someone's
  // behalf (e.g. during in-person onboarding).
  if (assignment.userId !== ctx.userId && !isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Not yours to complete.'), { status: 403 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  let schema;
  try {
    schema = validateOnboardingSchema(assignment.template.steps);
  } catch {
    return json(err('invalid_schema', 'Template schema invalid.'), { status: 500 });
  }
  if (!schema.steps.some((s) => s.id === parsed.data.stepId)) {
    return json(err('invalid_input', 'Unknown step id.'), { status: 400 });
  }

  const completed: CompletedSteps =
    typeof assignment.completedSteps === 'object' && assignment.completedSteps !== null
      ? (assignment.completedSteps as CompletedSteps)
      : {};
  completed[parsed.data.stepId] = {
    completedAt: new Date().toISOString(),
    metadata: parsed.data.metadata,
  };

  const allDone = schema.steps.every((s) => completed[s.id]);
  const updated = await prisma.onboardingAssignment.update({
    where: { id: assignment.id },
    data: {
      completedSteps: completed as never,
      status: allDone ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: allDone ? new Date() : null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: allDone ? 'onboarding.completed' : 'onboarding.step_completed',
    entity: 'OnboardingAssignment',
    entityId: assignment.id,
    metadata: { stepId: parsed.data.stepId },
  });

  return json(ok(updated));
}
