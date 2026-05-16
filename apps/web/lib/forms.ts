import { z } from 'zod';

// ---------------------------------------------------------------------------
// Form schema runtime.
//
// FormTemplate.schema is JSON shaped like:
//   { fields: FieldDef[], scoring?: ScoringConfig, settings?: {...} }
//
// This file defines the supported field types, the wire-format validators,
// the conditional-logic evaluator, and an `answers` validator that produces
// a clean { id → value } object plus an optional score.
//
// Photo / signature fields are present in the schema for forward-compat but
// currently store a base64 / placeholder string — true file uploads land in
// Phase 4 when S3 is wired.
// ---------------------------------------------------------------------------

const FieldOption = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  score: z.number().int().optional(),
});

const ConditionalRule = z
  .object({
    fieldId: z.string().min(1),
    op: z.enum(['equals', 'not_equals', 'in', 'gte', 'lte']),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  })
  .strict();

const FieldBase = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/i, 'lowercase letters, digits, underscores only').max(40),
  label: z.string().min(1).max(140),
  helpText: z.string().max(280).optional(),
  required: z.boolean().default(false),
  /** If set, this field is only shown when the rule evaluates true. */
  showIf: ConditionalRule.optional(),
});

const TextField = FieldBase.extend({
  kind: z.literal('text'),
  placeholder: z.string().max(140).optional(),
  multiline: z.boolean().default(false),
  maxLength: z.number().int().positive().max(10_000).optional(),
});

const NumberField = FieldBase.extend({
  kind: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().max(20).optional(),
});

const DateField = FieldBase.extend({
  kind: z.literal('date'),
});

const DropdownField = FieldBase.extend({
  kind: z.literal('dropdown'),
  options: z.array(FieldOption).min(1).max(50),
});

const RatingField = FieldBase.extend({
  kind: z.literal('rating'),
  max: z.number().int().min(2).max(10).default(5),
});

const GpsField = FieldBase.extend({
  kind: z.literal('gps'),
});

const PhotoField = FieldBase.extend({
  kind: z.literal('photo'),
});

const SignatureField = FieldBase.extend({
  kind: z.literal('signature'),
});

export const FieldDef = z.discriminatedUnion('kind', [
  TextField,
  NumberField,
  DateField,
  DropdownField,
  RatingField,
  GpsField,
  PhotoField,
  SignatureField,
]);

export type FieldDef = z.infer<typeof FieldDef>;

export const ScoringConfig = z
  .object({
    /** Threshold below which submissions get auto-flagged. */
    flagBelow: z.number().int().optional(),
  })
  .optional();

export const FormSchema = z.object({
  fields: z.array(FieldDef).min(1).max(200),
  scoring: ScoringConfig,
  settings: z.object({}).passthrough().optional(),
});

export type FormSchema = z.infer<typeof FormSchema>;

// Ensure field ids are unique within a schema.
export function validateFormSchema(input: unknown): FormSchema {
  const parsed = FormSchema.parse(input);
  const ids = new Set<string>();
  for (const f of parsed.fields) {
    if (ids.has(f.id)) {
      throw new Error(`Duplicate field id "${f.id}"`);
    }
    ids.add(f.id);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Conditional logic evaluator.
// ---------------------------------------------------------------------------

export function fieldIsVisible(
  field: FieldDef,
  answers: Record<string, unknown>,
): boolean {
  if (!field.showIf) return true;
  const { fieldId, op, value } = field.showIf;
  const actual = answers[fieldId];

  switch (op) {
    case 'equals':
      return actual === value;
    case 'not_equals':
      return actual !== value;
    case 'in':
      return Array.isArray(value) ? value.includes(actual as string) : false;
    case 'gte':
      return typeof actual === 'number' && typeof value === 'number' && actual >= value;
    case 'lte':
      return typeof actual === 'number' && typeof value === 'number' && actual <= value;
  }
}

// ---------------------------------------------------------------------------
// Answer validation + scoring.
//
// Skipped fields (hidden by showIf) bypass required-ness checks.
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true; answers: Record<string, unknown>; score: number | null; maxScore: number | null }
  | { ok: false; errors: { fieldId: string; message: string }[] };

export function validateAnswers(
  schema: FormSchema,
  rawAnswers: Record<string, unknown>,
): ValidationResult {
  const errors: { fieldId: string; message: string }[] = [];
  const cleaned: Record<string, unknown> = {};
  let score: number | null = null;
  let maxScore: number | null = null;

  for (const field of schema.fields) {
    if (!fieldIsVisible(field, rawAnswers)) {
      cleaned[field.id] = null;
      continue;
    }

    const raw = rawAnswers[field.id];
    const isEmpty = raw === undefined || raw === null || raw === '';

    if (field.required && isEmpty) {
      errors.push({ fieldId: field.id, message: 'Required' });
      continue;
    }

    if (isEmpty) {
      cleaned[field.id] = null;
      continue;
    }

    const result = coerce(field, raw);
    if (!result.ok) {
      errors.push({ fieldId: field.id, message: result.error });
      continue;
    }
    cleaned[field.id] = result.value;

    if (field.kind === 'dropdown') {
      const opt = field.options.find((o) => o.value === result.value);
      if (opt && typeof opt.score === 'number') {
        score = (score ?? 0) + opt.score;
        const maxForField = Math.max(...field.options.map((o) => o.score ?? 0));
        maxScore = (maxScore ?? 0) + maxForField;
      }
    } else if (field.kind === 'rating') {
      score = (score ?? 0) + (result.value as number);
      maxScore = (maxScore ?? 0) + field.max;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, answers: cleaned, score, maxScore };
}

function coerce(
  field: FieldDef,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (field.kind) {
    case 'text': {
      if (typeof raw !== 'string') return { ok: false, error: 'Expected text' };
      if (field.maxLength && raw.length > field.maxLength) {
        return { ok: false, error: `Max ${field.maxLength} characters` };
      }
      return { ok: true, value: raw };
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: 'Expected a number' };
      if (field.min !== undefined && n < field.min) {
        return { ok: false, error: `Min ${field.min}` };
      }
      if (field.max !== undefined && n > field.max) {
        return { ok: false, error: `Max ${field.max}` };
      }
      return { ok: true, value: n };
    }
    case 'date': {
      if (typeof raw !== 'string') return { ok: false, error: 'Expected a date' };
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return { ok: false, error: 'Invalid date' };
      return { ok: true, value: d.toISOString() };
    }
    case 'dropdown': {
      if (typeof raw !== 'string') return { ok: false, error: 'Pick an option' };
      if (!field.options.some((o) => o.value === raw)) {
        return { ok: false, error: 'Not a valid option' };
      }
      return { ok: true, value: raw };
    }
    case 'rating': {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > field.max) {
        return { ok: false, error: `Pick 1–${field.max}` };
      }
      return { ok: true, value: n };
    }
    case 'gps': {
      if (
        typeof raw === 'object' &&
        raw !== null &&
        'lat' in raw &&
        'lng' in raw &&
        typeof (raw as { lat: unknown }).lat === 'number' &&
        typeof (raw as { lng: unknown }).lng === 'number'
      ) {
        return { ok: true, value: raw };
      }
      return { ok: false, error: 'Expected { lat, lng }' };
    }
    case 'photo':
    case 'signature': {
      // Phase 3 placeholder — accept a non-empty string ("data:image/..." or
      // a future signed-URL ref) so the UI can prove it captured something.
      if (typeof raw === 'string' && raw.length > 0) return { ok: true, value: raw };
      return { ok: false, error: 'Capture required' };
    }
  }
}
