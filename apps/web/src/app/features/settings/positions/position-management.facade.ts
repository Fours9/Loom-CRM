import { Injectable, computed, inject, signal } from '@angular/core';
import { Permission } from '@loom/contracts-auth';
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

export type CatalogTab = 'skills' | 'goals' | 'duties';
export type CatalogPanel = 'directions' | 'departments' | 'positions';

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
  });

  togglePanel(panel: CatalogPanel): void {
    this.panelOpen.update((state) => ({ ...state, [panel]: !state[panel] }));
  }

  newDepartment = '';
  newDepartmentDirectionId = '';
  newDirection = '';
  formName = '';
  formDepartmentId = '';
  formDirectionId = '';
  formDescription = '';
  formIsActive = true;

  reqSkillId = '';
  reqTargetLevel = 3;
  reqRequired = true;

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
    const used = new Set(this.skillRequirements().map((r) => r.skillId));
    return this.catalogSkills().filter((s) => s.isActive && !used.has(s.id));
  });

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

  inheritedDirectionLabel(): string {
    const deptId = this.formDepartmentId;
    if (!deptId) return '';
    const dept = this.departments().find((d) => d.id === deptId);
    if (!dept) return '';
    return dept.directionName || dept.direction?.name || '';
  }

  departmentDirectionLabel(d: OrgDepartment): string {
    return d.directionName || d.direction?.name || '';
  }

  skillsForGroup(groupId: string): OrgSkill[] {
    return this.catalogSkills().filter((s) => s.groupId === groupId);
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
    this.api.getSkillGroups().subscribe({
      next: (g) => this.skillGroups.set(g),
      error: () => this.error.set('Не вдалося завантажити групи навичок'),
    });
    this.api.getSkills().subscribe({
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
      this.api.updateDepartment(id, body).subscribe({
        next: () => {
          this.cancelEditDepartment();
          this.reload();
        },
        error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти відділ')),
      });
      return;
    }
    this.api.createDepartment(body).subscribe({
      next: () => {
        this.cancelEditDepartment();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати відділ')),
    });
  }

  startEditDepartment(d: OrgDepartment): void {
    this.panelOpen.update((state) => ({ ...state, departments: true }));
    this.editingDepartmentId.set(d.id);
    this.newDepartment = d.name;
    this.newDepartmentDirectionId = d.directionId || '';
    this.error.set('');
  }

  cancelEditDepartment(): void {
    this.editingDepartmentId.set(null);
    this.newDepartment = '';
    this.newDepartmentDirectionId = '';
  }

  hardDeleteDepartment(d: OrgDepartment): void {
    if (!confirm(`Видалити відділ «${d.name}» назавжди?`)) return;
    this.api.deleteDepartment(d.id).subscribe({
      next: () => {
        if (this.editingDepartmentId() === d.id) this.cancelEditDepartment();
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
      this.api.updateDirection(id, { name }).subscribe({
        next: () => {
          this.cancelEditDirection();
          this.reload();
        },
        error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти напрямок')),
      });
      return;
    }
    this.api.createDirection({ name }).subscribe({
      next: () => {
        this.cancelEditDirection();
        this.reload();
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати напрямок')),
    });
  }

  startEditDirection(d: OrgDirection): void {
    this.panelOpen.update((state) => ({ ...state, directions: true }));
    this.editingDirectionId.set(d.id);
    this.newDirection = d.name;
    this.error.set('');
  }

  cancelEditDirection(): void {
    this.editingDirectionId.set(null);
    this.newDirection = '';
  }

  hardDeleteDirection(d: OrgDirection): void {
    if (!confirm(`Видалити напрямок «${d.name}» назавжди?`)) return;
    this.api.deleteDirection(d.id).subscribe({
      next: () => {
        if (this.editingDirectionId() === d.id) this.cancelEditDirection();
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

  startEdit(p: OrgPosition): void {
    this.panelOpen.update((state) => ({ ...state, positions: true }));
    this.editingId.set(p.id);
    this.formName = p.name;
    this.formDepartmentId = p.departmentId || '';
    this.formDirectionId = p.directionId || '';
    this.formDescription = p.description || '';
    this.formIsActive = p.isActive;
    this.error.set('');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.formName = '';
    this.formDepartmentId = '';
    this.formDirectionId = '';
    this.formDescription = '';
    this.formIsActive = true;
  }

  savePosition(): void {
    this.error.set('');
    if (!this.formName.trim()) {
      this.error.set('Вкажіть назву посади');
      return;
    }

    const departmentId = this.formDepartmentId || null;
    const body = {
      name: this.formName.trim(),
      departmentId,
      directionId: departmentId ? null : this.formDirectionId || null,
      description: this.formDescription.trim() || null,
    };

    const id = this.editingId();
    if (id) {
      this.api
        .updatePosition(id, {
          ...body,
          isActive: this.formIsActive,
        })
        .subscribe({
          next: () => {
            this.cancelEdit();
            this.reload();
          },
          error: (err) => this.error.set(this.apiError(err, 'Не вдалося зберегти посаду')),
        });
      return;
    }

    this.api.createPosition(body).subscribe({
      next: (created) => {
        this.cancelEdit();
        this.reload();
        this.selectPosition(created);
      },
      error: (err) => this.error.set(this.apiError(err, 'Не вдалося додати посаду')),
    });
  }

  hardDeletePosition(p: OrgPosition): void {
    if (!confirm(`Видалити посаду «${p.name}» назавжди?`)) return;
    this.api.deletePosition(p.id).subscribe({
      next: () => {
        if (this.selectedPositionId() === p.id) this.clearSelection();
        if (this.editingId() === p.id) this.cancelEdit();
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

  addSkillRequirement(): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.error.set('');
    if (!this.reqSkillId) {
      this.error.set('Оберіть навичку');
      return;
    }
    this.api
      .createPositionSkillRequirement(positionId, {
        skillId: this.reqSkillId,
        targetLevel: this.reqTargetLevel,
        required: this.reqRequired,
      })
      .subscribe({
        next: () => {
          this.reqSkillId = '';
          this.reqTargetLevel = 3;
          this.reqRequired = true;
          this.loadPositionCatalog(positionId);
        },
        error: (err) =>
          this.error.set(this.apiError(err, 'Не вдалося додати вимогу')),
      });
  }

  bumpRequirementLevel(r: OrgPositionSkillRequirement, delta: number): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    const next = Math.max(0, Math.min(r.skillScaleMax ?? 5, r.targetLevel + delta));
    if (next === r.targetLevel) return;
    this.api
      .updatePositionSkillRequirement(positionId, r.id, { targetLevel: next })
      .subscribe({
        next: () => this.loadPositionCatalog(positionId),
        error: () => this.error.set('Не вдалося оновити рівень'),
      });
  }

  removeSkillRequirement(r: OrgPositionSkillRequirement): void {
    const positionId = this.selectedPositionId();
    if (!positionId) return;
    this.api.deletePositionSkillRequirement(positionId, r.id).subscribe({
      next: () => this.loadPositionCatalog(positionId),
      error: () => this.error.set('Не вдалося прибрати вимогу'),
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
