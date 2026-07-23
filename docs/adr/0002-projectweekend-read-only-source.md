# ADR 0002: ProjectWeekend as read-only copy source

## Context

ProjectWeekend remains a working product locally during the CRM build-out.

## Decision

Keep `ProjectWeekend/` on disk as a **read-only copy-source**, gitignored from LoomCRM. Copy/adapt code into LoomCRM; never edit PW as part of CRM work.

## Consequences

- Two git repositories can coexist under `C:\Loom-CRM-Core`.
- Bugfixes in PW are not automatic — must be re-copied deliberately.
- Enforced via `.gitignore`, `AGENTS.md`, and local `pnpm check:copy-source`.

## Rejected alternatives

- Git submodule.
- Rewriting CRM inside the ProjectWeekend repo.
- Moving PW history into LoomCRM.
