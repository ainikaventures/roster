import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { validateCourseContent } from '@/lib/courses';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const course = await prisma.course.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      content: true,
      requiredFor: true,
      passingScore: true,
      teamId: true,
      createdBy: { select: { id: true, name: true, email: true } },
      enrollments: {
        where: { userId: ctx.userId },
        select: {
          id: true,
          status: true,
          progress: true,
          score: true,
          completedAt: true,
          startedAt: true,
        },
      },
    },
  });

  if (!course) return json(err('not_found', 'Course not found.'), { status: 404 });
  if (course.status !== 'PUBLISHED' && !isManager(ctx.scope.role)) {
    return json(err('not_found', 'Course not found.'), { status: 404 });
  }
  if (
    course.teamId &&
    ctx.scope.teamIds !== null &&
    !ctx.scope.teamIds.includes(course.teamId)
  ) {
    return json(err('forbidden', 'Out of scope.'), { status: 403 });
  }

  return json(ok(course));
}

const Patch = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  teamId: z.string().min(1).nullable().optional(),
  content: z.unknown().optional(),
  requiredFor: z.string().nullable().optional(),
  passingScore: z.number().int().min(0).max(100).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const existing = await prisma.course.findFirst({
    where: { id: params.id, orgId: ctx.orgId },
    select: { id: true, teamId: true },
  });
  if (!existing) return json(err('not_found', 'Course not found.'), { status: 404 });
  if (existing.teamId && !canWriteToTeam(ctx.scope, existing.teamId)) {
    return json(err('forbidden', 'Out of scope.'), { status: 403 });
  }

  const parsed = Patch.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.requiredFor !== undefined) data.requiredFor = parsed.data.requiredFor;
  if (parsed.data.passingScore !== undefined) data.passingScore = parsed.data.passingScore;
  if (parsed.data.teamId !== undefined) {
    if (parsed.data.teamId && !canWriteToTeam(ctx.scope, parsed.data.teamId)) {
      return json(err('forbidden', 'Out of team scope.'), { status: 403 });
    }
    data.teamId = parsed.data.teamId;
  }
  if (parsed.data.content !== undefined) {
    try {
      data.content = validateCourseContent(parsed.data.content) as never;
    } catch (e) {
      return json(
        err('invalid_schema', e instanceof Error ? e.message : 'Invalid content'),
        { status: 400 },
      );
    }
  }

  const updated = await prisma.course.update({ where: { id: params.id }, data });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'course.updated',
    entity: 'Course',
    entityId: params.id,
    metadata: { fields: Object.keys(data) },
  });

  return json(ok(updated));
}
