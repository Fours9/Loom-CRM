import {
  buildContactsBundleProposalCandidates,
  contactsReplaceSetStale,
} from './contacts-bundle-projector';
import { emptyEmployeeContactsBundle } from '@loom/employee-contacts';

describe('contacts bundle projector', () => {
  it('emits work scalar and replace-set proposals', () => {
    const current = emptyEmployeeContactsBundle();
    const bundle = {
      ...current,
      work: { email: 'a@b.c', phone: null, telegram: null },
      personal: [{ type: 'personal_email' as const, value: 'x@y.z', isPrimary: true }],
    };
    const candidates = buildContactsBundleProposalCandidates({ bundle, current });
    const fields = candidates.map((c) => c.proposedChanges.field);
    expect(fields).toContain('workEmail');
    expect(fields).toContain('personal_replace');
  });

  it('replace-set stale returns apply when current matches from', () => {
    const from = [{ type: 'personal_phone', value: '1', isPrimary: true }];
    const to = [{ type: 'personal_phone', value: '2', isPrimary: true }];
    expect(contactsReplaceSetStale(from, from, to)).toBe('apply');
    expect(contactsReplaceSetStale(to, from, to)).toBe('already_satisfied');
    expect(contactsReplaceSetStale([], from, to)).toBe('stale');
  });
});
