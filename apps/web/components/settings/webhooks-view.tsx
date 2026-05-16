'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Copy, Plus, Trash2 } from 'lucide-react';
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

type Webhook = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  createdAt: string;
  _count: { deliveries: number };
};

const EVENT_OPTIONS = [
  'shift.created',
  'shift.updated',
  'shift.published',
  'time_entry.created',
  'time_entry.approved',
  'task.completed',
  'form.submitted',
  'time_off.requested',
  'time_off.approved',
  'announcement.posted',
];

export function WebhooksView() {
  const qc = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null);

  const hooks = useQuery({
    queryKey: ['webhooks'],
    queryFn: async (): Promise<Webhook[]> => {
      const res = await fetch('/api/webhooks');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New webhook
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {(hooks.data ?? []).length === 0 && !hooks.isLoading && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No webhooks yet.
            </p>
          )}
          <ul className="divide-y">
            {(hooks.data ?? []).map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {h.url}
                    </code>
                    {!h.isActive && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Events:{' '}
                    {h.events.length === 0 ? (
                      <span>all</span>
                    ) : (
                      h.events.join(', ')
                    )}
                    {' · '}
                    {h._count.deliveries} delivery
                    {h._count.deliveries === 1 ? '' : 'ies'} ·{' '}
                    {format(new Date(h.createdAt), 'MMM d, yyyy')}
                  </p>
                  {h.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{h.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={h.isActive}
                      onChange={(e) => toggle.mutate({ id: h.id, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => remove.mutate(h.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {creating && (
        <CreateWebhookDialog
          open
          onOpenChange={(o) => !o && setCreating(false)}
          onCreated={(secret) => {
            setCreating(false);
            setRevealedSecret(secret);
            qc.invalidateQueries({ queryKey: ['webhooks'] });
          }}
        />
      )}

      {revealedSecret && (
        <RevealSecretDialog
          open
          onOpenChange={(o) => !o && setRevealedSecret(null)}
          secret={revealedSecret}
        />
      )}
    </>
  );
}

function CreateWebhookDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (secret: string) => void;
}) {
  const [url, setUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New webhook</DialogTitle>
          <DialogDescription>
            The signing secret is shown once. Save it in your destination service.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/webhooks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: url.trim(),
                events: selected,
                description: description.trim() || undefined,
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onCreated(body.data.secret);
          }}
        >
          <div>
            <Label htmlFor="url">Destination URL</Label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/roster"
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Events</Label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Leave none selected to receive all events.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {EVENT_OPTIONS.map((ev) => (
                <label key={ev} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(ev)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, ev] : prev.filter((x) => x !== ev),
                      )
                    }
                  />
                  <code className="font-mono">{ev}</code>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !url.trim()}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevealSecretDialog({
  open,
  onOpenChange,
  secret,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save the signing secret</DialogTitle>
          <DialogDescription>
            Use this to verify the <code>X-Roster-Signature</code> header on
            each delivery.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="break-all rounded-md border bg-muted p-3 font-mono text-xs">
            {secret}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(secret);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
