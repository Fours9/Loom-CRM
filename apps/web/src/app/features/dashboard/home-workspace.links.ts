/**
 * Home workspace CTAs — single SoT for dashboard quick links.
 * Pure / deterministic: same session inputs → same routes.
 * Aligns with APP_NAV_TREE paths (`/absences`, `/people/:id`).
 */

/** Work calendar module root (nav catalog path). */
export const HOME_WORK_CALENDAR_PATH = '/absences';

export const HOME_PROFILE_LABEL = 'Мій профіль';
export const HOME_WORK_CALENDAR_LABEL = 'Робочий календар';

export const HOME_PROFILE_BLURB = 'Дані, документи та робочий контекст';
export const HOME_WORK_CALENDAR_BLURB = 'Заявки, календар і події команди';

/**
 * People profile URL for the signed-in employee, or null if the account
 * has no linked employee (button must stay disabled — fail-closed).
 */
export function resolveMyProfilePath(
  employeeId: string | null | undefined,
): string | null {
  if (employeeId == null) return null;
  const id = String(employeeId).trim();
  if (!id) return null;
  return `/people/${id}`;
}

export type HomeWorkspaceAction = {
  readonly id: 'profile' | 'work-calendar';
  readonly label: string;
  readonly blurb: string;
  /** Router path when enabled; null = disabled CTA. */
  readonly path: string | null;
};

/**
 * Ordered home CTAs for the dashboard. Deterministic order: profile, calendar.
 */
export function homeWorkspaceActions(
  employeeId: string | null | undefined,
): readonly HomeWorkspaceAction[] {
  return [
    {
      id: 'profile',
      label: HOME_PROFILE_LABEL,
      blurb: HOME_PROFILE_BLURB,
      path: resolveMyProfilePath(employeeId),
    },
    {
      id: 'work-calendar',
      label: HOME_WORK_CALENDAR_LABEL,
      blurb: HOME_WORK_CALENDAR_BLURB,
      path: HOME_WORK_CALENDAR_PATH,
    },
  ];
}
