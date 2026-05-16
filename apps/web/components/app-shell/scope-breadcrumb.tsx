import type { Role } from '@roster/db';

export function ScopeBreadcrumb({
  orgName,
  branches,
  teams,
  role,
}: {
  orgName: string;
  branches: { id: string; name: string }[];
  teams: { id: string; name: string; color: string | null }[];
  role: Role;
}) {
  const scopeLabel =
    role === 'OWNER' || role === 'ADMIN'
      ? 'Org-wide view'
      : role === 'BRANCH_MANAGER'
        ? `${branches.length} branch${branches.length === 1 ? '' : 'es'} · ${teams.length} team${teams.length === 1 ? '' : 's'}`
        : role === 'TEAM_MANAGER'
          ? `${teams.length} team${teams.length === 1 ? '' : 's'}`
          : teams[0]?.name ?? 'Your team';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background/60 px-4 py-2 text-xs text-muted-foreground md:px-6">
      <span className="font-medium text-foreground">{orgName}</span>
      <span aria-hidden>·</span>
      <span>{scopeLabel}</span>
      {teams.length > 0 && (role === 'BRANCH_MANAGER' || role === 'TEAM_MANAGER') && (
        <div className="ml-2 flex flex-wrap items-center gap-1.5">
          {teams.slice(0, 6).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: t.color ?? 'hsl(var(--muted-foreground))' }}
                aria-hidden
              />
              {t.name}
            </span>
          ))}
          {teams.length > 6 && (
            <span className="text-muted-foreground">+{teams.length - 6} more</span>
          )}
        </div>
      )}
    </div>
  );
}
