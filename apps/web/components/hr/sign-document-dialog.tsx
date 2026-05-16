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
} from '@roster/ui';
import { SignaturePad } from '@/components/tasks/signature-pad';

export function SignDocumentDialog({
  open,
  onOpenChange,
  document,
  onSigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: { id: string; title: string };
  onSigned: () => void;
}) {
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign: {document.title}</DialogTitle>
          <DialogDescription>
            Your signature is recorded with a timestamp.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!signatureData) {
              setError('Sign above first.');
              return;
            }
            setSubmitting(true);
            setError(null);
            const res = await fetch(`/api/documents/${document.id}/sign`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ signatureData }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onSigned();
          }}
        >
          <SignaturePad value={signatureData} onChange={setSignatureData} />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !signatureData}>
              {submitting ? 'Saving…' : 'I agree, sign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
