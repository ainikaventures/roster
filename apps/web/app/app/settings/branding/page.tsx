import { redirect } from 'next/navigation';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { BrandingView } from '@/components/settings/branding-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Branding' };

export default async function BrandingPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');

  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { id: true, name: true, brandColor: true, logoUrl: true },
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Customize how the workspace looks for your team.
        </p>
      </header>
      <BrandingView
        initialName={org?.name ?? ''}
        initialBrandColor={org?.brandColor ?? '#0a0a0a'}
        initialLogoUrl={org?.logoUrl ?? ''}
      />
    </div>
  );
}
