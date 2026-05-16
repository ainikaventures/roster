'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ChevronRight, FilePlus } from 'lucide-react';
import { Badge } from '@roster/ui';

type FormSummary = {
  id: string;
  title: string;
  description: string | null;
  teamId: string | null;
  isActive: boolean;
  schema: { fields: { id: string; label: string }[] };
  updatedAt: string;
  team: { id: string; name: string; color: string | null } | null;
  _count: { submissions: number };
};

export function FormsList({ canManage }: { canManage: boolean }) {
  const list = useQuery({
    queryKey: ['forms'],
    queryFn: async (): Promise<FormSummary[]> => {
      const res = await fetch('/api/forms');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const items = list.data ?? [];

  if (items.length === 0 && !list.isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
        <FilePlus className="h-6 w-6" aria-hidden />
        <span>No forms yet.</span>
        {canManage && <span>Create one to start collecting structured submissions.</span>}
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((f) => (
        <li key={f.id}>
          <Link
            href={`/app/forms/${f.id}/fill`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{f.title}</span>
                {f.team && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: f.team.color ?? 'hsl(var(--muted-foreground))' }}
                      aria-hidden
                    />
                    {f.team.name}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px]">
                  {f.schema.fields.length} field{f.schema.fields.length === 1 ? '' : 's'}
                </Badge>
              </div>
              {f.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {f.description}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {f._count.submissions} submission
                {f._count.submissions === 1 ? '' : 's'} · updated{' '}
                {format(new Date(f.updatedAt), 'MMM d')}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
