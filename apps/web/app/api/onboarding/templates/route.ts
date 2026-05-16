import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { validateOnboardingSchema } from '@/lib/onboarding';

// GET /api/onboarding/templates
export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const templates = await prisma.onboardingTemplate.findMany({
    where: { orgId: ctx.orgId, archivedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      steps: true,
      updatedAt: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { assignments: true } },
    },
  });

  return json(ok(templates));
}

// POST /api/onboarding/templates — managers only
const CreateBody = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional(),
  steps: z.unknown(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  let schema;
  try {
    schema = validateOnboardingSchema({ steps: parsed.data.steps });
  } catch (e) {
    return json(
      err('invalid_schema', e instanceof Error ? e.message : 'Invalid steps'),
      { status: 400 },
    );
  }

  const template = await prisma.onboardingTemplate.create({
    data: {
      orgId: ctx.orgId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      steps: schema as never,
      createdById: ctx.userId,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'onboarding_template.created',
    entity: 'OnboardingTemplate',
    entityId: template.id,
    metadata: { stepCount: schema.steps.length },
  });

  return json(ok(template), { status: 201 });
}
