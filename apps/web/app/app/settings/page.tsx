import Link from 'next/link';
import {
  Building2,
  CreditCard,
  FileSearch,
  KeyRound,
  Palette,
  Shield,
  Webhook,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@roster/ui';
import { requireScope, loadScopeContext } from '@/lib/scope';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

type SectionLink = {
  href: string;
  title: string;
  description: string;
  icon: typeof Building2;
  adminOnly?: boolean;
};

const SECTIONS: SectionLink[] = [
  {
    href: '/app/settings/workspace',
    title: 'Workspace',
    description: 'Org name, branches, teams.',
    icon: Building2,
  },
  {
    href: '/app/settings/branding',
    title: 'Branding',
    description: 'Logo and brand color.',
    icon: Palette,
    adminOnly: true,
  },
  {
    href: '/app/settings/billing',
    title: 'Billing',
    description: 'Plan, seats, invoices.',
    icon: CreditCard,
    adminOnly: true,
  },
  {
    href: '/app/settings/api-keys',
    title: 'API keys',
    description: 'Programmatic access to the REST API.',
    icon: KeyRound,
    adminOnly: true,
  },
  {
    href: '/app/settings/webhooks',
    title: 'Webhooks',
    description: 'Push events to your tools.',
    icon: Webhook,
    adminOnly: true,
  },
  {
    href: '/app/settings/roles',
    title: 'Custom roles',
    description: 'Granular permissions beyond the defaults.',
    icon: Shield,
    adminOnly: true,
  },
  {
    href: '/app/settings/audit-log',
    title: 'Audit log',
    description: 'Every sensitive action, searchable.',
    icon: FileSearch,
    adminOnly: true,
  },
];

export default async function SettingsPage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);
  const isAdmin = ctx.scope.role === 'OWNER' || ctx.scope.role === 'ADMIN';
  const sections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage {scopeData.org?.name ?? 'this workspace'}.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="h-full hover:bg-accent/40">
                <CardHeader>
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <CardTitle className="mt-2 text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
