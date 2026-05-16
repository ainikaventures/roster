'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  cn,
} from '@roster/ui';

type FieldKind =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'rating'
  | 'gps'
  | 'photo'
  | 'signature';

type DraftField = {
  id: string;
  label: string;
  helpText?: string;
  required: boolean;
  kind: FieldKind;
  // type-specific
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  unit?: string;
  ratingMax?: number;
  options?: { value: string; label: string; score?: number }[];
};

const KIND_LABEL: Record<FieldKind, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  rating: 'Rating',
  gps: 'GPS location',
  photo: 'Photo',
  signature: 'Signature',
};

type Team = { id: string; name: string; color: string | null; branchId: string };

export function FormBuilder({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [teamId, setTeamId] = React.useState<string>('');
  const [fields, setFields] = React.useState<DraftField[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function addField() {
    const id = uniqueId(fields);
    setFields((prev) => [
      ...prev,
      { id, label: 'New question', required: false, kind: 'text' },
    ]);
  }

  function update(idx: number, patch: Partial<DraftField>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function remove(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    setFields((prev) => {
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
    if (fields.length === 0) return setError('Add at least one field.');

    const schema = {
      fields: fields.map((f) => buildField(f)),
    };

    setSubmitting(true);
    const res = await fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        teamId: teamId || null,
        schema,
      }),
    });
    const body = await res.json();
    setSubmitting(false);
    if (!body.ok) {
      setError(body.error?.message ?? 'Failed to save');
      return;
    }
    router.push('/app/forms');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New form</h1>
        <p className="text-sm text-muted-foreground">
          Build a checklist or audit form. You can edit fields any time before publishing.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Form details</CardTitle>
          <CardDescription>Visible to people in the chosen scope.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
              maxLength={140}
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
            <Label htmlFor="team">Team scope</Label>
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
        </CardContent>
      </Card>

      <div className="space-y-3">
        {fields.map((field, idx) => (
          <FieldEditor
            key={field.id}
            field={field}
            onUpdate={(p) => update(idx, p)}
            onRemove={() => remove(idx)}
            onMoveUp={idx > 0 ? () => move(idx, -1) : undefined}
            onMoveDown={idx < fields.length - 1 ? () => move(idx, 1) : undefined}
          />
        ))}

        <Button type="button" variant="outline" onClick={addField} className="w-full">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add field
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push('/app/forms')}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save form'}
        </Button>
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: DraftField;
  onUpdate: (patch: Partial<DraftField>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {KIND_LABEL[field.kind]} · <span className="font-mono normal-case">{field.id}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!onMoveUp}
            onClick={onMoveUp}
            className={cn(
              'rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-30',
            )}
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!onMoveDown}
            onClick={onMoveDown}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Question</Label>
            <Input
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              maxLength={140}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={field.kind}
              onChange={(e) => onUpdate({ kind: e.target.value as FieldKind })}
            >
              {Object.entries(KIND_LABEL).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Help text</Label>
          <Input
            value={field.helpText ?? ''}
            onChange={(e) => onUpdate({ helpText: e.target.value })}
            placeholder="Optional"
            className="mt-1.5"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
          />
          Required
        </label>

        {field.kind === 'text' && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!field.multiline}
              onChange={(e) => onUpdate({ multiline: e.target.checked })}
            />
            Multi-line input
          </label>
        )}

        {field.kind === 'number' && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Min</Label>
              <Input
                type="number"
                value={field.min ?? ''}
                onChange={(e) =>
                  onUpdate({ min: e.target.value === '' ? undefined : Number(e.target.value) })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Max</Label>
              <Input
                type="number"
                value={field.max ?? ''}
                onChange={(e) =>
                  onUpdate({ max: e.target.value === '' ? undefined : Number(e.target.value) })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={field.unit ?? ''}
                onChange={(e) => onUpdate({ unit: e.target.value })}
                placeholder="e.g. °F"
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {field.kind === 'rating' && (
          <div>
            <Label>Scale max</Label>
            <Input
              type="number"
              min={2}
              max={10}
              value={field.ratingMax ?? 5}
              onChange={(e) => onUpdate({ ratingMax: Number(e.target.value) })}
              className="mt-1.5 max-w-[8rem]"
            />
          </div>
        )}

        {field.kind === 'dropdown' && (
          <OptionsEditor
            options={field.options ?? []}
            onChange={(options) => onUpdate({ options })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: { value: string; label: string; score?: number }[];
  onChange: (options: { value: string; label: string; score?: number }[]) => void;
}) {
  function add() {
    onChange([...options, { value: `opt_${options.length + 1}`, label: 'Option' }]);
  }
  function update(idx: number, patch: Partial<{ value: string; label: string; score?: number }>) {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }
  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <ul className="space-y-1.5">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              value={o.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="value"
              className="max-w-[10rem] font-mono text-xs"
            />
            <Input
              value={o.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
            />
            <Input
              type="number"
              value={o.score ?? ''}
              onChange={(e) =>
                update(i, { score: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              placeholder="Score"
              className="max-w-[5rem]"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-md p-1 text-muted-foreground hover:text-destructive"
              aria-label="Remove option"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" onClick={add}>
        <Plus className="mr-1 h-3 w-3" /> Add option
      </Button>
    </div>
  );
}

function uniqueId(existing: DraftField[]): string {
  let i = existing.length + 1;
  let candidate = `field_${i}`;
  const ids = new Set(existing.map((f) => f.id));
  while (ids.has(candidate)) {
    i += 1;
    candidate = `field_${i}`;
  }
  return candidate;
}

function buildField(draft: DraftField): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: draft.id,
    label: draft.label,
    required: draft.required,
    kind: draft.kind,
  };
  if (draft.helpText) base.helpText = draft.helpText;

  switch (draft.kind) {
    case 'text':
      if (draft.multiline) base.multiline = true;
      if (draft.placeholder) base.placeholder = draft.placeholder;
      if (draft.maxLength) base.maxLength = draft.maxLength;
      break;
    case 'number':
      if (draft.min !== undefined) base.min = draft.min;
      if (draft.max !== undefined) base.max = draft.max;
      if (draft.unit) base.unit = draft.unit;
      break;
    case 'rating':
      base.max = draft.ratingMax ?? 5;
      break;
    case 'dropdown':
      base.options = draft.options ?? [];
      break;
    default:
      break;
  }
  return base;
}
