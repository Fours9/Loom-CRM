import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Permission } from '@loom/contracts-auth';
import { MAX_POSITION_SKILLS } from '@loom/position-skill-catalog';
import { SessionStore } from '../../../core/auth/session.store';
import {
  GoalKind,
  OrgDepartment,
  OrgDirection,
  OrgPosition,
  OrgPositionDuty,
  OrgPositionGoalTemplate,
  OrgPositionSkillRequirement,
  OrgSkill,
  OrgSkillGroup,
  SettingsOrgApiService,
} from '../settings-org-api.service';
import {
  canEditDraftQueue,
  closePolicyFor,
  formatNativeTarget,
  isSaveLocked,
  mergeRequirementRows,
  type PositionDialogMode,
  type RequirementRowVm,
} from './position-dialog.models';
import { PositionDraftSkillQueue } from './position-draft-skill-queue';
import {
  applyDraftRequirements,
  createPositionThenApplyDrafts,
} from './position-create.flow';

export type CatalogTab = 'skills' | 'goals' | 'duties';
export type CatalogPanel = 'directions' | 'departments' | 'positions' | 'skills';

const GOAL_KIND_LABELS: Record<GoalKind, string> = {
  career: 'Карʼєра',
  probation: 'Випробувальний',
  quarterly: 'Квартальна',
};

@Injectable()
export class PositionManagementFacade {
  private readonly api = inject(SettingsOrgApiService);
  private readonly session = inject(SessionStore);

  readonly departments = signal<OrgDepartment[]>([]);
  readonly directions = signal<OrgDirection[]>([]);
  readonly positions = signal<OrgPosition[]>([]);
  readonly skillGroups = signal<OrgSkillGroup[]>([]);
  readonly catalogSkills = signal<OrgSkill[]>([]);
  readonly skillRequirements = signal<OrgPositionSkillRequirement[]>([]);
  readonly goalTemplates = signal<OrgPositionGoalTemplate[]>([]);
  readonly duties = signal<OrgPositionDuty[]>([]);
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);
  readonly editingDepartmentId = signal<string | null>(null);
  readonly editingDirectionId = signal<string | null>(null);
  readonly selectedPositionId = signal<string | null>(null);
  readonly catalogTab = signal<CatalogTab>('skills');
  readonly panelOpen = signal<Record<CatalogPanel, boolean>>({
    directions: true,
    departments: true,
    positions: true,
    skills: true,
  });
  readonly positionDialogOpen = signal(false);
  readonly dialogMode = signal<PositionDialogMode>('create');
  readonly pickerOpen = signal(false);
  readonly pickerSelectedIds = signal<string[]>([]);
  readonly selectedSkillGroupId = signal<string | null>(null);
  readonly skillDialogOpen = signal(false);
  readonly groupDialogOpen = signal(false);
  readonly directionDialogOpen = signal(false);
  readonly departmentDialogOpen = signal(false);
  readonly skillSort = signal<{ key: 'name' | 'scale'; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  });
  readonly groupSortDir = signal<'asc' | 'desc'>('asc');
  private readonly draftQueue = new PositionDraftSkillQueue();
  readonly draftRevision = signal(0);

  private touchDraft(): void {
    this.draftRevision.update((n) => n + 1);
  }

  togglePanel(panel: CatalogPanel): void {
    this.panelOpen.update((state) => ({ ...state, [panel]: !state[panel] }));
  }

  newDepartment = '';
  newDepartmentDirectionId = '';
  formDepartmentIsActive = true;
  newDirection = '';
  formDirectionIsActive = true;
  formName = '';
  formDepartmentId = '';
  formDirectionId = '';
  formDescription = '';
  formIsActive = true;

  newSkillName = '';
  newSkillGroupId = '';
  newSkillScaleKind: 'range' | 'percent' = 'range';
  newSkillScaleMin = 0;
  newSkillScaleMax = 5;
  formSkillIsActive = true;
  editingSkillId = signal<string | null>(null);

  newGroupName = '';
  formGroupIsActive = true;
  editingGroupId = signal<string | null>(null);

  goalKind: GoalKind = 'probation';
  goalTitle = '';
  goalDescription = '';

  dutyTitle = '';
  dutyDescription = '';
  dutySortOrder = 0;

  readonly canManage = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.DepartmentsManage) ||
      this.session.hasPermission(Permission.PositionsManage) ||
      this.session.hasPermission(Permission.DirectionsManage),
  );

  readonly canManageDepartments = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.DepartmentsManage),
  );

  readonly canManageDirections = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.DirectionsManage),
  );

  readonly canManagePositions = computed(
    () =>
      this.session.user()?.role === 'admin' ||
      this.session.hasPermission(Permission.PositionsManage),
  );

  readonly activeDepartments = computed(() =>
    this.departments().filter((d) => d.isActive && !d.isHidden),
  );

  readonly activeDirections = computed(() =>
    this.directions().filter((d) => d.isActive),
  );

  readonly selectedPosition = computed(() => {
    const id = this.selectedPositionId();
    if (!id) return null;
    return this.positions().find((p) => p.id === id) ?? null;
  });

  readonly availableSkills = computed(() => {
    this.draftRevision();
    const used = new Set([
      ...this.skillRequirements().map((r) => r.skillId),
      ...this.draftQueue.skillIds(),
      ...this.pickerSelectedIds(),
    ]);
    const activeGroupIds = new Set(
      this.skillGroups()
        .filter((g) => g.isActive)
        .map((g) => g.id),
    );
    return this.catalogSkills().filter(
      (s) => s.isActive && activeGroupIds.has(s.groupId) && !used.has(s.id),
    );
  });

  readonly pickerCandidateSkills = computed(() => {
    this.draftRevision();
    const used = new Set([
      ...this.skillRequirements().map((r) => r.skillId),
      ...this.draftQueue.skillIds(),
    ]);
    const selected = new Set(this.pickerSelectedIds());
    const activeGroupIds = new Set(
      this.skillGroups()
        .filter((g) => g.isActive)
        .map((g) => g.id),
    );
    return this.catalogSkills().filter(
      (s) =>
        s.isActive &&
        activeGroupIds.has(s.groupId) &&
        (!used.has(s.id) || selected.has(s.id)),
    );
  });

  readonly requirementRows = computed((): RequirementRowVm[] => {
    this.draftRevision();
    return mergeRequirementRows(this.skillRequirements(), this.draftQueue.snapshot());
  });

  readonly maxPositionSkills = MAX_POSITION_SKILLS;

  readonly remainingSkillSlots = computed(() => {
    this.draftRevision();
    return Math.max(
      0,
      MAX_POSITION_SKILLS - this.skillRequirements().length - this.draftQueue.length,
    );
  });

  readonly skillsQuotaReached = computed(() => this.remainingSkillSlots() <= 0);

  readonly saveLocked = computed(() => isSaveLocked(this.dialogMode()));
  readonly closeLocked = computed(() => {
    this.draftRevision();
    const policy = closePolicyFor(
      this.dialogMode(),
      this.draftQueue.length,
      this.draftQueue.failedCount(),
    );
    return policy.action === 'disabled';
  });
  readonly skillsEditingLocked = computed(() => {
    const mode = this.dialogMode();
    return (
      mode === 'creating-position' ||
      mode === 'applying-drafts' ||
      mode === 'unresolved-create'
    );
  });

  readonly skillsForSelectedGroup = computed(() => {
    const groupId = this.selectedSkillGroupId();
    const rows = groupId
      ? this.catalogSkills().filter((s) => s.groupId === groupId)
      : this.catalogSkills();
    const { key, dir } = this.skillSort();
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (key === 'scale') {
        const kind = this.scaleKindLabel(a.scaleKind).localeCompare(
          this.scaleKindLabel(b.scaleKind),
          'uk',
        );
        if (kind !== 0) return kind * sign;
        return a.name.localeCompare(b.name, 'uk');
      }
      return a.name.localeCompare(b.name, 'uk') * sign;
    });
  });

  readonly selectedSkillGroup = computed(() => {
    const id = this.selectedSkillGroupId();
    if (!id) return null;
    return this.skillGroups().find((g) => g.id === id) ?? null;
  });

  readonly sortedSkillGroups = computed(() => {
    const sign = this.groupSortDir() === 'asc' ? 1 : -1;
    return [...this.skillGroups()].sort(
      (a, b) => a.name.localeCompare(b.name, 'uk') * sign,
    );
  });

  toggleSkillSort(key: 'name' | 'scale'): void {
    const current = this.skillSort();
    if (current.key === key) {
      this.skillSort.set({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' });
      return;
    }
    this.skillSort.set({ key, dir: 'asc' });
  }

  skillSortMark(key: 'name' | 'scale'): string {
    const current = this.skillSort();
    if (current.key !== key) return '';
    return current.dir === 'asc' ? '▲' : '▼';
  }

  toggleGroupNameSort(): void {
    this.groupSortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
  }

  groupSortMark(): string {
    return this.groupSortDir() === 'asc' ? '▲' : '▼';
  }

  scaleKindLabel(kind: 'range' | 'percent'): string {
    return kind === 'percent' ? 'Відсотки' : 'Від–до';
  }

  /** Active options plus the currently selected row when editing a legacy value. */
  formDepartmentOptions(): OrgDepartment[] {
    const active = this.activeDepartments();
    const id = this.formDepartmentId;
    if (!id || active.some((d) => d.id === id)) return active;
    const current = this.departments().find((d) => d.id === id);
    return current ? [current, ...active] : active;
  }

  formDirectionOptions(): OrgDirection[] {
    const active = this.activeDirections();
    const id = this.newDepartmentDirectionId;
    if (!id || active.some((d) => d.id === id)) return active;
    const current = this.directions().find((d) => d.id === id);
    return current ? [current, ...active] : active;
  }

  /** Direction options for a position without a department. */
  formPositionDirectionOptions(): OrgDirection[] {
    const active = this.activeDirections();
    const id = this.formDirectionId;
    if (!id || active.some((d) => d.id === id)) return active;
    const current = this.directions().find((d) => d.id === id);
    return current ? [current, ...active] : active;
  }

  onFormDepartmentChange(): void {
    if (!this.formDepartmentId) return;
    const dept = this.departments().find((d) => d.id === this.formDepartmentId);
    this.formDirectionId = dept?.directionId || '';
  }

  departmentDirectionLabel(d: OrgDepartment): string {
    return d.directionName || d.direction?.name || '';
  }

  goalKindLabel(kind: string): string {
    return GOAL_KIND_LABELS[kind as GoalKind] || kind;
  }

  departmentLabel(p: OrgPosition): string {
    return p.departmentName || p.department?.name || 'Без відділу';
  }

  directionLabel(p: OrgPosition): string {
    return p.directionName || '';
  }

  reload(): void {
    this.api.getDepartments().subscribe({
      next: (d) => this.departments.set(d),
      error: () => this.error.set('Не вдалося завантажити відділи'),
    });
    this.api.getDirections().subscribe({
      next: (d) => this.directions.set(d),
      error: () => this.error.set('Не вдалося завантажити напрямки'),
    });
    this.api.getPositions(true).subscribe({
      next: (p) => this.positions.set(p),
      error: () => this.error.set('Не вдалося завантажити посади'),
    });
    this.api.getSkillGroups(true).subscribe({
      next: (g) => {
        this.skillGroups.set(g);
        const selected = this.selectedSkillGroupId();
        if (!selected && g.length > 0) {
          const firstActive = g.find((row) => row.isActive) ?? g[0];
          this.selectedSkillGroupId.set(firstActive.id);
        }
      },
      error: () => this.error.set('Не вдалося завантажити групи навичок'),
    });
    this.api.getSkills(true).subscribe({
      next: (s) => this.catalogSkills.set(s),
      error: () => this.error.set('Не вдалося завантажити навички'),
    });
    const selected = this.selectedPositionId();
    if (selected) this.loadPositionCatalog(selected);
  }

  selectPosition(p: OrgPosition): void {
    this.selectedPositionId.set(p.id);
    this.catalogTab.set('skills');
    this.loadPositionCatalog(p.id);
  }

  clearSelection(): void {
    this.selectedPositionId.set(null);
    this.skillRequirements.set([]);
    this.goalTemplates.set([]);
    this.duties.set([]);
  }

  private loadPositionCatalog(positionId: string): void {
    this.api.getPositionSkillRequirements(positionId).subscribe({
      next: (rows) => this.skillRequirements.set(rows),
      error: () => this.error.set('Не вдалося завантажити вимоги навичок'),
    });
    this.api.getPositionGoalTemplates(positionId, true).subscribe({
      next: (rows) => this.goalTemplates.set(rows.filter((r) => r.isActive)),
      error: () => this.error.set('Не вдалося завантажити шаблони цілей'),
    });
    this.api.getPositionDuties(positionId, true).subscribe({
      next: (rows) => this.duties.set(rows.filter((r) => r.isActive)),
      error: () => this.error.set('Не вдалося завантажити обовʼязки'),
    });
  }

  private apiError(err: unknown, fallback: string): string {
    const msg = (err as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    return msg || fallback;
  }

  saveDepartment(): void {
    this.error.set('');
    if (!this.newDepartment.trim()) {
      this.error.set('Вкажіть назву відділу');
      return;
    }
    const body = {
      name: this.newDepartment.trim(),
      directionId: this.newDepartmentDirectionId || null,
    };
    const id = this.editingDepartmentId();
    if (id) {
      this.api
        .updateDepartment(id, {
          ...body,
          isActive: this.formDepartmentIsActive,
          isHidden: !this.formDepartmentIsActive,
        })
        .subscribe({
          next: () => {
            this.closeDepartmentDialog();
            this.reload();
          },
          error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти відділ')),
        });
      return;
    }
    this.api.createDepartment(body).subscribe({
      next: () => {
        this.closeDepartmentDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати відділ')),
    });
  }

  startCreateDepartment(): void {
    this.cancelEditDepartment();
    this.formDepartmentIsActive = true;
    this.departmentDialogOpen.set(true);
    this.error.set('');
  }

  startEditDepartment(d: OrgDepartment): void {
    this.panelOpen.update((state) => ({ ...state, departments: true }));
    this.editingDepartmentId.set(d.id);
    this.newDepartment = d.name;
    this.newDepartmentDirectionId = d.directionId || '';
    this.formDepartmentIsActive = d.isActive && !d.isHidden;
    this.departmentDialogOpen.set(true);
    this.error.set('');
  }

  cancelEditDepartment(): void {
    this.editingDepartmentId.set(null);
    this.newDepartment = '';
    this.newDepartmentDirectionId = '';
    this.formDepartmentIsActive = true;
  }

  closeDepartmentDialog(): void {
    this.departmentDialogOpen.set(false);
    this.cancelEditDepartment();
  }

  hardDeleteDepartment(d: OrgDepartment): void {
    if (!confirm(`Видалити відділ «${d.name}» назавжди?`)) return;
    this.api.deleteDepartment(d.id).subscribe({
      next: () => {
        if (this.editingDepartmentId() === d.id) this.closeDepartmentDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити відділ')),
    });
  }

  setDepartmentActive(d: OrgDepartment, active: boolean): void {
    this.api
      .updateDepartment(d.id, {
        isActive: active,
        isHidden: !active,
      })
      .subscribe({
        next: () => this.reload(),
        error: () => this.error.set('Не вдалося змінити стан відділу'),
      });
  }

  saveDirection(): void {
    this.error.set('');
    if (!this.newDirection.trim()) {
      this.error.set('Вкажіть назву напрямку');
      return;
    }
    const name = this.newDirection.trim();
    const id = this.editingDirectionId();
    if (id) {
      this.api
        .updateDirection(id, {
          name,
          isActive: this.formDirectionIsActive,
        })
        .subscribe({
          next: () => {
            this.closeDirectionDialog();
            this.reload();
          },
          error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти напрямок')),
        });
      return;
    }
    this.api.createDirection({ name }).subscribe({
      next: () => {
        this.closeDirectionDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати напрямок')),
    });
  }

  startCreateDirection(): void {
    this.cancelEditDirection();
    this.formDirectionIsActive = true;
    this.directionDialogOpen.set(true);
    this.error.set('');
  }

  startEditDirection(d: OrgDirection): void {
    this.panelOpen.update((state) => ({ ...state, directions: true }));
    this.editingDirectionId.set(d.id);
    this.newDirection = d.name;
    this.formDirectionIsActive = d.isActive;
    this.directionDialogOpen.set(true);
    this.error.set('');
  }

  cancelEditDirection(): void {
    this.editingDirectionId.set(null);
    this.newDirection = '';
    this.formDirectionIsActive = true;
  }

  closeDirectionDialog(): void {
    this.directionDialogOpen.set(false);
    this.cancelEditDirection();
  }

  hardDeleteDirection(d: OrgDirection): void {
    if (!confirm(`Видалити напрямок «${d.name}» назавжди?`)) return;
    this.api.deleteDirection(d.id).subscribe({
      next: () => {
        if (this.editingDirectionId() === d.id) this.closeDirectionDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити напрямок')),
    });
  }

  setDirectionActive(d: OrgDirection, active: boolean): void {
    this.api.updateDirection(d.id, { isActive: active }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося змінити стан напрямку'),
    });
  }

  startCreatePosition(): void {
    if (this.positionDialogOpen()) {
      this.requestClose();
      if (this.positionDialogOpen()) return;
    }
    this.cancelEdit();
    this.clearSelection();
    this.resetDraftSession();
    this.dialogMode.set('create');
    this.positionDialogOpen.set(true);
    this.error.set('');
  }

  startEdit(p: OrgPosition): void {
    if (this.positionDialogOpen() && this.dialogMode() !== 'edit') {
      this.requestClose();
      if (this.positionDialogOpen()) return;
    }
    this.resetDraftSession();
    this.editingId.set(p.id);
    this.dialogMode.set('edit');
    this.formName = p.name;
    this.formDepartmentId = p.departmentId || '';
    this.formDirectionId = p.directionId || '';
    this.formDescription = p.description || '';
    this.formIsActive = p.isActive;
    this.loadPositionCatalog(p.id);
    this.positionDialogOpen.set(true);
    this.error.set('');
  }

  closePositionDialog(): void {
    this.requestClose();
  }

  requestClose(): void {
    if (this.closeLocked()) return;
    this.draftRevision();
    const policy = closePolicyFor(
      this.dialogMode(),
      this.draftQueue.length,
      this.draftQueue.failedCount(),
    );
    if (policy.action === 'confirm-discard-drafts') {
      if (!confirm('Відхилити чернетку вимог до навичок?')) return;
    } else if (policy.action === 'acknowledge-unresolved') {
      if (
        !confirm(
          'Результат створення невідомий. Перед повторним створенням перевірте список посад.',
        )
      ) {
        return;
      }
      this.positionDialogOpen.set(false);
      this.cancelEdit();
      this.resetDraftSession();
      this.reload();
      return;
    } else if (policy.action === 'warn-failed-drafts') {
      if (
        !confirm(
          `Посада створена, ${policy.failedCount} вимог не додано. Закрити і відхилити невдалі вимоги?`,
        )
      ) {
        return;
      }
    }
    this.positionDialogOpen.set(false);
    this.cancelEdit();
    this.resetDraftSession();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.formName = '';
    this.formDepartmentId = '';
    this.formDirectionId = '';
    this.formDescription = '';
    this.formIsActive = true;
  }

  private resetDraftSession(): void {
    this.draftQueue.reset();
    this.pickerOpen.set(false);
    this.pickerSelectedIds.set([]);
    this.dialogMode.set('create');
    this.touchDraft();
  }

  async savePosition(): Promise<void> {
    this.error.set('');
    if (this.saveLocked()) return;
    if (!this.formName.trim()) {
      this.error.set('Вкажіть назву посади');
      return;
    }

    const departmentId = this.formDepartmentId || null;
    const body = {
      name: this.formName.trim(),
      departmentId,
      ...(departmentId ? {} : { directionId: this.formDirectionId || null }),
      description: this.formDescription.trim() || null,
    };

    const id = this.editingId();
    if (id) {
      try {
        await firstValueFrom(
          this.api.updatePosition(id, {
            ...body,
            isActive: !!this.formIsActive,
          }),
        );
        this.positionDialogOpen.set(false);
        this.cancelEdit();
        this.resetDraftSession();
        this.reload();
      } catch (err) {
        this.error.set(this.apiError(err, 'Не вдалося зберегти посаду'));
      }
      return;
    }

    const result = await createPositionThenApplyDrafts({
      api: this.api,
      queue: this.draftQueue,
      mode: this.dialogMode(),
      body,
      setMode: (next) => this.dialogMode.set(next),
    });
    this.touchDraft();

    if (result.kind === 'locked') return;
    if (result.kind === 'known-rejection') {
      this.error.set(result.message);
      return;
    }
    if (result.kind === 'unknown') {
      this.error.set('Не вдалося підтвердити результат створення');
      return;
    }

    this.editingId.set(result.position.id);
    this.selectedPositionId.set(result.position.id);
    this.formIsActive = result.position.isActive;
    this.reload();
    this.loadPositionCatalog(result.position.id);
    if (result.mode === 'edit-with-failed-drafts') {
      this.error.set('Посаду створено, але частину вимог не вдалося додати');
    }
  }

  hardDeletePosition(p: OrgPosition): void {
    if (!confirm(`Видалити посаду «${p.name}» назавжди?`)) return;
    this.api.deletePosition(p.id).subscribe({
      next: () => {
        if (this.selectedPositionId() === p.id) this.clearSelection();
        if (this.editingId() === p.id) {
          this.positionDialogOpen.set(false);
          this.cancelEdit();
          this.resetDraftSession();
        }
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити посаду')),
    });
  }

  setPositionActive(p: OrgPosition, active: boolean): void {
    this.api.updatePosition(p.id, { isActive: active }).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Не вдалося змінити стан посади'),
    });
  }

  formatNativeTarget(
    r: RequirementRowVm | OrgPositionSkillRequirement,
  ): string {
    return formatNativeTarget(r);
  }

  togglePicker(): void {
    if (this.skillsEditingLocked() || !this.canManagePositions()) return;
    this.pickerOpen.update((open) => !open);
    if (!this.pickerOpen()) this.pickerSelectedIds.set([]);
  }

  isPickerSelected(skillId: string): boolean {
    return this.pickerSelectedIds().includes(skillId);
  }

  togglePickerSkill(skillId: string): void {
    if (this.skillsEditingLocked()) return;
    const selected = new Set(this.pickerSelectedIds());
    if (selected.has(skillId)) {
      selected.delete(skillId);
      this.pickerSelectedIds.set([...selected]);
      return;
    }
    if (this.remainingSkillSlots() - selected.size <= 0) {
      this.error.set(`Посада може мати щонайбільше ${MAX_POSITION_SKILLS} навичок`);
      return;
    }
    selected.add(skillId);
    this.pickerSelectedIds.set([...selected]);
  }

  confirmPickerSkills(): void {
    if (this.skillsEditingLocked() || !canEditDraftQueue(this.dialogMode())) return;
    const ids = this.pickerSelectedIds();
    if (ids.length === 0) {
      this.error.set('Оберіть навичку');
      return;
    }
    const skills = ids
      .map((id) => this.catalogSkills().find((s) => s.id === id))
      .filter((s): s is OrgSkill => !!s);
    this.error.set('');
    const positionId = this.editingId();
    if (positionId && this.dialogMode() !== 'create') {
      this.addPersistedSkills(positionId, skills);
    } else {
      const result = this.draftQueue.addSkills(
        skills.map((s) => ({
          id: s.id,
          scaleMin: s.scaleMin,
          scaleMax: s.scaleMax,
          name: s.name,
          code: s.code,
          scaleKind: s.scaleKind,
        })),
        this.skillRequirements().length,
      );
      this.touchDraft();
      if (result.error) this.error.set(result.error);
    }
    this.pickerOpen.set(false);
    this.pickerSelectedIds.set([]);
  }

  private addPersistedSkills(positionId: string, skills: OrgSkill[]): void {
    const room = this.remainingSkillSlots();
    const toAdd = skills.slice(0, room);
    if (toAdd.length < skills.length) {
      this.error.set(`Посада може мати щонайбільше ${MAX_POSITION_SKILLS} навичок`);
    }
    for (const skill of toAdd) {
      this.api
        .createPositionSkillRequirement(positionId, {
          skillId: skill.id,
          targetLevel: skill.scaleMin,
          required: true,
        })
        .subscribe({
          next: () => this.loadPositionCatalog(positionId),
          error: (err) =>
            this.error.set(this.apiError(err, 'Не вдалося додати вимогу')),
        });
    }
  }

  bumpRequirementLevel(row: RequirementRowVm, delta: number): void {
    const min = row.skillScaleMin ?? 0;
    const max = row.skillScaleMax ?? 5;
    const next = Math.max(min, Math.min(max, row.targetLevel + delta));
    if (next === row.targetLevel) return;
    this.changeTarget(row, next);
  }

  changeTarget(row: RequirementRowVm, targetLevel: number): void {
    if (this.skillsEditingLocked()) return;
    if (row.kind === 'draft') {
      this.draftQueue.changeTarget(row.clientId, targetLevel);
      this.touchDraft();
      return;
    }
    const positionId = this.editingId();
    if (!positionId) return;
    this.api
      .updatePositionSkillRequirement(positionId, row.id, { targetLevel })
      .subscribe({
        next: () => this.loadPositionCatalog(positionId),
        error: () => this.error.set('Не вдалося оновити рівень'),
      });
  }

  changeRequired(row: RequirementRowVm, required: boolean): void {
    if (this.skillsEditingLocked()) return;
    if (row.kind === 'draft') {
      this.draftQueue.changeRequired(row.clientId, required);
      this.touchDraft();
      return;
    }
    const positionId = this.editingId();
    if (!positionId) return;
    this.api
      .updatePositionSkillRequirement(positionId, row.id, { required })
      .subscribe({
        next: () => this.loadPositionCatalog(positionId),
        error: () => this.error.set('Не вдалося оновити вимогу'),
      });
  }

  removeRequirement(row: RequirementRowVm): void {
    if (this.skillsEditingLocked()) return;
    if (row.kind === 'draft') {
      this.draftQueue.remove(row.clientId);
      this.touchDraft();
      return;
    }
    const positionId = this.editingId();
    if (!positionId) return;
    this.api.deletePositionSkillRequirement(positionId, row.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати вимогу'),
    });
  }

  async retryFailedDrafts(): Promise<void> {
    const positionId = this.editingId();
    if (!positionId || this.skillsEditingLocked()) return;
    this.dialogMode.set('applying-drafts');
    this.error.set('');
    try {
      const rows = await applyDraftRequirements(this.api, positionId, this.draftQueue);
      this.skillRequirements.set(rows);
      this.dialogMode.set(
        this.draftQueue.hasUnresolved() ? 'edit-with-failed-drafts' : 'edit',
      );
    } finally {
      this.touchDraft();
    }
  }

  rowStateLabel(row: RequirementRowVm): string {
    if (row.kind !== 'draft') return '';
    if (row.state === 'applying') return 'застосування…';
    if (row.state === 'failed') return 'не додано';
    if (row.state === 'conflict') return 'розбіжність';
    return 'чернетка';
  }

  saveCatalogSkill(): void {
    this.error.set('');
    if (!this.newSkillName.trim() || !this.newSkillGroupId) {
      this.error.set('Вкажіть назву і групу навички');
      return;
    }
    const body = {
      groupId: this.newSkillGroupId,
      name: this.newSkillName.trim(),
      scaleKind: this.newSkillScaleKind,
      scaleMin: Number(this.newSkillScaleMin),
      scaleMax: Number(this.newSkillScaleMax),
    };
    const id = this.editingSkillId();
    if (id) {
      this.api
        .updateSkill(id, {
          ...body,
          isActive: this.formSkillIsActive,
        })
        .subscribe({
          next: () => {
            this.closeSkillDialog();
            this.reload();
          },
          error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти навичку')),
        });
      return;
    }
    this.api.createSkill(body).subscribe({
      next: () => {
        this.closeSkillDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати навичку')),
    });
  }

  startCreateSkill(): void {
    this.cancelEditSkill();
    this.newSkillGroupId = this.selectedSkillGroupId() || '';
    this.formSkillIsActive = true;
    this.skillDialogOpen.set(true);
    this.error.set('');
  }

  startEditSkill(s: OrgSkill): void {
    this.panelOpen.update((state) => ({ ...state, skills: true }));
    this.editingSkillId.set(s.id);
    this.newSkillName = s.name;
    this.newSkillGroupId = s.groupId;
    this.newSkillScaleKind = s.scaleKind ?? 'range';
    this.newSkillScaleMin = s.scaleMin ?? 0;
    this.newSkillScaleMax = s.scaleMax ?? 5;
    this.formSkillIsActive = s.isActive;
    this.selectedSkillGroupId.set(s.groupId);
    this.skillDialogOpen.set(true);
    this.error.set('');
  }

  skillFormGroupOptions(): OrgSkillGroup[] {
    const active = this.skillGroups().filter((g) => g.isActive);
    const id = this.newSkillGroupId;
    if (!id || active.some((g) => g.id === id)) return active;
    const current = this.skillGroups().find((g) => g.id === id);
    return current ? [current, ...active] : active;
  }

  cancelEditSkill(): void {
    this.editingSkillId.set(null);
    this.newSkillName = '';
    this.newSkillGroupId = '';
    this.newSkillScaleKind = 'range';
    this.newSkillScaleMin = 0;
    this.newSkillScaleMax = 5;
    this.formSkillIsActive = true;
  }

  closeSkillDialog(): void {
    this.skillDialogOpen.set(false);
    this.cancelEditSkill();
  }

  hardDeleteSkill(s: OrgSkill): void {
    if (!confirm(`Видалити навичку «${s.name}»?`)) return;
    this.api.deleteSkill(s.id).subscribe({
      next: () => {
        if (this.editingSkillId() === s.id) this.closeSkillDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося видалити навичку')),
    });
  }

  setSkillActive(s: OrgSkill, active: boolean): void {
    this.api.updateSkill(s.id, { isActive: active }).subscribe({
      next: () => this.reload(),
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося змінити стан навички')),
    });
  }

  selectSkillGroup(g: OrgSkillGroup): void {
    this.selectedSkillGroupId.set(g.id);
  }

  saveCatalogGroup(): void {
    this.error.set('');
    if (!this.newGroupName.trim()) {
      this.error.set('Вкажіть назву групи');
      return;
    }
    const name = this.newGroupName.trim();
    const id = this.editingGroupId();
    if (id) {
      this.api
        .updateSkillGroup(id, {
          name,
          isActive: this.formGroupIsActive,
        })
        .subscribe({
          next: () => {
            this.closeGroupDialog();
            this.reload();
          },
          error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти групу')),
        });
      return;
    }
    this.api.createSkillGroup({ name }).subscribe({
      next: (created) => {
        this.closeGroupDialog();
        this.selectedSkillGroupId.set(created.id);
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати групу')),
    });
  }

  startCreateGroup(): void {
    this.cancelEditGroup();
    this.formGroupIsActive = true;
    this.groupDialogOpen.set(true);
    this.error.set('');
  }

  startEditGroup(g: OrgSkillGroup): void {
    this.panelOpen.update((state) => ({ ...state, skills: true }));
    this.editingGroupId.set(g.id);
    this.newGroupName = g.name;
    this.formGroupIsActive = g.isActive;
    this.selectedSkillGroupId.set(g.id);
    this.groupDialogOpen.set(true);
    this.error.set('');
  }

  cancelEditGroup(): void {
    this.editingGroupId.set(null);
    this.newGroupName = '';
    this.formGroupIsActive = true;
  }

  closeGroupDialog(): void {
    this.groupDialogOpen.set(false);
    this.cancelEditGroup();
  }

  hardDeleteGroup(g: OrgSkillGroup): void {
    if (!confirm(`Вимкнути групу «${g.name}»?`)) return;
    this.api.deleteSkillGroup(g.id).subscribe({
      next: () => {
        if (this.editingGroupId() === g.id) this.closeGroupDialog();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося вимкнути групу')),
    });
  }

  setGroupActive(g: OrgSkillGroup, active: boolean): void {
    this.api.updateSkillGroup(g.id, { isActive: active }).subscribe({
      next: () => this.reload(),
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося змінити стан групи')),
    });
  }

  addGoalTemplate(): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.error.set('');
    if (!this.goalTitle.trim()) {
      this.error.set('Вкажіть назву цілі');
      return;
    }
    this.api
      .createPositionGoalTemplate(positionId, {
        goalKind: this.goalKind,
        title: this.goalTitle.trim(),
        description: this.goalDescription.trim() || null,
      })
      .subscribe({
        next: () => {
          this.goalTitle = '';
          this.goalDescription = '';
          this.loadPositionCatalog(positionId);
        },
        error: (err) =>
          this.error.set(this.apiError(err, 'Не вдалося додати шаблон цілі')),
      });
  }

  removeGoalTemplate(g: OrgPositionGoalTemplate): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.api.deletePositionGoalTemplate(positionId, g.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати шаблон цілі'),
    });
  }

  addDuty(): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.error.set('');
    if (!this.dutyTitle.trim()) {
      this.error.set('Вкажіть назву обовʼязку');
      return;
    }
    this.api
      .createPositionDuty(positionId, {
        title: this.dutyTitle.trim(),
        description: this.dutyDescription.trim() || null,
        sortOrder: this.dutySortOrder,
      })
      .subscribe({
        next: () => {
          this.dutyTitle = '';
          this.dutyDescription = '';
          this.dutySortOrder = this.duties().length;
          this.loadPositionCatalog(positionId);
        },
        error: (err) =>
          this.error.set(this.apiError(err, 'Не вдалося додати обовʼязок')),
      });
  }

  moveDuty(d: OrgPositionDuty, delta: number): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    const next = Math.max(0, d.sortOrder + delta);
    if (next === d.sortOrder) return;
    this.api.updatePositionDuty(positionId, d.id, { sortOrder: next }).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося змінити порядок'),
    });
  }

  removeDuty(d: OrgPositionDuty): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.api.deletePositionDuty(positionId, d.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати обовʼязок'),
    });
  }
}
