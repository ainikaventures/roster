import { describe, expect, it } from 'vitest';
import { validateOnboardingSchema } from '@/lib/onboarding';

describe('validateOnboardingSchema', () => {
  it('accepts a minimal valid schema', () => {
    const s = validateOnboardingSchema({
      steps: [{ id: 'welcome', title: 'Welcome', kind: 'text' }],
    });
    expect(s.steps[0]?.kind).toBe('text');
  });

  it('rejects duplicate step ids', () => {
    expect(() =>
      validateOnboardingSchema({
        steps: [
          { id: 's1', title: 'a', kind: 'text' },
          { id: 's1', title: 'b', kind: 'text' },
        ],
      }),
    ).toThrow();
  });

  it('requires url on video steps', () => {
    expect(() =>
      validateOnboardingSchema({
        steps: [{ id: 'v', title: 'Watch', kind: 'video' } as unknown],
      }),
    ).toThrow();
  });
});
