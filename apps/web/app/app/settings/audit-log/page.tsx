import { redirect } from 'next/navigation';
import { requireScope } from '@/lib/scope';
import { AuditLogView } from '@/components/settings/audit-log-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log' };

export default async function AuditLogPage() {
  const ctx = await requireScope();
  if (ctx.scope.role !== 'OWNER' && ctx.scope.role !== 'ADMIN') redirect('/app/settings');
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every sensitive action across the workspace, searchable by user, entity,
          and date.
        </p>
      </header>
      <AuditLogView />
    </div>
  );
}
