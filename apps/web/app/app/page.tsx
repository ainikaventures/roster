import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roster/ui';
import { CalendarDays, Clock, Users, Building2 } from 'lucide-react';
import { requireScope, loadScopeContext } from '@/lib/scope';
import { prisma } from '@roster/db';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);

  const teamFilter = ctx.scope.teamIds
    ? { teamId: { in: ctx.scope.teamIds } }
    : { team: { branch: { orgId: ctx.orgId } } };

  const [memberCount, shiftCount, openTimeEntries] = await Promise.all([
    prisma.membership.count({
      where: {
        orgId: ctx.orgId,
        ...(ctx.scope.teamIds ? { teamId: { in: ctx.scope.teamIds } } : {}),
      },
    }),
    prisma.shift.count({
      where: { orgId: ctx.orgId, ...teamFilter, published: true },
    }),
    prisma.timeEntry.count({
      where: { orgId: ctx.orgId, clockedOut: null, ...teamFilter },
    }),
  ]);

  const stats = [
    {
      label: 'Workspace',
      value: scopeData.org?.name ?? '—',
      icon: Building2,
      hint: `${scopeData.branches.length} branch${scopeData.branches.length === 1 ? '' : 'es'} · ${scopeData.teams.length} team${scopeData.teams.length === 1 ? '' : 's'}`,
    },
    {
      label: 'People in your scope',
      value: memberCount.toString(),
      icon: Users,
      hint: ctx.scope.role.replaceAll('_', ' ').toLowerCase(),
    },
    {
      label: 'Published shifts',
      value: shiftCount.toString(),
      icon: CalendarDays,
      hint: 'across your scope',
    },
    {
      label: 'Currently clocked in',
      value: openTimeEntries.toString(),
      icon: Clock,
      hint: 'live',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{ctx.name ? `, ${ctx.name.split(' ')[0]}` : ''}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Phase 0 is wired up. Scheduling and time tracking arrive in Phase 1.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>
            What&apos;s ready and what&apos;s coming based on the product spec.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Checklist
            items={[
              { label: 'Multi-tenant data model (Org → Branch → Team)', done: true },
              { label: 'Auth with email + Google sign-in', done: true },
              { label: 'Workspace creation & seed flow', done: true },
              { label: 'Role-scoped app shell (sidebar, mobile nav, breadcrumb)', done: true },
              { label: 'Schedule + time clock (Phase 1)', done: true },
              { label: 'Team chat + announcements (Phase 2)', done: true },
              { label: 'Tasks + forms (Phase 3)', done: true },
              { label: 'Onboarding + documents + PTO (Phase 4)', done: true },
              { label: 'Training & knowledge base (Phase 5)', done: false },
              { label: 'Advanced scheduling + payroll (Phase 6)', done: false },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Checklist({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
              item.done
                ? 'border-emerald-500 bg-emerald-500 text-emerald-50'
                : 'border-muted-foreground/40 bg-background'
            }`}
            aria-hidden
          >
            {item.done && (
              <svg viewBox="0 0 12 12" className="h-3 w-3">
                <path
                  d="M2 6.5l2.5 2.5L10 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
