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

export function UploadDocumentDialog({
  open,
  onOpenChange,
  canManageOrgDocs,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManageOrgDocs: boolean;
  onUploaded: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [kind, setKind] = React.useState<
    'POLICY' | 'CONTRACT' | 'CERTIFICATION' | 'ID' | 'HANDBOOK' | 'OTHER'
  >('OTHER');
  const [scope, setScope] = React.useState<'org' | 'self'>(canManageOrgDocs ? 'org' : 'self');
  const [expiresAt, setExpiresAt] = React.useState('');
  const [requireSignature, setRequireSignature] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Up to 20 MB. Files are stored locally until S3 is configured.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) {
              setError('Pick a file first.');
              return;
            }
            setSubmitting(true);
            setError(null);

            const form = new FormData();
            form.set('file', file);
            form.set('title', title.trim() || file.name);
            if (description.trim()) form.set('description', description.trim());
            form.set('kind', kind);
            if (expiresAt) form.set('expiresAt', new Date(expiresAt).toISOString());
            if (scope === 'org') {
              form.set('ownerId', 'null');
              form.set('requireSignature', String(requireSignature));
            } else {
              form.set('ownerId', '');
            }

            const res = await fetch('/api/documents', { method: 'POST', body: form });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Upload failed');
              return;
            }
            onUploaded();
          }}
        >
          <div>
            <Label htmlFor="file">File</Label>
            <input
              id="file"
              type="file"
              required
              className="mt-1.5 block w-full text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
              }}
            />
          </div>

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
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kind">Kind</Label>
              <select
                id="kind"
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="POLICY">Policy</option>
                <option value="CONTRACT">Contract</option>
                <option value="CERTIFICATION">Certification</option>
                <option value="ID">ID</option>
                <option value="HANDBOOK">Handbook</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="expires">Expires</Label>
              <Input
                id="expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {canManageOrgDocs && (
            <fieldset className="space-y-2 rounded-md border p-3">
              <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Scope
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={scope === 'org'}
                  onChange={() => setScope('org')}
                />
                Org-wide policy / handbook
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={scope === 'self'}
                  onChange={() => setScope('self')}
                />
                My personal file
              </label>

              {scope === 'org' && (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={requireSignature}
                    onChange={(e) => setRequireSignature(e.target.checked)}
                  />
                  Require everyone in the org to sign
                </label>
              )}
            </fieldset>
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
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
