import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { validateFormSchema } from '@/lib/forms';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const form = await prisma.formTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null },
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
    },
  });

  if (!form) return json(err('not_found', 'Form not found.'), { status: 404 });

  // Employees only see forms scoped to their team or org-wide.
  if (form.teamId && ctx.scope.teamIds !== null && !ctx.scope.teamIds.includes(form.teamId)) {
    return json(err('forbidden', 'You don’t have access to that form.'), { status: 403 });
  }

  return json(ok(form));
}

const Patch = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().max(2000).nullable().optional(),
  teamId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  schema: z.unknown().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Only managers can edit forms.'), { status: 403 });
  }

  const existing = await prisma.formTemplate.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!existing) return json(err('not_found', 'Form not found.'), { status: 404 });

  // If the existing template is team-scoped, require write access to that team.
  if (existing.teamId && !canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'You can’t edit that form.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) {
    return json(err('invalid_input', 'Invalid input'), { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.teamId !== undefined) {
    if (parsed.data.teamId && !canWriteToTeam(ctx.scope, parsed.data.teamId)) {
      return json(err('forbidden', 'You can’t scope a form to that team.'), { status: 403 });
    }
    data.teamId = parsed.data.teamId;
  }
  if (parsed.data.schema !== undefined) {
    try {
      data.schema = validateFormSchema(parsed.data.schema) as never;
    } catch (e) {
      return json(
        err('invalid_schema', e instanceof Error ? e.message : 'Invalid schema'),
        { status: 400 },
      );
    }
  }

  const updated = await prisma.formTemplate.update({ where: { id: params.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'form.updated',
    entity: 'FormTemplate',
    entityId: params.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}
