import type { HelpPageDescriptor } from '../../../core/help/help-page.models';

export type SettingsHelpDialogKind = 'role' | null;

/**
 * Dialog precedence for Access Roles: open role form → settings.dialog.role;
 * otherwise list tour settings.access-roles.
 */
export function resolveSettingsHelpContext(
  dialogKind: SettingsHelpDialogKind,
): HelpPageDescriptor {
  if (dialogKind === 'role') {
    return {
      label: 'Роль доступу',
      tourId: 'settings.dialog.role',
      soon: false,
    };
  }
  return {
    label: 'Доступи',
    tourId: 'settings.access-roles',
    soon: false,
  };
}
