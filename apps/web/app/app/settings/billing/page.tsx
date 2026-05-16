import { redirect } from 'next/navigation';
import { requireScope } from '@/lib/scope';
import { BillingView } from '@/components/settings/billing-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Billing' };

export default async function BillingPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Plan, seats, and invoices. Stripe integration plugs in via{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">STRIPE_SECRET_KEY</code>.
        </p>
      </header>
      <BillingView />
    </div>
  );
}
