/**
 * Machine-empty predicate for DIFFERENT-employee reattach (ADR 0010).
 * Any own key in answersJson (even empty bundle) ⇒ not empty ⇒ 409.
 */
export function isEmptyForDifferentEmployeeReattach(input: {
  submissions: ReadonlyArray<unknown>;
  response: { answersJson?: Record<string, unknown> | null } | null;
}): boolean {
  if (input.submissions.length > 0) return false;
  const response = input.response;
  if (response == null) return true;
  return Object.keys(response.answersJson ?? {}).length === 0;
}
