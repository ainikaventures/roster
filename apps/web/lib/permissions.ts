import type { Role } from '@roster/db';

// ---------------------------------------------------------------------------
// Permission identifiers.
//
// Built-in Role values map deterministically to a set of permissions
// (`ROLE_PERMISSIONS`). Custom roles store an arbitrary subset.
//
// New features should add a string here and check it via `hasPermission`.
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  // Schedule
  'schedule.read',
  'schedule.write',
  'schedule.publish',
  // Time clock
  'time.clock_self',
  'time.approve',
  'time.edit_others',
  // Tasks
  'tasks.read',
  'tasks.write',
  'tasks.complete_self',
  // Forms
  'forms.read',
  'forms.write_templates',
  'forms.submit',
  // Chat
  'chat.read',
  'chat.write',
  'chat.moderate',
  // Updates
  'updates.read',
  'updates.publish',
  // HR
  'hr.documents.read',
  'hr.documents.write',
  'hr.timeoff.request_self',
  'hr.timeoff.approve',
  'hr.onboarding.manage',
  // Training + KB
  'training.read',
  'training.manage',
  'kb.read',
  'kb.write',
  // Admin
  'org.settings',
  'org.billing',
  'org.api_keys',
  'org.webhooks',
  'org.audit_log',
  'org.roles',
  'org.branding',
  // Payroll
  'payroll.export',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ---------------------------------------------------------------------------
// Role → built-in permission mapping. The fixed Role enum acts as a
// preset; CustomRole augments this on a per-user basis.
// ---------------------------------------------------------------------------

const COMMON_EMPLOYEE: Permission[] = [
  'schedule.read',
  'time.clock_self',
  'tasks.read',
  'tasks.complete_self',
  'forms.read',
  'forms.submit',
  'chat.read',
  'chat.write',
  'updates.read',
  'hr.documents.read',
  'hr.timeoff.request_self',
  'training.read',
  'kb.read',
];

const TEAM_MANAGER_EXTRAS: Permission[] = [
  'schedule.write',
  'schedule.publish',
  'time.approve',
  'time.edit_others',
  'tasks.write',
  'forms.write_templates',
  'chat.moderate',
  'updates.publish',
  'hr.documents.write',
  'hr.timeoff.approve',
  'hr.onboarding.manage',
  'training.manage',
  'kb.write',
  'payroll.export',
];

const ORG_ADMIN_EXTRAS: Permission[] = [
  'org.settings',
  'org.billing',
  'org.api_keys',
  'org.webhooks',
  'org.audit_log',
  'org.roles',
  'org.branding',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  EMPLOYEE: COMMON_EMPLOYEE,
  TEAM_MANAGER: [...COMMON_EMPLOYEE, ...TEAM_MANAGER_EXTRAS],
  BRANCH_MANAGER: [...COMMON_EMPLOYEE, ...TEAM_MANAGER_EXTRAS],
  ADMIN: [...COMMON_EMPLOYEE, ...TEAM_MANAGER_EXTRAS, ...ORG_ADMIN_EXTRAS],
  OWNER: [...COMMON_EMPLOYEE, ...TEAM_MANAGER_EXTRAS, ...ORG_ADMIN_EXTRAS],
};

export function hasPermission(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

// Used by the custom roles UI to render permission groups.
export const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: 'Schedule', perms: ['schedule.read', 'schedule.write', 'schedule.publish'] },
  { label: 'Time clock', perms: ['time.clock_self', 'time.approve', 'time.edit_others'] },
  { label: 'Tasks', perms: ['tasks.read', 'tasks.write', 'tasks.complete_self'] },
  { label: 'Forms', perms: ['forms.read', 'forms.write_templates', 'forms.submit'] },
  { label: 'Chat & updates', perms: ['chat.read', 'chat.write', 'chat.moderate', 'updates.read', 'updates.publish'] },
  {
    label: 'HR',
    perms: [
      'hr.documents.read',
      'hr.documents.write',
      'hr.timeoff.request_self',
      'hr.timeoff.approve',
      'hr.onboarding.manage',
    ],
  },
  { label: 'Training & knowledge', perms: ['training.read', 'training.manage', 'kb.read', 'kb.write'] },
  { label: 'Payroll', perms: ['payroll.export'] },
  {
    label: 'Admin',
    perms: [
      'org.settings',
      'org.billing',
      'org.api_keys',
      'org.webhooks',
      'org.audit_log',
      'org.roles',
      'org.branding',
    ],
  },
];
