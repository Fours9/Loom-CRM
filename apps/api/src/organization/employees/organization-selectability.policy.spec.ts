import {
  isDepartmentSelectable,
  isDirectionSelectable,
  isPositionSelectable,
} from './organization-selectability.policy';
import type { Company } from '../companies/company.entity';
import type { Direction } from '../companies/direction.entity';
import type { Department } from '../departments/department.entity';
import type { Position } from '../positions/position.entity';

describe('organization-selectability.policy', () => {
  it('allows active directions without a company parent', () => {
    const direction = {
      id: 'd1',
      companyId: null,
      isActive: true,
    } as Direction;

    expect(
      isDirectionSelectable({
        direction,
        company: null,
      }),
    ).toBe(true);
  });

  it('blocks directions whose company is inactive', () => {
    const direction = {
      id: 'd1',
      companyId: 'c1',
      isActive: true,
    } as Direction;
    const company = { id: 'c1', isActive: false } as Company;

    expect(isDirectionSelectable({ direction, company })).toBe(false);
  });

  it('allows departments under company-less selectable directions', () => {
    const department = {
      id: 'dep1',
      directionId: 'd1',
      isActive: true,
      isHidden: false,
    } as Department;
    const direction = {
      id: 'd1',
      companyId: null,
      isActive: true,
    } as Direction;

    expect(
      isDepartmentSelectable({
        department,
        direction,
        company: null,
      }),
    ).toBe(true);
  });

  it('allows positions under company-less hierarchy', () => {
    const position = {
      id: 'p1',
      departmentId: 'dep1',
      directionId: 'd1',
      isActive: true,
    } as Position;
    const department = {
      id: 'dep1',
      directionId: 'd1',
      isActive: true,
      isHidden: false,
    } as Department;
    const direction = {
      id: 'd1',
      companyId: null,
      isActive: true,
    } as Direction;

    expect(
      isPositionSelectable({
        position,
        department,
        direction,
        company: null,
      }),
    ).toBe(true);
  });
});
