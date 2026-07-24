/** Employment status — not absence types (vacation/sick). */
export const EmploymentStatus = {
  Draft: 'draft',
  Candidate: 'candidate',
  Preboarding: 'preboarding',
  Probation: 'probation',
  Active: 'active',
  Suspended: 'suspended',
  MaternityLeave: 'maternity_leave',
  MilitaryLeave: 'military_leave',
  Dismissed: 'dismissed',
  Archived: 'archived',
} as const;

export type EmploymentStatus =
  (typeof EmploymentStatus)[keyof typeof EmploymentStatus];
