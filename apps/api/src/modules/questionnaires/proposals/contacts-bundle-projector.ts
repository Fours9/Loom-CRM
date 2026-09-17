import {
  canonicalEmployeeContactsBundle,
  employeeContactsBundlesEqual,
  type EmployeeContactsBundle,
} from '@loom/employee-contacts';

/** Frozen UA titles for contacts-bundle field_update proposals. */
export const CONTACTS_PROPOSAL_LABEL_UA: Readonly<Record<string, string>> = {
  workEmail: 'Робочий email',
  workPhone: 'Робочий телефон',
  workTelegram: 'Робочий Telegram',
  personal_replace: 'Особисті контакти',
  emergency_replace: 'Екстрені контакти',
};

export type ContactsBundleProposalCandidate = {
  targetSection: 'contacts';
  proposedChanges: {
    kind: 'field_update';
    section: 'contacts';
    field: string;
    answerKey: string;
    from: unknown;
    to: unknown;
    labelUa: string;
  };
};

export function buildContactsBundleProposalCandidates(input: {
  bundle: EmployeeContactsBundle;
  current: EmployeeContactsBundle;
  answerKey?: string;
}): ContactsBundleProposalCandidate[] {
  const answerKey = input.answerKey ?? 'contacts.bundle';
  const bundle = canonicalEmployeeContactsBundle(input.bundle);
  const current = canonicalEmployeeContactsBundle(input.current);
  const candidates: ContactsBundleProposalCandidate[] = [];

  const workFields: Array<{
    field: 'workEmail' | 'workPhone' | 'workTelegram';
    from: string | null;
    to: string | null;
  }> = [
    {
      field: 'workEmail',
      from: current.work.email,
      to: bundle.work.email,
    },
    {
      field: 'workPhone',
      from: current.work.phone,
      to: bundle.work.phone,
    },
    {
      field: 'workTelegram',
      from: current.work.telegram,
      to: bundle.work.telegram,
    },
  ];

  for (const item of workFields) {
    const from = item.from ?? null;
    const to = item.to ?? null;
    if (from === to) continue;
    candidates.push({
      targetSection: 'contacts',
      proposedChanges: {
        kind: 'field_update',
        section: 'contacts',
        field: item.field,
        answerKey,
        from,
        to,
        labelUa: CONTACTS_PROPOSAL_LABEL_UA[item.field],
      },
    });
  }

  if (!personalArraysEqual(current.personal, bundle.personal)) {
    candidates.push({
      targetSection: 'contacts',
      proposedChanges: {
        kind: 'field_update',
        section: 'contacts',
        field: 'personal_replace',
        answerKey,
        from: current.personal,
        to: bundle.personal,
        labelUa: CONTACTS_PROPOSAL_LABEL_UA.personal_replace,
      },
    });
  }

  if (!emergencyArraysEqual(current.emergency, bundle.emergency)) {
    candidates.push({
      targetSection: 'contacts',
      proposedChanges: {
        kind: 'field_update',
        section: 'contacts',
        field: 'emergency_replace',
        answerKey,
        from: current.emergency,
        to: bundle.emergency,
        labelUa: CONTACTS_PROPOSAL_LABEL_UA.emergency_replace,
      },
    });
  }

  return candidates;
}

export function contactsReplaceSetStale(
  current: unknown,
  from: unknown,
  to: unknown,
): 'apply' | 'already_satisfied' | 'stale' {
  if (JSON.stringify(current) === JSON.stringify(to)) {
    return 'already_satisfied';
  }
  if (JSON.stringify(current) === JSON.stringify(from)) {
    return 'apply';
  }
  return 'stale';
}

export function contactsBundleAlreadyApplied(
  current: EmployeeContactsBundle,
  target: EmployeeContactsBundle,
): boolean {
  return employeeContactsBundlesEqual(current, target);
}

function personalArraysEqual(
  a: EmployeeContactsBundle['personal'],
  b: EmployeeContactsBundle['personal'],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function emergencyArraysEqual(
  a: EmployeeContactsBundle['emergency'],
  b: EmployeeContactsBundle['emergency'],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
