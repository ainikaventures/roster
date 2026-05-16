import { redirect } from 'next/navigation';
import { requireScope } from '@/lib/scope';
import { WebhooksView } from '@/components/settings/webhooks-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Webhooks' };

export default async function WebhooksPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="text-sm text-muted-foreground">
          Receive HTTP POSTs when things happen. Each event is signed with
          HMAC-SHA256 (header <code className="rounded bg-muted px-1.5 py-0.5 text-xs">X-Roster-Signature</code>).
        </p>
      </header>
      <WebhooksView />
    </div>
  );
}
