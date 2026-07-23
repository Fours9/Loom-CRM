export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  employeeId: string | null;
  tokenVersion: number;
};
