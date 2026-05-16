import { describe, expect, it } from 'vitest';
import { gradeQuiz, isCourseComplete, validateCourseContent } from '@/lib/courses';

describe('validateCourseContent', () => {
  it('accepts a single text module', () => {
    const c = validateCourseContent({
      modules: [{ id: 'm1', kind: 'text', title: 'Intro', body: 'Hello' }],
    });
    expect(c.modules[0]?.kind).toBe('text');
  });

  it('rejects a quiz with no correct option', () => {
    expect(() =>
      validateCourseContent({
        modules: [
          {
            id: 'q1',
            kind: 'quiz',
            title: 'Q',
            passingScore: 50,
            questions: [
              {
                id: 'x',
                prompt: '?',
                options: [
                  { id: 'a', label: 'A' },
                  { id: 'b', label: 'B' },
                ],
                correctOptionId: 'c',
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('gradeQuiz', () => {
  const quiz = {
    id: 'q',
    kind: 'quiz' as const,
    title: 'q',
    passingScore: 70,
    questions: [
      {
        id: 'one',
        prompt: '1?',
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        correctOptionId: 'a',
      },
      {
        id: 'two',
        prompt: '2?',
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        correctOptionId: 'b',
      },
    ],
  };

  it('marks all-correct as passing', () => {
    const r = gradeQuiz(quiz, { one: 'a', two: 'b' });
    expect(r.scorePercent).toBe(100);
    expect(r.passed).toBe(true);
  });

  it('marks half-correct as failing under a 70% threshold', () => {
    const r = gradeQuiz(quiz, { one: 'a', two: 'a' });
    expect(r.scorePercent).toBe(50);
    expect(r.passed).toBe(false);
  });
});

describe('isCourseComplete', () => {
  it('requires every module to be recorded', () => {
    const content = validateCourseContent({
      modules: [
        { id: 'a', kind: 'text', title: 'A', body: 'a' },
        { id: 'b', kind: 'text', title: 'B', body: 'b' },
      ],
    });
    expect(
      isCourseComplete(content, { a: { completedAt: 'x' } }),
    ).toBe(false);
    expect(
      isCourseComplete(content, {
        a: { completedAt: 'x' },
        b: { completedAt: 'y' },
      }),
    ).toBe(true);
  });
});
