import { z } from 'zod';
import { prisma } from '@roster/db';
import { audit, ctxOr401, err, json, ok } from '@/lib/api';
import {
  type CourseContent,
  type CourseProgress,
  gradeQuiz,
  isCourseComplete,
  validateCourseContent,
} from '@/lib/courses';

// POST /api/courses/:id/progress
// Marks a single module complete. For quiz modules, expects answers in
// `quizAnswers` and stores the resulting score/passed flag.
const Body = z.object({
  moduleId: z.string().min(1),
  quizAnswers: z.record(z.string()).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const course = await prisma.course.findFirst({
    where: {
      id: params.id,
      orgId: ctx.orgId,
      archivedAt: null,
      status: 'PUBLISHED',
    },
    select: { id: true, title: true, content: true, teamId: true },
  });
  if (!course) return json(err('not_found', 'Course not available.'), { status: 404 });
  if (
    course.teamId &&
    ctx.scope.teamIds !== null &&
    !ctx.scope.teamIds.includes(course.teamId)
  ) {
    return json(err('forbidden', 'Out of scope.'), { status: 403 });
  }

  let content: CourseContent;
  try {
    content = validateCourseContent(course.content);
  } catch {
    return json(err('invalid_schema', 'Course schema invalid'), { status: 500 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return json(err('invalid_input', 'Invalid input'), { status: 400 });

  const module = content.modules.find((m) => m.id === parsed.data.moduleId);
  if (!module) return json(err('invalid_input', 'Unknown module.'), { status: 400 });

  let stepRecord: { completedAt: string; score?: number; passed?: boolean };
  if (module.kind === 'quiz') {
    if (!parsed.data.quizAnswers) {
      return json(err('invalid_input', 'Quiz answers required'), { status: 400 });
    }
    const result = gradeQuiz(module, parsed.data.quizAnswers);
    stepRecord = {
      completedAt: new Date().toISOString(),
      score: result.scorePercent,
      passed: result.passed,
    };
  } else {
    stepRecord = { completedAt: new Date().toISOString() };
  }

  // Find / create enrollment.
  const enrollment = await prisma.courseEnrollment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: ctx.userId } },
    update: {},
    create: { courseId: course.id, userId: ctx.userId, progress: {} as never },
  });

  const prevProgress: CourseProgress =
    typeof enrollment.progress === 'object' && enrollment.progress !== null
      ? (enrollment.progress as CourseProgress)
      : {};

  const nextProgress: CourseProgress = { ...prevProgress, [module.id]: stepRecord };
  const allDone = isCourseComplete(content, nextProgress);

  // For courses with quizzes, a failed quiz blocks completion.
  const anyQuizFailed = content.modules.some(
    (m) => m.kind === 'quiz' && nextProgress[m.id]?.passed === false,
  );

  // Compute aggregate score (average of all quiz scores).
  const quizScores = content.modules
    .filter((m) => m.kind === 'quiz')
    .map((m) => nextProgress[m.id]?.score)
    .filter((s): s is number => typeof s === 'number');
  const aggregateScore =
    quizScores.length > 0
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
      : null;

  const status =
    allDone && anyQuizFailed
      ? 'FAILED'
      : allDone
        ? 'COMPLETED'
        : 'IN_PROGRESS';

  const updated = await prisma.courseEnrollment.update({
    where: { id: enrollment.id },
    data: {
      progress: nextProgress as never,
      score: aggregateScore,
      status,
      completedAt: status === 'COMPLETED' ? new Date() : null,
    },
  });

  await audit({
    orgId: ctx.orgId,
    userId: ctx.userId,
    action:
      status === 'COMPLETED'
        ? 'course.completed'
        : status === 'FAILED'
          ? 'course.failed'
          : 'course.module_completed',
    entity: 'CourseEnrollment',
    entityId: updated.id,
    metadata: { courseId: course.id, moduleId: module.id },
  });

  return json(ok(updated));
}
