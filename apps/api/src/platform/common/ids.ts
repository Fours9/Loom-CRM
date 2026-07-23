import { createHash, randomUUID } from 'node:crypto';

/** UUID v4 (acceptable per ADR 0006 when v7 is inconvenient). */
export function newEntityId(): string {
  return randomUUID();
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
