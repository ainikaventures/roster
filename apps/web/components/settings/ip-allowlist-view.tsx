'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Input } from '@roster/ui';

type Entry = {
  id: string;
  cidr: string;
  description: string | null;
  createdAt: string;
};

export function IpAllowlistView() {
  const qc = useQueryClient();
  const [cidr, setCidr] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const list = useQuery({
    queryKey: ['ip-allowlist'],
    queryFn: async (): Promise<Entry[]> => {
      const res = await fetch('/api/ip-allowlist');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ip-allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cidr: cidr.trim(),
          description: description.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      setCidr('');
      setDescription('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['ip-allowlist'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ip-allowlist/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ip-allowlist'] }),
  });

  const entries = list.data ?? [];

  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-xs text-muted-foreground">
            Restrict employee access to specific networks (IPv4 CIDR).
            Owners and admins are always exempt so misconfigurations
            don&apos;t lock you out.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="10.0.0.0/8"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="font-mono"
            />
            <Input
              placeholder="HQ office"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-2"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            size="sm"
            onClick={() => add.mutate()}
            disabled={!cidr.trim() || add.isPending}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No allowlist entries — anyone with a valid login can access.
            </p>
          )}
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <code className="font-mono">{e.cidr}</code>
                  {e.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.description}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate(e.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
