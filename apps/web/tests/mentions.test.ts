import { describe, expect, it } from 'vitest';
import { mentionedUserIds, parseMentions, stripMentions } from '@/lib/mentions';

describe('parseMentions', () => {
  it('extracts a single mention', () => {
    const out = parseMentions('hey @[Alex K](abc123) ping');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ label: 'Alex K', userId: 'abc123' });
  });

  it('handles multiple mentions and ignores text without markers', () => {
    const body = '@[A](u1) @[B](u2) plain text';
    expect(mentionedUserIds(body)).toEqual(['u1', 'u2']);
  });

  it('returns empty list when no mentions', () => {
    expect(parseMentions('no @one here')).toEqual([]);
  });
});

describe('stripMentions', () => {
  it('replaces markers with @label for plain-text contexts', () => {
    expect(stripMentions('hi @[Alex K](u1)!')).toBe('hi @Alex K!');
  });
});
