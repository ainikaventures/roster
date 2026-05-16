import { requireScope, loadScopeContext } from '@/lib/scope';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { MobileNav } from '@/components/app-shell/mobile-nav';
import { ScopeBreadcrumb } from '@/components/app-shell/scope-breadcrumb';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="flex min-h-dvh w-full bg-muted/20">
      <Sidebar role={ctx.scope.role} />

      <div className="flex flex-1 flex-col">
        <Topbar
          user={{ id: ctx.userId, email: ctx.email, name: ctx.name }}
          orgs={scopeData.orgs}
          activeOrgId={ctx.orgId}
          activeOrg={scopeData.org}
        />

        <ScopeBreadcrumb
          orgName={scopeData.org?.name ?? 'Workspace'}
          branches={scopeData.branches}
          teams={scopeData.teams}
          role={ctx.scope.role}
        />

        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8">{children}</main>

        <MobileNav role={ctx.scope.role} />
      </div>
    </div>
  );
}
