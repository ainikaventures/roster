'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@roster/ui';
import type { TeamMember } from '@/components/schedule/types';

export function AssignOnboardingDialog({
  open,
  onOpenChange,
  template,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: { id: string; title: string };
  onAssigned: () => void;
}) {
  const [userId, setUserId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const members = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch('/api/users');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign: {template.title}</DialogTitle>
          <DialogDescription>
            Picks one teammate and starts the workflow.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/onboarding/assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ templateId: template.id, userId }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onAssigned();
          }}
        >
          <div>
            <Label htmlFor="user">Assignee</Label>
            <select
              id="user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Pick a teammate…</option>
              {(members.data ?? []).map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name ?? m.user.email}
                </option>
              ))}
            </select>
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
            <Button type="submit" disabled={submitting || !userId}>
              {submitting ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
