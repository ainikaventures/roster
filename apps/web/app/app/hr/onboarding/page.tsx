import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { OnboardingView } from '@/components/hr/onboarding-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Onboarding' };

export default async function OnboardingPage() {
  const ctx = await requireScope();
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <OnboardingView canManage={isManager(ctx.scope.role)} />
    </div>
  );
}
