import * as React from 'react';
import { parseMentions } from '@/lib/mentions';

// ---------------------------------------------------------------------------
// Renders a message body, turning `@[Name](userId)` mention markers into
// styled chips. Auto-linkifies http(s) URLs. Preserves newlines.
// ---------------------------------------------------------------------------

const URL_RE = /\b(https?:\/\/[^\s<]+)/g;

export function MessageBody({ body }: { body: string }) {
  const segments = React.useMemo(() => splitByMentions(body), [body]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) =>
        seg.kind === 'mention' ? (
          <span
            key={i}
            className="rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary"
          >
            @{seg.label}
          </span>
        ) : (
          <Linkified key={i} text={seg.text} />
        ),
      )}
    </span>
  );
}

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; label: string; userId: string };

function splitByMentions(body: string): Segment[] {
  const mentions = parseMentions(body);
  if (mentions.length === 0) return [{ kind: 'text', text: body }];

  const out: Segment[] = [];
  let cursor = 0;
  for (const m of mentions) {
    if (m.start > cursor) {
      out.push({ kind: 'text', text: body.slice(cursor, m.start) });
    }
    out.push({ kind: 'mention', label: m.label, userId: m.userId });
    cursor = m.end;
  }
  if (cursor < body.length) {
    out.push({ kind: 'text', text: body.slice(cursor) });
  }
  return out;
}

function Linkified({ text }: { text: string }) {
  const pieces: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, 'g');
  while ((match = re.exec(text)) != null) {
    if (match.index > last) pieces.push(text.slice(last, match.index));
    const href = match[0];
    pieces.push(
      <a
        key={`${match.index}-${href}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 hover:underline"
      >
        {href}
      </a>,
    );
    last = match.index + href.length;
  }
  if (last < text.length) pieces.push(text.slice(last));
  return <>{pieces}</>;
}
