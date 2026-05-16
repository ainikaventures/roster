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

export function NewTimeOffDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [type, setType] = React.useState<'VACATION' | 'SICK' | 'PERSONAL' | 'UNPAID' | 'OTHER'>(
    'VACATION',
  );
  const [startsAt, setStartsAt] = React.useState('');
  const [endsAt, setEndsAt] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request time off</DialogTitle>
          <DialogDescription>
            We assume 8 hours per day. Approval may take a moment.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/time-off', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type,
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                reason: reason.trim() || undefined,
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onCreated();
          }}
        >
          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="VACATION">Vacation</option>
              <option value="SICK">Sick</option>
              <option value="PERSONAL">Personal</option>
              <option value="UNPAID">Unpaid</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-md border bg-background p-2 text-sm"
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
            <Button type="submit" disabled={submitting || !startsAt || !endsAt}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
