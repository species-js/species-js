# 016 — Singular composite naming: `*IdentitySignal` and `*PrototypeSurface`

**Date:** 2026-06-03

**Context.** Early sub-helper names were plural: `hasAsyncFunctionIdentityLabels` and
`hasAsyncFunctionPrototypeShape`. Both names had problems. _Labels_ (plural) conflated the
helper with its constituents — the function tests one thing (an identity signal), composed
of two checks. _Shape_ was already overloaded at the orchestrator level
(`hasAsyncFunctionShape`); subordinating the same word to a sub-helper invited reader
confusion.

**Decision.** Use singular composite naming. `*IdentitySignal` (singular) names the
abstract composite that the helper tests; the two underlying tag-label and name-label are
constituents named in prose ("the two identity-signal labels"). `*PrototypeSurface`
(singular) names the proto-side own-key surface precisely, leaving "Shape" reserved for
the orchestrator's top-level structural claim.

**Rationale.** The function tests _one_ identity signal, _one_ prototype surface — both
composite concepts. Plural naming misframed them as collections of independent checks; the
user's reframing as composite-with-constituents reads more accurately. Naming convention
is now structural, not enumerative.

**Consequences.** Five renames across `function.{d.ts,js}` and four memory files. The doc
prose accompanying these helpers uses "labels" descriptively to refer to the two
underlying checks, while the function name names the composite. Parallel `.d.ts`
declarations updated.
