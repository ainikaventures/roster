'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, Check, GraduationCap } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@roster/ui';

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  requiredFor: string | null;
  content: { modules: { id: string; kind: string; title: string }[] };
  team: { id: string; name: string; color: string | null } | null;
  enrollments: {
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    score: number | null;
    progress: Record<string, unknown>;
    completedAt: string | null;
  }[];
  _count: { enrollments: number };
};

export function CoursesList({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = React.useState<'all' | 'mine' | 'required'>('all');

  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: async (): Promise<CourseRow[]> => {
      const res = await fetch('/api/courses');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const items = (courses.data ?? []).filter((c) => {
    if (tab === 'mine') return c.enrollments.length > 0;
    if (tab === 'required') return c.requiredFor === 'ALL';
    return true;
  });

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'required', label: 'Required' },
            { id: 'mine', label: 'In progress' },
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

      {items.length === 0 && !courses.isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <GraduationCap className="h-6 w-6" aria-hidden />
            <span>{tab === 'all' ? 'No courses yet.' : 'Nothing in this view.'}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => {
          const enrollment = c.enrollments[0];
          const completedModules = enrollment ? Object.keys(enrollment.progress).length : 0;
          const totalModules = c.content.modules.length;
          const pct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
          return (
            <Link key={c.id} href={`/app/training/${c.id}`}>
              <Card className="h-full hover:bg-accent/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-1">
                      {c.status !== 'PUBLISHED' && canManage && (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {c.status.toLowerCase()}
                        </Badge>
                      )}
                      {c.requiredFor === 'ALL' && (
                        <Badge variant="destructive">Required</Badge>
                      )}
                      {enrollment?.status === 'COMPLETED' && (
                        <Badge variant="secondary" className="gap-1">
                          <Check className="h-3 w-3" /> Done
                        </Badge>
                      )}
                      {enrollment?.status === 'FAILED' && (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>
                  </div>
                  {c.description && (
                    <CardDescription className="line-clamp-2">
                      {c.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>
                      {totalModules} module{totalModules === 1 ? '' : 's'}
                      {c.team && ` · ${c.team.name}`}
                    </span>
                    {enrollment?.score != null && (
                      <span className="inline-flex items-center gap-1">
                        <Award className="h-3 w-3" /> {enrollment.score}%
                      </span>
                    )}
                  </div>
                  {enrollment && enrollment.status !== 'COMPLETED' && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                        aria-hidden
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
