'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@roster/ui';

export function OrgSwitcher({
  orgs,
  activeOrgId,
  activeOrg,
}: {
  orgs: { id: string; name: string; slug: string }[];
  activeOrgId: string;
  activeOrg: { id: string; name: string; slug: string } | null;
}) {
  const router = useRouter();

  async function switchTo(orgId: string) {
    if (orgId === activeOrgId) return;
    await fetch('/api/orgs/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    });
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-[14rem] justify-between gap-2">
          <span className="truncate font-medium">{activeOrg?.name ?? 'Workspace'}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => switchTo(org.id)}
            className="justify-between"
          >
            <span className="truncate">{org.name}</span>
            {org.id === activeOrgId && <Check className="h-4 w-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/signup/welcome')}>
          <Plus className="h-4 w-4" aria-hidden />
          <span>Create workspace</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
