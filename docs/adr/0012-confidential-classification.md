# ADR 0012: Confidential classification

## Context

Після [ADR 0011](0011-org-leadership-vs-account-role.md) account roles можуть давати `documents.manage` без adminEquivalent. Потрібен крос-доменний шар classification (`isConfidential`), незалежний від type-based sensitivity documents, з єдиною permission і без self-escalation через Settings.

## Decision

1. **Permission** `confidential.view` — cross-domain classification authority. `≠ documents.view` / `≠ documents.manage`. ADMIN preset includes it; employee/DM/director system roles do not by default.
2. **One permission, two predicates** (`ConfidentialAccessPolicy`):
   - `canView(ctx, { isOwner })` = adminEquivalent ∨ owner ∨ has `confidential.view`
   - `canMark(ctx)` = adminEquivalent ∨ has `confidential.view` (**no** owner exception)
3. **Documents first:** `employee_documents.is_confidential` (immutable after create in this slice). Additive stack on type sensitivity — confidential never widens `DocumentTypeAccessPolicy`.
4. **Type policy (post-ADR 0011):** `DocumentTypeAccessPolicy` uses resolved facts (`isOwner`, `isAdminEquivalent`, `isViaManagedScope`), not `User.role`. `canWriteType ≡ canReadType` — cannot upload/mutate a type you cannot read.
5. **Access API:** `EmployeeAccessService.resolveTargetAccess` → `{ isOwner, isInScope, isViaManagedScope }`. Documents resolve AuthZ + actor context + target access **once** per operation.
6. **Resource policy:** `DocumentResourceAccessPolicy.evaluateExistingDocumentAccess` → `{ canRead, canMutate }` with defense-in-depth on `employeeInScope`. Mutations use `requireExistingDocumentMutationAccess` (404 concealment). List `permissions.canDelete` is **per-document**.
7. **Upload multipart:** omitted / null / `''` `isConfidential` → `false` (legacy clients). Mark without `canMark` → 403. Type write deny → 404, no rows.
8. **Grant ceiling:** any AccountRole security-definition mutation (`isAdminEquivalent`, `permissionPreset`, extras incl. `confidential.view`) requires actor **already** adminEquivalent from **pre-mutation** `AuthorizationContext`. Settings checkbox «Може бачити конфіденційну інформацію» writes/removes extra only; adminEquivalent targets show checked + disabled.

## Canonical formulas

```text
canRead = DocumentsView ∧ EmployeeScope ∧ TypeRead ∧ (!confidential ∨ canView)
canUploadOrdinary = DocumentsManage ∧ EmployeeScope ∧ TypeWrite
canUploadConfidential = canUploadOrdinary ∧ canMark
canMutate = DocumentsManage ∧ EmployeeScope ∧ TypeWrite ∧ (!confidential ∨ canView)
```

## Consequences

- SoftDelete and download share the same resource gate (closes manage-without-type-visibility hole).
- Contacts / other domains may reuse `ConfidentialAccessPolicy` later; flag writers stay domain-owned.
- Future: PATCH classification, delegated grant-ceiling, audit events `document_classified_confidential` / `confidential_removed`.

## Non-goals

- Physical change of classification after upload (this slice).
- Delegated non-admin Settings editors with grant-ceiling.
- Binding type sensitivity to account-role code instead of managed scope.
- `ProjectWeekend/**` edits.

## Rejected alternatives

- Mark = any uploader with `documents.manage` (rejected: only confidential.view / adminEq).
- Confidential replaces type gate (rejected: additive stack).
- AuthZ via `permissionsForRole(actor.role)` for confidential/type (forbidden after ADR 0011).
