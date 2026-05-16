import { describe, expect, it } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS } from '@/lib/permissions';
import { hexToHsl } from '@/lib/color';

describe('hasPermission', () => {
  it('grants employees their own time clock', () => {
    expect(hasPermission('EMPLOYEE', 'time.clock_self')).toBe(true);
  });

  it('denies employees admin areas', () => {
    expect(hasPermission('EMPLOYEE', 'org.billing')).toBe(false);
    expect(hasPermission('EMPLOYEE', 'org.api_keys')).toBe(false);
  });

  it('grants admins everything an org-wide role needs', () => {
    expect(hasPermission('OWNER', 'org.audit_log')).toBe(true);
    expect(hasPermission('ADMIN', 'org.webhooks')).toBe(true);
  });

  it('treats branch and team managers identically for permission grants', () => {
    expect(ROLE_PERMISSIONS.BRANCH_MANAGER.sort()).toEqual(
      [...ROLE_PERMISSIONS.TEAM_MANAGER].sort(),
    );
  });
});

describe('hexToHsl', () => {
  it('converts black to 0 lightness', () => {
    expect(hexToHsl('#000000')).toMatch(/^0\.0 0\.0% 0\.0%$/);
  });

  it('converts white to 100 lightness', () => {
    expect(hexToHsl('#ffffff')).toMatch(/^0\.0 0\.0% 100\.0%$/);
  });

  it('rejects malformed input', () => {
    expect(hexToHsl('bogus')).toBeNull();
    expect(hexToHsl('#fff')).toBeNull();
  });
});
