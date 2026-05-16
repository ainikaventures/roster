import { requireScope } from '@/lib/scope';
import { TwoFactorSetup } from '@/components/settings/two-factor-setup';
import { IpAllowlistView } from '@/components/settings/ip-allowlist-view';
import { isManager } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Security' };

export default async function SecurityPage() {
  const ctx = await requireScope();
  const isAdmin = ctx.scope.role === 'OWNER' || ctx.scope.role === 'ADMIN';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Two-factor authentication for your account, plus org-wide network
          controls.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Two-factor authentication
        </h2>
        <TwoFactorSetup />
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            IP allowlist (admin only)
          </h2>
          <IpAllowlistView />
        </section>
      )}
    </div>
  );
}
