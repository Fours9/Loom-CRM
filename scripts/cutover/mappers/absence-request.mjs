import { bool, pick, strOrNull } from './coerce.mjs';

/**
 * Resolve user FK: required or nullable.
 * @param {import('../id-map.mjs').IdMap} idMap
 * @param {unknown} pwUserId
 * @param {{ required: boolean, label: string }} opts
 */
export function remapUserRef(idMap, pwUserId, opts) {
  if (pwUserId === null || pwUserId === undefined || pwUserId === '') {
    if (opts.required) {
      throw new Error(`${opts.label}: missing required user id`);
    }
    return null;
  }
  const mapped = idMap.get('user', pwUserId);
  if (!mapped) {
    throw new Error(
      `${opts.label}: PW user ${pwUserId} has no Loom mapping (fail-closed)`,
    );
  }
  return mapped;
}

export function mapAbsenceRequest(row, loomId, idMap) {
  const empPw = pick(row, 'employee_id', 'employeeId');
  const employeeId = idMap.require('employee', empPw);
  const createdBy = remapUserRef(
    idMap,
    pick(row, 'created_by_user_id', 'createdByUserId'),
    { required: true, label: `absence ${row.id} created_by` },
  );
  const decidedBy = remapUserRef(
    idMap,
    pick(row, 'decided_by_user_id', 'decidedByUserId'),
    { required: false, label: `absence ${row.id} decided_by` },
  );
  const deletionBy = remapUserRef(
    idMap,
    pick(row, 'deletion_requested_by_user_id', 'deletionRequestedByUserId'),
    { required: false, label: `absence ${row.id} deletion_requested_by` },
  );

  const deptPw = pick(row, 'department_id_at_submission', 'departmentIdAtSubmission');
  const posPw = pick(row, 'position_id_at_submission', 'positionIdAtSubmission');

  return {
    id: loomId,
    employee_id: employeeId,
    department_id_at_submission: deptPw ? idMap.get('department', deptPw) : null,
    position_id_at_submission: posPw ? idMap.get('position', posPw) : null,
    employee_name_at_submission: String(
      pick(row, 'employee_name_at_submission', 'employeeNameAtSubmission') ??
        'Unknown',
    ),
    employee_number_at_submission: strOrNull(
      pick(row, 'employee_number_at_submission', 'employeeNumberAtSubmission'),
    ),
    calendar_color_at_submission: strOrNull(
      pick(row, 'calendar_color_at_submission', 'calendarColorAtSubmission'),
    ),
    type: String(pick(row, 'type')),
    start_date: String(pick(row, 'start_date', 'startDate')),
    end_date: strOrNull(pick(row, 'end_date', 'endDate')),
    absence_start_time: strOrNull(
      pick(row, 'absence_start_time', 'absenceStartTime'),
    ),
    absence_end_time: strOrNull(pick(row, 'absence_end_time', 'absenceEndTime')),
    is_unpaid: bool(pick(row, 'is_unpaid', 'isUnpaid'), false),
    reason: strOrNull(pick(row, 'reason')),
    employee_comment: strOrNull(
      pick(row, 'employee_comment', 'employeeComment'),
    ),
    status: String(pick(row, 'status') ?? 'pending'),
    version: Number(pick(row, 'version') ?? 1),
    created_by_user_id: createdBy,
    decision_comment: strOrNull(
      pick(row, 'decision_comment', 'decisionComment'),
    ),
    adjustment_comment: strOrNull(
      pick(row, 'adjustment_comment', 'adjustmentComment'),
    ),
    deletion_comment: strOrNull(
      pick(row, 'deletion_comment', 'deletionComment'),
    ),
    decided_at: pick(row, 'decided_at', 'decidedAt') ?? null,
    decided_by_user_id: decidedBy,
    status_before_deletion_request: strOrNull(
      pick(row, 'status_before_deletion_request', 'statusBeforeDeletionRequest'),
    ),
    deletion_requested_at:
      pick(row, 'deletion_requested_at', 'deletionRequestedAt') ?? null,
    deletion_requested_by_user_id: deletionBy,
    created_at: pick(row, 'created_at', 'createdAt') ?? null,
    updated_at: pick(row, 'updated_at', 'updatedAt') ?? null,
  };
}

export function mapAbsenceHistory(row, loomId, idMap) {
  const reqPw = pick(row, 'request_id', 'requestId');
  const requestId = idMap.require('absence', reqPw);
  const actor = remapUserRef(
    idMap,
    pick(row, 'changed_by_user_id', 'changedByUserId'),
    { required: false, label: `history ${row.id} actor` },
  );
  const from = pick(row, 'from_status', 'fromStatus');
  const to = pick(row, 'to_status', 'toStatus');
  const desc = strOrNull(pick(row, 'change_description', 'changeDescription'));
  let action = desc;
  if (!action) {
    if (from || to) action = `${from ?? ''}->${to ?? ''}`;
    else action = 'ported';
  }
  action = String(action).slice(0, 64);

  const snapshot = pick(row, 'snapshot_json', 'snapshotJson');
  let comment = desc;
  if (!comment && snapshot) {
    comment = String(snapshot).slice(0, 500);
  }

  return {
    id: loomId,
    request_id: requestId,
    action,
    actor_user_id: actor,
    comment: comment ?? null,
    created_at: pick(row, 'created_at', 'createdAt') ?? null,
  };
}
