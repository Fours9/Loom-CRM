import { loadBetterSqlite3 } from './deps.mjs';

export class SqliteSource {
  /** @param {string} sqlitePath */
  constructor(sqlitePath) {
    const Database = loadBetterSqlite3();
    this.db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
    this.path = sqlitePath;
    this.tables = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY 1`,
      )
      .all()
      .map((r) => r.name);
  }

  has(table) {
    return this.tables.includes(table);
  }

  count(table) {
    if (!this.has(table)) return 0;
    return this.db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  }

  /**
   * Deterministic order by id ASC when column exists.
   * @param {string} table
   */
  all(table) {
    if (!this.has(table)) return [];
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all();
    const hasId = cols.some((c) => c.name === 'id');
    if (hasId) {
      return this.db.prepare(`SELECT * FROM ${table} ORDER BY id ASC`).all();
    }
    return this.db.prepare(`SELECT * FROM ${table}`).all();
  }

  columns(table) {
    if (!this.has(table)) return [];
    return this.db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  }

  close() {
    this.db.close();
  }
}
