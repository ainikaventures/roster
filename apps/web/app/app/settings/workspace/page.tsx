import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@roster/ui';
import { requireScope, loadScopeContext } from '@/lib/scope';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Workspace' };

export default async function WorkspaceSettingsPage() {
  const ctx = await requireScope();
  const scopeData = await loadScopeContext(ctx);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-muted-foreground">
          Branches, teams, and base settings.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{scopeData.org?.name}</CardTitle>
          <CardDescription>{scopeData.org?.slug}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Timezone</div>
            <div className="font-medium">{scopeData.org?.timezone}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branches</CardTitle>
            <CardDescription>{scopeData.branches.length} in your scope</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {scopeData.branches.map((b) => (
                <li key={b.id} className="rounded-md border bg-muted/30 px-3 py-2">
                  {b.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
            <CardDescription>{scopeData.teams.length} in your scope</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {scopeData.teams.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color ?? 'hsl(var(--muted-foreground))' }}
                    aria-hidden
                  />
                  {t.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
