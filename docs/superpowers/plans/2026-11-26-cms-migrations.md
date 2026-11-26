# CMS automatic migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically generate deployable SQL for every confirmed local CMS mutation.

**Architecture:** Capture repository writes and serialize PostgreSQL parameters. Journal SQL and the local applied marker in the content transaction, then export immutable files with recoverable failures. Production and legacy profiles opt out.

**Tech Stack:** TypeScript, node:fs/promises, pg, Fastify, Vitest, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-26-cms-migrations-design.md`

## Global Constraints
- Enable only for `CMS_PROFILE=local`.
- Files live in `backend/migrations/` and use the existing deploy migrator.
- Never copy local player data or overwrite different migration bytes.
- Do not commit or deploy automatically.

## Review Focus
- Quotes, backslashes, JSON and binary images must survive literal serialization.
- Disk failure after commit must leave recoverable SQL and an explicit error.
- Production-only team membership/history must affect replay correctly.
- Multiple saves must preserve migration ordering and immutable names.
- Invalid mutations must roll back without export or applied markers.

### Task 1: Durable migration writer and repository integration
**Files:** Create `cms/server/migration-writer.ts`, `backend/migrations/054_cms_migration_journal.sql`, `cms/server/migrations.db.test.ts`; modify `cms/server/repository.ts`.
**Interfaces:** `CmsMigrationWriter(directory?: URL)` exposes capture/journal/export; repository accepts optional writer. Each mutating repository transaction records its actual SQL writes.
- [x] Write and run a failing integration test: a saved skillset generates a file and local applied marker; applying that file to an independent schema reproduces all four ordered slots and survives seed.
- [x] Implement journal, SQL serialization, monotonic filenames and immutable filesystem export.
- [x] Integrate all repository mutators, removing local-player-dependent SQL parameters from disable operations and preserving deletion checks during replay.
- [x] Test failed validation, ordered saves, image bytes, reorder/delete and export recovery.

### Task 2: API profile integration and documentation
**Files:** Modify `cms/server/app.ts`, `docs/cms.md`, `README.md`; extend integration tests.
**Interfaces:** app constructs writer only in local profile; status recovers pending exports and explains local migration mode.
- [x] Route media and setup deletion through transactional repository methods.
- [x] Test HTTP local enablement and prod/legacy opt-out.
- [x] Document setup, save → generated SQL → commit/push → deploy, pending export recovery and filename conventions.
- [x] Run `npm run typecheck`, `npm test`, `npm run test:db` and inspect final diff.

## Execution notes
- Inline implementation in the existing `develop` workspace; no automatic commits.
- Initial skillset test failed with zero generated files, then passed with real SQL replay.
- Tests exposed destination-history and disable-side-effect differences; SQL guards
  and destination-based CTEs now cover them.
- New-install replay initially failed on missing baseline abilities; the migrator
  now bootstraps the catalog only when the base character and character overrides
  are absent, before applying generated CMS SQL.
- Independent review found production-only encounters could retain temporary
  positions and production-only units could lose catalog order. Three regression
  cases failed before the fix and passed after adding SQL membership guards.
- Targeted final verification: 14 migration integration tests pass; typecheck passes.
- Final suites: `npm test` 391/391; `npm run test:db` 145/145;
  `npm run typecheck` and `npm run build:api` passed.
- A concurrent full frontend/backend test run exceeded the new integration fixture's
  default 10-second setup limit. The database suite passed in isolation; the fixture
  now allows 30 seconds to migrate and seed its two schemas. Final full DB suite and
  typecheck passed after that adjustment.
