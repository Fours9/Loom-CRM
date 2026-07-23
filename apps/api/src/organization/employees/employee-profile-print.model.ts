export const PROFILE_PDF_TEMPLATE_VERSION = '1.2';

export type EmployeeProfilePrintScheduleDay = {
  weekday: number;
  weekdayLabel: string;
  isWorkingDay: boolean;
  workTime: string | null;
  breakTime: string | null;
};

export type EmployeeProfilePrintModel = {
  employeeNumber: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
  phoneNumber: string | null;
  telegram: string | null;
  email: string | null;
  schedule: EmployeeProfilePrintScheduleDay[] | null;
  comment: string | null;
  generatedAtLabel: string;
  generatedByLabel: string;
  templateVersion: string;
};
