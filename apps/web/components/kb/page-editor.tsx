'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, cn } from '@roster/ui';
import { Markdown } from '@/components/markdown';

type FolderOption = { id: string; name: string; parentId: string | null };

export function PageEditor({
  folders,
  initialFolderId,
  page,
}: {
  folders: FolderOption[];
  initialFolderId: string | null;
  page?: { id: string; title: string; body: string; folderId: string | null };
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(page?.title ?? '');
  const [body, setBody] = React.useState(page?.body ?? '');
  const [folderId, setFolderId] = React.useState<string>(
    page?.folderId ?? initialFolderId ?? '',
  );
  const [tab, setTab] = React.useState<'edit' | 'preview'>('edit');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function save() {
    setError(null);
    if (!title.trim()) return setError('Title is required.');

    setSubmitting(true);
    const url = page ? `/api/kb/pages/${page.id}` : '/api/kb/pages';
    const method = page ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body,
        folderId: folderId || null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!data.ok) {
      setError(data.error?.message ?? 'Failed');
      return;
    }
    router.push(`/app/kb/${page?.id ?? data.data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {page ? 'Edit page' : 'New page'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Markdown is supported. Preview before saving.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="folder">Folder</Label>
            <select
              id="folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Root (no folder)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium',
            tab === 'edit'
              ? 'border-foreground bg-foreground text-background'
              : 'border-input text-muted-foreground hover:bg-accent',
          )}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium',
            tab === 'preview'
              ? 'border-foreground bg-foreground text-background'
              : 'border-input text-muted-foreground hover:bg-accent',
          )}
        >
          <Eye className="h-3.5 w-3.5" /> Preview
        </button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {tab === 'edit' ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={20}
              className="block w-full rounded-md border bg-background p-3 font-mono text-sm"
              placeholder="# Heading&#10;&#10;Paragraph text. **Bold** and *italic*.&#10;&#10;- list item&#10;- another&#10;&#10;`inline code` and [link](https://example.com)"
            />
          ) : body.trim() ? (
            <Markdown>{body}</Markdown>
          ) : (
            <p className="text-sm italic text-muted-foreground">Nothing to preview yet.</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push('/app/kb')}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={submitting}>
          {submitting ? 'Saving…' : page ? 'Save changes' : 'Create page'}
        </Button>
      </div>
    </div>
  );
}
