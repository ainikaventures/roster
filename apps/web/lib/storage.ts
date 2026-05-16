import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Storage abstraction.
//
// When AWS S3 credentials are configured (S3_BUCKET + S3_REGION + creds),
// uploads go to S3 and reads return signed URLs.
//
// In dev / when S3 isn't configured, files land in a per-org subdir under
// the OS temp directory and the server returns a `/api/storage/local/<id>`
// URL that streams the file back. This keeps Phase 4 fully self-contained
// without forcing the user to provision S3 just to play with uploads.
//
// All call sites should use `putObject` / `getObjectUrl` and never hit the
// S3 SDK directly — that way the Phase 7 swap is a single-file change.
// ---------------------------------------------------------------------------

const s3Configured =
  !!process.env.S3_BUCKET &&
  !!process.env.S3_REGION &&
  !!process.env.S3_ACCESS_KEY_ID &&
  !!process.env.S3_SECRET_ACCESS_KEY;

const LOCAL_ROOT = path.join(tmpdir(), 'roster-storage');

export type PutOptions = {
  orgId: string;
  /** Logical subfolder, e.g. "documents", "form-submissions/photos". */
  kind: string;
  filename: string;
  contentType: string;
  body: Buffer;
};

export type PutResult = {
  /** Opaque key — store in the DB. */
  key: string;
  /** Public-ish URL or signed S3 URL; expires per `getObjectUrl`. */
  url: string;
  bytes: number;
};

export async function putObject(opts: PutOptions): Promise<PutResult> {
  if (s3Configured) {
    return putToS3(opts);
  }
  return putToLocal(opts);
}

export async function getObjectUrl(key: string): Promise<string> {
  if (s3Configured && key.startsWith('s3://')) {
    return signS3Url(key);
  }
  return `/api/storage/local/${encodeURIComponent(key)}`;
}

export async function readLocalObject(key: string): Promise<{
  body: Buffer;
  contentType: string;
} | null> {
  if (!key || key.startsWith('s3://')) return null;
  const safe = key.replace(/[^a-z0-9/._-]/gi, '_');
  const full = path.join(LOCAL_ROOT, safe);
  try {
    const body = await fs.readFile(full);
    const meta = await readMeta(full);
    return { body, contentType: meta.contentType };
  } catch {
    return null;
  }
}

export const isS3 = () => s3Configured;

// ---------------------------------------------------------------------------
// Local file fallback
// ---------------------------------------------------------------------------

async function putToLocal(opts: PutOptions): Promise<PutResult> {
  const id = randomUUID();
  const ext = path.extname(opts.filename).toLowerCase().slice(0, 16);
  const key = `${opts.orgId}/${opts.kind}/${id}${ext}`;
  const full = path.join(LOCAL_ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, opts.body);
  await writeMeta(full, { contentType: opts.contentType, originalName: opts.filename });
  return {
    key,
    url: `/api/storage/local/${encodeURIComponent(key)}`,
    bytes: opts.body.byteLength,
  };
}

type Meta = { contentType: string; originalName: string };

async function writeMeta(filePath: string, meta: Meta) {
  await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(meta));
}
async function readMeta(filePath: string): Promise<Meta> {
  try {
    const raw = await fs.readFile(`${filePath}.meta.json`, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { contentType: 'application/octet-stream', originalName: path.basename(filePath) };
  }
}

// ---------------------------------------------------------------------------
// S3 path (intentionally minimal — full SDK wiring lands when the user
// provides creds). We import lazily so dev envs without the SDK still work.
// ---------------------------------------------------------------------------

async function putToS3(_opts: PutOptions): Promise<PutResult> {
  throw new Error(
    'S3 upload not yet wired in this build. Install @aws-sdk/client-s3 and fill in putToS3.',
  );
}

async function signS3Url(key: string): Promise<string> {
  // Same — placeholder until the SDK is added.
  return key;
}
