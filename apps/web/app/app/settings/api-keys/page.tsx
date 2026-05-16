import { redirect } from 'next/navigation';
import { requireScope } from '@/lib/scope';
import { ApiKeysView } from '@/components/settings/api-keys-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'API keys' };

export default async function ApiKeysPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Authenticate against{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/api/v1/*</code> with
          a <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Authorization: Bearer …</code>{' '}
          header.
        </p>
      </header>
      <ApiKeysView />
    </div>
  );
}
