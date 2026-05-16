'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage, Badge, Input } from '@roster/ui';
import type { TeamMember } from '@/components/schedule/types';

const ROLE_LABEL: Record<TeamMember['role'], string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch manager',
  TEAM_MANAGER: 'Team manager',
  EMPLOYEE: 'Employee',
};

export function DirectoryList({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = React.useState('');

  const filtered = members.filter((m) => {
    if (!query.trim()) return true;
    const haystack =
      `${m.user.name ?? ''} ${m.user.email} ${m.team?.name ?? ''}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div>
      <div className="p-3">
        <Input
          placeholder="Search by name, email, or team…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className="divide-y border-t">
        {filtered.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No people match.
          </li>
        )}
        {filtered.map((m) => {
          const initials =
            m.user.name
              ?.split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('') ?? m.user.email[0]?.toUpperCase() ?? '?';
          return (
            <li
              key={m.user.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-9 w-9">
                  {m.user.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt="" />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {m.user.name ?? m.user.email}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <a href={`mailto:${m.user.email}`} className="hover:underline">
                      {m.user.email}
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.team && (
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: m.team.color ?? 'hsl(var(--muted-foreground))',
                      }}
                      aria-hidden
                    />
                    {m.team.name}
                  </span>
                )}
                <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
