import { redirect } from 'next/navigation';
import { requireScope, loadScopeContext } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { PayrollExport } from '@/components/payroll/payroll-export';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payroll export' };

export default async function PayrollPage() {
  const ctx = await requireScope();
  if (!isManager(ctx.scope.role)) redirect('/app/time');
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll export</h1>
        <p className="text-sm text-muted-foreground">
          Download a CSV of completed time entries for any date range. QuickBooks
          / Gusto / ADP API exports arrive in Phase 7.
        </p>
      </header>
      <PayrollExport teams={scopeData.teams} />
    </div>
  );
}
