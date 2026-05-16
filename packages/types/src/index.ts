import type { Role } from '@roster/db';

// ---------------------------------------------------------------------------
// Session shape — what we attach to the authenticated request.
// Augments next-auth's Session in apps/web.
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  /** Currently-active org for this session (workspace switcher). */
  activeOrgId: string | null;
};

export type ScopedSession = {
  user: SessionUser;
  activeOrgId: string;
  role: Role;
  // null = no team-level filter (org-wide). Empty array = no access.
  teamIds: string[] | null;
  branchIds: string[] | null;
};

// ---------------------------------------------------------------------------
// UI scope picker — what the org/branch/team selector emits.
// ---------------------------------------------------------------------------

export type ScopeSelection =
  | { kind: 'org'; orgId: string }
  | { kind: 'branch'; orgId: string; branchId: string }
  | { kind: 'team'; orgId: string; branchId: string; teamId: string };

// ---------------------------------------------------------------------------
// Notification shape — used by in-app notification center.
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'shift.published'
  | 'shift.changed'
  | 'timesheet.approval_needed'
  | 'timesheet.approved'
  | 'announcement.posted'
  | 'task.assigned'
  | 'mention'
  | 'system';

export type AppNotification = {
  id: string;
  orgId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// API result envelope. Keeps responses uniform across the app.
// ---------------------------------------------------------------------------

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: string; message: string } };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export const ok = <T>(data: T): ApiOk<T> => ({ ok: true, data });
export const err = (code: string, message: string): ApiErr => ({
  ok: false,
  error: { code, message },
});
