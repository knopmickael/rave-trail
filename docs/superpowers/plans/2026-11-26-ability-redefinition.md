# Ability redefinition implementation plan

**Spec:** `todo-list.md` (three rebalances, five new abilities).
**Goal:** Make all requested content executable in the deterministic shared engine,
editable in the manual CMS and deployable to existing databases.

## Decisions
- Existing IDs: `quick-slash`, `wolfs-howl`, `fury-scream`.
- New IDs/assets: `damage-reflection`, `deep-concentration`, `dragons-roar`,
  `seismic-explosion`, `frozen-throne`; public paths use `/media/abilities/`.
- Reuse `ability-block` for freezing and `attack-block` for Frozen Throne.
- Add `burn {teamTurns}`, `damage-reflection {percent,teamTurns}` and
  `concentration {teamTurns}` to the supported effect contract.
- Burn blocks healing (including drain and shield healing) and new Guard/invulnerability,
  not existing defenses or resurrection. It lasts the next three target-team turns.
- Reflection preserves the incoming damage, returns floor(actual damage * percent / 100),
  respects the attacker's defenses, never reflects itself or periodic damage, and lasts
  the next opposing-team turn. It does not stack; dispel-shields does not remove it.
- Concentration is self-only. Skip the next two own-team turns; at the next own turn
  restore team energy to 100 if still alive. Death/revival cancels it. Extra turns count.
- Preserve existing battle snapshots, player progress and unrelated CMS edits.
- Add migration 055 after all current 054 CMS migrations. New catalog entries are not
  assigned to character slots (the spec does not request loadout changes).
- Keep the existing uncommitted CMS UI work, authoring migrations and asset moves.
  No automatic commit/push.

## Tasks
1. Write failing combat tests for burn/heal defenses, reflection/expiry/recursion/fatal
   hits, concentration/extra turns/death, and the requested catalog values.
2. Implement effect types, shared combat resolution, bot state keys and legal actions.
3. Expose effect fields/validation in the CMS and status icons/action disabling in combat.
4. Write a database regression: old authored content -> migration -> seed, preserving
   unrelated properties and snapshots; new rows remain editable after migration.
5. Add migration 055, catalog definitions, docs and task completion notes.
6. Run typecheck, focused tests, full unit/database suites and build; review the diff.

## Execution record
- Implemented all eight catalog changes and three new effect kinds; freezing and
  offensive blocking reuse the existing control contracts.
- Combat, CMS validation, active-status UI, localization, migrations and snapshot
  compatibility are covered by regression tests.
- Two independent reviews found migration handling of repeated/missing authored
  effects and reflection history attribution. Regression tests failed first;
  migration normalization and reaction-specific action IDs fixed those findings.
- Explicit turn-start ordering: concentration completion precedes bleeding ticks.
- Baseline repository tests now use real numbered migrations through a temporary
  fixture directory, excluding generated CMS authoring. This avoids comparing a
  personalized catalog against fixed defaults. `new-abilities.db.test.ts` continues
  to run the complete real migration chain, including the user's 054 authoring;
  CMS replay tests execute generated SQL through the same production runner.
- Reset only the disposable `_test` public fixtures after an old destructive
  migration test failed midway; no game database was reset.
- Verification: 408 unit/UI tests, 148 database tests, typecheck and production build.
- Applied migration 055 locally and restarted the CMS through App Hub. Browser
  checks at 1440px/390px confirm the new reflection form, 17 effect kinds, asset
  loading and absence of horizontal overflow.
- No automatic commit or push; prior user edits and generated migrations remain.
