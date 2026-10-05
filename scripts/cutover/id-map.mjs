import { loadUuid } from './deps.mjs';

/** Fixed DNS namespace for PW→Loom deterministic UUIDs (documented in runbook). */
export const CUTOVER_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const { v5: uuidv5 } = loadUuid();

/**
 * Deterministic IdMap: source-backed and synthetic kinds.
 * All Loom PKs are derived via uuid v5 and inserted explicitly.
 */
export class IdMap {
  /** @type {Record<string, Record<string, string>>} */
  #maps = {};

  /**
   * @param {string} kind
   * @param {string} name  full v5 name (already includes kind policy)
   */
  derive(kind, name) {
    const id = uuidv5(name, CUTOVER_UUID_NAMESPACE);
    if (!this.#maps[kind]) this.#maps[kind] = {};
    return id;
  }

  /**
   * Source-backed: remember(kind, pwId) → uuid v5(`${kind}:${pwId}`)
   * @param {string} kind
   * @param {string|number} pwId
   */
  bindSource(kind, pwId) {
    const key = String(pwId);
    const id = this.derive(kind, `${kind}:${key}`);
    this.#maps[kind][key] = id;
    return id;
  }

  /**
   * @param {string} kind
   * @param {string|number} pwId
   * @param {string} loomId
   */
  remember(kind, pwId, loomId) {
    const key = String(pwId);
    if (!this.#maps[kind]) this.#maps[kind] = {};
    this.#maps[kind][key] = loomId;
    return loomId;
  }

  /**
   * @param {string} kind
   * @param {string|number|null|undefined} pwId
   * @returns {string|null}
   */
  get(kind, pwId) {
    if (pwId === null || pwId === undefined || pwId === '') return null;
    return this.#maps[kind]?.[String(pwId)] ?? null;
  }

  /**
   * @param {string} kind
   * @param {string|number} pwId
   */
  require(kind, pwId) {
    const found = this.get(kind, pwId);
    if (!found) {
      throw new Error(`IdMap missing ${kind}:${pwId}`);
    }
    return found;
  }

  /** Stable sorted mapping for report reconciliation. */
  toReportMapping() {
    /** @type {Record<string, Record<string, string>>} */
    const out = {};
    for (const kind of Object.keys(this.#maps).sort()) {
      const src = this.#maps[kind];
      /** @type {Record<string, string>} */
      const sorted = {};
      for (const k of Object.keys(src).sort()) {
        sorted[k] = src[k];
      }
      out[kind] = sorted;
    }
    return out;
  }

  // --- synthetic helpers (frozen name schemes) ---

  employmentAssignmentActive(pwEmployeeId) {
    const name = `employment-assignment:${pwEmployeeId}:active:v1`;
    const id = this.derive('employment-assignment', name);
    this.remember('employment-assignment', `${pwEmployeeId}:active:v1`, id);
    return id;
  }

  contact(pwEmployeeId, type, ordinal = 0) {
    const name = `contact:${pwEmployeeId}:${type}:${ordinal}`;
    const id = this.derive('contact', name);
    this.remember('contact', `${pwEmployeeId}:${type}:${ordinal}`, id);
    return id;
  }

  eaManagedDept(pwEmployeeId, pwDepartmentId) {
    const name = `ea-managed-dept:${pwEmployeeId}:${pwDepartmentId}`;
    const id = this.derive('ea-managed-dept', name);
    this.remember('ea-managed-dept', `${pwEmployeeId}:${pwDepartmentId}`, id);
    return id;
  }

  employeeManagedDept(pwEmployeeId, pwDepartmentId) {
    const name = `employee-managed-dept:${pwEmployeeId}:${pwDepartmentId}`;
    const id = this.derive('employee-managed-dept', name);
    this.remember(
      'employee-managed-dept',
      `${pwEmployeeId}:${pwDepartmentId}`,
      id,
    );
    return id;
  }

  schedule(pwScheduleId) {
    return this.bindSource('schedule', pwScheduleId);
  }
}
