#!/usr/bin/env node
/**
 * One-shot ProjectWeekend SQLite → LoomCRM PostgreSQL importer (cutover).
 *
 * Usage:
 *   node scripts/cutover/import-from-projectweekend.mjs --dry-run
 *   node scripts/cutover/import-from-projectweekend.mjs --sqlite path/to/app.sqlite
 *
 * Never modifies ProjectWeekend. Reads SQLite read-only when possible.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

const dryRun = process.argv.includes('--dry-run');
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
    try {
      // Fallback note — better-sqlite3 may not be installed in LoomCRM workspace.
      step(
        'better-sqlite3 not installed. Install temporarily: pnpm add -wD better-sqlite3',
      );
      report.errors.push('Missing dependency better-sqlite3');
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      process.exit(2);
    } catch (e) {
      report.errors.push(String(e));
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      process.exit(2);
    }
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
  report.counts.absence_requests =
    count('absence_requests') || count('requests') || 0;

  step(
    `Source counts: users=${report.counts.users}, employees=${report.counts.employees}, departments=${report.counts.departments}, positions=${report.counts.positions}, requests=${report.counts.absence_requests}`,
  );

  if (dryRun) {
    step('Dry-run only — no PostgreSQL writes. Mapping would be generated on apply.');
    report.finishedAt = new Date().toISOString();
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Report: ${reportPath}`);
    db.close();
    return;
  }

  const { Client } = require('pg');
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgres://loom:loom@127.0.0.1:5432/loom_crm';
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  step(`Connected to PostgreSQL`);

  try {
    await client.query('BEGIN');

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
            row.is_hidden ?? row.isHidden ?? false,
            row.is_active ?? row.isActive ?? true,
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
            row.is_active ?? row.isActive ?? true,
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
           ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
           RETURNING id`,
          [
            String(row.email).toLowerCase(),
            row.password_hash ?? row.passwordHash,
            row.role,
            row.is_department_manager ?? row.isDepartmentManager ?? false,
            row.status ?? 'active',
            row.must_change_password ?? row.mustChangePassword ?? true,
            row.password_changed_at ?? row.passwordChangedAt ?? null,
            row.token_version ?? row.tokenVersion ?? 0,
            row.last_login_at ?? row.lastLoginAt ?? null,
          ],
        );
        report.mapping.users[String(row.id)] = res.rows[0].id;
      }
      step(`Imported users: ${rows.length}`);
    }

    // Employees
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
             department_id, position_id, calendar_color, is_active
           ) VALUES ($1,$2,COALESCE($3,false),$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,true))
           RETURNING id`,
          [
            userId ? report.mapping.users[String(userId)] ?? null : null,
            row.role ?? 'employee',
            row.is_department_manager ?? row.isDepartmentManager ?? false,
            String(row.employee_number ?? row.employeeNumber),
            row.first_name ?? row.firstName,
            row.last_name ?? row.lastName,
            row.middle_name ?? row.middleName ?? null,
            row.work_email ?? row.workEmail ?? null,
            deptId ? report.mapping.departments[String(deptId)] ?? null : null,
            posId ? report.mapping.positions[String(posId)] ?? null : null,
            row.calendar_color ?? row.calendarColor ?? null,
            row.is_active ?? row.isActive ?? true,
          ],
        );
        report.mapping.employees[String(row.id)] = res.rows[0].id;
      }
      step(`Imported employees: ${rows.length}`);
    }

    // Absence requests (legacy table name may be absence_requests)
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

    // FK sanity
    const orphans = await client.query(`
      SELECT COUNT(*)::int AS c FROM absence_requests ar
      LEFT JOIN employees e ON e.id = ar.employee_id
      WHERE e.id IS NULL
    `);
    report.counts.orphanRequests = orphans.rows[0].c;
    if (orphans.rows[0].c > 0) {
      throw new Error(`Orphan absence_requests: ${orphans.rows[0].c}`);
    }

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
