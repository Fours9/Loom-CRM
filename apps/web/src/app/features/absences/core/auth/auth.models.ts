export type UserRole = 'employee' | 'department_manager' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  isDepartmentManager: boolean;
  status: string;
  /** May arrive as 0/1 from API/SQLite before AuthService normalizes it */
  mustChangePassword: boolean | 0 | 1;
  lastLoginAt: string | null;
  createdAt: string;
  employeeId: string | null;
}
