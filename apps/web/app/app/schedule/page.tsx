import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { ScheduleView } from '@/components/schedule/schedule-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Schedule' };

export default async function SchedulePage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <ScheduleView
        teams={scopeData.teams}
        canEdit={isManager(ctx.scope.role)}
        userId={ctx.userId}
      />
    </div>
  );
}
