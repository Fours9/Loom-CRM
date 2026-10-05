import { TRUNCATE_TABLES, KEEP_TABLES } from '../reset-policy.mjs';
import { mapPwRole } from '../mappers/role.mjs';
import {
  hasManagerEvidence,
  needsEmploymentAssignment,
} from '../mappers/employee.mjs';
import { pick } from '../mappers/coerce.mjs';
import { remapUserRef } from '../mappers/absence-request.mjs';
import { IdMap } from '../id-map.mjs';

/**
 * Dry-run / preflight: SQLite + PG READ ONLY. Throws aggregating errors.
 *
 * @param {import('../sqlite-source.mjs').SqliteSource} source
 * @param {import('../pg-target.mjs').PostgresTarget} target
 * @param {import('../report.mjs').CutoverReport} report
 * @param {{ reset: boolean }} opts
 */
export async function runDryRunValidation(source, target, report, opts) {
  const errors = [];

  // ResetPolicy tables exist
  for (const table of TRUNCATE_TABLES) {
    if (!(await target.tableExists(table))) {
      errors.push(`ResetPolicy.TRUNCATE table missing in target: ${table}`);
    }
  }
  for (const table of KEEP_TABLES) {
    if (!(await target.tableExists(table))) {
      errors.push(`ResetPolicy.KEEP table missing in target: ${table}`);
    }
  }

  // Non-empty truncate domain without --reset (apply or intending apply)
  const counts = await target.countTruncateTables();
  report.data.counts.targetTruncate = counts;
  if (!opts.reset) {
    const nonempty = Object.entries(counts).filter(([, c]) => c > 0);
    if (nonempty.length) {
      errors.push(
        `Without --reset, truncate-domain has rows (refuse mixed state): ${nonempty
          .slice(0, 12)
          .map(([t, c]) => `${t}=${c}`)
          .join(', ')}${nonempty.length > 12 ? '…' : ''}. Re-run with --dry-run --reset or --reset.`,
      );
    }
  }

  // Account roles
  const rolesByCode = await target.loadAccountRolesByCode();
  report.data.counts.accountRoles = [...rolesByCode.keys()].sort();

  const users = source.all('users');
  for (const u of users) {
    try {
      mapPwRole(u.role, rolesByCode);
    } catch (e) {
      errors.push(String(e.message || e));
    }
  }

  // Manager / EA representability
  const managedAll = source.has('employee_managed_departments')
    ? source.all('employee_managed_departments')
    : [];
  const deptIds = new Set(source.all('departments').map((d) => String(d.id)));
  const employees = source.all('employees');

  for (const emp of employees) {
    const pwId = String(emp.id);
    const managedFor = managedAll.filter(
      (m) => String(pick(m, 'employee_id', 'employeeId')) === pwId,
    );
    for (const m of managedFor) {
      const d = String(pick(m, 'department_id', 'departmentId'));
      if (!deptIds.has(d)) {
        errors.push(
          `Orphan managed department ${d} for employee ${pwId}`,
        );
      }
    }
    if (hasManagerEvidence(emp, managedFor)) {
      if (!needsEmploymentAssignment(emp, managedFor)) {
        errors.push(
          `Manager evidence for employee ${pwId} but EA not representable`,
        );
      }
    }
  }

  // Absence actor coverage (simulate IdMap bind for users/employees/depts/positions)
  const idMap = new IdMap();
  for (const d of source.all('departments')) idMap.bindSource('department', d.id);
  for (const p of source.all('positions')) idMap.bindSource('position', p.id);
  for (const u of users) idMap.bindSource('user', u.id);
  for (const e of employees) idMap.bindSource('employee', e.id);

  const reqTable = source.has('absence_requests')
    ? 'absence_requests'
    : source.has('requests')
      ? 'requests'
      : null;
  if (reqTable) {
    for (const row of source.all(reqTable)) {
      try {
        const empPw = pick(row, 'employee_id', 'employeeId');
        if (!idMap.get('employee', empPw)) {
          errors.push(`Absence ${row.id}: employee ${empPw} not mapped`);
        }
        remapUserRef(
          idMap,
          pick(row, 'created_by_user_id', 'createdByUserId'),
          { required: true, label: `absence ${row.id} created_by` },
        );
        remapUserRef(
          idMap,
          pick(row, 'decided_by_user_id', 'decidedByUserId'),
          { required: false, label: `absence ${row.id} decided_by` },
        );
        remapUserRef(
          idMap,
          pick(row, 'deletion_requested_by_user_id', 'deletionRequestedByUserId'),
          { required: false, label: `absence ${row.id} deletion_by` },
        );
        idMap.bindSource('absence', row.id);
      } catch (e) {
        errors.push(String(e.message || e));
      }
    }
  }

  if (source.has('request_history')) {
    for (const row of source.all('request_history')) {
      try {
        const reqPw = pick(row, 'request_id', 'requestId');
        if (!idMap.get('absence', reqPw)) {
          errors.push(`History ${row.id}: request ${reqPw} not mapped`);
        }
        remapUserRef(
          idMap,
          pick(row, 'changed_by_user_id', 'changedByUserId'),
          { required: false, label: `history ${row.id} actor` },
        );
      } catch (e) {
        errors.push(String(e.message || e));
      }
    }
  }

  // Attachments
  if (source.has('request_attachments') && source.count('request_attachments') > 0) {
    errors.push(
      `request_attachments has ${source.count('request_attachments')} rows; binary port out of scope v1 (fail-closed)`,
    );
  }

  report.data.counts.source = {
    users: source.count('users'),
    employees: source.count('employees'),
    departments: source.count('departments'),
    positions: source.count('positions'),
    work_schedule_days: source.count('work_schedule_days'),
    absence_requests: source.count('absence_requests') || source.count('requests'),
    request_history: source.count('request_history'),
    notifications: source.count('notifications'),
    employee_managed_departments: source.count('employee_managed_departments'),
  };

  report.skip('pw:audit_logs (not imported)');
  report.skip('pw:schema_migrations (source-only)');

  if (errors.length) {
    for (const e of errors) report.error(e);
    const err = new Error(`Preflight failed with ${errors.length} error(s)`);
    err.preflightErrors = errors;
    throw err;
  }

  report.step('Preflight OK (SQLite + PG read-only checks)');
  return { rolesByCode };
}
