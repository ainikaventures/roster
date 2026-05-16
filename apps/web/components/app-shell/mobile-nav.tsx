'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@roster/ui';
import type { Role } from '@roster/db';
import { visibleNav } from './nav-items';

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  // Show only items flagged for mobile that are shipped (Phase ≤ 5).
  // Cap to 5 so the bottom bar stays usable on small phones.
  const items = visibleNav(role, true)
    .filter((i) => i.phase <= 5)
    .slice(0, 5);

  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background md:hidden"
      aria-label="Mobile primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
