'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button, Card, CardContent, Input } from '@roster/ui';

type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
};

export function AuditLogView() {
  const [actionFilter, setActionFilter] = React.useState('');
  const [entityFilter, setEntityFilter] = React.useState('');
  const [cursor, setCursor] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['audit-log', actionFilter, entityFilter, cursor],
    queryFn: async (): Promise<{ items: AuditEntry[]; nextCursor: string | null }> => {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity', entityFilter);
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/audit-log?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[12rem]">
          <Input
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCursor(null);
            }}
            placeholder="Filter by action (e.g. shift.created)"
          />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <Input
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setCursor(null);
            }}
            placeholder="Filter by entity (e.g. TimeEntry)"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {(query.data?.items ?? []).map((row) => (
              <li key={row.id} className="grid grid-cols-[8rem_1fr_auto] items-start gap-3 p-3 text-sm">
                <code className="font-mono text-xs text-muted-foreground">
                  {format(new Date(row.createdAt), 'MMM d, p')}
                </code>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {row.action}
                    </code>
                    <span className="text-xs text-muted-foreground">{row.entity}</span>
                  </div>
                  {row.metadata != null && (
                    <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-muted/40 p-2 text-[10px] leading-snug text-muted-foreground">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.user ? row.user.name ?? row.user.email : 'system'}
                </div>
              </li>
            ))}
            {(query.data?.items ?? []).length === 0 && !query.isLoading && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                No entries match.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {query.data?.nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(query.data.nextCursor)}
          >
            Load older
          </Button>
        </div>
      )}
    </>
  );
}
