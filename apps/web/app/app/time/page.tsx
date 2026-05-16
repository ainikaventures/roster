import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { ClockWidget } from '@/components/time/clock-widget';
import { Timesheet } from '@/components/time/timesheet';
import Link from 'next/link';
import { Button } from '@roster/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Time Clock' };

export default async function TimePage() {
  const ctx = await requireScope();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Clock</h1>
          <p className="text-sm text-muted-foreground">
            Clock in to start a shift. Manual edits keep an audit trail.
          </p>
        </div>
        {isManager(ctx.scope.role) && (
          <Button asChild variant="outline" size="sm">
            <Link href="/app/time/approvals">Approve timesheets</Link>
          </Button>
        )}
      </header>

      <ClockWidget />
      <Timesheet scope={isManager(ctx.scope.role) ? 'manager' : 'self'} />
    </div>
  );
}
