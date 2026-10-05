import { mapDepartment, mapPosition } from '../mappers/department.mjs';
import { mapUser } from '../mappers/user.mjs';
import { mapPwRole } from '../mappers/role.mjs';
import {
  mapEmployee,
  needsEmploymentAssignment,
} from '../mappers/employee.mjs';
import { pick } from '../mappers/coerce.mjs';
import { mapContactsFromEmployee } from '../mappers/contact.mjs';
import { mapEmploymentAssignment } from '../mappers/employment-assignment.mjs';
import { mapScheduleDay } from '../mappers/schedule.mjs';
import {
  mapAbsenceRequest,
  mapAbsenceHistory,
} from '../mappers/absence-request.mjs';
import { mapNotification, mapPrivacyPairs } from '../mappers/notification.mjs';

/**
 * @param {import('../sqlite-source.mjs').SqliteSource} source
 * @param {import('../pg-target.mjs').PostgresTarget} target
 * @param {import('../id-map.mjs').IdMap} idMap
 * @param {import('../report.mjs').CutoverReport} report
 * @param {Map<string, any>} rolesByCode
 */
export async function importOrganization(source, target, idMap, report, rolesByCode) {
  // Departments
  const depts = source.all('departments');
  for (const row of depts) {
    const id = idMap.bindSource('department', row.id);
    const m = mapDepartment(row, id);
    await target.query(
      `INSERT INTO departments (id, name, description, is_hidden, is_active, direction_id, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        m.id,
        m.name,
        m.description,
        m.is_hidden,
        m.is_active,
        m.direction_id,
        m.location,
      ],
    );
  }
  report.step(`Imported departments: ${depts.length}`);

  // Positions
  const positions = source.all('positions');
  for (const row of positions) {
    const id = idMap.bindSource('position', row.id);
    const deptPw = pick(row, 'department_id', 'departmentId');
    const deptId = deptPw ? idMap.get('department', deptPw) : null;
    const m = mapPosition(row, id, deptId);
    await target.query(
      `INSERT INTO positions (id, name, department_id, description, is_active, direction_id, is_department_manager_template, management_kind_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        m.id,
        m.name,
        m.department_id,
        m.description,
        m.is_active,
        m.direction_id,
        m.is_department_manager_template,
        m.management_kind_template,
      ],
    );
  }
  report.step(`Imported positions: ${positions.length}`);

  // Users
  const users = source.all('users');
  for (const row of users) {
    const role = mapPwRole(row.role, rolesByCode);
    const id = idMap.bindSource('user', row.id);
    const m = mapUser(row, id, role);
    await target.query(
      `INSERT INTO users (
         id, email, password_hash, role, account_role_id, is_department_manager,
         status, must_change_password, password_changed_at, token_version, last_login_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        m.id,
        m.email,
        m.password_hash,
        m.role,
        m.account_role_id,
        m.is_department_manager,
        m.status,
        m.must_change_password,
        m.password_changed_at,
        m.token_version,
        m.last_login_at,
      ],
    );
  }
  report.step(`Imported users: ${users.length}`);

  // Employees (+ EA + contacts)
  const managedAll = source.has('employee_managed_departments')
    ? source.all('employee_managed_departments')
    : [];
  const employees = source.all('employees');
  let eaCount = 0;
  let contactCount = 0;
  let emdCount = 0;

  for (const row of employees) {
    const pwId = String(row.id);
    const userPw = pick(row, 'user_id', 'userId');
    const deptPw = pick(row, 'department_id', 'departmentId');
    const posPw = pick(row, 'position_id', 'positionId');
    const managedFor = managedAll.filter(
      (m) => String(pick(m, 'employee_id', 'employeeId')) === pwId,
    );

    let legacyUserRole = 'employee';
    if (userPw) {
      const u = users.find((x) => String(x.id) === String(userPw));
      if (u) {
        legacyUserRole = mapPwRole(u.role, rolesByCode).legacyUserRole;
      }
    } else {
      legacyUserRole = mapPwRole(row.role ?? 'employee', rolesByCode)
        .legacyUserRole;
    }

    const loomId = idMap.bindSource('employee', pwId);
    const m = mapEmployee(row, loomId, {
      userId: userPw ? idMap.get('user', userPw) : null,
      departmentId: deptPw ? idMap.get('department', deptPw) : null,
      positionId: posPw ? idMap.get('position', posPw) : null,
      legacyUserRole,
    });

    await target.query(
      `INSERT INTO employees (
         id, user_id, role, is_department_manager, employee_number,
         first_name, last_name, middle_name, preferred_name, birth_date, city, preferred_language,
         employment_status, hired_at, current_assignment_id, archived_at,
         work_email, department_id, position_id, calendar_color,
         phone_number, telegram, personal_phone_number, personal_telegram, personal_email,
         comment, admin_comment, photo_url,
         profile_visibility_override, absence_visibility_override, show_absence_type_to_peers_override,
         is_active
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
         $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
       )`,
      [
        m.id,
        m.user_id,
        m.role,
        m.is_department_manager,
        m.employee_number,
        m.first_name,
        m.last_name,
        m.middle_name,
        m.preferred_name,
        m.birth_date,
        m.city,
        m.preferred_language,
        m.employment_status,
        m.hired_at,
        m.current_assignment_id,
        m.archived_at,
        m.work_email,
        m.department_id,
        m.position_id,
        m.calendar_color,
        m.phone_number,
        m.telegram,
        m.personal_phone_number,
        m.personal_telegram,
        m.personal_email,
        m.comment,
        m.admin_comment,
        m.photo_url,
        m.profile_visibility_override,
        m.absence_visibility_override,
        m.show_absence_type_to_peers_override,
        m.is_active,
      ],
    );

    if (needsEmploymentAssignment(row, managedFor)) {
      const syn = mapEmploymentAssignment(
        row,
        pwId,
        loomId,
        idMap,
        managedFor,
      );
      const a = syn.assignment;
      await target.query(
        `INSERT INTO employment_assignments (
           id, employee_id, company_id, direction_id, department_id, position_id,
           functional_role, manager_employee_id, mentor_employee_id, hr_responsible_employee_id,
           work_location, work_format, employment_type, contract_type,
           start_date, end_date, probation_start_date, probation_end_date,
           status, management_kind, is_department_manager, comment,
           activation_blocked_reason, activation_checked_at, created_by_user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
         )`,
        [
          a.id,
          a.employee_id,
          a.company_id,
          a.direction_id,
          a.department_id,
          a.position_id,
          a.functional_role,
          a.manager_employee_id,
          a.mentor_employee_id,
          a.hr_responsible_employee_id,
          a.work_location,
          a.work_format,
          a.employment_type,
          a.contract_type,
          a.start_date,
          a.end_date,
          a.probation_start_date,
          a.probation_end_date,
          a.status,
          a.management_kind,
          a.is_department_manager,
          a.comment,
          a.activation_blocked_reason,
          a.activation_checked_at,
          a.created_by_user_id,
        ],
      );
      await target.query(
        `UPDATE employees SET current_assignment_id = $1 WHERE id = $2`,
        [a.id, loomId],
      );
      eaCount += 1;

      for (const md of syn.managed) {
        await target.query(
          `INSERT INTO employment_assignment_managed_departments (id, assignment_id, department_id)
           VALUES ($1,$2,$3)`,
          [md.id, md.assignment_id, md.department_id],
        );
      }
      for (const md of syn.legacyManaged) {
        await target.query(
          `INSERT INTO employee_managed_departments (id, employee_id, department_id)
           VALUES ($1,$2,$3)`,
          [md.id, md.employee_id, md.department_id],
        );
        emdCount += 1;
      }
    }

    const contacts = mapContactsFromEmployee(row, loomId, idMap, pwId);
    for (const c of contacts) {
      await target.query(
        `INSERT INTO employee_contacts (id, employee_id, type, value, is_primary, visibility)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.id, c.employee_id, c.type, c.value, c.is_primary, c.visibility],
      );
      contactCount += 1;
    }
  }
  report.step(
    `Imported employees: ${employees.length}; EA: ${eaCount}; contacts: ${contactCount}; legacy EMD: ${emdCount}`,
  );
}

export async function importSchedules(source, target, idMap, report) {
  if (!source.has('work_schedule_days')) {
    report.step('No work_schedule_days in source');
    return;
  }
  const rows = source.all('work_schedule_days');
  let n = 0;
  for (const row of rows) {
    const empPw = pick(row, 'employee_id', 'employeeId');
    const loomEmp = idMap.get('employee', empPw);
    if (!loomEmp) {
      report.warn(`Skip schedule ${row.id}: missing employee ${empPw}`);
      continue;
    }
    const id = idMap.schedule(row.id);
    const m = mapScheduleDay(row, id, loomEmp);
    await target.query(
      `INSERT INTO work_schedule_days (
         id, employee_id, weekday, start_time, end_time, is_day_off, is_working_day, break_start, break_end, note
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        m.id,
        m.employee_id,
        m.weekday,
        m.start_time,
        m.end_time,
        m.is_day_off,
        m.is_working_day,
        m.break_start,
        m.break_end,
        m.note,
      ],
    );
    n += 1;
  }
  report.step(`Imported work_schedule_days: ${n}`);
}

export async function importAbsences(source, target, idMap, report) {
  const table = source.has('absence_requests')
    ? 'absence_requests'
    : source.has('requests')
      ? 'requests'
      : null;
  if (!table) {
    report.step('No absence requests table');
    return;
  }
  const rows = source.all(table);
  for (const row of rows) {
    const id = idMap.bindSource('absence', row.id);
    const m = mapAbsenceRequest(row, id, idMap);
    await target.query(
      `INSERT INTO absence_requests (
         id, employee_id, department_id_at_submission, position_id_at_submission,
         employee_name_at_submission, employee_number_at_submission, calendar_color_at_submission,
         type, start_date, end_date, absence_start_time, absence_end_time, is_unpaid,
         reason, employee_comment, status, version, created_by_user_id,
         decision_comment, adjustment_comment, deletion_comment,
         decided_at, decided_by_user_id, status_before_deletion_request,
         deletion_requested_at, deletion_requested_by_user_id, created_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
         COALESCE($27, now()), COALESCE($28, now())
       )`,
      [
        m.id,
        m.employee_id,
        m.department_id_at_submission,
        m.position_id_at_submission,
        m.employee_name_at_submission,
        m.employee_number_at_submission,
        m.calendar_color_at_submission,
        m.type,
        m.start_date,
        m.end_date,
        m.absence_start_time,
        m.absence_end_time,
        m.is_unpaid,
        m.reason,
        m.employee_comment,
        m.status,
        m.version,
        m.created_by_user_id,
        m.decision_comment,
        m.adjustment_comment,
        m.deletion_comment,
        m.decided_at,
        m.decided_by_user_id,
        m.status_before_deletion_request,
        m.deletion_requested_at,
        m.deletion_requested_by_user_id,
        m.created_at,
        m.updated_at,
      ],
    );
  }
  report.step(`Imported absence_requests: ${rows.length}`);

  if (source.has('request_history')) {
    const hist = source.all('request_history');
    for (const row of hist) {
      const id = idMap.bindSource('absence-history', row.id);
      const m = mapAbsenceHistory(row, id, idMap);
      await target.query(
        `INSERT INTO absence_request_history (id, request_id, action, actor_user_id, comment, created_at)
         VALUES ($1,$2,$3,$4,$5, COALESCE($6, now()))`,
        [m.id, m.request_id, m.action, m.actor_user_id, m.comment, m.created_at],
      );
    }
    report.step(`Imported absence_request_history: ${hist.length}`);
  }
}

export async function importNotifications(source, target, idMap, report) {
  if (!source.has('notifications')) {
    report.step('No notifications');
    return;
  }
  const rows = source.all('notifications');
  let n = 0;
  for (const row of rows) {
    const id = idMap.bindSource('notification', row.id);
    const m = mapNotification(row, id, idMap);
    await target.query(
      `INSERT INTO notifications (
         id, recipient_user_id, type, title, body, payload, is_read, dismissed_at, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8, COALESCE($9, now()))`,
      [
        m.id,
        m.recipient_user_id,
        m.type,
        m.title,
        m.body,
        m.payload ? JSON.stringify(m.payload) : null,
        m.is_read,
        m.dismissed_at,
        m.created_at,
      ],
    );
    n += 1;
  }
  report.step(`Imported notifications: ${n}`);
}

export async function importPrivacy(source, target, report) {
  if (!source.has('privacy_settings')) {
    report.step('No privacy_settings');
    return;
  }
  const row = source.all('privacy_settings')[0];
  if (!row) return;
  const pairs = mapPrivacyPairs(row);
  for (const [key, value] of pairs) {
    await target.query(
      `INSERT INTO application_settings (key, value)
       VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  }
  report.step(`Imported privacy → application_settings (${pairs.length})`);
}
