'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@roster/ui';
import { Badge } from '@roster/ui';
import type { Role } from '@roster/db';
import { visibleNav } from './nav-items';

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = visibleNav(role);

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/app" className="text-base font-semibold tracking-tight">
          Roster
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          // Phases 0–7 are live; Phase 8+ items still render as "Soon".
          // Bump the threshold when a new phase ships.
          const comingSoon = item.phase > 7;

          const inner = (
            <span
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                comingSoon && 'opacity-60',
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </span>
              {comingSoon && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Soon
                </Badge>
              )}
            </span>
          );

          return comingSoon ? (
            <div key={item.href} aria-disabled className="pointer-events-none">
              {inner}
            </div>
          ) : (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
              {inner}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3 text-xs text-muted-foreground">
        <p>Phase 7 · Admin &amp; Integrations</p>
      </div>
    </aside>
  );
}
