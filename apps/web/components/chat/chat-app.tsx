'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Building2, Users as UsersIcon } from 'lucide-react';
import { Badge, cn } from '@roster/ui';
import { ChatPane } from './chat-pane';

export type ChannelSummary = {
  id: string;
  kind: 'TEAM' | 'BRANCH' | 'ORG' | 'GROUP' | 'DM';
  name: string | null;
  description: string | null;
  teamId: string | null;
  branchId: string | null;
  team: { id: string; name: string; color: string | null } | null;
  branch: { id: string; name: string } | null;
  lastReadAt: string | null;
  unread: number;
  latest: {
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string | null; email: string };
  } | null;
};

export function ChatApp({
  userId,
  initialChannelId,
}: {
  userId: string;
  initialChannelId: string | null;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState<string | null>(initialChannelId);

  const channels = useQuery({
    queryKey: ['channels'],
    queryFn: async (): Promise<ChannelSummary[]> => {
      const res = await fetch('/api/channels');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    refetchInterval: 15_000,
  });

  // Auto-select the first channel on first load.
  React.useEffect(() => {
    if (selected || !channels.data?.length) return;
    setSelected(channels.data[0]!.id);
  }, [channels.data, selected]);

  const active = channels.data?.find((c) => c.id === selected) ?? null;

  return (
    <div className="grid h-[calc(100dvh-9.5rem)] grid-cols-1 overflow-hidden rounded-lg border bg-card md:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="hidden flex-col border-r md:flex">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Channels</h2>
          <p className="text-xs text-muted-foreground">
            {channels.data?.length ?? 0} in your scope
          </p>
        </header>
        <ul className="flex-1 overflow-y-auto p-2">
          {(channels.data ?? []).map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              active={c.id === selected}
              onSelect={() => setSelected(c.id)}
            />
          ))}
          {channels.isLoading && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Loading…</li>
          )}
        </ul>
      </aside>

      {/* Mobile channel picker */}
      <div className="border-b p-2 md:hidden">
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={selected ?? ''}
          onChange={(e) => setSelected(e.target.value || null)}
        >
          <option value="" disabled>
            Pick a channel…
          </option>
          {(channels.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {channelLabel(c)}
              {c.unread > 0 ? ` (${c.unread})` : ''}
            </option>
          ))}
        </select>
      </div>

      <section className="flex min-h-0 flex-col">
        {active ? (
          <ChatPane
            channel={active}
            userId={userId}
            onMessageSent={() => qc.invalidateQueries({ queryKey: ['channels'] })}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            Pick a channel to start chatting.
          </div>
        )}
      </section>
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  onSelect,
}: {
  channel: ChannelSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon =
    channel.kind === 'ORG'
      ? Building2
      : channel.kind === 'BRANCH'
        ? Building2
        : channel.kind === 'GROUP' || channel.kind === 'DM'
          ? UsersIcon
          : Hash;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
          active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate font-medium">{channelLabel(channel)}</span>
            {channel.latest && (
              <span className="block truncate text-xs text-muted-foreground">
                {channel.latest.user.name ?? channel.latest.user.email}:{' '}
                {previewBody(channel.latest.body)}
              </span>
            )}
          </span>
        </span>
        {channel.unread > 0 && (
          <Badge className="shrink-0">{channel.unread > 99 ? '99+' : channel.unread}</Badge>
        )}
      </button>
    </li>
  );
}

function channelLabel(c: ChannelSummary): string {
  if (c.kind === 'ORG') return '#general';
  if (c.kind === 'TEAM') return `#${c.team?.name ?? c.name ?? 'team'}`;
  if (c.kind === 'BRANCH') return `#${c.branch?.name ?? c.name ?? 'branch'}`;
  return c.name ?? 'Untitled';
}

function previewBody(body: string): string {
  // Strip mention markers for the sidebar preview.
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
}
