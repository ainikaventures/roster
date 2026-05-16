'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@roster/ui';
import type { Role } from '@roster/db';

export function NewAnnouncementDialog({
  open,
  onOpenChange,
  role,
  branches,
  teams,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  branches: { id: string; name: string }[];
  teams: { id: string; name: string; color: string | null }[];
  onCreated: () => void;
}) {
  const canPostOrgWide = role === 'OWNER' || role === 'ADMIN';
  const [scope, setScope] = React.useState<'ORG' | 'BRANCH' | 'TEAM'>(
    canPostOrgWide ? 'ORG' : teams.length > 0 ? 'TEAM' : 'BRANCH',
  );
  const [scopeId, setScopeId] = React.useState<string>(() =>
    scope === 'TEAM' ? teams[0]?.id ?? '' : scope === 'BRANCH' ? branches[0]?.id ?? '' : '',
  );
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Keep scopeId in sync when scope changes.
  React.useEffect(() => {
    if (scope === 'ORG') setScopeId('');
    else if (scope === 'BRANCH') setScopeId(branches[0]?.id ?? '');
    else setScopeId(teams[0]?.id ?? '');
  }, [scope, branches, teams]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>
            Posts notify everyone in the chosen scope.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/announcements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scope,
                scopeId: scope === 'ORG' ? undefined : scopeId,
                title: title.trim(),
                body: body.trim(),
              }),
            });
            const data = await res.json();
            setSubmitting(false);
            if (!data.ok) {
              setError(data.error?.message ?? 'Failed to post');
              return;
            }
            onCreated();
          }}
        >
          <div>
            <Label htmlFor="scope">Audience</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-md border p-1">
              {(['ORG', 'BRANCH', 'TEAM'] as const).map((s) => {
                const disabled =
                  (s === 'ORG' && !canPostOrgWide) ||
                  (s === 'BRANCH' && branches.length === 0) ||
                  (s === 'TEAM' && teams.length === 0);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={disabled}
                    onClick={() => setScope(s)}
                    className={`rounded-sm px-2 py-1.5 text-xs font-medium uppercase tracking-wide ${
                      scope === s ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    } ${disabled ? 'opacity-40' : ''}`}
                  >
                    {s.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {scope === 'BRANCH' && (
            <div>
              <Label htmlFor="branch">Branch</Label>
              <select
                id="branch"
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'TEAM' && (
            <div>
              <Label htmlFor="team">Team</Label>
              <select
                id="team"
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="body">Body</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={10_000}
              required
              rows={5}
              className="mt-1.5 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
              {submitting ? 'Posting…' : 'Post update'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
