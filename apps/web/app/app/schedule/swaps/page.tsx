import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { SwapsView } from '@/components/schedule/swaps-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shift swaps' };

export default async function SwapsPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Shift swaps</h1>
        <p className="text-sm text-muted-foreground">
          Coverage requests waiting on a teammate or manager.
        </p>
      </header>
      <SwapsView userId={ctx.userId} canApprove={isManager(ctx.scope.role)} />
    </div>
  );
}
