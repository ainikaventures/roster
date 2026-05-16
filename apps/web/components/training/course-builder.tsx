'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@roster/ui';

type ModuleKind = 'text' | 'image' | 'video' | 'quiz';

type DraftModule = {
  id: string;
  title: string;
  kind: ModuleKind;
  body?: string;
  url?: string;
  caption?: string;
  passingScore?: number;
  questions?: DraftQuestion[];
};

type DraftQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
};

type Team = { id: string; name: string; color: string | null; branchId: string };

export function CourseBuilder({
  teams,
  canMakeRequired,
}: {
  teams: Team[];
  canMakeRequired: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [teamId, setTeamId] = React.useState<string>('');
  const [requiredForAll, setRequiredForAll] = React.useState(false);
  const [publishImmediately, setPublishImmediately] = React.useState(false);
  const [modules, setModules] = React.useState<DraftModule[]>([
    { id: 'intro', title: 'Introduction', kind: 'text', body: '# Welcome\n' },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function addModule(kind: ModuleKind) {
    const ids = new Set(modules.map((m) => m.id));
    let i = modules.length + 1;
    while (ids.has(`mod_${i}`)) i += 1;
    const base = { id: `mod_${i}`, title: 'New module', kind };
    setModules([
      ...modules,
      kind === 'quiz'
        ? {
            ...base,
            passingScore: 70,
            questions: [
              {
                id: 'q1',
                prompt: 'Question?',
                options: [
                  { id: 'a', label: 'Option A' },
                  { id: 'b', label: 'Option B' },
                ],
                correctOptionId: 'a',
              },
            ],
          }
        : base,
    ]);
  }

  function update(idx: number, patch: Partial<DraftModule>) {
    setModules((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }
  function remove(idx: number) {
    setModules((prev) => prev.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    setModules((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target]!, next[idx]!];
      return next;
    });
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError('Title is required.');
    if (modules.length === 0) return setError('Add at least one module.');

    setSubmitting(true);
    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        teamId: teamId || null,
        requiredFor: requiredForAll ? 'ALL' : null,
        content: { modules },
      }),
    });
    const body = await res.json();
    if (!body.ok) {
      setSubmitting(false);
      setError(body.error?.message ?? 'Failed');
      return;
    }
    const created = body.data as { id: string };

    if (publishImmediately) {
      await fetch(`/api/courses/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });
    }

    setSubmitting(false);
    router.push('/app/training');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New course</h1>
        <p className="text-sm text-muted-foreground">
          Sequence text, image, video, and quiz modules. Saves as draft until you publish.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-md border bg-background p-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="team">Audience</Label>
            <select
              id="team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Org-wide</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {canMakeRequired && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requiredForAll}
                onChange={(e) => setRequiredForAll(e.target.checked)}
              />
              Required for everyone in the org
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
            />
            Publish immediately
          </label>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {modules.map((m, idx) => (
          <ModuleEditor
            key={m.id}
            module={m}
            onUpdate={(p) => update(idx, p)}
            onRemove={() => remove(idx)}
            onMoveUp={idx > 0 ? () => move(idx, -1) : undefined}
            onMoveDown={idx < modules.length - 1 ? () => move(idx, 1) : undefined}
          />
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addModule('text')}>
            <Plus className="mr-1 h-3 w-3" /> Text
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addModule('image')}>
            <Plus className="mr-1 h-3 w-3" /> Image
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addModule('video')}>
            <Plus className="mr-1 h-3 w-3" /> Video
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addModule('quiz')}>
            <Plus className="mr-1 h-3 w-3" /> Quiz
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push('/app/training')}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={submitting}>
          {submitting ? 'Saving…' : publishImmediately ? 'Publish' : 'Save draft'}
        </Button>
      </div>
    </div>
  );
}

function ModuleEditor({
  module,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  module: DraftModule;
  onUpdate: (patch: Partial<DraftModule>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {module.kind}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!onMoveUp} onClick={onMoveUp} className="rounded-md p-1 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" disabled={!onMoveDown} onClick={onMoveDown} className="rounded-md p-1 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} className="rounded-md p-1 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            value={module.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            maxLength={140}
            className="mt-1.5"
          />
        </div>

        {module.kind === 'text' && (
          <div>
            <Label>Body (Markdown)</Label>
            <textarea
              value={module.body ?? ''}
              onChange={(e) => onUpdate({ body: e.target.value })}
              rows={6}
              className="mt-1.5 w-full rounded-md border bg-background p-2 font-mono text-xs"
              placeholder="# Section&#10;**Bold** text, *italic*, [link](https://…), - list item"
            />
          </div>
        )}

        {(module.kind === 'image' || module.kind === 'video') && (
          <>
            <div>
              <Label>URL</Label>
              <Input
                value={module.url ?? ''}
                onChange={(e) => onUpdate({ url: e.target.value })}
                type="url"
                placeholder={
                  module.kind === 'image'
                    ? 'https://…/image.png'
                    : 'https://youtube.com/watch?v=…'
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Caption</Label>
              <Input
                value={module.caption ?? ''}
                onChange={(e) => onUpdate({ caption: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </>
        )}

        {module.kind === 'quiz' && (
          <QuizEditor module={module} onUpdate={onUpdate} />
        )}
      </CardContent>
    </Card>
  );
}

function QuizEditor({
  module,
  onUpdate,
}: {
  module: DraftModule;
  onUpdate: (patch: Partial<DraftModule>) => void;
}) {
  const questions = module.questions ?? [];

  function addQuestion() {
    const ids = new Set(questions.map((q) => q.id));
    let i = questions.length + 1;
    while (ids.has(`q${i}`)) i += 1;
    onUpdate({
      questions: [
        ...questions,
        {
          id: `q${i}`,
          prompt: 'New question',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          correctOptionId: 'a',
        },
      ],
    });
  }

  function updateQuestion(qi: number, patch: Partial<DraftQuestion>) {
    onUpdate({
      questions: questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)),
    });
  }
  function removeQuestion(qi: number) {
    onUpdate({ questions: questions.filter((_, i) => i !== qi) });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Passing score (%)</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={module.passingScore ?? 70}
          onChange={(e) => onUpdate({ passingScore: Number(e.target.value) })}
          className="mt-1.5 max-w-[8rem]"
        />
      </div>

      <ul className="space-y-2">
        {questions.map((q, qi) => (
          <li key={q.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-start gap-2">
              <Input
                value={q.prompt}
                onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                className="flex-1"
                placeholder="Question prompt"
              />
              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1.5 pl-2">
              {q.options.map((o, oi) => (
                <li key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    checked={q.correctOptionId === o.id}
                    onChange={() => updateQuestion(qi, { correctOptionId: o.id })}
                  />
                  <Input
                    value={o.label}
                    onChange={(e) => {
                      const next = q.options.map((opt, oj) =>
                        oj === oi ? { ...opt, label: e.target.value } : opt,
                      );
                      updateQuestion(qi, { options: next });
                    }}
                    placeholder="Option label"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestion(qi, {
                        options: q.options.filter((_, oj) => oj !== oi),
                      })
                    }
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                    aria-label="Remove option"
                    disabled={q.options.length <= 2}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const used = new Set(q.options.map((o) => o.id));
                let n = q.options.length + 1;
                while (used.has(String.fromCharCode(96 + n))) n += 1;
                const newId = String.fromCharCode(96 + n);
                updateQuestion(qi, {
                  options: [...q.options, { id: newId, label: 'Option' }],
                });
              }}
            >
              <Plus className="mr-1 h-3 w-3" /> Add option
            </Button>
          </li>
        ))}
      </ul>

      <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
        <Plus className="mr-1 h-3 w-3" /> Add question
      </Button>
    </div>
  );
}
