'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@roster/ui';
import {
  type FieldDef,
  type FormSchema,
  fieldIsVisible,
  validateFormSchema,
} from '@/lib/forms';
import { SignaturePad } from '@/components/tasks/signature-pad';

export function FormRunner({
  formId,
  title,
  description,
  schema: rawSchema,
}: {
  formId: string;
  title: string;
  description: string | null;
  schema: { fields: unknown[] };
}) {
  const router = useRouter();
  const schema: FormSchema = React.useMemo(
    () => validateFormSchema(rawSchema),
    [rawSchema],
  );

  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const set = (id: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch(`/api/forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const body = await res.json();
    setSubmitting(false);

    if (!body.ok) {
      setSubmitError(body.error?.message ?? 'Failed to submit');
      // Parse "field: msg; field: msg" into a map for inline display.
      const msg = body.error?.message ?? '';
      const next: Record<string, string> = {};
      for (const part of msg.split(';').map((s: string) => s.trim())) {
        const m = part.match(/^([a-z0-9_]+):\s*(.+)$/i);
        if (m) next[m[1]!] = m[2]!;
      }
      setErrors(next);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Submitted</CardTitle>
          <CardDescription>Thanks — your response was recorded.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={() => router.push('/app/forms')}>Back to forms</Button>
          <Button
            variant="outline"
            onClick={() => {
              setAnswers({});
              setSuccess(false);
            }}
          >
            Submit another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      </Card>

      {schema.fields.map((field) => {
        if (!fieldIsVisible(field, answers)) return null;
        return (
          <Card key={field.id}>
            <CardContent className="space-y-2 py-4">
              <FieldRenderer
                field={field}
                value={answers[field.id]}
                onChange={(v) => set(field.id, v)}
                error={errors[field.id]}
              />
            </CardContent>
          </Card>
        );
      })}

      {submitError && !Object.keys(errors).length && (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push('/app/forms')}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </form>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const helpId = `${field.id}-help`;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={field.id}>
          {field.label}
          {field.required && <span className="ml-1 text-destructive">*</span>}
        </Label>
      </div>
      {field.helpText && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      )}

      {field.kind === 'text' && (
        field.multiline ? (
          <textarea
            id={field.id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? ''}
            maxLength={field.maxLength}
            rows={4}
            className="w-full rounded-md border bg-background p-2 text-sm"
            aria-describedby={field.helpText ? helpId : undefined}
          />
        ) : (
          <Input
            id={field.id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? ''}
            maxLength={field.maxLength}
            aria-describedby={field.helpText ? helpId : undefined}
          />
        )
      )}

      {field.kind === 'number' && (
        <div className="flex items-center gap-2">
          <Input
            id={field.id}
            type="number"
            value={(value as number | string | undefined) ?? ''}
            onChange={(e) =>
              onChange(e.target.value === '' ? null : Number(e.target.value))
            }
            min={field.min}
            max={field.max}
            className="max-w-[12rem]"
          />
          {field.unit && (
            <span className="text-sm text-muted-foreground">{field.unit}</span>
          )}
        </div>
      )}

      {field.kind === 'date' && (
        <Input
          id={field.id}
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.kind === 'dropdown' && (
        <select
          id={field.id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Pick one…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {field.kind === 'rating' && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={field.id}>
          {Array.from({ length: field.max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-9 w-9 rounded-md border text-sm font-medium ${
                value === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent'
              }`}
              role="radio"
              aria-checked={value === n}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {field.kind === 'gps' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (!('geolocation' in navigator)) return;
            navigator.geolocation.getCurrentPosition(
              (pos) =>
                onChange({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                }),
              () => onChange(null),
            );
          }}
        >
          {value
            ? `📍 ${(value as { lat: number; lng: number }).lat.toFixed(4)}, ${(value as { lat: number; lng: number }).lng.toFixed(4)}`
            : 'Capture current location'}
        </Button>
      )}

      {field.kind === 'photo' && (
        <div>
          <input
            id={field.id}
            type="file"
            accept="image/*"
            capture="environment"
            className="block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return onChange(null);
              const reader = new FileReader();
              reader.onload = () => onChange(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value as string}
              alt=""
              className="mt-2 max-h-40 rounded-md border"
            />
          )}
        </div>
      )}

      {field.kind === 'signature' && (
        <SignaturePad value={(value as string) ?? null} onChange={onChange} />
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
