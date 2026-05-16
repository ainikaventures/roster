import { requireScope } from '@/lib/scope';
import { AvailabilityView } from '@/components/schedule/availability-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Availability' };

export default async function AvailabilityPage() {
  await requireScope();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-sm text-muted-foreground">
          When you can — and can&apos;t — work. Managers see this when building the
          schedule.
        </p>
      </header>
      <AvailabilityView />
    </div>
  );
}
