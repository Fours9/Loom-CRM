import { EntityManager } from 'typeorm';

/** Inline / DB-backed keys use the `db:` prefix (absences + documents today). */
export function isDbBackedStorageKey(storageKey: string): boolean {
  return storageKey.startsWith('db:');
}

/**
 * Queue external object-store keys for post-COMMIT cleanup.
 * DB-backed keys are deleted with their row (content in Postgres).
 */
export async function enqueueExternalFileDeletion(
  manager: EntityManager,
  storageKey: string,
): Promise<void> {
  if (!storageKey || isDbBackedStorageKey(storageKey)) return;
  await manager.query(
    `INSERT INTO "file_deletion_outbox" ("storage_key") VALUES ($1)`,
    [storageKey],
  );
}
