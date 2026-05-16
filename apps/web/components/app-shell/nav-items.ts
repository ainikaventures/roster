import {
  CalendarDays,
  Clock,
  ClipboardCheck,
  Heart,
  ListChecks,
  MessageSquare,
  Megaphone,
  Users,
  Settings,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@roster/db';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that should see this item. Omit for everyone. */
  roles?: Role[];
  /** Whether to surface in the mobile bottom nav (max 5 fit comfortably). */
  mobile?: boolean;
  /** Phase the feature is shipped in. Items with phase > current are hidden. */
  phase: number;
};

// Single source of truth for nav. Items with phase > 0 render as "coming soon"
// chips in the sidebar so the IA is visible even before features land.
export const NAV_ITEMS: NavItem[] = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, mobile: true, phase: 0 },
  { href: '/app/schedule', label: 'Schedule', icon: CalendarDays, mobile: true, phase: 1 },
  { href: '/app/time', label: 'Time Clock', icon: Clock, mobile: true, phase: 1 },
  { href: '/app/tasks', label: 'Tasks', icon: ListChecks, mobile: true, phase: 3 },
  { href: '/app/forms', label: 'Forms', icon: ClipboardCheck, phase: 3 },
  { href: '/app/chat', label: 'Chat', icon: MessageSquare, mobile: true, phase: 2 },
  { href: '/app/updates', label: 'Updates', icon: Megaphone, phase: 2 },
  { href: '/app/directory', label: 'Directory', icon: Users, phase: 1 },
  { href: '/app/hr', label: 'HR', icon: Heart, phase: 4 },
  {
    href: '/app/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['OWNER', 'ADMIN', 'BRANCH_MANAGER'],
    mobile: true,
    phase: 0,
  },
];

export function visibleNav(role: Role, mobileOnly = false): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (mobileOnly && !item.mobile) return false;
    return true;
  });
}
