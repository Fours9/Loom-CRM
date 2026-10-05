export class CutoverReport {
  /**
   * @param {{ dryRun: boolean, reset: boolean, sqlitePath: string, databaseUrl: string }} opts
   */
  constructor(opts) {
    this.data = {
      startedAt: new Date().toISOString(),
      dryRun: opts.dryRun,
      reset: opts.reset,
      sqlitePath: opts.sqlitePath,
      databaseUrl: opts.databaseUrl.replace(/:[^:@/]+@/, ':***@'),
      steps: /** @type {string[]} */ ([]),
      warnings: /** @type {string[]} */ ([]),
      errors: /** @type {string[]} */ ([]),
      skipped: /** @type {string[]} */ ([]),
      counts: /** @type {Record<string, unknown>} */ ({}),
      mapping: /** @type {Record<string, Record<string, string>>} */ ({}),
      finishedAt: /** @type {string|null} */ (null),
    };
  }

  step(msg) {
    this.data.steps.push(msg);
    console.log(msg);
  }

  warn(msg) {
    this.data.warnings.push(msg);
    console.warn(`WARN: ${msg}`);
  }

  error(msg) {
    this.data.errors.push(msg);
    console.error(`ERROR: ${msg}`);
  }

  skip(msg) {
    this.data.skipped.push(msg);
  }

  finish() {
    this.data.finishedAt = new Date().toISOString();
  }
}
