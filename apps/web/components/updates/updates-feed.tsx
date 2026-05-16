'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { Megaphone, Plus } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@roster/ui';
import type { Role } from '@roster/db';
import { NewAnnouncementDialog } from './new-announcement-dialog';

type Announcement = {
  id: string;
  title: string;
  body: string;
  scope: 'ORG' | 'BRANCH' | 'TEAM';
  scopeId: string | null;
  publishedAt: string;
  createdBy: { id: string; name: string | null; email: string; avatarUrl: string | null };
  readAt: string | null;
  readCount: number;
};

export function UpdatesFeed({
  canPost,
  role,
  branches,
  teams,
}: {
  canPost: boolean;
  role: Role;
  branches: { id: string; name: string }[];
  teams: { id: string; name: string; color: string | null }[];
}) {
  const qc = useQueryClient();
  const [composing, setComposing] = React.useState(false);

  const list = useQuery({
    queryKey: ['announcements'],
    queryFn: async (): Promise<Announcement[]> => {
      const res = await fetch('/api/announcements');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/announcements/${id}/read`, { method: 'POST' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });

  const items = list.data ?? [];

  return (
    <>
      {canPost && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setComposing(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Post update
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {items.length === 0 && !list.isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Megaphone className="h-6 w-6" aria-hidden />
              <span>No announcements yet.</span>
            </CardContent>
          </Card>
        )}

        {items.map((a) => {
          const isUnread = !a.readAt;
          const initials =
            a.createdBy.name
              ?.split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('') ?? a.createdBy.email[0]?.toUpperCase() ?? '?';

          return (
            <Card
              key={a.id}
              className={isUnread ? 'ring-2 ring-primary/20' : undefined}
              onClick={() => isUnread && markRead.mutate(a.id)}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      {a.createdBy.name ?? a.createdBy.email} ·{' '}
                      {formatDistanceToNowStrict(new Date(a.publishedAt), {
                        addSuffix: true,
                      })}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {a.scope.toLowerCase()}
                  </Badge>
                  {isUnread && <Badge>New</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {a.readCount} read{a.readCount === 1 ? '' : 's'}
                  </span>
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(a.id)}
                      className="font-medium text-foreground hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {composing && (
        <NewAnnouncementDialog
          open
          onOpenChange={(o) => setComposing(o)}
          role={role}
          branches={branches}
          teams={teams}
          onCreated={() => {
            setComposing(false);
            qc.invalidateQueries({ queryKey: ['announcements'] });
          }}
        />
      )}
    </>
  );
}
