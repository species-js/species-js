# 024 — `hasInertMethod` factored as `@/utility` primitive

**Date:** 2026-06-04

**Context.** The equip-js source's `isThenable` inlined the descriptor-walk +
accessor-rejection + callability-check logic. The thenable migration needed the same logic
for `doesMatchPromiseContract` (three times, for `then`/`catch`/`finally`). Inlining three
times would duplicate the inspect-without-invoke contract — and any future
Promise-adjacent or method-contract predicate would duplicate it again.

**Decision.** Factor `hasInertMethod(value, key)` as an `@/utility` primitive. Tests
whether the value carries a callable data property at `key`, reachable through its
prototype chain. Composes `getNextAvailablePropertyDescriptor` with
`objectHasOwn(descriptor, 'value')` rejection of accessor descriptors and
`isCallable(descriptor.value)` for the callability verification.

**Rationale.** The inspect-without-invoke contract is a reusable primitive, not a local
choice for one predicate. Extracting it to `@/utility` makes it composable for any future
method-contract predicate; the thenable module composes it four times (once in
`isThenable`, three times in `doesMatchPromiseContract`). The name `hasInertMethod` was
chosen over candidates like `hasTrustedMethod` (overloaded — "trusted against what?") and
`hasDataMethod` (spec-precise but obscures the safety frame) because "inert" is
metaphorical-but-universal (chemistry, physics, HTML all share the meaning) and conveys
the load-bearing safety guarantee without requiring the reader to internalize ECMA-262
descriptor terminology.

**Consequences.** `hasInertMethod` ships in `@/utility` as a public export. Used by
`isThenable` and `doesMatchPromiseContract` in the thenable module. Composes naturally for
any future method-contract predicate. The descriptor-walk pattern it embodies is captured
in decision #021 (the spec-shape rule's third pattern); the contract vocabulary it enables
is captured in [[design-rulings]] via the contract-vocabulary ruling.
