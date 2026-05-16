// ---------------------------------------------------------------------------
// Mention parsing.
//
// Messages use the syntax `@[Name](userId)` so the writer's intent survives
// even if the mentioned user later renames. The chat composer rewrites raw
// "@" lookups into this format before sending.
//
// Returns the set of unique userIds mentioned and a list of plain "@Name"
// references the server can resolve against channel membership.
// ---------------------------------------------------------------------------

const MENTION_RE = /@\[([^\]]+)\]\(([a-z0-9_-]{1,40})\)/gi;

export type Mention = {
  /** Display label as authored (e.g. "Alex K"). */
  label: string;
  /** Stable userId. */
  userId: string;
  /** Byte offset in the message body. */
  start: number;
  end: number;
};

export function parseMentions(body: string): Mention[] {
  const out: Mention[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(body)) != null) {
    out.push({
      label: match[1]!,
      userId: match[2]!,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return out;
}

export function mentionedUserIds(body: string): string[] {
  const ids = new Set<string>();
  for (const m of parseMentions(body)) ids.add(m.userId);
  return [...ids];
}

/**
 * Replaces `@[Name](id)` markers with `@Name` for display when rendering
 * messages in a non-React context (e.g. notification body text).
 */
export function stripMentions(body: string): string {
  return body.replace(MENTION_RE, (_, label) => `@${label}`);
}
