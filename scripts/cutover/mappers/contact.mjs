import { pick, strOrNull } from './coerce.mjs';

/**
 * Canonical contact rows mirroring EmployeeContactsFacade conventions.
 * @returns {{ id: string, employee_id: string, type: string, value: string, is_primary: boolean, visibility: string }[]}
 */
export function mapContactsFromEmployee(empRow, loomEmployeeId, idMap, pwEmployeeId) {
  /** @type {{ type: string, value: string|null, visibility: string, is_primary: boolean }[]} */
  const specs = [
    {
      type: 'work_email',
      value: strOrNull(pick(empRow, 'work_email', 'workEmail')),
      visibility: 'work',
      is_primary: true,
    },
    {
      type: 'work_phone',
      value: strOrNull(pick(empRow, 'phone_number', 'phoneNumber')),
      visibility: 'work',
      is_primary: true,
    },
    {
      type: 'work_telegram',
      value: strOrNull(pick(empRow, 'telegram')),
      visibility: 'work',
      is_primary: true,
    },
    {
      type: 'personal_email',
      value: strOrNull(pick(empRow, 'personal_email', 'personalEmail')),
      visibility: 'personal',
      is_primary: true,
    },
    {
      type: 'personal_phone',
      value: strOrNull(
        pick(empRow, 'personal_phone_number', 'personalPhoneNumber'),
      ),
      visibility: 'personal',
      is_primary: true,
    },
    {
      type: 'personal_telegram',
      value: strOrNull(pick(empRow, 'personal_telegram', 'personalTelegram')),
      visibility: 'personal',
      is_primary: true,
    },
  ];

  const out = [];
  for (const s of specs) {
    if (!s.value) continue;
    out.push({
      id: idMap.contact(pwEmployeeId, s.type, 0),
      employee_id: loomEmployeeId,
      type: s.type,
      value: s.value,
      is_primary: s.is_primary,
      visibility: s.visibility,
    });
  }
  return out;
}
