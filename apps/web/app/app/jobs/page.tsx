import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { JobsView } from '@/components/jobs/jobs-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jobs' };

export default async function JobsPage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <JobsView
        userId={ctx.userId}
        canEdit={isManager(ctx.scope.role)}
        teams={scopeData.teams}
      />
    </div>
  );
}
