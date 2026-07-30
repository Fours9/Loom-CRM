import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { EmployeeProfileResponse } from '@loom/contracts-employees';

/**
 * Feature-private adapter for profile mirror display defaults.
 * Not exported via public-api. Does not import People internals.
 * Prefer assignment.profileMirror when present; otherwise GET employee profile.
 *
 * Flat keys MUST match schema proposalMapping.field (e.g. personal_phone).
 */
@Injectable()
export class QuestionnaireProfileMirrorService {
  private readonly http = inject(HttpClient);

  resolve(
    employeeId: string,
    fromAssignment: Record<string, unknown> | null | undefined,
  ): Observable<Record<string, unknown>> {
    if (fromAssignment && Object.keys(fromAssignment).length > 0) {
      return of({ ...fromAssignment });
    }
    return this.fetchFlatMirror(employeeId);
  }

  private fetchFlatMirror(
    employeeId: string,
  ): Observable<Record<string, unknown>> {
    return this.http
      .get<EmployeeProfileResponse>(`/api/v1/employees/${employeeId}/profile`)
      .pipe(
        map((profile) => flattenEmployeeProfileMirror(profile)),
        catchError(() => of({})),
      );
  }
}

/** Map profile response into flat keys matching seed proposalMapping.field. */
export function flattenEmployeeProfileMirror(
  profile: EmployeeProfileResponse,
): Record<string, unknown> {
  const overview = profile.sections.overview;
  const personal = profile.sections.personal;
  const contacts = profile.sections.contacts ?? [];

  const primaryPhone =
    contacts.find((c) => c.type === 'personal_phone' && c.isPrimary)?.value ??
    personal?.personalPhone ??
    null;
  const secondaryPhone =
    contacts.find((c) => c.type === 'personal_phone' && !c.isPrimary)?.value ??
    null;
  const email =
    contacts.find((c) => c.type === 'personal_email' && c.isPrimary)?.value ??
    personal?.personalEmail ??
    null;
  const telegram =
    contacts.find((c) => c.type === 'personal_telegram' && c.isPrimary)
      ?.value ??
    personal?.personalTelegram ??
    null;

  return {
    lastName: overview?.lastName ?? null,
    firstName: overview?.firstName ?? null,
    middleName: overview?.middleName ?? null,
    preferredName: overview?.preferredName ?? personal?.preferredName ?? null,
    birthDate: personal?.birthDate ?? null,
    city: personal?.city ?? null,
    preferredLanguage: personal?.preferredLanguage ?? null,
    personal_phone: primaryPhone,
    personal_phone_secondary: secondaryPhone,
    personal_email: email,
    personal_telegram: telegram,
  };
}
