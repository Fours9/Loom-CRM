import { MAX_POSITION_SKILLS } from '@loom/position-skill-catalog';
import type {
  DraftRequirementState,
  PendingSkillRequirement,
  PersistedRequirementLike,
} from './position-dialog.models';

export type SkillScaleSnapshot = {
  id: string;
  scaleMin: number;
  scaleMax: number;
  name?: string | null;
  code?: string | null;
  scaleKind?: 'range' | 'percent' | null;
};

let clientSeq = 0;

function nextClientId(): string {
  clientSeq += 1;
  return `draft-${clientSeq}`;
}

export class PositionDraftSkillQueue {
  private rows: PendingSkillRequirement[] = [];
  private nextSequence = 1;

  snapshot(): PendingSkillRequirement[] {
    return this.rows.map((row) => ({ ...row }));
  }

  get length(): number {
    return this.rows.length;
  }

  isEmpty(): boolean {
    return this.rows.length === 0;
  }

  skillIds(): Set<string> {
    return new Set(this.rows.map((row) => row.skillId));
  }

  pendingInSequence(): PendingSkillRequirement[] {
    return this.rows
      .filter(
        (row) =>
          row.state === 'pending' ||
          row.state === 'failed' ||
          row.state === 'conflict',
      )
      .sort((a, b) => a.sequence - b.sequence)
      .map((row) => ({ ...row }));
  }

  failedCount(): number {
    return this.rows.filter((row) => row.state === 'failed' || row.state === 'conflict')
      .length;
  }

  hasUnresolved(): boolean {
    return this.rows.some(
      (row) =>
        row.state === 'pending' ||
        row.state === 'failed' ||
        row.state === 'conflict' ||
        row.state === 'applying',
    );
  }

  reset(): void {
    this.rows = [];
    this.nextSequence = 1;
  }

  addSkills(
    skills: SkillScaleSnapshot[],
    persistedCount: number,
    required = true,
  ): { added: number; error?: string } {
    const used = this.skillIds();
    const unique = skills.filter((skill) => !used.has(skill.id));
    const room = MAX_POSITION_SKILLS - persistedCount - this.rows.length;
    if (room <= 0) {
      return {
        added: 0,
        error: `Посада може мати щонайбільше ${MAX_POSITION_SKILLS} навичок`,
      };
    }
    const toAdd = unique.slice(0, room);
    for (const skill of toAdd) {
      this.rows.push({
        clientId: nextClientId(),
        sequence: this.nextSequence,
        skillId: skill.id,
        targetLevel: skill.scaleMin,
        required,
        state: 'pending',
        skillName: skill.name ?? null,
        skillCode: skill.code ?? null,
        skillScaleKind: skill.scaleKind ?? 'range',
        skillScaleMin: skill.scaleMin,
        skillScaleMax: skill.scaleMax,
      });
      this.nextSequence += 1;
    }
    if (unique.length > toAdd.length) {
      return {
        added: toAdd.length,
        error: `Посада може мати щонайбільше ${MAX_POSITION_SKILLS} навичок`,
      };
    }
    return { added: toAdd.length };
  }

  remove(clientId: string): void {
    this.rows = this.rows.filter((row) => row.clientId !== clientId);
  }

  changeTarget(clientId: string, targetLevel: number): void {
    const row = this.rows.find((item) => item.clientId === clientId);
    if (!row) return;
    const min = row.skillScaleMin ?? 0;
    const max = row.skillScaleMax ?? 5;
    row.targetLevel = Math.max(min, Math.min(max, targetLevel));
  }

  changeRequired(clientId: string, required: boolean): void {
    const row = this.rows.find((item) => item.clientId === clientId);
    if (!row) return;
    row.required = required;
  }

  markApplying(clientId: string): void {
    this.setState(clientId, 'applying');
  }

  markFailed(clientId: string, error: string): void {
    const row = this.rows.find((item) => item.clientId === clientId);
    if (!row) return;
    row.state = 'failed';
    row.error = error;
  }

  markConflict(clientId: string, persistedId: string): void {
    const row = this.rows.find((item) => item.clientId === clientId);
    if (!row) return;
    row.state = 'conflict';
    row.persistedId = persistedId;
    row.error = 'Серверні значення відрізняються від чернетки';
  }

  drop(clientId: string): void {
    this.remove(clientId);
  }

  setState(clientId: string, state: DraftRequirementState): void {
    const row = this.rows.find((item) => item.clientId === clientId);
    if (!row) return;
    row.state = state;
    if (state !== 'failed' && state !== 'conflict') {
      row.error = undefined;
    }
  }

  /**
   * Same skillId + same targetLevel/required → applied (drop).
   * Same skillId, different values → conflict.
   * Missing on server → keep as failed/pending.
   */
  reconcile(serverRows: readonly PersistedRequirementLike[]): void {
    const next: PendingSkillRequirement[] = [];
    for (const row of this.rows) {
      const server = serverRows.find((item) => item.skillId === row.skillId);
      if (!server) {
        if (row.state === 'applying') {
          next.push({ ...row, state: 'failed', error: row.error || 'Не підтверджено' });
        } else {
          next.push({ ...row });
        }
        continue;
      }
      if (server.targetLevel === row.targetLevel && server.required === row.required) {
        continue;
      }
      next.push({
        ...row,
        state: 'conflict',
        persistedId: server.id,
        error: 'Серверні значення відрізняються від чернетки',
      });
    }
    this.rows = next;
  }
}
