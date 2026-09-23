/**
 * Re-export print model from contracts — Organization must not own the DTO
 * that Platform PdfRenderer imports.
 */
export {
  PROFILE_PDF_TEMPLATE_VERSION,
  type EmployeeProfilePrintModel,
  type EmployeeProfilePrintScheduleDay,
} from '@loom/contracts-employees';
