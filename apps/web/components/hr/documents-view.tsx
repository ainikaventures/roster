'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, format } from 'date-fns';
import { Check, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Card, CardContent, cn } from '@roster/ui';
import { UploadDocumentDialog } from './upload-document-dialog';
import { SignDocumentDialog } from './sign-document-dialog';

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  kind: 'POLICY' | 'CONTRACT' | 'CERTIFICATION' | 'ID' | 'HANDBOOK' | 'OTHER';
  fileUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  expiresAt: string | null;
  requireSignature: boolean;
  ownerId: string | null;
  createdAt: string;
  owner: { id: string; name: string | null; email: string } | null;
  signatures: { id: string; signedAt: string }[];
  _count: { signatures: number };
};

export function DocumentsView({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<'all' | 'mine' | 'policies'>('all');
  const [uploading, setUploading] = React.useState(false);
  const [signing, setSigning] = React.useState<DocumentRow | null>(null);

  const docs = useQuery({
    queryKey: ['documents', tab],
    queryFn: async (): Promise<DocumentRow[]> => {
      const params = new URLSearchParams();
      if (tab === 'mine') params.set('mine', 'true');
      if (tab === 'policies') params.set('kind', 'POLICY');
      const res = await fetch(`/api/documents?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const items = docs.data ?? [];

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Policies, contracts, IDs, and certifications. Files are stored locally
            until S3 is configured.
          </p>
        </div>
        <Button size="sm" onClick={() => setUploading(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Upload
        </Button>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'policies', label: 'Policies' },
            { id: 'mine', label: 'My files' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              tab === t.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-input text-muted-foreground hover:bg-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 && !docs.isLoading && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <FileText className="h-6 w-6" aria-hidden />
              <span>No documents in this view.</span>
            </div>
          )}
          <ul className="divide-y">
            {items.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                canManage={canManage}
                onSign={() => setSigning(doc)}
                onArchive={() => archive.mutate(doc.id)}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      {uploading && (
        <UploadDocumentDialog
          open
          onOpenChange={(o) => setUploading(o)}
          canManageOrgDocs={canManage}
          onUploaded={() => {
            setUploading(false);
            qc.invalidateQueries({ queryKey: ['documents'] });
          }}
        />
      )}

      {signing && (
        <SignDocumentDialog
          open
          document={signing}
          onOpenChange={(o) => !o && setSigning(null)}
          onSigned={() => {
            setSigning(null);
            qc.invalidateQueries({ queryKey: ['documents'] });
          }}
        />
      )}
    </>
  );
}

function DocumentRow({
  doc,
  canManage,
  onSign,
  onArchive,
}: {
  doc: DocumentRow;
  canManage: boolean;
  onSign: () => void;
  onArchive: () => void;
}) {
  const signed = doc.signatures.length > 0;
  const expiresIn = doc.expiresAt ? differenceInDays(new Date(doc.expiresAt), new Date()) : null;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={doc.fileUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline-offset-2 hover:underline"
            >
              {doc.title}
            </a>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {doc.kind.toLowerCase()}
            </Badge>
            {doc.requireSignature && (
              <Badge variant={signed ? 'secondary' : 'destructive'} className="gap-1">
                {signed ? <Check className="h-3 w-3" /> : null}
                {signed ? 'Signed' : 'Signature required'}
              </Badge>
            )}
            {expiresIn !== null && (
              <Badge
                variant={
                  expiresIn < 0 ? 'destructive' : expiresIn <= 30 ? 'destructive' : 'outline'
                }
              >
                {expiresIn < 0
                  ? `Expired ${-expiresIn}d ago`
                  : `Expires in ${expiresIn}d`}
              </Badge>
            )}
          </div>
          {doc.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{doc.description}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doc.owner ? `For ${doc.owner.name ?? doc.owner.email}` : 'Org-wide'} ·{' '}
            {fmtBytes(doc.fileSize)} · uploaded {format(new Date(doc.createdAt), 'MMM d')}
            {doc.requireSignature && (
              <>
                {' '}· {doc._count.signatures} signature
                {doc._count.signatures === 1 ? '' : 's'}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {doc.requireSignature && !signed && (
          <Button size="sm" onClick={onSign}>
            Sign
          </Button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={onArchive}
            aria-label="Archive"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function fmtBytes(n: number | null): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 10 || u === 0 ? 0 : 1)} ${units[u]}`;
}
