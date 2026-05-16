'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@roster/ui';

type StepKind = 'text' | 'video' | 'read_doc' | 'sign_doc' | 'form' | 'task';

type DraftStep = {
  id: string;
  title: string;
  description?: string;
  kind: StepKind;
  url?: string;
  documentId?: string;
  formId?: string;
  taskId?: string;
};

const KIND_LABEL: Record<StepKind, string> = {
  text: 'Read note',
  video: 'Watch video',
  read_doc: 'Read document',
  sign_doc: 'Sign document',
  form: 'Complete form',
  task: 'Complete task',
};

export function NewOnboardingTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [steps, setSteps] = React.useState<DraftStep[]>([
    { id: 'welcome', title: 'Welcome', kind: 'text' },
  ]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function addStep() {
    const ids = new Set(steps.map((s) => s.id));
    let i = steps.length + 1;
    while (ids.has(`step_${i}`)) i += 1;
    setSteps([...steps, { id: `step_${i}`, title: 'New step', kind: 'text' }]);
  }

  function update(idx: number, patch: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function remove(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError('Title is required.');
    if (steps.length === 0) return setError('Add at least one step.');

    setSubmitting(true);
    const res = await fetch('/api/onboarding/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        steps,
      }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (!body.ok) {
      setError(body.error?.message ?? 'Failed');
      return;
    }
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New onboarding template</DialogTitle>
          <DialogDescription>
            Sequence the steps a new hire walks through. Reference doc, form,
            and task IDs by their cuid — full pickers land in a later iteration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="mt-1.5"
            />
          </div>

          <div className="space-y-2">
            <Label>Steps</Label>
            <ul className="space-y-2">
              {steps.map((step, idx) => (
                <li key={step.id} className="rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 text-xs font-medium text-muted-foreground">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          value={step.title}
                          onChange={(e) => update(idx, { title: e.target.value })}
                          className="col-span-2"
                          placeholder="Step title"
                        />
                        <select
                          value={step.kind}
                          onChange={(e) =>
                            update(idx, { kind: e.target.value as StepKind })
                          }
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                        >
                          {Object.entries(KIND_LABEL).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        value={step.description ?? ''}
                        onChange={(e) => update(idx, { description: e.target.value })}
                        placeholder="Description (optional)"
                      />
                      {step.kind === 'video' && (
                        <Input
                          value={step.url ?? ''}
                          onChange={(e) => update(idx, { url: e.target.value })}
                          placeholder="https://… (video URL)"
                          type="url"
                        />
                      )}
                      {(step.kind === 'read_doc' || step.kind === 'sign_doc') && (
                        <Input
                          value={step.documentId ?? ''}
                          onChange={(e) => update(idx, { documentId: e.target.value })}
                          placeholder="Document ID"
                          className="font-mono text-xs"
                        />
                      )}
                      {step.kind === 'form' && (
                        <Input
                          value={step.formId ?? ''}
                          onChange={(e) => update(idx, { formId: e.target.value })}
                          placeholder="Form template ID"
                          className="font-mono text-xs"
                        />
                      )}
                      {step.kind === 'task' && (
                        <Input
                          value={step.taskId ?? ''}
                          onChange={(e) => update(idx, { taskId: e.target.value })}
                          placeholder="Task ID"
                          className="font-mono text-xs"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Remove step"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={addStep}>
              <Plus className="mr-1 h-3 w-3" /> Add step
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
