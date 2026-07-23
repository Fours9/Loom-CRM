#!/usr/bin/env node
/**
 * One-shot ProjectWeekend SQLite → LoomCRM PostgreSQL importer (cutover).
 *
 * Usage:
 *   node scripts/cutover/import-from-projectweekend.mjs --dry-run
 *   node scripts/cutover/import-from-projectweekend.mjs --reset --sqlite ProjectWeekend/data/app.sqlite
 *
 * --reset truncates Loom domain tables (keeps migrations / bootstrap_state) before import.
 * Never modifies ProjectWeekend. Reads SQLite read-only.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const requireApi = createRequire(
  pathToFileURL(resolve(process.cwd(), 'apps/api/package.json')).href,
);

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

const dryRun = process.argv.includes('--dry-run');
const reset = process.argv.includes('--reset');
const sqlitePath = resolve(
  String(
    arg('--sqlite', resolve(process.cwd(), 'ProjectWeekend/data/app.sqlite')),
  ),
);
const reportPath = resolve(
  process.cwd(),
  `cutover-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);

const report = {
  startedAt: new Date().toISOString(),
  dryRun,
  reset,
  sqlitePath,
  mapping: {
    users: {},
    employees: {},
    departments: {},
    positions: {},
    requests: {},
  },
  counts: {},
  errors: [],
  steps: [],
};

function step(msg) {
  report.steps.push(msg);
  console.log(msg);
}

function bool(v, fallback = false) {
  if (v === undefined || v === null) return fallback;
  return Boolean(v);
}

async function main() {
  if (!existsSync(sqlitePath)) {
    report.errors.push(`SQLite file not found: ${sqlitePath}`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.error(report.errors[0]);
    process.exit(1);
  }

  let Database;
  try {
    Database = require('better-sqlite3');
  } catch {
    step(
      'better-sqlite3 not installed. Install temporarily: pnpm add -wD better-sqlite3',
    );
    report.errors.push('Missing dependency better-sqlite3');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  step(`Opened SQLite (readonly): ${sqlitePath}`);

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    )
    .all()
    .map((r) => r.name);
  report.counts.sqliteTables = tables.length;
  step(`Found ${tables.length} tables`);

  const count = (table) => {
    if (!tables.includes(table)) return 0;
    return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  };

  report.counts.users = count('users');
  report.counts.employees = count('employees');
  report.counts.departments = count('departments');
  report.counts.positions = count('positions');
  report.counts.work_schedule_days = count('work_schedule_days');
  report.counts.notifications = count('notifications');
  report.counts.privacy_settings = count('privacy_settings');
  report.counts.absence_requests =
    count('absence_requests') || count('requests') || 0;

  step(
    `Source counts: users=${report.counts.users}, employees=${report.counts.employees}, departments=${report.counts.departments}, positions=${report.counts.positions}, schedules=${report.counts.work_schedule_days}, notifications=${report.counts.notifications}, requests=${report.counts.absence_requests}`,
  );

  if (dryRun) {
    step('Dry-run only — no PostgreSQL writes. Mapping would be generated on apply.');
    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report: ${reportPath}`);
    db.close();
    return;
  }

  const { Client } = requireApi('pg');
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgres://loom:loom@127.0.0.1:5432/loom_crm';
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  step(`Connected to PostgreSQL`);

  try {
    await client.query('BEGIN');

    if (reset) {
      await client.query(`
        TRUNCATE TABLE
          absence_attachments,
          absence_request_history,
          absence_requests,
          notifications,
          audit_logs,
          work_schedule_days,
          employee_managed_departments,
          employees,
          positions,
          departments,
          users
        RESTART IDENTITY CASCADE
      `);
      step('RESET: truncated Loom domain tables');
    }

    // Departments
    if (tables.includes('departments')) {
      const rows = db.prepare('SELECT * FROM departments').all();
      for (const row of rows) {
        const res = await client.query(
          `INSERT INTO departments (name, description, is_hidden, is_active)
           VALUES ($1, $2, COALESCE($3, false), COALESCE($4, true))
           RETURNING id`,
          [
            row.name,
            row.description ?? null,
            bool(row.is_hidden ?? row.isHidden, false),
            bool(row.is_active ?? row.isActive, true),
          ],
        );
        report.mapping.departments[String(row.id)] = res.rows[0].id;
      }
      step(`Imported departments: ${rows.length}`);
    }

    // Positions
    if (tables.includes('positions')) {
      const rows = db.prepare('SELECT * FROM positions').all();
      for (const row of rows) {
        const deptId = row.department_id ?? row.departmentId;
        const mappedDept = deptId
          ? report.mapping.departments[String(deptId)] ?? null
          : null;
        const res = await client.query(
          `INSERT INTO positions (name, department_id, description, is_active)
           VALUES ($1, $2, $3, COALESCE($4, true))
           RETURNING id`,
          [
            row.name,
            mappedDept,
            row.description ?? null,
            bool(row.is_active ?? row.isActive, true),
          ],
        );
        report.mapping.positions[String(row.id)] = res.rows[0].id;
      }
      step(`Imported positions: ${rows.length}`);
    }

    // Users
    if (tables.includes('users')) {
      const rows = db.prepare('SELECT * FROM users').all();
      for (const row of rows) {
        const res = await client.query(
          `INSERT INTO users (
             email, password_hash, role, is_department_manager, status,
             must_change_password, password_changed_at, token_version, last_login_at
           ) VALUES ($1,$2,$3,COALESCE($4,false),COALESCE($5,'active'),COALESCE($6,true),$7,COALESCE($8,0),$9)
           ON CONFLICT (email) DO UPDATE SET
             password_hash = EXCLUDED.password_hash,
             role = EXCLUDED.role,
             is_department_manager = EXCLUDED.is_department_manager,
             status = EXCLUDED.status,
             must_change_password = EXCLUDED.must_change_password,
             password_changed_at = EXCLUDED.password_changed_at,
             token_version = EXCLUDED.token_version,
             last_login_at = EXCLUDED.last_login_at
           RETURNING id`,
          [
            String(row.email).toLowerCase(),
            row.password_hash ?? row.passwordHash,
            row.role,
            bool(row.is_department_manager ?? row.isDepartmentManager, false),
            row.status ?? 'active',
            bool(row.must_change_password ?? row.mustChangePassword, true),
            row.password_changed_at ?? row.passwordChangedAt ?? null,
            row.token_version ?? row.tokenVersion ?? 0,
            row.last_login_at ?? row.lastLoginAt ?? null,
          ],
        );
        report.mapping.users[String(row.id)] = res.rows[0].id;
      }
      step(`Imported users: ${rows.length}`);
    }

    // Employees (full PW profile fields when columns exist)
    if (tables.includes('employees')) {
      const rows = db.prepare('SELECT * FROM employees').all();
      for (const row of rows) {
        const userId = row.user_id ?? row.userId;
        const deptId = row.department_id ?? row.departmentId;
        const posId = row.position_id ?? row.positionId;
        const res = await client.query(
          `INSERT INTO employees (
             user_id, role, is_department_manager, employee_number,
             first_name, last_name, middle_name, work_email,
             department_id, position_id, calendar_color, is_active,
             phone_number, telegram, personal_phone_number, personal_telegram,
             personal_email, comment, admin_comment, photo_url,
             profile_visibility_override, absence_visibility_override,
             show_absence_type_to_peers_override
           ) VALUES (
             $1,$2,COALESCE($3,false),$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,true),
             $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
           )
           RETURNING id`,
          [
            userId ? report.mapping.users[String(userId)] ?? null : null,
            row.role ?? 'employee',
            bool(row.is_department_manager ?? row.isDepartmentManager, false),
            String(row.employee_number ?? row.employeeNumber),
            row.first_name ?? row.firstName,
            row.last_name ?? row.lastName,
            row.middle_name ?? row.middleName ?? null,
            row.work_email ?? row.workEmail ?? null,
            deptId ? report.mapping.departments[String(deptId)] ?? null : null,
            posId ? report.mapping.positions[String(posId)] ?? null : null,
            row.calendar_color ?? row.calendarColor ?? null,
            bool(row.is_active ?? row.isActive, true),
            row.phone_number ?? row.phoneNumber ?? null,
            row.telegram ?? null,
            row.personal_phone_number ?? row.personalPhoneNumber ?? null,
            row.personal_telegram ?? row.personalTelegram ?? null,
            row.personal_email ?? row.personalEmail ?? null,
            row.comment ?? null,
            row.admin_comment ?? row.adminComment ?? null,
            row.photo_url ?? row.photoUrl ?? null,
            row.profile_visibility_override ??
              row.profileVisibilityOverride ??
              null,
            row.absence_visibility_override ??
              row.absenceVisibilityOverride ??
              null,
            row.show_absence_type_to_peers_override ??
              row.showAbsenceTypeToPeersOverride ??
              null,
          ],
        );
        report.mapping.employees[String(row.id)] = res.rows[0].id;
      }
      step(`Imported employees: ${rows.length}`);
    }

    // Work schedules
    if (tables.includes('work_schedule_days')) {
      const rows = db.prepare('SELECT * FROM work_schedule_days').all();
      let n = 0;
      for (const row of rows) {
        const empId = row.employee_id ?? row.employeeId;
        const mappedEmp = report.mapping.employees[String(empId)];
        if (!mappedEmp) {
          report.errors.push(`Skip schedule ${row.id}: missing employee`);
          continue;
        }
        const isWorking =
          row.is_working_day ?? row.isWorkingDay ?? row.is_day_off === 0;
        const isDayOff =
          row.is_day_off !== undefined && row.is_day_off !== null
            ? bool(row.is_day_off)
            : !bool(isWorking, true);
        const isWorkingDay = !isDayOff;
        await client.query(
          `INSERT INTO work_schedule_days (
             employee_id, weekday, start_time, end_time, is_day_off,
             is_working_day, break_start, break_end, note
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (employee_id, weekday) DO UPDATE SET
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             is_day_off = EXCLUDED.is_day_off,
             is_working_day = EXCLUDED.is_working_day,
             break_start = EXCLUDED.break_start,
             break_end = EXCLUDED.break_end,
             note = EXCLUDED.note`,
          [
            mappedEmp,
            row.weekday,
            row.start_time ?? row.startTime ?? null,
            row.end_time ?? row.endTime ?? null,
            isDayOff,
            isWorkingDay,
            row.break_start ?? row.breakStart ?? null,
            row.break_end ?? row.breakEnd ?? null,
            row.note ?? null,
          ],
        );
        n += 1;
      }
      step(`Imported work_schedule_days: ${n}`);
    }

    // Managed departments
    if (tables.includes('employee_managed_departments')) {
      const rows = db.prepare('SELECT * FROM employee_managed_departments').all();
      let n = 0;
      for (const row of rows) {
        const empId = row.employee_id ?? row.employeeId;
        const deptId = row.department_id ?? row.departmentId;
        const mappedEmp = report.mapping.employees[String(empId)];
        const mappedDept = report.mapping.departments[String(deptId)];
        if (!mappedEmp || !mappedDept) continue;
        await client.query(
          `INSERT INTO employee_managed_departments (employee_id, department_id)
           VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [mappedEmp, mappedDept],
        );
        n += 1;
      }
      step(`Imported employee_managed_departments: ${n}`);
    }

    // Notifications
    if (tables.includes('notifications')) {
      const rows = db.prepare('SELECT * FROM notifications').all();
      let n = 0;
      for (const row of rows) {
        const recipient =
          report.mapping.users[
            String(row.recipient_user_id ?? row.recipientUserId)
          ];
        if (!recipient) {
          report.errors.push(`Skip notification ${row.id}: missing recipient`);
          continue;
        }
        const relatedReq =
          row.related_request_id ?? row.relatedRequestId ?? null;
        const payload = relatedReq
          ? { relatedRequestId: relatedReq }
          : null;
        await client.query(
          `INSERT INTO notifications (
             recipient_user_id, type, title, body, payload, is_read, created_at
           ) VALUES ($1,$2,$3,$4,$5::jsonb,COALESCE($6,false),COALESCE($7,now()))`,
          [
            recipient,
            row.type,
            row.title,
            row.body,
            payload ? JSON.stringify(payload) : null,
            bool(row.is_read ?? row.isRead, false),
            row.created_at ?? row.createdAt ?? null,
          ],
        );
        n += 1;
      }
      step(`Imported notifications: ${n}`);
    }

    // Privacy → application_settings
    if (tables.includes('privacy_settings')) {
      const row = db.prepare('SELECT * FROM privacy_settings LIMIT 1').get();
      if (row) {
        const pairs = [
          [
            'privacy.absence_visibility_mode',
            String(row.absence_visibility_mode ?? row.absenceVisibilityMode),
          ],
          [
            'privacy.profile_visibility_mode',
            String(row.profile_visibility_mode ?? row.profileVisibilityMode),
          ],
          [
            'privacy.show_department_on_calendar',
            String(
              bool(
                row.show_department_on_calendar ?? row.showDepartmentOnCalendar,
                true,
              ),
            ),
          ],
          [
            'privacy.show_position_on_calendar',
            String(
              bool(
                row.show_position_on_calendar ?? row.showPositionOnCalendar,
                true,
              ),
            ),
          ],
          [
            'privacy.show_absence_type_to_peers',
            String(
              bool(
                row.show_absence_type_to_peers ?? row.showAbsenceTypeToPeers,
                false,
              ),
            ),
          ],
          [
            'privacy.session_inactivity_minutes',
            String(
              row.session_inactivity_minutes ??
                row.sessionInactivityMinutes ??
                480,
            ),
          ],
          [
            'privacy.global_privacy_priority',
            String(
              bool(
                row.global_privacy_priority ?? row.globalPrivacyPriority,
                false,
              ),
            ),
          ],
        ];
        for (const [key, value] of pairs) {
          await client.query(
            `INSERT INTO application_settings (key, value)
             VALUES ($1,$2)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [key, value],
          );
        }
        step(`Imported privacy_settings → application_settings (${pairs.length})`);
      }
    }

    // Absence requests
    const reqTable = tables.includes('absence_requests')
      ? 'absence_requests'
      : tables.includes('requests')
        ? 'requests'
        : null;
    if (reqTable) {
      const rows = db.prepare(`SELECT * FROM ${reqTable}`).all();
      for (const row of rows) {
        const empId = row.employee_id ?? row.employeeId;
        const mappedEmp = report.mapping.employees[String(empId)];
        if (!mappedEmp) {
          report.errors.push(`Skip request ${row.id}: missing employee mapping`);
          continue;
        }
        const createdBy =
          report.mapping.users[
            String(row.created_by_user_id ?? row.createdByUserId)
          ] ?? null;
        if (!createdBy) {
          report.errors.push(`Skip request ${row.id}: missing creator mapping`);
          continue;
        }
        const res = await client.query(
          `INSERT INTO absence_requests (
             employee_id, department_id_at_submission, employee_name_at_submission,
             type, start_date, end_date, reason, status, created_by_user_id, decision_comment
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'pending'),$9,$10)
           RETURNING id`,
          [
            mappedEmp,
            null,
            row.employee_name_at_submission ??
              row.employeeNameAtSubmission ??
              'Unknown',
            row.type,
            row.start_date ?? row.startDate,
            row.end_date ?? row.endDate ?? null,
            row.reason ?? null,
            row.status ?? 'pending',
            createdBy,
            row.decision_comment ?? row.decisionComment ?? null,
          ],
        );
        report.mapping.requests[String(row.id)] = res.rows[0].id;
      }
      step(`Imported absence requests: ${rows.length}`);
    }

    const orphans = await client.query(`
      SELECT COUNT(*)::int AS c FROM absence_requests ar
      LEFT JOIN employees e ON e.id = ar.employee_id
      WHERE e.id IS NULL
    `);
    report.counts.orphanRequests = orphans.rows[0].c;
    if (orphans.rows[0].c > 0) {
      throw new Error(`Orphan absence_requests: ${orphans.rows[0].c}`);
    }

    const loomCounts = await client.query(`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM employees) AS employees,
        (SELECT count(*)::int FROM departments) AS departments,
        (SELECT count(*)::int FROM positions) AS positions,
        (SELECT count(*)::int FROM work_schedule_days) AS schedules
    `);
    report.counts.loomAfter = loomCounts.rows[0];
    step(`Loom after import: ${JSON.stringify(loomCounts.rows[0])}`);

    await client.query('COMMIT');
    step('COMMIT successful');
  } catch (e) {
    await client.query('ROLLBACK');
    report.errors.push(String(e));
    step(`ROLLBACK: ${e}`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    db.close();
    await client.end();
    process.exit(1);
  }

  report.finishedAt = new Date().toISOString();
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report: ${reportPath}`);
  db.close();
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
