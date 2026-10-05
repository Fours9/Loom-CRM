import { bool, pick } from './coerce.mjs';

/**
 * Preserve payload keys; remap known request id fields.
 * @param {object} row
 * @param {string} loomId
 * @param {import('../id-map.mjs').IdMap} idMap
 */
export function mapNotification(row, loomId, idMap) {
  const recipient = idMap.require(
    'user',
    pick(row, 'recipient_user_id', 'recipientUserId'),
  );

  let payload = null;
  const rawPayload = pick(row, 'payload', 'payload_json', 'payloadJson');
  if (rawPayload && typeof rawPayload === 'object') {
    payload = { ...rawPayload };
  } else if (typeof rawPayload === 'string' && rawPayload.trim()) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      payload = { raw: rawPayload };
    }
  } else {
    payload = {};
  }

  const relatedCol = pick(row, 'related_request_id', 'relatedRequestId');
  if (relatedCol && !payload.relatedRequestId && !payload.related_request_id) {
    payload.relatedRequestId = relatedCol;
  }

  payload = remapRequestIdsInPayload(payload, idMap);

  const dismissedAt = pick(row, 'dismissed_at', 'dismissedAt') ?? null;

  return {
    id: loomId,
    recipient_user_id: recipient,
    type: String(pick(row, 'type')),
    title: String(pick(row, 'title')),
    body: String(pick(row, 'body') ?? ''),
    payload: Object.keys(payload).length ? payload : null,
    is_read: bool(pick(row, 'is_read', 'isRead'), false),
    dismissed_at: dismissedAt,
    created_at: pick(row, 'created_at', 'createdAt') ?? null,
  };
}

/**
 * @param {Record<string, unknown>} payload
 * @param {import('../id-map.mjs').IdMap} idMap
 */
function remapRequestIdsInPayload(payload, idMap) {
  const out = { ...payload };
  for (const key of [
    'relatedRequestId',
    'related_request_id',
    'requestId',
    'request_id',
  ]) {
    if (out[key] === undefined || out[key] === null) continue;
    const mapped = idMap.get('absence', out[key]);
    if (mapped) out[key] = mapped;
    // if unmapped, leave original key value (preserve) — request may be gone
  }
  return out;
}

export function mapPrivacyPairs(row) {
  return [
    [
      'privacy.absence_visibility_mode',
      String(
        pick(row, 'absence_visibility_mode', 'absenceVisibilityMode') ??
          'department',
      ),
    ],
    [
      'privacy.profile_visibility_mode',
      String(
        pick(row, 'profile_visibility_mode', 'profileVisibilityMode') ??
          'department',
      ),
    ],
    [
      'privacy.show_department_on_calendar',
      String(
        bool(
          pick(row, 'show_department_on_calendar', 'showDepartmentOnCalendar'),
          true,
        ),
      ),
    ],
    [
      'privacy.show_position_on_calendar',
      String(
        bool(
          pick(row, 'show_position_on_calendar', 'showPositionOnCalendar'),
          true,
        ),
      ),
    ],
    [
      'privacy.show_absence_type_to_peers',
      String(
        bool(
          pick(row, 'show_absence_type_to_peers', 'showAbsenceTypeToPeers'),
          false,
        ),
      ),
    ],
    [
      'privacy.session_inactivity_minutes',
      String(
        pick(row, 'session_inactivity_minutes', 'sessionInactivityMinutes') ??
          480,
      ),
    ],
    [
      'privacy.global_privacy_priority',
      String(
        bool(
          pick(row, 'global_privacy_priority', 'globalPrivacyPriority'),
          false,
        ),
      ),
    ],
  ];
}
