import { bool, overrideText, pick, strOrNull } from './coerce.mjs';

/**
 * @param {object} row
 * @param {string} loomId
 * @param {{ userId: string|null, departmentId: string|null, positionId: string|null, legacyUserRole: string }} refs
 */
export function mapEmployee(row, loomId, refs) {
  return {
    id: loomId,
    user_id: refs.userId,
    role: refs.legacyUserRole,
    is_department_manager: bool(
      pick(row, 'is_department_manager', 'isDepartmentManager'),
      false,
    ),
    employee_number: String(pick(row, 'employee_number', 'employeeNumber')),
    first_name: String(pick(row, 'first_name', 'firstName')),
    last_name: String(pick(row, 'last_name', 'lastName')),
    middle_name: strOrNull(pick(row, 'middle_name', 'middleName')),
    preferred_name: null,
    birth_date: null,
    city: null,
    preferred_language: null,
    employment_status: 'active',
    hired_at: null,
    current_assignment_id: null, // set after EA
    archived_at: null,
    work_email: strOrNull(pick(row, 'work_email', 'workEmail')),
    department_id: refs.departmentId,
    position_id: refs.positionId,
    calendar_color: strOrNull(pick(row, 'calendar_color', 'calendarColor')),
    phone_number: strOrNull(pick(row, 'phone_number', 'phoneNumber')),
    telegram: strOrNull(pick(row, 'telegram')),
    personal_phone_number: strOrNull(
      pick(row, 'personal_phone_number', 'personalPhoneNumber'),
    ),
    personal_telegram: strOrNull(
      pick(row, 'personal_telegram', 'personalTelegram'),
    ),
    personal_email: strOrNull(pick(row, 'personal_email', 'personalEmail')),
    comment: strOrNull(pick(row, 'comment')),
    admin_comment: strOrNull(pick(row, 'admin_comment', 'adminComment')),
    photo_url: strOrNull(pick(row, 'photo_url', 'photoUrl')),
    profile_visibility_override: strOrNull(
      pick(row, 'profile_visibility_override', 'profileVisibilityOverride'),
    ),
    absence_visibility_override: strOrNull(
      pick(row, 'absence_visibility_override', 'absenceVisibilityOverride'),
    ),
    show_absence_type_to_peers_override: overrideText(
      pick(
        row,
        'show_absence_type_to_peers_override',
        'showAbsenceTypeToPeersOverride',
      ),
    ),
    is_active: bool(pick(row, 'is_active', 'isActive'), true),
  };
}

/**
 * Managerial evidence from PW employee + managed dept rows.
 * @param {object} empRow
 * @param {object[]} managedRowsForEmployee
 */
export function hasManagerEvidence(empRow, managedRowsForEmployee) {
  if (bool(pick(empRow, 'is_department_manager', 'isDepartmentManager'), false)) {
    return true;
  }
  return managedRowsForEmployee.length > 0;
}

/**
 * Need EA if org placement or manager evidence.
 */
export function needsEmploymentAssignment(empRow, managedRowsForEmployee) {
  const dept = pick(empRow, 'department_id', 'departmentId');
  const pos = pick(empRow, 'position_id', 'positionId');
  if (dept || pos) return true;
  return hasManagerEvidence(empRow, managedRowsForEmployee);
}
