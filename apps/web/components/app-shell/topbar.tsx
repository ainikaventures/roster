'use client';

import { signOut } from 'next-auth/react';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@roster/ui';
import { OrgSwitcher } from './org-switcher';

export function Topbar({
  user,
  orgs,
  activeOrgId,
  activeOrg,
}: {
  user: { id: string; email: string; name: string | null };
  orgs: { id: string; name: string; slug: string }[];
  activeOrgId: string;
  activeOrg: { id: string; name: string; slug: string } | null;
}) {
  const initials =
    user.name
      ?.split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('') ?? user.email[0]?.toUpperCase() ?? '?';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <span className="md:hidden text-base font-semibold tracking-tight">Roster</span>
        <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} activeOrg={activeOrg} />
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="User menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user.name ?? 'Signed in'}</DropdownMenuLabel>
            <DropdownMenuItem className="pointer-events-none flex-col items-start gap-0 text-xs text-muted-foreground">
              {user.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/app/settings/profile">Profile</a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => signOut({ callbackUrl: '/' })}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
