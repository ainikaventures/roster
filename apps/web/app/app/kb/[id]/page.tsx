import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@roster/ui';
import { prisma } from '@roster/db';
import { requireScope } from '@/lib/scope';
import { isManager } from '@/lib/api';
import { Markdown } from '@/components/markdown';

export const dynamic = 'force-dynamic';

export default async function KbPageView({ params }: { params: { id: string } }) {
  const ctx = await requireScope();

  const page = await prisma.kbPage.findFirst({
    where: { id: params.id, orgId: ctx.orgId, archivedAt: null },
    select: {
      id: true,
      title: true,
      body: true,
      version: true,
      updatedAt: true,
      folder: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, email: true } },
    },
  });

  if (!page) notFound();
  const canEdit = isManager(ctx.scope.role);

  return (
    <article className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {page.folder?.name ?? 'Knowledge base'}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{page.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            v{page.version} · updated {new Date(page.updatedAt).toLocaleString()} ·{' '}
            {page.author.name ?? page.author.email}
          </p>
        </div>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/kb/${page.id}/edit`}>Edit</Link>
          </Button>
        )}
      </header>

      {page.body.trim() ? (
        <Markdown>{page.body}</Markdown>
      ) : (
        <p className="text-sm italic text-muted-foreground">This page is empty.</p>
      )}
    </article>
  );
}
