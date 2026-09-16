import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Permission } from '@loom/contracts-auth';
import type { CreateEmployeeRequest } from '@loom/contracts-employees';
import { forkJoin, of } from 'rxjs';
import { SessionStore } from '../../core/auth/session.store';
import {
  OrganizationCatalogApiService,
  type OrganizationCatalogDepartment,
  type OrganizationCatalogDirection,
  type OrganizationCatalogPosition,
} from '../../core/api/organization-catalog-api.service';
import { EmployeeCreateFormComponent } from '../../shared/employees/employee-create-form.component';
import {
  emptyEmployeeCreateDraft,
  normalizeEmployeeCreateDraft,
  validateEmployeeCreateDraft,
  type EmployeeCreateDraft,
} from '../../shared/employees/employee-create-draft';
import { PeopleEmployeesApiService } from './people-employees-api.service';
import { AccountRolesApiService } from '../settings/access-roles/account-roles-api.service';
import type { AssignableAccountRoleOption } from '@loom/contracts-access-control';

@Component({
  selector: 'loom-people-employee-create-page',
  standalone: true,
  imports: [RouterLink, EmployeeCreateFormComponent],
  template: `
    <section class="page">
      <a routerLink="/people" class="back">← Назад</a>
      <div class="page-head">
        <h1>Новий працівник</h1>
        <button type="submit" form="create-employee" [disabled]="loading()">
          Створити
        </button>
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <loom-employee-create-form
        [draft]="draft"
        [directions]="directions()"
        [departments]="departments()"
        [positions]="positions()"
        [accountRoles]="accountRoles()"
        [canCreateAccountAtCreate]="canCreateAccountAtCreate()"
        [canAssignAccountRole]="canAssignAccountRole()"
        [canEditPersonal]="canEditPersonal()"
        (submitted)="submit()"
      />
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1rem;
        max-width: 1100px;
        margin-inline: auto;
        width: 100%;
      }
      .back {
        color: var(--pw-accent, #2a6fdb);
        text-decoration: none;
      }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .page-head h1 {
        margin: 0;
      }
      .page-head button {
        width: auto;
        min-width: 10rem;
        padding: 0.55rem 0.9rem;
        border: 0;
        border-radius: 8px;
        background: var(--pw-accent, #2a6fdb);
        color: var(--pw-on-accent, #fff);
        cursor: pointer;
      }
      .page-head button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .error {
        color: var(--pw-danger, #b00020);
        margin: 0;
      }
    `,
  ],
})
export class PeopleEmployeeCreatePageComponent implements OnInit {
  private readonly api = inject(PeopleEmployeesApiService);
  private readonly catalogApi = inject(OrganizationCatalogApiService);
  private readonly accountRolesApi = inject(AccountRolesApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  readonly canCreateAccountAtCreate = signal(false);
  readonly canAssignAccountRole = signal(false);
  readonly canEditPersonal = signal(false);
  readonly directions = signal<OrganizationCatalogDirection[]>([]);
  readonly departments = signal<OrganizationCatalogDepartment[]>([]);
  readonly positions = signal<OrganizationCatalogPosition[]>([]);
  readonly accountRoles = signal<AssignableAccountRoleOption[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  draft: EmployeeCreateDraft = emptyEmployeeCreateDraft();

  ngOnInit(): void {
    this.canCreateAccountAtCreate.set(
      this.session.isAdminEquivalent() ||
        this.session.hasPermission(Permission.EmployeesCreateAccountAtCreate),
    );
    this.canAssignAccountRole.set(
      this.session.isAdminEquivalent() ||
        this.session.hasPermission(Permission.EmployeesAssignAccountRole),
    );
    this.canEditPersonal.set(
      this.session.isAdminEquivalent() ||
        this.session.hasPermission(Permission.EmployeesWritePersonal),
    );
    this.draft = emptyEmployeeCreateDraft({
      canCreateAccountAtCreate: this.canCreateAccountAtCreate(),
    });

    const roles$ = this.canAssignAccountRole()
      ? this.accountRolesApi.getAssignableRoles()
      : of([] as AssignableAccountRoleOption[]);

    forkJoin({
      catalog: this.catalogApi.getSnapshot(),
      roles: roles$,
    }).subscribe({
      next: ({ catalog, roles }) => {
        this.directions.set(catalog.directions ?? []);
        this.departments.set(catalog.departments ?? []);
        this.positions.set(catalog.positions ?? []);
        this.accountRoles.set(roles);
      },
      error: () => {
        this.error.set('Не вдалося завантажити дані для створення');
      },
    });
  }

  submit(): void {
    const validation = validateEmployeeCreateDraft(this.draft);
    if (validation) {
      this.error.set(this.validationMessage(validation));
      return;
    }
    const body: CreateEmployeeRequest = normalizeEmployeeCreateDraft(this.draft);
    this.loading.set(true);
    this.error.set('');
    this.api.createEmployee(body).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.openDetail) {
          void this.router.navigate(['/people', res.id]);
        } else {
          void this.router.navigate(['/people']);
        }
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message ||
            err?.message ||
            'Не вдалося створити працівника',
        );
      },
    });
  }

  private validationMessage(
    code: NonNullable<ReturnType<typeof validateEmployeeCreateDraft>>,
  ): string {
    switch (code) {
      case 'required_names':
        return 'Вкажіть прізвище та імʼя';
      case 'account_email_required':
        return 'Вкажіть email для входу';
      case 'account_password_required':
        return 'Вкажіть тимчасовий пароль';
      case 'account_password_short':
        return 'Пароль має містити щонайменше 8 символів';
    }
  }
}
