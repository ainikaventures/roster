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
  Label,
} from '@roster/ui';
import type { Task } from './types';
import { SignaturePad } from './signature-pad';

export function CompleteTaskDialog({
  open,
  onOpenChange,
  task,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onCompleted: () => void;
}) {
  const [notes, setNotes] = React.useState('');
  const [photoData, setPhotoData] = React.useState<string | null>(null);
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete: {task.title}</DialogTitle>
          <DialogDescription>
            {task.recurrence === 'NONE'
              ? 'Marks this task done.'
              : `Records a ${task.recurrence.toLowerCase()} completion.`}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch(`/api/tasks/${task.id}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                notes: notes.trim() || undefined,
                photoData: photoData ?? undefined,
                signatureData: signatureData ?? undefined,
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onCompleted();
          }}
        >
          {(task.requireNote || true) && (
            <div>
              <Label htmlFor="notes">
                Notes {task.requireNote && <span className="text-destructive">*</span>}
              </Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-md border bg-background p-2 text-sm"
              />
            </div>
          )}

          {task.requirePhoto && (
            <div>
              <Label htmlFor="photo">
                Photo <span className="text-destructive">*</span>
              </Label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="mt-1.5 block w-full text-sm"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setPhotoData(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
              {photoData && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoData}
                  alt="Captured"
                  className="mt-2 max-h-40 rounded-md border"
                />
              )}
            </div>
          )}

          {task.requireSignature && (
            <div>
              <Label>
                Signature <span className="text-destructive">*</span>
              </Label>
              <SignaturePad value={signatureData} onChange={setSignatureData} />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Complete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
