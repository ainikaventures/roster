import { describe, expect, it } from 'vitest';
import { err, ok } from '@roster/types';

describe('API result envelope', () => {
  it('wraps success payloads', () => {
    const result = ok({ orgId: 'abc' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.orgId).toBe('abc');
  });

  it('wraps error payloads', () => {
    const result = err('invalid_input', 'too short');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_input');
      expect(result.error.message).toBe('too short');
    }
  });
});
