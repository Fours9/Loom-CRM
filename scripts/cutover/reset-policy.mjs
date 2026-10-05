/**
 * Canonical ResetPolicy for PW → Loom port.
 *
 * TRUNCATE = exhaustive runtime/domain state (NO CASCADE).
 * KEEP     = migrations + true catalogs/config.
 * INTENTIONALLY_IGNORED = source-only / not a Loom target concern.
 *
 * Missing dependent table with FK → PostgreSQL fail-closed on TRUNCATE.
 */

/** @type {readonly string[]} */
export const TRUNCATE_TABLES = Object.freeze([
  // Absences
  'absence_attachments',
  'absence_request_history',
  'absence_requests',
  // Documents + storage cleanup queue
  'employee_document_files',
  'employee_documents',
  'file_deletion_outbox',
  // Questionnaire runtime (not templates)
  'questionnaire_profile_proposals',
  'questionnaire_submissions',
  'questionnaire_responses',
  'questionnaire_assignments',
  'questionnaire_assignment_code_counters',
  // Employment / org runtime
  'employment_assignment_managed_departments',
  'employment_assignments',
  'employee_contacts',
  'employee_about',
  'employee_emergency_contacts',
  'employee_important_dates',
  'employee_skill_assessments',
  'employee_managed_departments',
  'work_schedule_days',
  // Position catalog runtime rows
  'position_managed_departments',
  'position_duties',
  'position_goal_templates',
  'position_skill_requirements',
  // Platform runtime
  'notifications',
  'audit_logs',
  // Org core (last among domain)
  'employees',
  'positions',
  'departments',
  'users',
]);

/** @type {readonly string[]} */
export const KEEP_TABLES = Object.freeze([
  'migrations',
  'bootstrap_state',
  'account_roles',
  'account_role_permissions',
  'account_role_surfaces',
  'account_role_questionnaire_templates',
  'app_surfaces',
  'work_formats',
  'employment_types',
  'skills',
  'skill_groups',
  'questionnaire_templates',
  'questionnaire_template_versions',
  'directions',
  'companies',
  'application_settings',
]);

/** Source-only / not Loom tables — documented for classification completeness. */
export const INTENTIONALLY_IGNORED = Object.freeze([
  'pw:schema_migrations',
  'pw:audit_logs', // not imported
  'pw:request_attachments', // binary port out of scope v1
]);

/**
 * Single TRUNCATE … RESTART IDENTITY (no CASCADE).
 * @param {(sql: string, params?: unknown[]) => Promise<unknown>} query
 */
export async function executeResetTruncate(query) {
  const list = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
  await query(`TRUNCATE TABLE ${list} RESTART IDENTITY`);
}
