'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@roster/ui';

type ApiKey = {
  id: string;
  prefix: string;
  name: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
};

export function ApiKeysView() {
  const qc = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [revealedKey, setRevealedKey] = React.useState<{
    fullKey: string;
    prefix: string;
  } | null>(null);

  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: async (): Promise<ApiKey[]> => {
      const res = await fetch('/api/api-keys');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <KeyRound className="mr-1.5 h-3.5 w-3.5" /> New key
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {(keys.data ?? []).length === 0 && !keys.isLoading && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No keys yet.
            </p>
          )}
          <ul className="divide-y">
            {(keys.data ?? []).map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{k.name}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {k.prefix}…
                    </code>
                    {k.revokedAt && <Badge variant="destructive">Revoked</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created {format(new Date(k.createdAt), 'MMM d, yyyy')} by{' '}
                    {k.createdBy.name ?? k.createdBy.email} ·{' '}
                    {k.lastUsedAt
                      ? `last used ${format(new Date(k.lastUsedAt), 'MMM d, p')}`
                      : 'never used'}
                  </p>
                  {k.scopes.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Scopes: {k.scopes.join(', ')}
                    </p>
                  )}
                </div>
                {!k.revokedAt && (
                  <button
                    type="button"
                    onClick={() => revoke.mutate(k.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Revoke key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {creating && (
        <CreateKeyDialog
          open
          onOpenChange={(o) => !o && setCreating(false)}
          onCreated={(payload) => {
            setCreating(false);
            setRevealedKey(payload);
            qc.invalidateQueries({ queryKey: ['api-keys'] });
          }}
        />
      )}

      {revealedKey && (
        <RevealKeyDialog
          open
          onOpenChange={(o) => !o && setRevealedKey(null)}
          fullKey={revealedKey.fullKey}
        />
      )}
    </>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (payload: { fullKey: string; prefix: string }) => void;
}) {
  const [name, setName] = React.useState('');
  const [scopes, setScopes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            The full key is shown once — copy it before closing this dialog.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/api-keys', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name.trim(),
                scopes: scopes
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onCreated(body.data);
          }}
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payroll sync"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="scopes">Scopes (comma-separated)</Label>
            <Input
              id="scopes"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="read:shifts, read:time_entries"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Leave blank for full access. Otherwise see the docs for the
              available scope identifiers.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevealKeyDialog({
  open,
  onOpenChange,
  fullKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fullKey: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this key</DialogTitle>
          <DialogDescription>
            You won&apos;t be able to see it again. Store it in your secrets
            manager.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="break-all rounded-md border bg-muted p-3 font-mono text-xs">
            {fullKey}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(fullKey);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy to clipboard'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
