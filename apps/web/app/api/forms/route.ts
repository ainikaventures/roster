import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { validateFormSchema } from '@/lib/forms';

// ---------------------------------------------------------------------------
// GET /api/forms — list templates visible to the current scope.
// ---------------------------------------------------------------------------

export async function GET() {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const teamFilter =
    ctx.scope.teamIds === null
      ? {}
      : { OR: [{ teamId: null }, { teamId: { in: ctx.scope.teamIds } }] };

  const forms = await prisma.formTemplate.findMany({
    where: {
      orgId: ctx.orgId,
      archivedAt: null,
      isActive: true,
      ...teamFilter,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      teamId: true,
      isActive: true,
      schema: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true, color: true } },
      _count: { select: { submissions: true } },
    },
  });

  return json(ok(forms));
}

// ---------------------------------------------------------------------------
// POST /api/forms — managers create templates.
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional(),
  teamId: z.string().min(1).nullable().optional(),
  schema: z.unknown(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Only managers can create forms.'), { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  if (parsed.data.teamId && !canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'You can’t scope a form to that team.'), { status: 403 });
  }

  let schema;
  try {
    schema = validateFormSchema(parsed.data.schema);
  } catch (e) {
    return json(
      err('invalid_schema', e instanceof Error ? e.message : 'Invalid form schema'),
      { status: 400 },
    );
  }

  const form = await prisma.formTemplate.create({
    data: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      schema: schema as never,
      createdById: ctx.userId,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'form.created',
    entity: 'FormTemplate',
    entityId: form.id,
    metadata: { teamId: form.teamId, fieldCount: schema.fields.length },
  });

  return json(ok(form), { status: 201 });
}
