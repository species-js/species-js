# 076 — Generalize the `@@throw-safe` marker beyond utility (re-scopes #073)

**Date:** 2026-07-26

**Context.** ADR #073 introduced the `/* @@throw-safe */` source marker and scoped it
**utility-module-only**, with an explicit escape hatch: _"revisit only if a second module
independently needs the same oracle."_ The primitive round is that second module —
`primitive.js` carries the marker on its throw-safe reads. So #073's "utility-only" scope
is superseded in practice, and the canon must say so rather than read "utility-only" while
a second module (and, on the coming retro-sweep, every module) carries it.

This ADR changes only the **scope** of the marker — nothing about its form or rationale
(both stay as #073 defined them).

**Decision.**

1. **`@@throw-safe` is a package-wide convention, not utility-only.** Any type-detection
   module whose throw-safety warrants an explicit, machine-checkable enumeration carries
   the marker on its throw-safe exports. The form is unchanged from #073: a
   single-asterisk `/* @@throw-safe */` block comment on the line directly above the
   export's doc block, mirrored **identically in `.js` and `.d.ts`**, absent from the
   raw/throw-propagating forms (which instead carry `@throws {unknown}`), serving the dual
   purpose of test-suite completeness oracle + reader-facing throw-safety marker.
2. **Both-files parity is part of the convention.** The marker appears in BOTH `.js` and
   `.d.ts`. The `.js` count may exceed the `.d.ts` count only by factory-internal
   runtime-branch methods (per #073's `isValidWeakKey` note). A `.js`-only application is
   an incomplete state, not a variant.
3. **`primitive` is the first module beyond utility.** Its `.js` markers are brought to
   `.d.ts` parity as part of the primitive round (owner-driven). Future module rounds
   apply the marker as a first-class deliverable, alongside the `@throws {unknown}`
   annotation of any raw forms.
4. **Retro-application to the pre-marker modules is SEQUENCED, not immediate.** The
   already-finalized modules that predate the marker — `thenable`, `object`, `evented`,
   `error`, `function` — are NOT retrofitted piecemeal now. They wait until the remaining
   module spec-and-test rounds are complete; then a single "work back" pass applies all
   accumulated conventions (this marker, the `@throws {unknown}` parity, the
   cross-artifact Round-2 audit, the config Round-2 inventory) uniformly across every done
   module.

**Rationale.**

- **The oracle argument generalizes.** #073's reason for a flag over a naming heuristic —
  throw-safety spans `Safe` / `Inert` / `Defined`-named helpers PLUS design-inert
  predicates with no naming hint, so no naming scheme uniformly signals it — is not
  utility-specific. Every module's test round wants the same completeness oracle (the
  flagged set must equal the `hostile × predicate` matrix's scored set).
- **Canon must match practice.** Leaving #073 reading "utility-only" while `primitive`
  carries the marker is exactly the doc-vs-code drift the cross-artifact-alignment
  discipline exists to prevent.
- **Sequenced retro-application avoids partial-state churn.** Retrofitting the done
  modules one convention at a time, as each is invented, yields N divergent partial
  states; a single deferred back-pass applies the full, settled convention set once.
  (User-directed sequencing.)

**Consequences.**

- Canon split: **this ADR owns the marker's scope; #073 owns its form + rationale.** #073
  gets a forward-pointer banner; its "utility-only" line is historical.
- `primitive` carries the marker in both `.js` and `.d.ts` (the `.d.ts` alignment is the
  primitive round's work, owner-driven).
- The five pre-marker done modules owe the marker + `@throws {unknown}` parity on the
  deferred retro-sweep — gated behind the remaining rounds, tracked in memory.
- No source behavior changes; this is a documentation-convention scope decision.
