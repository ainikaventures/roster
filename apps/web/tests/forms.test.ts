import { describe, expect, it } from 'vitest';
import { fieldIsVisible, validateAnswers, validateFormSchema } from '@/lib/forms';

describe('validateFormSchema', () => {
  it('accepts a minimal valid schema', () => {
    const s = validateFormSchema({
      fields: [{ id: 'name', kind: 'text', label: 'Name', required: true }],
    });
    expect(s.fields[0]?.id).toBe('name');
  });

  it('rejects duplicate field ids', () => {
    expect(() =>
      validateFormSchema({
        fields: [
          { id: 'x', kind: 'text', label: 'A', required: false },
          { id: 'x', kind: 'text', label: 'B', required: false },
        ],
      }),
    ).toThrow();
  });
});

describe('fieldIsVisible', () => {
  it('always shows fields without showIf', () => {
    const field = { id: 'x', kind: 'text', label: 'X', required: false } as never;
    expect(fieldIsVisible(field, {})).toBe(true);
  });

  it('honors equals condition', () => {
    const field = {
      id: 'why',
      kind: 'text',
      label: 'Why?',
      required: false,
      showIf: { fieldId: 'mood', op: 'equals', value: 'sad' },
    } as never;
    expect(fieldIsVisible(field, { mood: 'sad' })).toBe(true);
    expect(fieldIsVisible(field, { mood: 'happy' })).toBe(false);
  });
});

describe('validateAnswers', () => {
  it('flags missing required fields', () => {
    const schema = validateFormSchema({
      fields: [{ id: 'name', kind: 'text', label: 'Name', required: true }],
    });
    const result = validateAnswers(schema, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.fieldId).toBe('name');
  });

  it('skips required-ness for fields hidden by showIf', () => {
    const schema = validateFormSchema({
      fields: [
        { id: 'mood', kind: 'text', label: 'Mood', required: false },
        {
          id: 'why',
          kind: 'text',
          label: 'Why?',
          required: true,
          showIf: { fieldId: 'mood', op: 'equals', value: 'sad' },
        },
      ],
    });
    const result = validateAnswers(schema, { mood: 'happy' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.answers.why).toBeNull();
  });

  it('totals scoring from dropdown options and rating', () => {
    const schema = validateFormSchema({
      fields: [
        {
          id: 'clean',
          kind: 'dropdown',
          label: 'Clean?',
          required: true,
          options: [
            { value: 'yes', label: 'Yes', score: 10 },
            { value: 'no', label: 'No', score: 0 },
          ],
        },
        { id: 'tidy', kind: 'rating', label: 'Tidiness', required: true, max: 5 },
      ],
    });
    const result = validateAnswers(schema, { clean: 'yes', tidy: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBe(14);
      expect(result.maxScore).toBe(15);
    }
  });
});
