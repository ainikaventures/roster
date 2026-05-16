'use client';

import * as React from 'react';
import { Button, Card, CardContent, Input, Label } from '@roster/ui';

export function BrandingView({
  initialName,
  initialBrandColor,
  initialLogoUrl,
}: {
  initialName: string;
  initialBrandColor: string;
  initialLogoUrl: string;
}) {
  const [name, setName] = React.useState(initialName);
  const [brandColor, setBrandColor] = React.useState(initialBrandColor);
  const [logoUrl, setLogoUrl] = React.useState(initialLogoUrl);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function save() {
    setSubmitting(true);
    setMessage(null);
    const res = await fetch('/api/orgs/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || undefined,
        brandColor,
        logoUrl: logoUrl.trim() || null,
      }),
    });
    const body = await res.json();
    setSubmitting(false);
    setMessage(body.ok ? 'Saved.' : body.error?.message ?? 'Failed');
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1.5"
          />
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Preview"
              className="mt-2 max-h-16 rounded border"
            />
          )}
        </div>

        <div>
          <Label htmlFor="brandColor">Brand color</Label>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              id="brandColor"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-md border bg-background"
            />
            <Input
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="font-mono uppercase"
              maxLength={7}
            />
            <span
              className="inline-block h-10 w-32 rounded-md border"
              style={{ backgroundColor: brandColor }}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Applied across buttons, badges, and the topbar accent. Changes go
            live on the next page load for everyone in the org.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
          {message && <span className="text-sm text-muted-foreground">{message}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
