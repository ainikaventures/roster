import * as React from 'react';

// ---------------------------------------------------------------------------
// Tiny markdown renderer.
//
// Outputs React elements directly (never HTML strings) so XSS is impossible
// by construction. Avoids the size + supply-chain cost of pulling in a full
// markdown engine for the limited subset we actually use in the KB.
//
// Supported:
//   # / ## / ### headings
//   **bold**, *italic*, `inline code`
//   - / 1. lists (single level)
//   ```fenced code blocks```
//   [link text](https://…)
//   Paragraphs separated by blank lines
//   ---
// ---------------------------------------------------------------------------

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const blocks = parseBlocks(children);
  return (
    <div className={className ?? 'prose prose-sm max-w-none'}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lang: string | null; body: string }
  | { kind: 'hr' };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const line = raw.trimEnd();

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || null;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push({ kind: 'code', lang, body: body.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!,
      });
      i += 1;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph: gather consecutive non-empty, non-block lines.
    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (
        !next.trim() ||
        next.startsWith('```') ||
        next.startsWith('#') ||
        /^[-*]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^(?:---|\*\*\*|___)\s*$/.test(next.trim())
      ) {
        break;
      }
      paragraph.push(next);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.kind) {
    case 'heading': {
      const tag = `h${block.level}` as const;
      const cls =
        block.level === 1
          ? 'mt-6 text-2xl font-bold tracking-tight first:mt-0'
          : block.level === 2
            ? 'mt-5 text-xl font-semibold tracking-tight first:mt-0'
            : 'mt-4 text-lg font-semibold first:mt-0';
      return React.createElement(tag, { key, className: cls }, renderInline(block.text));
    }
    case 'paragraph':
      return (
        <p key={key} className="my-3 leading-relaxed">
          {renderInline(block.text)}
        </p>
      );
    case 'ul':
      return (
        <ul key={key} className="my-3 ml-5 list-disc space-y-1">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={key} className="my-3 ml-5 list-decimal space-y-1">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case 'code':
      return (
        <pre
          key={key}
          className="my-3 overflow-x-auto rounded-md border bg-muted/60 p-3 text-xs leading-relaxed"
        >
          <code>{block.body}</code>
        </pre>
      );
    case 'hr':
      return <hr key={key} className="my-6 border-t" />;
  }
}

// ---------------------------------------------------------------------------
// Inline renderer — bold / italic / code / links.
// Returns React nodes; never strings to dangerouslySetInnerHTML.
// ---------------------------------------------------------------------------

const TOKEN_RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\((?:https?:[^)]+)\))/g;

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, 'g');

  while ((match = re.exec(text)) != null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0]!;
    parts.push(renderToken(token, parts.length));
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderToken(token: string, key: number): React.ReactNode {
  if (token.startsWith('**')) {
    return <strong key={key}>{token.slice(2, -2)}</strong>;
  }
  if (token.startsWith('*')) {
    return <em key={key}>{token.slice(1, -1)}</em>;
  }
  if (token.startsWith('`')) {
    return (
      <code
        key={key}
        className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
      >
        {token.slice(1, -1)}
      </code>
    );
  }
  // Link: [label](url) — already restricted to http(s) by the regex.
  const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (linkMatch) {
    return (
      <a
        key={key}
        href={linkMatch[2]!}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 hover:underline"
      >
        {linkMatch[1]}
      </a>
    );
  }
  return token;
}
