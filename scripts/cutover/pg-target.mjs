import { loadPg } from './deps.mjs';
import { executeResetTruncate, TRUNCATE_TABLES } from './reset-policy.mjs';

export class PostgresTarget {
  /** @param {string} databaseUrl */
  constructor(databaseUrl) {
    const { Client } = loadPg();
    this.client = new Client({ connectionString: databaseUrl });
    this.databaseUrl = databaseUrl;
  }

  async connect() {
    await this.client.connect();
  }

  async end() {
    await this.client.end();
  }

  /**
   * @param {string} sql
   * @param {unknown[]} [params]
   */
  async query(sql, params = []) {
    return this.client.query(sql, params);
  }

  async begin() {
    await this.query('BEGIN');
  }

  async beginReadOnly() {
    await this.query('BEGIN READ ONLY');
  }

  async commit() {
    await this.query('COMMIT');
  }

  async rollback() {
    await this.query('ROLLBACK');
  }

  async truncateDomain() {
    await executeResetTruncate((sql, params) => this.query(sql, params));
  }

  /**
   * @returns {Promise<Record<string, number>>}
   */
  async countTruncateTables() {
    /** @type {Record<string, number>} */
    const counts = {};
    for (const table of TRUNCATE_TABLES) {
      const res = await this.query(
        `SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      if (res.rows[0].c === 0) {
        counts[table] = -1; // missing
        continue;
      }
      const c = await this.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
      counts[table] = c.rows[0].c;
    }
    return counts;
  }

  /** @returns {Promise<Map<string, {id: string, code: string, permissionPreset: string, isAdminEquivalent: boolean}>>} */
  async loadAccountRolesByCode() {
    const res = await this.query(
      `SELECT id, code, permission_preset, is_admin_equivalent FROM account_roles`,
    );
    /** @type {Map<string, {id: string, code: string, permissionPreset: string, isAdminEquivalent: boolean}>} */
    const map = new Map();
    for (const row of res.rows) {
      map.set(row.code, {
        id: row.id,
        code: row.code,
        permissionPreset: row.permission_preset,
        isAdminEquivalent: row.is_admin_equivalent,
      });
    }
    return map;
  }

  async tableExists(table) {
    const res = await this.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [table],
    );
    return res.rowCount > 0;
  }
}
