export type AccessScope = 'self' | 'managed_departments' | 'all';

export function scopeForRole(role: string): AccessScope {
  if (role === 'admin') return 'all';
  if (role === 'department_manager') return 'managed_departments';
  return 'self';
}
