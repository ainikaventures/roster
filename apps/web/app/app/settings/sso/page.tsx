import { redirect } from 'next/navigation';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { SsoView } from '@/components/settings/sso-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'SSO' };

export default async function SsoPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');

  const [config, scimTokens] = await Promise.all([
    prisma.samlConfig.findUnique({ where: { orgId: ctx.orgId } }),
    prisma.scimToken.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        prefix: true,
        name: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">SSO &amp; SCIM</h1>
        <p className="text-sm text-muted-foreground">
          SAML 2.0 single sign-on and SCIM v2 user provisioning for Okta /
          Azure AD / Google Workspace.
        </p>
      </header>
      <SsoView initialConfig={config} initialScimTokens={scimTokens} />
    </div>
  );
}
