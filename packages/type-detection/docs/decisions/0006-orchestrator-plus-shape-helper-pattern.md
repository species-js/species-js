# 006 — Orchestrator + shape-helper pattern for non-newable predicates

**Date:** 2026-06-01

**Context.** `isAsyncFunction` originally fused the `isFunction` gate, the same-realm
`instanceof` fast path, and the cross-realm structural check into one function. Testing
the cross-realm path required either an iframe harness or coverage of branches you could
not reach without one.

**Decision.** Split every non-newable predicate into two pieces. The **orchestrator** is
the public, narrowing predicate (e.g. `isAsyncFunction`): gate → fast-path → delegate to
shape helper. The **shape helper** is `hasXxxFunctionShape`, marked `@internal`, exported
for direct testability. The shape helper runs the realm-independent markers in isolation,
takes `value?: unknown`, returns plain `boolean` (no narrowing — that role belongs to the
orchestrator).

**Rationale.** Independent unit-testability for the two pieces. The shape helper _is_ the
cross-realm code path, so direct invocation tests it without an iframe harness. The shape
helper also becomes the introspection layer's narrowing primitive — when
`@species-js/function-introspection` lands its source-regex predicates, they will compose
the shape helper with a source check rather than re-implementing the marker chain.

**Consequences.** Applied across `isAsyncFunction` + `hasAsyncFunctionShape`,
`isGeneratorFunction` + `hasGeneratorFunctionShape`, `isAsyncGeneratorFunction` +
`hasAsyncGeneratorFunctionShape`, and `isAnyGeneratorFunction` (umbrella; no dedicated
`hasAnyGeneratorFunctionShape` because the union of two single-family helpers is the
umbrella's job). Later refined by decision #014 with sub-helper extraction
(`*IdentitySignal`, `*PrototypeSurface`).
