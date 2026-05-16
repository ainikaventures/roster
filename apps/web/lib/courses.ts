import { z } from 'zod';

// ---------------------------------------------------------------------------
// Course module runtime.
//
// A course's `content` field is { modules: CourseModule[] }. Module kinds:
//   - text:  markdown body, just read-and-acknowledge
//   - image: image URL (S3 ref in later phases) + caption
//   - video: video URL (YouTube embed or direct mp4)
//   - quiz:  question[] with one correct option per question; passes when
//            the learner reaches `passingScore` (0–100 percent)
//
// Quiz scoring: each question is worth 1 point; final score = correct / total.
// ---------------------------------------------------------------------------

const ModuleBase = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/i).max(40),
  title: z.string().min(1).max(140),
});

const TextModule = ModuleBase.extend({
  kind: z.literal('text'),
  body: z.string().min(1).max(50_000),
});

const ImageModule = ModuleBase.extend({
  kind: z.literal('image'),
  url: z.string().url(),
  caption: z.string().max(280).optional(),
});

const VideoModule = ModuleBase.extend({
  kind: z.literal('video'),
  url: z.string().url(),
  caption: z.string().max(280).optional(),
});

const QuizQuestion = z
  .object({
    id: z.string().min(1).max(40),
    prompt: z.string().min(1).max(500),
    options: z
      .array(
        z.object({
          id: z.string().min(1).max(20),
          label: z.string().min(1).max(280),
        }),
      )
      .min(2)
      .max(10),
    correctOptionId: z.string().min(1),
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    message: 'correctOptionId must match an option id',
    path: ['correctOptionId'],
  });

const QuizModule = ModuleBase.extend({
  kind: z.literal('quiz'),
  passingScore: z.number().int().min(0).max(100).default(70),
  questions: z.array(QuizQuestion).min(1).max(50),
});

export const CourseModule = z.discriminatedUnion('kind', [
  TextModule,
  ImageModule,
  VideoModule,
  QuizModule,
]);
export type CourseModule = z.infer<typeof CourseModule>;

export const CourseContent = z.object({
  modules: z.array(CourseModule).min(1).max(100),
});
export type CourseContent = z.infer<typeof CourseContent>;

export function validateCourseContent(input: unknown): CourseContent {
  const parsed = CourseContent.parse(input);
  const ids = new Set<string>();
  for (const m of parsed.modules) {
    if (ids.has(m.id)) throw new Error(`Duplicate module id "${m.id}"`);
    ids.add(m.id);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Quiz grading.
//
// answers: { [questionId]: optionId }
// Returns the percentage score (0–100) and whether it cleared passingScore.
// ---------------------------------------------------------------------------

export type QuizResult = {
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  passed: boolean;
};

export function gradeQuiz(
  module: CourseModule & { kind: 'quiz' },
  answers: Record<string, string>,
): QuizResult {
  const total = module.questions.length;
  let correct = 0;
  for (const q of module.questions) {
    if (answers[q.id] === q.correctOptionId) correct += 1;
  }
  const scorePercent = total === 0 ? 100 : Math.round((correct / total) * 100);
  return {
    totalQuestions: total,
    correctCount: correct,
    scorePercent,
    passed: scorePercent >= module.passingScore,
  };
}

// Aggregate progress for the enrollment.
export type CourseProgress = Record<
  string,
  {
    completedAt: string;
    score?: number;
    passed?: boolean;
  }
>;

export function isCourseComplete(
  content: CourseContent,
  progress: CourseProgress,
): boolean {
  return content.modules.every((m) => progress[m.id]);
}
