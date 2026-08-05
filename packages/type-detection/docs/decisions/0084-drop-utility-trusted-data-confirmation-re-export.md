# 084 — Drop `utility`'s `TRUSTED_DATA_CONFIRMATION` re-export (amends #070)

**Date:** 2026-08-05

**Context.** #070 extracted `TRUSTED_DATA_CONFIRMATION` into the zero-import `foundation`
leaf to dissolve a module-load TDZ crash, and deliberately kept `utility` re-exporting it
so that "the public surface stays byte-identical" — the sentinel remained reachable at
`…/utility` and through the root barrel. That was a migration-safety property: the
extraction was a structural change to a shipping surface, and holding the surface constant
kept the refactor's blast radius provably zero.

Three facts have since made the re-export dead weight rather than safety.

1. **Nothing consumes it.** Every internal reader — `thenable`, `evented`, `error`,
   `object`, `function` — imports the sentinel from `#foundation` **directly**, which #070
   itself made load-bearing (a re-export-only route through `utility` would have left the
   crash intact). `utility` still imports it for its own use; only the pass-through export
   has no caller.
2. **`foundation` is not in the root barrel.** `src/index.{js,d.ts}` re-export eight
   modules and `foundation` is not among them, so `utility`'s re-export was the sentinel's
   **sole path onto the package's typed surface**.
3. **It is `@internal` machinery.** The fast-path skip hint of #058 is not consumer
   surface. F-γ (`63dc2da`, 2026-07-31) found the re-export had silently dropped its
   `@internal` tag — a bare `export { X } from …` does not carry the tag — and restored it
   rather than removing the export, explicitly deferring removal to the `@internal`
   hardening round because removal reverses this decision's byte-identical clause.

**Decision.** Remove the re-export from `utility`'s `.js` and `.d.ts`. This **amends
#070** by retiring its byte-identical-surface clause, which has served its purpose.

Two things deliberately stay: `utility`'s **import** from `#foundation` (it threads the
sentinel as the `trustedData` hint through its descriptor walk — the value is used, not
merely forwarded), and `foundation`'s **own** export, which is consumed tree-wide.

**Rationale.**

- **The clause was scoped to a migration that has landed and is guarded.** Byte-identical
  surface protected a refactor in flight; the entry-point arena
  (`test/entry-arena.test.js`) now asserts the real property directly — every published
  subpath loads clean as its own entry. Holding a surface constant to de-risk a change
  that is finished, tested, and a year of rounds behind us is cost without benefit.
- **An unreachable-by-intent symbol should be unreachable in fact.** A reachable, typed
  `@internal` export is a de-facto public contract: invisible to the consumer,
  unenforceable by us, and binding under Hyrum's law across six planned dependents.
  Tagging it `@internal` documents the intent; removing it enacts it.
- **Free now, breaking later.** Pre-1.0 and unpublished, this costs nothing. After publish
  it is a breaking change. The asymmetry is the whole argument for doing it now rather
  than at publish-readiness.
- **Verified dead before removal, not assumed.** No `src` consumer outside `utility`
  itself; no test consumes the value (the sole test mention is prose in
  `entry-arena.test.js` describing the historical crash); `utility`'s own three uses are
  of the imported value, not the export.

**Consequences.**

- `utility`'s exported surface drops the re-exported constant; `UTILITY.spec.md`'s
  inventory and re-confirmation gate are reconciled in the same commit.
- The sentinel stays available to internal code via `#foundation`, unchanged.
- **The wider `@internal` types-only hardening remains OPEN, and its mechanism is
  unsolved.** This ADR closes only the one bounded piece. The recorded plan — "narrow the
  public root `.d.ts`, tests keep full reach via `#index`" — is self-contradictory:
  `exports["."].types` and `#index` resolve to the same file (`src/index.d.ts`), and all
  49 test import sites go through `#index`, so narrowing it breaks `typecheck` across the
  suite. A public-only root needs either a curated barrel of ~138 named re-exports (plus a
  sync gate, since a hand-maintained list of that size rots) or a public/internal file
  split across nine modules and both sides of every `.js`/`.d.ts` pair. Deferred to
  publish-readiness with the trigger named, rather than left as "sometime".
- Builds on #058 (the flag itself) and #060 (the sibling module-scope sentinel precedent).
