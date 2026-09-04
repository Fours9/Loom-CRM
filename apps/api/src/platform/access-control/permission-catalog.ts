import { Permission } from '../permissions/permission.names';

const PERMISSION_SET = new Set<string>(Object.values(Permission));

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value);
}

export function assertKnownPermission(value: string): Permission {
  if (!isPermission(value)) {
    throw new Error(`Unknown permission in account role: ${value}`);
  }
  return value;
}
