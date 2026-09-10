import { Permission } from '@loom/contracts-auth';

/** UI entry predicate for employee create (Model A). */
export function canOpenEmployeeCreate(session: {
  hasPermission(permission: Permission): boolean;
}): boolean {
  return (
    session.hasPermission(Permission.EmployeesCreate) &&
    session.hasPermission(Permission.EmployeesView)
  );
}
