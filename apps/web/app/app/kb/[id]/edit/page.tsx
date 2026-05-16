import { notFound, redirect } from 'next/navigation';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { PageEditor } from '@/components/kb/page-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit page' };

export default async function EditKbPage({ params }: { params: { id: string } }) {
  const ctx = await requireScope();
  if (!isManager(ctx.scope.role)) redirect('/app/kb');

  const [page, folders] = await Promise.all([
    prisma.kbPage.findFirst({
      where: { id: params.id, orgId: ctx.orgId, archivedAt: null },
      select: { id: true, title: true, body: true, folderId: true },
    }),
    prisma.kbFolder.findMany({
      where: { orgId: ctx.orgId, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, parentId: true },
    }),
  ]);

  if (!page) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageEditor folders={folders} page={page} initialFolderId={page.folderId} />
    </div>
  );
}
