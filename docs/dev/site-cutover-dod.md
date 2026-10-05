# Site cutover DoD checklist (code + docs delivered in-repo).
# Operational VPS execution of the window is manual; this file tracks repo readiness.

## Delivered in repository

- [x] 27. sourceMode=snapshot: recreate → restore → migrate (`site-cutover.sh` + scripts)
- [x] 28. sourceMode=pw-refresh: recreate → migrate → importer; never on unmigrated DB
- [x] 29. PW refresh cutover image + RO sqlite mount (`docker/cutover.Dockerfile`, compose profile)
- [x] 30. Full baseline restore only into freshly recreated DB (`db-recreate.sh` + `db-restore.sh`)
- [x] 31. Exact migration-set verify vs typeorm registry (`migration-verify.sh`)
- [x] 32–34. Acceptance overlay `127.0.0.1:8080`; go_live flips to `:80` + second public smoke
- [x] 35. Explicit migrate + `up -d --no-deps` (deploy-vps / site-cutover)
- [x] 36. Preflight asserts migrate/api DATABASE_URL identical
- [x] 37. CUTOVER_SMOKE_* separate from SEED_ADMIN_*
- [x] 38–39. `backups/` gitignored; marker has no secrets
- [x] 40. Daily deploy documents BC migrations / `LOOM_STOP_API_BEFORE_MIGRATE=1`

## VPS window (operator)

- [ ] Fill `.env.production` with real secrets + CUTOVER_SMOKE_*
- [ ] Off-box PW backup verified
- [ ] `./scripts/preflight-compose.sh --build`
- [ ] `./scripts/site-cutover.sh` through acceptance
- [ ] Admin ACCEPT → `--resume --phase go_live`
- [ ] Public smoke on `:80`
