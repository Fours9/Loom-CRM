/** Compatibility enum; domain language prefers TimeEventType (same string values). */
export enum AbsenceType {
  DayOff = 'day_off',
  Vacation = 'vacation',
  SickLeave = 'sick_leave',
  PartTime = 'part_time',
  Overtime = 'overtime',
  BusinessTrip = 'business_trip',
  ExtraWorkDay = 'extra_work_day',
}

export enum AbsenceRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
  DeletionRequested = 'deletion_requested',
}
