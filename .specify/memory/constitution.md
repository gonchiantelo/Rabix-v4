<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Principles defined:
  - I. No Visual Regressions (new)
  - II. Supabase as Fixed Infrastructure (new)
  - III. Data Access Layer Isolation (new)
  - IV. RLS Verified, Never Assumed (new)
  - V. Incremental Strangler-Fig Migration (new)
- Sections added: Technical Constraints, Development Workflow, Governance
- Sections removed: none (initial creation from template)
- Templates requiring alignment:
  - .specify/templates/plan-template.md — ✅ no changes needed (reads constitution at runtime)
  - .specify/templates/spec-template.md — ✅ no changes needed
  - .specify/templates/tasks-template.md — ✅ no changes needed
  - .specify/templates/checklist-template.md — ✅ no changes needed
- Follow-up TODOs: none
-->

# RAVIX V5 Constitution

## Core Principles

### I. No Visual Regressions
The current HTML/CSS is the single source of truth for the product's visual design. No spec,
plan, or implementation MAY change existing styles, layout, or screens unless visual change is
the explicit, declared objective of that unit of work. Every module migration MUST include
automated visual regression verification (e.g. Playwright screenshot diff) against a baseline
captured before that module is touched. A migration is not complete until visual parity is
confirmed — functional parity alone is insufficient.

**Rationale**: The migration's entire purpose is to modernize what is *underneath* the UI without
disrupting a product that users already know. Visual drift during a long, multi-epic migration is
the single largest risk to that goal, and it is silent unless actively checked for.

### II. Supabase as Fixed Infrastructure
Supabase (Postgres + Auth + Storage, accessed via its REST/RPC API) is the project's permanent
backend. No spec or plan MAY propose, evaluate, or scaffold an alternative database engine or
BaaS provider. Work against the backend MUST take the form of ordering, securing, and versioning
what already exists (schema, policies, auth) — not replacing it.

**Rationale**: The backend is an explicitly preserved artifact per the migration mandate. Treating
it as fixed removes an entire axis of speculative architecture debate and keeps every spec focused
on the client-side modernization that is actually in scope.

### III. Data Access Layer Isolation
Once a module has been migrated, no application code outside its dedicated data-access layer
(`/src/data/*`) MAY call Supabase directly — no `.from()`, no `.rpc()`, no `.auth` calls from UI
code, event handlers, or view logic. All reads and writes for a migrated module MUST pass through
that module's data layer.

**Rationale**: Today ~100 direct Supabase calls are scattered across the client with no
intermediary, making it impossible to audit, cache, or consistently error-handle data access. This
principle is the structural fix, and it must be enforced from the first migrated module onward or
the debt simply reappears in the new architecture.

### IV. RLS Verified, Never Assumed
Any spec or plan that reads from or writes to a Supabase table — new or existing — MUST include
explicit verification of that table's Row Level Security policies as part of its scope. A plan
MUST NOT assume existing RLS is correct; it must confirm it, document the intended access model,
and flag any table found without adequate policies as a blocking finding, not a follow-up.

**Rationale**: The anon key used by this client is public by design; RLS is the only real access
boundary. An audit already found no evidence of systematic RLS verification, which today is the
project's most direct path to a data-exposure incident.

### V. Incremental Strangler-Fig Migration
Migration proceeds module by module. A new module MUST be built alongside its legacy counterpart,
verified for functional and visual parity, and only then does the legacy implementation get
removed. Big-bang rewrites of multiple modules in a single unit of work are prohibited. Every spec
and plan MUST explicitly declare which module(s) it touches and MUST NOT expand scope to
undeclared modules mid-implementation.

**Rationale**: The codebase is a ~22k-line monolith with no tests and no CI; the only way to
migrate it without a production incident is in small, independently verifiable increments where
each one can be reverted without affecting the rest of the app.

## Technical Constraints

- New module code MUST be written as ES modules (`import`/`export`), replacing the `window.*`
  global-namespace pattern one module at a time — not rewritten in place inside the same global
  object.
- A module MAY adopt a component framework (per the project's documented Option C) only once its
  data layer (Principle III) and its visual baseline (Principle I) are in place; adopting a
  framework MUST NOT be used as a substitute for either.
- Supabase credentials MUST be defined in exactly one place, sourced from environment/build-time
  configuration — never hardcoded or duplicated across files.
- Session state MUST be managed through `supabase.auth`, not through manually-managed
  `localStorage` tokens.
- Business logic that mutates data across more than one table, or that enforces a rule the
  frontend cannot fully trust itself to enforce, MUST live in a Postgres RPC function or Edge
  Function — not in client-side `.insert()`/`.upsert()` calls.

## Development Workflow

- Every module epic from the migration backlog (`docs/01-plan-migracion-backlog.md`) is worked as
  its own Spec Kit feature: `/speckit-specify` → optional `/speckit-clarify` → `/speckit-plan` →
  `/speckit-tasks` → optional `/speckit-analyze` → `/speckit-implement` → optional
  `/speckit-checklist`.
- Specs MUST cite concrete evidence from the repository (file paths, line ranges, table names) —
  see `docs/03-inventario-tecnico-componentes.md` — rather than describing a module only by name.
- A module is not considered migrated until: (a) its data access is fully behind `/src/data/*`
  (Principle III), (b) its RLS has been verified (Principle IV), and (c) visual regression checks
  pass against the pre-migration baseline (Principle I).
- Foundational hygiene (Fase 0 in the backlog: fixing broken references, centralizing config,
  auditing RLS, introducing the build tool and data layer, capturing the visual baseline) MUST
  land before the first module epic begins.

## Governance

This constitution supersedes ad-hoc practice for all spec-driven work on this project. Amendments
require: (1) a documented reason for the change, (2) an updated Sync Impact Report at the top of
this file, (3) a version bump following semantic versioning — MAJOR for backward-incompatible
principle removals or redefinitions, MINOR for new principles or materially expanded guidance,
PATCH for clarifications and wording fixes — and (4) review of any template or in-flight spec that
the change affects. `/speckit-analyze` MUST be used to verify a feature's spec, plan, and tasks
remain compliant with the current constitution before `/speckit-implement` runs.

**Version**: 1.0.0 | **Ratified**: 2026-07-31 | **Last Amended**: 2026-07-31
