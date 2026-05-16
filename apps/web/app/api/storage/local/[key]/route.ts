import { ctxOr401 } from '@/lib/api';
import { readLocalObject } from '@/lib/storage';

// ---------------------------------------------------------------------------
// GET /api/storage/local/:key
// Serves local-fallback storage objects. Requires an authenticated session
// (no per-doc authz here yet — that's enforced by the document route that
// hands out the URL). Suffices for Phase 4 dev; production should swap to S3
// signed URLs and remove this entire route.
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const ctx = await ctxOr401();
  if (ctx instanceof Response) return ctx;

  const decoded = decodeURIComponent(params.key);

  // Guard: the first path segment is the orgId; only the user's own org's
  // files are reachable through this endpoint.
  const orgPrefix = `${ctx.orgId}/`;
  if (!decoded.startsWith(orgPrefix)) {
    return new Response('Forbidden', { status: 403 });
  }

  const result = await readLocalObject(decoded);
  if (!result) return new Response('Not found', { status: 404 });

  return new Response(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
