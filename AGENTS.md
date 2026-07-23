# Agent rules for LoomCRM

## ProjectWeekend is read-only

`ProjectWeekend/**` is a local **read-only copy-source** for migrating domain logic into LoomCRM.

**Do not** edit, format, rename, delete, or generate files inside `ProjectWeekend/`.

- LoomCRM repository root: `C:\Loom-CRM-Core`
- Read-only copy source: `C:\Loom-CRM-Core\ProjectWeekend`
- Never modify ProjectWeekend as part of LoomCRM work

Before finishing work that may have touched the copy-source accidentally, run:

```bash
pnpm check:copy-source
```

## Architecture boundaries

- Arrow `A → B` means module A may import the public API of module B.
- Allowed: Organization → Platform; Absences → Platform; Absences → Organization.
- Forbidden: Platform → Absences; Organization → Absences; `apps/web` → `apps/api` source.
- Backend layout (Variant A): `apps/api/src/{platform,organization,modules}`.
- Do not enable TypeORM `synchronize: true` in any shared environment.

## Package manager

Use the exact `packageManager` from root `package.json` (pnpm@10.15.0) via Corepack when possible.
