import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SqliteSource } from './sqlite-source.mjs';
import { PostgresTarget } from './pg-target.mjs';
import { IdMap } from './id-map.mjs';
import { CutoverReport } from './report.mjs';
import { runDryRunValidation } from './validate/dry-run.mjs';
import {
  importOrganization,
  importSchedules,
  importAbsences,
  importNotifications,
  importPrivacy,
} from './importers/all.importer.mjs';

/**
 * @param {{
 *   sqlitePath: string,
 *   databaseUrl: string,
 *   dryRun: boolean,
 *   reset: boolean,
 *   reportPath?: string,
 * }} opts
 */
export async function runPort(opts) {
  const reportPath =
    opts.reportPath ??
    resolve(
      process.cwd(),
      `cutover-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
  const report = new CutoverReport({
    dryRun: opts.dryRun,
    reset: opts.reset,
    sqlitePath: opts.sqlitePath,
    databaseUrl: opts.databaseUrl,
  });

  const source = new SqliteSource(opts.sqlitePath);
  report.step(`Opened SQLite (readonly): ${opts.sqlitePath}`);

  const target = new PostgresTarget(opts.databaseUrl);
  await target.connect();
  report.step('Connected to PostgreSQL');

  try {
    // Always validate with read-only TX first
    await target.beginReadOnly();
    let rolesByCode;
    try {
      const pre = await runDryRunValidation(source, target, report, {
        reset: opts.reset,
      });
      rolesByCode = pre.rolesByCode;
      await target.commit();
    } catch (e) {
      await target.rollback();
      throw e;
    }

    if (opts.dryRun) {
      report.step('Dry-run only — no PostgreSQL writes.');
      report.data.mapping = {};
      report.finish();
      writeFileSync(reportPath, JSON.stringify(report.data, null, 2));
      console.log(`Report: ${reportPath}`);
      return { report: report.data, reportPath, exitCode: 0 };
    }

    if (!opts.reset) {
      // Extra guard (also in preflight)
      throw new Error('Apply requires --reset (fail-closed)');
    }

    const idMap = new IdMap();
    await target.begin();
    try {
      await target.truncateDomain();
      report.step(
        'RESET: TRUNCATE domain tables RESTART IDENTITY (NO CASCADE)',
      );

      await importOrganization(source, target, idMap, report, rolesByCode);
      await importSchedules(source, target, idMap, report);
      await importAbsences(source, target, idMap, report);
      await importNotifications(source, target, idMap, report);
      await importPrivacy(source, target, report);

      const orphans = await target.query(`
        SELECT COUNT(*)::int AS c FROM absence_requests ar
        LEFT JOIN employees e ON e.id = ar.employee_id
        WHERE e.id IS NULL
      `);
      if (orphans.rows[0].c > 0) {
        throw new Error(`Orphan absence_requests: ${orphans.rows[0].c}`);
      }

      const loomCounts = await target.query(`
        SELECT
          (SELECT count(*)::int FROM users) AS users,
          (SELECT count(*)::int FROM employees) AS employees,
          (SELECT count(*)::int FROM departments) AS departments,
          (SELECT count(*)::int FROM positions) AS positions,
          (SELECT count(*)::int FROM work_schedule_days) AS schedules,
          (SELECT count(*)::int FROM absence_requests) AS requests,
          (SELECT count(*)::int FROM absence_request_history) AS history,
          (SELECT count(*)::int FROM employment_assignments) AS assignments,
          (SELECT count(*)::int FROM notifications) AS notifications
      `);
      report.data.counts.loomAfter = loomCounts.rows[0];
      report.step(`Loom after import: ${JSON.stringify(loomCounts.rows[0])}`);

      // Dual role mirror check
      const mirrorCheck = await target.query(`
        SELECT u.email, u.role AS user_role, r.code AS role_code, r.permission_preset, r.is_admin_equivalent
        FROM users u
        JOIN account_roles r ON r.id = u.account_role_id
      `);
      for (const row of mirrorCheck.rows) {
        const expected = row.is_admin_equivalent
          ? 'admin'
          : row.permission_preset === 'department_manager'
            ? 'department_manager'
            : 'employee';
        if (row.user_role !== expected) {
          throw new Error(
            `Role mirror mismatch for ${row.email}: users.role=${row.user_role} expected ${expected} (account_roles.code=${row.role_code})`,
          );
        }
      }

      report.data.mapping = idMap.toReportMapping();
      await target.commit();
      report.step('COMMIT successful');
    } catch (e) {
      await target.rollback();
      report.error(String(e));
      report.step(`ROLLBACK: ${e}`);
      report.finish();
      writeFileSync(reportPath, JSON.stringify(report.data, null, 2));
      console.log(`Report: ${reportPath}`);
      return { report: report.data, reportPath, exitCode: 1 };
    }

    report.finish();
    writeFileSync(reportPath, JSON.stringify(report.data, null, 2));
    console.log(`Report: ${reportPath}`);
    return { report: report.data, reportPath, exitCode: 0 };
  } finally {
    source.close();
    await target.end();
  }
}
