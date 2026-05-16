'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import { Send } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  cn,
} from '@roster/ui';
import type { ChannelSummary } from './chat-app';
import { MessageBody } from './message-body';

type ChatMessage = {
  id: string;
  channelId: string;
  userId: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  reactions: { emoji: string; userId: string }[];
};

export function ChatPane({
  channel,
  userId,
  onMessageSent,
}: {
  channel: ChannelSummary;
  userId: string;
  onMessageSent: () => void;
}) {
  const qc = useQueryClient();
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [draft, setDraft] = React.useState('');

  const messages = useQuery({
    queryKey: ['messages', channel.id],
    queryFn: async (): Promise<ChatMessage[]> => {
      const res = await fetch(`/api/channels/${channel.id}/messages?limit=100`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
    refetchInterval: 5_000,
  });

  // Auto-scroll on new messages.
  const lastLength = React.useRef(0);
  React.useEffect(() => {
    const len = messages.data?.length ?? 0;
    if (len > lastLength.current) {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    lastLength.current = len;
  }, [messages.data]);

  // Mark read whenever the channel is open and there are new messages.
  React.useEffect(() => {
    if (!messages.data?.length) return;
    const id = setTimeout(() => {
      void fetch(`/api/channels/${channel.id}/read`, { method: 'POST' }).then(() =>
        qc.invalidateQueries({ queryKey: ['channels'] }),
      );
    }, 1_000);
    return () => clearTimeout(id);
  }, [channel.id, messages.data?.length, qc]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message ?? 'Failed to send');
      return data.data as ChatMessage;
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['messages', channel.id] });
      onMessageSent();
    },
  });

  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {headerTitle(channel)}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {channel.description ?? headerSubtitle(channel)}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {channel.kind.toLowerCase()}
        </Badge>
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 space-y-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {(messages.data ?? []).length === 0 && !messages.isLoading && (
          <p className="px-2 py-12 text-center text-sm text-muted-foreground">
            No messages yet. Say hi.
          </p>
        )}
        {(messages.data ?? []).map((m, i) => {
          const prev = (messages.data ?? [])[i - 1];
          const showHeader =
            !prev ||
            prev.userId !== m.userId ||
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() >
              5 * 60_000;
          const showDayDivider =
            !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
          return (
            <React.Fragment key={m.id}>
              {showDayDivider && (
                <div className="relative my-3 text-center">
                  <span className="rounded-full border bg-background px-3 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(new Date(m.createdAt), 'EEE, MMM d')}
                  </span>
                </div>
              )}
              <MessageRow
                message={m}
                isMine={m.userId === userId}
                showHeader={showHeader}
              />
            </React.Fragment>
          );
        })}
      </div>

      <form
        className="border-t bg-background p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body) return;
          send.mutate(body);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const body = draft.trim();
                if (body) send.mutate(body);
              }
            }}
            placeholder={`Message ${headerTitle(channel)}…`}
            rows={1}
            className="min-h-[40px] max-h-40 flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Button
            type="submit"
            size="icon"
            disabled={send.isPending || !draft.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {send.error instanceof Error && (
          <p className="mt-2 text-xs text-destructive">{send.error.message}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">
          Press Enter to send, Shift+Enter for a new line.
        </p>
      </form>
    </>
  );
}

function MessageRow({
  message,
  isMine,
  showHeader,
}: {
  message: ChatMessage;
  isMine: boolean;
  showHeader: boolean;
}) {
  const initials =
    message.user.name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('') ?? message.user.email[0]?.toUpperCase() ?? '?';

  return (
    <div className={cn('flex gap-3', !showHeader && 'pl-12')}>
      {showHeader && (
        <Avatar className="mt-0.5 h-9 w-9 shrink-0">
          {message.user.avatarUrl && <AvatarImage src={message.user.avatarUrl} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {message.user.name ?? message.user.email}
              {isMine && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}
            </span>
            <span
              className="text-[10px] uppercase tracking-wide text-muted-foreground"
              title={format(new Date(message.createdAt), 'PPpp')}
            >
              {formatDistanceToNowStrict(new Date(message.createdAt), { addSuffix: true })}
              {message.editedAt && ' · edited'}
            </span>
          </div>
        )}
        <div className="text-sm leading-relaxed">
          <MessageBody body={message.body} />
        </div>
      </div>
    </div>
  );
}

function headerTitle(c: ChannelSummary): string {
  if (c.kind === 'ORG') return '#general';
  if (c.kind === 'TEAM') return `#${c.team?.name ?? c.name ?? 'team'}`;
  if (c.kind === 'BRANCH') return `#${c.branch?.name ?? c.name ?? 'branch'}`;
  return c.name ?? 'Untitled';
}

function headerSubtitle(c: ChannelSummary): string {
  if (c.kind === 'TEAM' && c.team) return `Team channel`;
  if (c.kind === 'BRANCH' && c.branch) return `Branch channel`;
  if (c.kind === 'ORG') return `Everyone in your workspace`;
  return '';
}
