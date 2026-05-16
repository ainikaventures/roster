import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { UpdatesFeed } from '@/components/updates/updates-feed';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Updates' };

export default async function UpdatesPage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Updates</h1>
        <p className="text-sm text-muted-foreground">
          Announcements posted to your workspace, branch, or team.
        </p>
      </header>
      <UpdatesFeed
        canPost={isManager(ctx.scope.role)}
        role={ctx.scope.role}
        branches={scopeData.branches}
        teams={scopeData.teams}
      />
    </div>
  );
}
