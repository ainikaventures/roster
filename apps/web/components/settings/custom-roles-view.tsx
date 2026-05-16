'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@roster/ui';

type CustomRole = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  _count: { assignments: number };
};

type PermissionGroup = { label: string; perms: string[] };

export function CustomRolesView({ permissionGroups }: { permissionGroups: PermissionGroup[] }) {
  const qc = useQueryClient();
  const [creating, setCreating] = React.useState(false);

  const roles = useQuery({
    queryKey: ['custom-roles'],
    queryFn: async (): Promise<CustomRole[]> => {
      const res = await fetch('/api/custom-roles');
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data;
    },
  });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New role
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {(roles.data ?? []).length === 0 && !roles.isLoading && (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Shield className="h-6 w-6" aria-hidden />
              <span>No custom roles yet.</span>
            </div>
          )}
          <ul className="divide-y">
            {(roles.data ?? []).map((r) => (
              <li key={r.id} className="space-y-1 p-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="outline">
                    {r._count.assignments} assignee{r._count.assignments === 1 ? '' : 's'}
                  </Badge>
                </div>
                {r.description && (
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {r.permissions.length} permission
                  {r.permissions.length === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {creating && (
        <CreateRoleDialog
          open
          onOpenChange={(o) => !o && setCreating(false)}
          permissionGroups={permissionGroups}
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['custom-roles'] });
          }}
        />
      )}
    </>
  );
}

function CreateRoleDialog({
  open,
  onOpenChange,
  permissionGroups,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissionGroups: PermissionGroup[];
  onCreated: () => void;
}) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [perms, setPerms] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(p: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New custom role</DialogTitle>
          <DialogDescription>
            Pick the permissions to grant. Empty selection = no extra access.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            setError(null);
            const res = await fetch('/api/custom-roles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: name.trim(),
                description: description.trim() || undefined,
                permissions: [...perms],
              }),
            });
            const body = await res.json();
            setSubmitting(false);
            if (!body.ok) {
              setError(body.error?.message ?? 'Failed');
              return;
            }
            onCreated();
          }}
        >
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              className="mt-1.5"
            />
          </div>

          <div className="space-y-3">
            {permissionGroups.map((g) => (
              <fieldset key={g.label} className="rounded-md border p-3">
                <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </legend>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                  {g.perms.map((p) => (
                    <label key={p} className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={perms.has(p)}
                        onChange={() => toggle(p)}
                        className="mt-0.5"
                      />
                      <code className="font-mono">{p}</code>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating…' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
