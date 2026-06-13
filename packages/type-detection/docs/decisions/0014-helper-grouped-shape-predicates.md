# 014 — Helper-grouped shape predicates with sub-helper extraction

**Date:** 2026-06-02 → 2026-06-03

**Context.** The 6-marker `hasAsyncFunctionShape` body had grown to a long flat `&&`
chain. The semantic groups (descriptor-presence floor, identity labels, proto-side
membership) were visible to a careful reader but not structurally named. Cross-realm
safety (the `getPrototypeOf` read must not run on nullish input) was implicit in the chain
order.

**Decision.** Split each shape predicate into named sub-helpers grouped by semantic role.
`hasAsyncFunctionShape` now reads as four `&&` links: descriptor-presence floor (two
checks), identity-signal helper, prototype-surface helper. Generator-family shape
predicates use the same shape with three `&&` links (descriptor floor + identity-signal +
family-shared prototype-surface).

**Rationale.** The sub-helpers name the semantic groups explicitly. Runtime safety becomes
structural: the prototype-surface helper is called as the _last_ link of the `&&` chain,
so by the time `getPrototypeOf` runs the upstream identity-signal check has already
rejected nullish input. Sub-helpers are exported (`@internal`) so each link can be tested
in isolation — see decision #015.

**Consequences.** Five new sub-helpers exported across the package:
`hasAsyncFunctionIdentitySignal`, `hasAsyncFunctionPrototypeSurface`,
`hasGeneratorFunctionIdentitySignal`, `hasAsyncGeneratorFunctionIdentitySignal`, and the
family-shared `hasAnyGeneratorFunctionPrototypeSurface`. Parallel `.d.ts` declarations
carry the same prose.
