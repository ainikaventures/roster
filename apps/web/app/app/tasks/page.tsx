import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { TasksView } from '@/components/tasks/tasks-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <TasksView
        userId={ctx.userId}
        canEdit={isManager(ctx.scope.role)}
        teams={scopeData.teams}
      />
    </div>
  );
}
