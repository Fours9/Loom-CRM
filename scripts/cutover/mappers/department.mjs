import { bool, pick, strOrNull } from './coerce.mjs';

/** PW department → Loom insert (direction_id always null — kept catalog, no PW semantics). */
export function mapDepartment(row, loomId) {
  return {
    id: loomId,
    name: String(pick(row, 'name')),
    description: strOrNull(pick(row, 'description')),
    is_hidden: bool(pick(row, 'is_hidden', 'isHidden'), false),
    is_active: bool(pick(row, 'is_active', 'isActive'), true),
    direction_id: null,
    location: null,
  };
}

/** PW position → Loom (direction_id null). */
export function mapPosition(row, loomId, departmentId) {
  return {
    id: loomId,
    name: String(pick(row, 'name')),
    department_id: departmentId,
    description: strOrNull(pick(row, 'description')),
    is_active: bool(pick(row, 'is_active', 'isActive'), true),
    direction_id: null,
    is_department_manager_template: false,
    management_kind_template: 'none',
  };
}
