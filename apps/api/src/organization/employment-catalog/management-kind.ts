/**
 * Organizational leadership of a Position template / active EA.
 * Independent from account role (Platform AccessControl) — see ADR 0011.
 */
export const ManagementKind = {
  None: 'none',
  Departments: 'departments',
  Direction: 'direction',
} as const;

export type ManagementKind = (typeof ManagementKind)[keyof typeof ManagementKind];

export const MANAGEMENT_KINDS: readonly ManagementKind[] = Object.values(
  ManagementKind,
);

export function isManagementKind(value: unknown): value is ManagementKind {
  return (
    typeof value === 'string' &&
    (MANAGEMENT_KINDS as readonly string[]).includes(value)
  );
}

/** Mirror for the legacy boolean columns: any leadership counts as manager. */
export function managementKindImpliesManager(kind: ManagementKind): boolean {
  return kind !== ManagementKind.None;
}
