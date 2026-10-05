import { bool, pick } from './coerce.mjs';
import { hasManagerEvidence } from './employee.mjs';

/**
 * Synthesize active EA from PW employee.
 * @returns {{
 *   assignment: object,
 *   managed: { id: string, assignment_id: string, department_id: string }[],
 *   legacyManaged: { id: string, employee_id: string, department_id: string }[]
 * }}
 */
export function mapEmploymentAssignment(
  empRow,
  pwEmployeeId,
  loomEmployeeId,
  idMap,
  managedPwRows,
) {
  const assignmentId = idMap.employmentAssignmentActive(pwEmployeeId);
  const deptPw = pick(empRow, 'department_id', 'departmentId');
  const posPw = pick(empRow, 'position_id', 'positionId');
  const departmentId = deptPw ? idMap.get('department', deptPw) : null;
  const positionId = posPw ? idMap.get('position', posPw) : null;
  const manager = hasManagerEvidence(empRow, managedPwRows);

  if (manager && managedPwRows.length === 0 && !departmentId && !positionId) {
    // Manager flag alone with no managed depts and no placement — still create EA
    // with management_kind=departments but empty managed set (scope empty but representable).
  }

  const assignment = {
    id: assignmentId,
    employee_id: loomEmployeeId,
    company_id: null,
    direction_id: null,
    department_id: departmentId,
    position_id: positionId,
    functional_role: null,
    manager_employee_id: null,
    mentor_employee_id: null,
    hr_responsible_employee_id: null,
    work_location: null,
    work_format: null,
    employment_type: null,
    contract_type: null,
    start_date: null,
    end_date: null,
    probation_start_date: null,
    probation_end_date: null,
    status: 'active',
    management_kind: manager ? 'departments' : 'none',
    is_department_manager: manager,
    comment: null,
    activation_blocked_reason: null,
    activation_checked_at: null,
    created_by_user_id: null,
  };

  const managed = [];
  const legacyManaged = [];
  for (const row of managedPwRows) {
    const pwDept = pick(row, 'department_id', 'departmentId');
    const loomDept = idMap.get('department', pwDept);
    if (!loomDept) {
      throw new Error(
        `Orphan managed department ${pwDept} for employee ${pwEmployeeId}`,
      );
    }
    managed.push({
      id: idMap.eaManagedDept(pwEmployeeId, pwDept),
      assignment_id: assignmentId,
      department_id: loomDept,
    });
    legacyManaged.push({
      id: idMap.employeeManagedDept(pwEmployeeId, pwDept),
      employee_id: loomEmployeeId,
      department_id: loomDept,
    });
  }

  // If manager flag but no managed rows and has home department — do not auto-add home dept
  // unless PW listed it; AuthZ scope is explicit managed list only.

  return { assignment, managed, legacyManaged };
}
