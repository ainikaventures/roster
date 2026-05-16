'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@roster/ui';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function CreateOrgForm({ defaultName = '' }: { defaultName?: string }) {
  const router = useRouter();
  const [orgName, setOrgName] = React.useState(
    defaultName ? `${defaultName.split(' ')[0]}'s Workspace` : '',
  );
  const [slug, setSlug] = React.useState(orgName ? slugify(orgName) : '');
  const [branchName, setBranchName] = React.useState('Main');
  const [teamName, setTeamName] = React.useState('Team 1');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        const res = await fetch('/api/orgs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orgName,
            orgSlug: slug,
            branchName,
            teamName,
          }),
        });

        const body = await res.json();
        if (!res.ok || !body.ok) {
          setError(body.error?.message ?? 'Something went wrong.');
          setSubmitting(false);
          return;
        }
        router.push('/app');
        router.refresh();
      }}
    >
      <div>
        <Label htmlFor="orgName">Organization name</Label>
        <Input
          id="orgName"
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value);
            setSlug(slugify(e.target.value));
          }}
          placeholder="Acme Hospitality"
          required
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="slug">Workspace URL</Label>
        <div className="mt-1.5 flex items-center overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
          <span className="bg-muted px-3 py-2 text-sm text-muted-foreground">
            roster.app/
          </span>
          <input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="h-10 flex-1 bg-background px-3 text-sm outline-none"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="branch">First branch</Label>
          <Input
            id="branch"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="team">First team</Label>
          <Input
            id="team"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting || !orgName || !slug} className="w-full">
        {submitting ? 'Creating…' : 'Create workspace'}
      </Button>
    </form>
  );
}
