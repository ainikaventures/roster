import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { TimeOffView } from '@/components/hr/time-off-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Time off' };

export default async function TimeOffPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <TimeOffView role={ctx.scope.role} canApprove={isManager(ctx.scope.role)} />
    </div>
  );
}
