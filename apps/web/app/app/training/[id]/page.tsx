import { notFound } from 'next/navigation';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { CoursePlayer } from '@/components/training/course-player';

export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: { id: string } }) {
  const ctx = await requireScope();

  const course = await prisma.course.findFirst({
    where: {
      id: params.id,
      orgId: ctx.orgId,
      archivedAt: null,
      OR: [
        { status: 'PUBLISHED' },
        ...(['OWNER', 'ADMIN', 'BRANCH_MANAGER', 'TEAM_MANAGER'].includes(ctx.scope.role)
          ? [{ status: 'DRAFT' as const }]
          : []),
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      content: true,
      passingScore: true,
      enrollments: {
        where: { userId: ctx.userId },
        select: { id: true, progress: true, status: true, score: true },
      },
    },
  });

  if (!course) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CoursePlayer
        courseId={course.id}
        title={course.title}
        description={course.description}
        content={course.content as { modules: unknown[] }}
        // Prisma surfaces `progress` as JsonValue; the runtime shape is
        // validated by lib/courses.ts so the cast is safe.
        enrollment={(course.enrollments[0] ?? null) as Parameters<typeof CoursePlayer>[0]['enrollment']}
      />
    </div>
  );
}
