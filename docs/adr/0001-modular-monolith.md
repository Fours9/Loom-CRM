# ADR 0001: Modular monolith

## Context

We are evolving from ProjectWeekend (absence manager) into a full CRM while keeping a small team and ~10–20 concurrent users.

## Decision

Build LoomCRM as a **modular monolith**: one NestJS API, one Angular app, one PostgreSQL database, with clear Platform / Organization / business-module boundaries.

## Consequences

- Simple local run and deployment.
- Modules can later be extracted if needed.
- Requires discipline (lint boundaries, no cross-module repository access).

## Rejected alternatives

- Microservices per domain (too much ops cost now).
- Git submodule of ProjectWeekend (couples lifecycle incorrectly).
