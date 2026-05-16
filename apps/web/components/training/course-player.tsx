'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@roster/ui';
import { Markdown } from '@/components/markdown';
import { type CourseModule, validateCourseContent } from '@/lib/courses';

type Enrollment = {
  id: string;
  progress: Record<string, { completedAt: string; score?: number; passed?: boolean }>;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  score: number | null;
};

export function CoursePlayer({
  courseId,
  title,
  description,
  content: rawContent,
  enrollment,
}: {
  courseId: string;
  title: string;
  description: string | null;
  content: { modules: unknown[] };
  enrollment: Enrollment | null;
}) {
  const content = React.useMemo(() => validateCourseContent(rawContent), [rawContent]);
  const qc = useQueryClient();
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [quizAnswers, setQuizAnswers] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const progress = enrollment?.progress ?? {};
  const completedCount = Object.keys(progress).length;
  const total = content.modules.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const completed = enrollment?.status === 'COMPLETED';
  const failed = enrollment?.status === 'FAILED';

  const submitModule = useMutation({
    mutationFn: async ({
      moduleId,
      quizAnswers: answers,
    }: {
      moduleId: string;
      quizAnswers?: Record<string, string>;
    }) => {
      const res = await fetch(`/api/courses/${courseId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, quizAnswers: answers }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      setQuizAnswers({});
      setError(null);
      qc.invalidateQueries({ queryKey: ['courses'] });
      // Move to next incomplete module.
      const next = content.modules.findIndex(
        (m, i) => i > activeIdx && !progress[m.id],
      );
      if (next !== -1) setActiveIdx(next);
    },
    onError: (e: Error) => setError(e.message),
  });

  const activeModule = content.modules[activeIdx];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-all',
                completed ? 'bg-emerald-500' : failed ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {completedCount}/{total}
          </span>
          {completed && enrollment?.score != null && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> {enrollment.score}%
            </Badge>
          )}
          {failed && <Badge variant="destructive">Failed</Badge>}
        </div>
      </header>

      <nav aria-label="Modules" className="flex flex-wrap gap-1.5">
        {content.modules.map((m, i) => {
          const done = !!progress[m.id];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                i === activeIdx
                  ? 'border-foreground bg-foreground text-background'
                  : done
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700'
                    : 'border-input text-muted-foreground hover:bg-accent',
              )}
            >
              {done && <Check className="h-3 w-3" aria-hidden />}
              <span>{i + 1}. {m.title}</span>
            </button>
          );
        })}
      </nav>

      {activeModule && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{activeModule.title}</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {activeModule.kind}
              </Badge>
            </div>
            {progress[activeModule.id] && (
              <CardDescription>
                Completed
                {typeof progress[activeModule.id]?.score === 'number' &&
                  ` · scored ${progress[activeModule.id]!.score}%`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ModuleContent module={activeModule} />

            {activeModule.kind === 'quiz' && !progress[activeModule.id] && (
              <QuizForm
                module={activeModule}
                answers={quizAnswers}
                onChange={setQuizAnswers}
              />
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              {!progress[activeModule.id] && (
                <Button
                  onClick={() => {
                    if (activeModule.kind === 'quiz') {
                      const missing = activeModule.questions.some(
                        (q) => !quizAnswers[q.id],
                      );
                      if (missing) {
                        setError('Answer every question first.');
                        return;
                      }
                      submitModule.mutate({
                        moduleId: activeModule.id,
                        quizAnswers,
                      });
                    } else {
                      submitModule.mutate({ moduleId: activeModule.id });
                    }
                  }}
                  disabled={submitModule.isPending}
                >
                  {submitModule.isPending
                    ? 'Saving…'
                    : activeModule.kind === 'quiz'
                      ? 'Submit answers'
                      : 'Mark complete'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ModuleContent({ module }: { module: CourseModule }) {
  switch (module.kind) {
    case 'text':
      return <Markdown>{module.body}</Markdown>;
    case 'image':
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={module.url}
            alt={module.caption ?? module.title}
            className="rounded-md border"
          />
          {module.caption && (
            <figcaption className="mt-2 text-xs text-muted-foreground">
              {module.caption}
            </figcaption>
          )}
        </figure>
      );
    case 'video':
      return (
        <div className="space-y-2">
          <div className="aspect-video overflow-hidden rounded-md border bg-black">
            {/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(module.url) ? (
              <iframe
                src={toEmbedUrl(module.url)}
                className="h-full w-full"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={module.title}
              />
            ) : (
              <video src={module.url} controls className="h-full w-full" />
            )}
          </div>
          {module.caption && (
            <p className="text-xs text-muted-foreground">{module.caption}</p>
          )}
        </div>
      );
    case 'quiz':
      return (
        <p className="text-sm text-muted-foreground">
          {module.questions.length} question{module.questions.length === 1 ? '' : 's'} ·
          pass at {module.passingScore}%
        </p>
      );
  }
}

function QuizForm({
  module,
  answers,
  onChange,
}: {
  module: CourseModule & { kind: 'quiz' };
  answers: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <ol className="space-y-4">
      {module.questions.map((q, idx) => (
        <li key={q.id} className="space-y-2 rounded-md border p-3">
          <div className="text-sm font-medium">
            {idx + 1}. {q.prompt}
          </div>
          <div className="space-y-1.5">
            {q.options.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === o.id}
                  onChange={() => onChange({ ...answers, [q.id]: o.id })}
                />
                {o.label}
              </label>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

function toEmbedUrl(url: string): string {
  // youtu.be/ID or youtube.com/watch?v=ID
  const idMatch =
    url.match(/youtu\.be\/([\w-]+)/) ?? url.match(/[?&]v=([\w-]+)/);
  return idMatch ? `https://www.youtube.com/embed/${idMatch[1]}` : url;
}
