# 021 — Spec-shape rule extended: predicate over inherited gets descriptor-walk for inspection without invocation

**Date:** 2026-06-04

**Context.** `hasInertMethod(value, key)` was introduced in the thenable migration as the
inspect-without-invoke primitive. Its callers (`isThenable`,
`doesImplementPromiseContract`) read inherited `Promise.prototype` methods (`then`,
`catch`, `finally`). Decision #020 says "inherited → direct access (let the engine
resolve)" but direct access would invoke any accessor at the key — wrong for a predicate
that must inspect without invocation.

**Decision.** Extend the spec-shape rule with a third pattern. The full rule now reads:

- **Own-data → descriptor-first** (no fallback). The descriptor's `value` is the canonical
  path; an accessor leaves `value` undefined and the downstream narrow rejects it.
- **Inherited → direct access.** The engine's prototype-chain walk is the spec-correct
  resolution; descriptor-first would return `undefined` for every inherited case.
- **Predicate over inherited → descriptor-walk for safety.** A predicate's contract is to
  inspect without consuming the value, so it cannot invoke accessors. The descriptor-walk
  pattern reads the chain via `getOwnPropertyDescriptor` at each level (the
  `getNextAvailablePropertyDescriptor` helper from `@/utility`) and rejects accessor
  descriptors via `objectHasOwn(descriptor, 'value')`.

**Rationale.** Patterns 1 and 2 govern reads that consume the value — production code
wants the property's value. Pattern 3 governs reads that inspect the structure to make a
boolean discrimination — predicate code wants to know "could this be safely consumed?"
without doing the consumption. The predicate's inspect-without-invoke contract overrides
the spec-shape access path because the contract requires non-invocation. An accessor at
the key is exactly the spoof case the predicate must reject; if direct access fires the
getter, the predicate's defense is gone.

**Consequences.** `hasInertMethod` is the canonical implementation of pattern 3 in this
package, factored as a `@/utility` primitive (see decision #024). The rule generalizes to
any future predicate that inspects inherited properties without firing accessors —
Iterator protocol predicates, EventTarget interface predicates, Error-invariants
predicates. Codified in [[design-rulings]] as a third pattern alongside the existing two;
the design-rulings entry carries the forward-applicable framing, this entry carries the
chronological capture.
