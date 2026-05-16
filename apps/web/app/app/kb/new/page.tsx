import { redirect } from 'next/navigation';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { PageEditor } from '@/components/kb/page-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New page' };

export default async function NewKbPagePage({
  searchParams,
}: {
  searchParams: { folderId?: string };
}) {
  const ctx = await requireScope();
  if (!isManager(ctx.scope.role)) redirect('/app/kb');

  const folders = await prisma.kbFolder.findMany({
    where: { orgId: ctx.orgId, archivedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentId: true },
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageEditor folders={folders} initialFolderId={searchParams.folderId ?? null} />
    </div>
  );
}
