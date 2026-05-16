import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@roster/ui';
import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { Timesheet } from '@/components/time/timesheet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Approve timesheets' };

export default async function ApprovalsPage() {
  const ctx = await requireScope();
  if (!isManager(ctx.scope.role)) redirect('/app/time');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approve timesheets</h1>
          <p className="text-sm text-muted-foreground">
            Review your team’s hours and approve for payroll.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/time">Back to my time</Link>
        </Button>
      </header>
      <Timesheet scope="manager" />
    </div>
  );
}
