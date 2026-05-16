import { prisma } from '@roster/db';
import { requireScope, loadScopeContext } from '@/lib/scope';
import { Sidebar } from '@/components/app-shell/sidebar';
import { Topbar } from '@/components/app-shell/topbar';
import { MobileNav } from '@/components/app-shell/mobile-nav';
import { ScopeBreadcrumb } from '@/components/app-shell/scope-breadcrumb';
import { hexToHsl } from '@/lib/color';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireScope();
  const [scopeData, branding] = await Promise.all([
    loadScopeContext(ctx),
    prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { brandColor: true },
    }),
  ]);

  // Map the org's hex brand color to the design tokens used by buttons + accents.
  const brandHsl = branding?.brandColor ? hexToHsl(branding.brandColor) : null;
  const style = brandHsl
    ? ({
        ['--primary' as const]: brandHsl,
        ['--ring' as const]: brandHsl,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-dvh w-full bg-muted/20" style={style}>
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
