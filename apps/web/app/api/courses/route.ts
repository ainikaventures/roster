import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, canWriteToTeam, ctxOr401, err, isManager, json, ok } from '@/lib/api';
import { validateCourseContent } from '@/lib/courses';

// GET /api/courses?status=&mine=
export async function GET(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') as
    | 'DRAFT'
    | 'PUBLISHED'
    | 'ARCHIVED'
    | null;
  const onlyEnrolled = url.searchParams.get('mine') === 'true';

  const teamFilter =
    ctx.scope.teamIds === null
      ? {}
      : { OR: [{ teamId: null }, { teamId: { in: ctx.scope.teamIds } }] };

  const where: Record<string, unknown> = {
    orgId: ctx.orgId,
    archivedAt: null,
    ...(isManager(ctx.scope.role) ? {} : { status: 'PUBLISHED' }),
    ...(status ? { status } : {}),
    ...teamFilter,
  };

  const courses = await prisma.course.findMany({
    where,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      requiredFor: true,
      passingScore: true,
      teamId: true,
      content: true,
      updatedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true, color: true } },
      enrollments: {
        where: { userId: ctx.userId },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          score: true,
          progress: true,
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  const filtered = onlyEnrolled
    ? courses.filter((c) => c.enrollments.length > 0)
    : courses;

  return json(ok(filtered));
}

// POST /api/courses — managers only
const CreateBody = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional(),
  teamId: z.string().min(1).nullable().optional(),
  content: z.unknown(),
  requiredFor: z.string().optional().nullable(),
  passingScore: z.number().int().min(0).max(100).optional(),
});

export async function POST(req: Request) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;
  if (!isManager(ctx.scope.role)) {
    return json(err('forbidden', 'Managers only.'), { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });
  if (parsed.data.teamId && !canWriteToTeam(ctx.scope, parsed.data.teamId)) {
    return json(err('forbidden', 'Out of team scope.'), { status: 403 });
  }
  if (parsed.data.requiredFor === 'ALL' && !['OWNER', 'ADMIN'].includes(ctx.scope.role)) {
    return json(
      err('forbidden', 'Only org admins can mark a course org-wide mandatory.'),
      { status: 403 },
    );
  }

  let content;
  try {
    content = validateCourseContent(parsed.data.content);
  } catch (e) {
    return json(
      err('invalid_schema', e instanceof Error ? e.message : 'Invalid content'),
      { status: 400 },
    );
  }

  const course = await prisma.course.create({
    data: {
      orgId: ctx.orgId,
      teamId: parsed.data.teamId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      content: content as never,
      requiredFor: parsed.data.requiredFor ?? null,
      passingScore: parsed.data.passingScore ?? null,
      createdById: ctx.userId,
      status: 'DRAFT',
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action: 'course.created',
    entity: 'Course',
    entityId: course.id,
    metadata: { moduleCount: content.modules.length },
  });

  return json(ok(course), { status: 201 });
}
