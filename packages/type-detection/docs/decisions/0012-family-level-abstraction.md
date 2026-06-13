# 012 — Family-level abstraction over per-species duplication when the invariant is codified

**Date:** 2026-06-02

**Context.** When the generator-family shape predicates each got a `hasXxxPrototypeShape`
helper, I initially kept them as two per-species functions with identical bodies, citing
the CLAUDE.md "three similar lines is better than a premature abstraction" rule. The user
refactored them to a single shared `hasAnyGeneratorFunctionPrototypeShape`.

**Decision.** When similar code reflects a _structural invariant already codified at a
documented family level_ (the generator family in this case), the family-level helper is
the right level — regardless of how short the bodies are.

**Rationale.** Per-species duplicates lie about where the invariant lives. They tell a
reader the two species each have "their own" proto-side check, when in fact they share a
family-level rule (`%GeneratorPrototype%` and `%AsyncGeneratorPrototype%` carry the same
`'constructor' + 'prototype'` own-key set; the `[[Class]]` tag at the identity-signal
layer is the per-species discriminator). The family-level helper names the actual semantic
boundary; per-species copies fight the abstraction that the type hierarchy already
codifies. CLAUDE.md's "three similar lines" rule protects against _premature_ abstractions
(those not yet codified anywhere) — structural invariants already documented in design
memory are not premature.

**Consequences.** `hasAnyGeneratorFunctionPrototypeSurface` (renamed at decision #016) is
the shared family-level helper called by both `hasGeneratorFunctionShape` and
`hasAsyncGeneratorFunctionShape`. The `Any` prefix matches the umbrella type
`AnyGeneratorFunction`.
