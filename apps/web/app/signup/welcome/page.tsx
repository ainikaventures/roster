import { redirect } from 'next/navigation';
import { prisma } from '@roster/db';
import { getServerAuthSession } from '@/lib/auth';
import { CreateOrgForm } from '@/components/create-org-form';

export const metadata = { title: 'Set up your workspace' };

export default async function WelcomePage() {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');

  // If they already have an org, skip the seed flow.
  const existing = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    select: { orgId: true },
  });
  if (existing) redirect('/app');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{session.user.name ? `, ${session.user.name.split(' ')[0]}` : ''}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Let&apos;s set up your workspace. You can rename branches and teams later.
        </p>

        <div className="mt-6">
          <CreateOrgForm defaultName={session.user.name ?? ''} />
        </div>
      </div>
    </main>
  );
}
