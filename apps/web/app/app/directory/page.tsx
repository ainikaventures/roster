import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { Card, CardContent } from '@roster/ui';
import { DirectoryList } from '@/components/directory/directory-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Directory' };

export default async function DirectoryPage() {
  const ctx = await requireScope();

  const teamFilter =
    ctx.scope.teamIds === null ? {} : { teamId: { in: ctx.scope.teamIds } };

  const memberships = await prisma.membership.findMany({
    where: { orgId: ctx.orgId, ...teamFilter },
    select: {
      role: true,
      teamId: true,
      team: { select: { id: true, name: true, color: true } },
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: [{ user: { name: 'asc' } }, { user: { email: 'asc' } }],
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Directory</h1>
        <p className="text-sm text-muted-foreground">
          {memberships.length} people in your scope.
        </p>
      </header>
      <Card>
        <CardContent className="p-0">
          <DirectoryList members={memberships} />
        </CardContent>
      </Card>
    </div>
  );
}
