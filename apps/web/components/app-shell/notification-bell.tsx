'use client';

import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@roster/ui';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();

  const data = useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<{ items: Notification[]; unread: number }> => {
      const res = await fetch('/api/notifications');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (payload: { ids?: string[]; all?: true }) => {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data.data?.unread ?? 0;
  const items = data.data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[28rem] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <DropdownMenuLabel className="m-0 p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate({ all: true })}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {items.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
            You’re all caught up.
          </p>
        )}

        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              if (!n.readAt) markRead.mutate({ ids: [n.id] });
              if (n.url) router.push(n.url);
            }}
            className={cn(
              'block w-full px-3 py-2.5 text-left text-sm hover:bg-accent',
              !n.readAt && 'bg-muted/40',
            )}
          >
            <div className="flex items-start gap-2">
              {!n.readAt && (
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{n.title}</div>
                {n.body && (
                  <div className="truncate text-xs text-muted-foreground">{n.body}</div>
                )}
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
