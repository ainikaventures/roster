'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { Award, Heart } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@roster/ui';
import type { TeamMember } from '@/components/schedule/types';

type Kudos = {
  id: string;
  message: string;
  points: number;
  category: string | null;
  createdAt: string;
  fromUser: { id: string; name: string | null; email: string };
  toUser: { id: string; name: string | null; email: string };
};

type LeaderboardEntry = {
  user: { id: string; name: string | null; email: string };
  points: number;
  count: number;
};

export function KudosView() {
  const qc = useQueryClient();
  const [toUserId, setToUserId] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [points, setPoints] = React.useState(5);
  const [category, setCategory] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const feed = useQuery({
    queryKey: ['kudos'],
    queryFn: async (): Promise<{ items: Kudos[]; leaderboard: LeaderboardEntry[] }> => {
      const res = await fetch('/api/kudos');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const members = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<TeamMember[]> => {
      const res = await fetch('/api/users');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const give = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/kudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          message: message.trim(),
          points,
          category: category.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => {
      setMessage('');
      setCategory('');
      setError(null);
      qc.invalidateQueries({ queryKey: ['kudos'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send kudos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="to">To</Label>
              <select
                id="to"
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Pick a teammate…</option>
                {(members.data ?? []).map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name ?? m.user.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-md border bg-background p-2 text-sm"
                placeholder="Thanks for covering the Friday close…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min={0}
                  max={100}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="teamwork"
                  className="mt-1.5"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={() => give.mutate()}
              disabled={!toUserId || !message.trim() || give.isPending}
            >
              <Heart className="mr-1.5 h-3.5 w-3.5" /> Send kudos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {(feed.data?.items ?? []).map((k) => (
                <li key={k.id} className="p-4 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <span className="font-medium">
                        {k.fromUser.name ?? k.fromUser.email}
                      </span>{' '}
                      → <span className="font-medium">{k.toUser.name ?? k.toUser.email}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(k.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{k.message}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {k.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {k.category}
                      </Badge>
                    )}
                    {k.points > 0 && (
                      <Badge className="text-[10px]">+{k.points} pts</Badge>
                    )}
                  </div>
                </li>
              ))}
              {(feed.data?.items ?? []).length === 0 && (
                <li className="p-6 text-center text-sm text-muted-foreground">
                  No kudos yet — start the streak.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <aside>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4" aria-hidden /> Top performers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(feed.data?.leaderboard ?? []).map((entry, i) => {
              const initials =
                entry.user.name
                  ?.split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('') ?? entry.user.email[0]?.toUpperCase() ?? '?';
              return (
                <div
                  key={entry.user.id}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
                >
                  <span className="w-5 text-center text-xs font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs font-medium">
                    {entry.user.name ?? entry.user.email}
                  </span>
                  <Badge className="ml-auto text-[10px]">{entry.points}</Badge>
                </div>
              );
            })}
            {(feed.data?.leaderboard ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No points yet.</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
