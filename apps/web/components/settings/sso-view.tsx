'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@roster/ui';

type SamlConfig = {
  idpEntityId: string;
  idpSsoUrl: string;
  idpX509Cert: string;
  enforce: boolean;
  defaultRole: string;
};

type ScimToken = {
  id: string;
  prefix: string;
  name: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function SsoView({
  initialConfig,
  initialScimTokens,
}: {
  initialConfig: SamlConfig | null;
  initialScimTokens: ScimToken[];
}) {
  const [entityId, setEntityId] = React.useState(initialConfig?.idpEntityId ?? '');
  const [ssoUrl, setSsoUrl] = React.useState(initialConfig?.idpSsoUrl ?? '');
  const [cert, setCert] = React.useState(initialConfig?.idpX509Cert ?? '');
  const [enforce, setEnforce] = React.useState(initialConfig?.enforce ?? false);
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [scimTokens, setScimTokens] = React.useState(initialScimTokens);
  const [revealedScim, setRevealedScim] = React.useState<string | null>(null);

  const qc = useQueryClient();

  async function saveSaml() {
    setSubmitting(true);
    setMessage(null);
    const res = await fetch('/api/sso/saml', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idpEntityId: entityId,
        idpSsoUrl: ssoUrl,
        idpX509Cert: cert,
        enforce,
        defaultRole: 'EMPLOYEE',
      }),
    });
    const body = await res.json();
    setSubmitting(false);
    setMessage(body.ok ? 'Saved.' : body.error?.message ?? 'Failed');
  }

  const createToken = useMutation({
    mutationFn: async () => {
      const name = prompt('Token label (e.g. "Okta")') ?? '';
      if (!name.trim()) return null;
      const res = await fetch('/api/scim-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error?.message ?? 'Failed');
      return body.data as { fullToken: string; id: string; prefix: string; name: string };
    },
    onSuccess: (data) => {
      if (!data) return;
      setRevealedScim(data.fullToken);
      setScimTokens((prev) => [
        {
          id: data.id,
          prefix: data.prefix,
          name: data.name,
          lastUsedAt: null,
          revokedAt: null,
        },
        ...prev,
      ]);
      qc.invalidateQueries({ queryKey: ['scim-tokens'] });
    },
  });

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">SAML 2.0</h2>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div>
              <Label htmlFor="entity">IdP Entity ID</Label>
              <Input
                id="entity"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="urn:okta:roster:abc"
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="sso">SSO URL</Label>
              <Input
                id="sso"
                type="url"
                value={ssoUrl}
                onChange={(e) => setSsoUrl(e.target.value)}
                placeholder="https://acme.okta.com/app/foo/sso/saml"
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label htmlFor="cert">X.509 Certificate</Label>
              <textarea
                id="cert"
                value={cert}
                onChange={(e) => setCert(e.target.value)}
                rows={6}
                className="mt-1.5 w-full rounded-md border bg-background p-2 font-mono text-xs"
                placeholder="-----BEGIN CERTIFICATE-----&#10;…&#10;-----END CERTIFICATE-----"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enforce}
                onChange={(e) => setEnforce(e.target.checked)}
              />
              Require SAML for everyone (no password fallback)
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={saveSaml} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Note: actual SAML handshake plugs in via @node-saml/passport-saml
              when env vars are configured. Schema + UI are ready.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">SCIM v2 tokens</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provisioning</CardTitle>
            <CardDescription>
              Endpoint:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {typeof window !== 'undefined' ? window.location.origin : ''}/scim/v2/Users
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="divide-y rounded-md border">
              {scimTokens.length === 0 && (
                <li className="p-3 text-center text-xs text-muted-foreground">
                  No SCIM tokens yet.
                </li>
              )}
              {scimTokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                      {t.prefix}…
                    </code>
                    {t.revokedAt && <Badge variant="destructive" className="ml-2">Revoked</Badge>}
                  </div>
                </li>
              ))}
            </ul>
            <Button size="sm" onClick={() => createToken.mutate()} disabled={createToken.isPending}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New token
            </Button>
            {revealedScim && (
              <div className="rounded-md border bg-muted p-3 text-xs">
                <p className="font-medium">Save this token now:</p>
                <pre className="mt-1 break-all">{revealedScim}</pre>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(revealedScim);
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
