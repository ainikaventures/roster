'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FileText, FolderPlus, FolderTree, Plus, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  cn,
} from '@roster/ui';

type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  _count: { pages: number; children: number };
};

type Page = {
  id: string;
  title: string;
  slug: string;
  folderId: string | null;
  version: number;
  updatedAt: string;
  excerpt?: string;
  author: { id: string; name: string | null; email: string };
};

export function KbBrowser({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [selectedFolder, setSelectedFolder] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query, 200);

  const folders = useQuery({
    queryKey: ['kb-folders'],
    queryFn: async (): Promise<Folder[]> => {
      const res = await fetch('/api/kb/folders');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const pages = useQuery({
    queryKey: ['kb-pages', selectedFolder, debounced],
    queryFn: async (): Promise<Page[]> => {
      const params = new URLSearchParams();
      if (debounced.trim()) params.set('q', debounced.trim());
      else if (selectedFolder !== null) params.set('folderId', selectedFolder);
      else params.set('folderId', 'null');
      const res = await fetch(`/api/kb/pages?${params}`);
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  const newFolder = useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: string | null }) => {
      const res = await fetch('/api/kb/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentId }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb-folders'] }),
  });

  const roots = (folders.data ?? []).filter((f) => !f.parentId);

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search KB…"
            className="pl-8"
          />
        </div>

        <Card>
          <CardContent className="p-2">
            <ul className="space-y-0.5 text-sm">
              <FolderRow
                label="All pages"
                selected={selectedFolder === null && !debounced}
                onSelect={() => {
                  setQuery('');
                  setSelectedFolder(null);
                }}
                count={null}
                icon={<FolderTree className="h-3.5 w-3.5" />}
              />
              {roots.map((root) => (
                <FolderNode
                  key={root.id}
                  folder={root}
                  allFolders={folders.data ?? []}
                  depth={0}
                  selected={selectedFolder}
                  onSelect={(id) => {
                    setQuery('');
                    setSelectedFolder(id);
                  }}
                />
              ))}
            </ul>
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start"
                onClick={() => {
                  const name = prompt('Folder name');
                  if (!name) return;
                  newFolder.mutate({ name, parentId: null });
                }}
              >
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> New folder
              </Button>
            )}
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {debounced ? `Search results for “${debounced}”` : 'Pages in this folder'}
          </p>
          {canManage && (
            <Button asChild size="sm">
              <Link href={`/app/kb/new${selectedFolder ? `?folderId=${selectedFolder}` : ''}`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New page
              </Link>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {(pages.data ?? []).length === 0 && !pages.isLoading && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {debounced ? 'No matches.' : 'No pages here yet.'}
              </p>
            )}
            <ul className="divide-y">
              {(pages.data ?? []).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/kb/${p.id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                        <span className="truncate text-sm font-medium">{p.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          v{p.version}
                        </Badge>
                      </div>
                      {p.excerpt && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {p.excerpt}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {p.author.name ?? p.author.email} · {new Date(p.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function FolderRow({
  label,
  selected,
  onSelect,
  count,
  icon,
  depth = 0,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  count: number | null;
  icon: React.ReactNode;
  depth?: number;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left',
          selected ? 'bg-accent font-medium' : 'hover:bg-accent/60',
        )}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        <span className="flex items-center gap-2 truncate">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        {count !== null && count > 0 && (
          <span className="text-xs text-muted-foreground">{count}</span>
        )}
      </button>
    </li>
  );
}

function FolderNode({
  folder,
  allFolders,
  depth,
  selected,
  onSelect,
}: {
  folder: Folder;
  allFolders: Folder[];
  depth: number;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  return (
    <>
      <FolderRow
        label={folder.name}
        selected={selected === folder.id}
        onSelect={() => onSelect(folder.id)}
        count={folder._count.pages}
        icon={<FolderTree className="h-3.5 w-3.5" />}
        depth={depth}
      />
      {children.map((c) => (
        <FolderNode
          key={c.id}
          folder={c}
          allFolders={allFolders}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [out, setOut] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setOut(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return out;
}
