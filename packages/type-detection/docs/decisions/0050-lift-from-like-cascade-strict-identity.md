# 050 — Lift-from-`Like`-cascade: two-axis dispatch at the strict-identity entry point

**Date:** 2026-06-16

**Context.** ADR #049 added a local-realm `instanceof` shortcut at the public entry point
of `isThenable` and the boxed-primitive predicates that lacked one. It did not touch the
strict-identity trio — `isPromise`, `isEventTarget`, `isAbortSignal` — which still
cascaded through their `Like` sibling:

```js
// pre-#050 shape
export function isPromise(value) {
  return (
    isPromiseLike(value) &&
    getTypeSignature(value) === '[object Promise]' &&
    getDefinedConstructorName(value) === 'Promise'
  );
}
```

The cascade had three costs that became visible once the entry-point shortcut framing from
#049 was applied to the strict trio:

1. Local-realm direct instances (the hot path) paid the `instanceof` check inside `Like`,
   then ran the tag and constructor-name strict markers afterward — even though the
   local-realm `proto-identity` check could settle the identity question outright in O(1).
2. Local-realm subclasses paid the same cross-realm chain to reach the inevitable
   constructor-name rejection. With a proto-identity check on the local-realm arm, the
   same rejection takes one O(1) comparison.
3. The cross-realm arm calling `Like` re-ran the realm-fixed `instanceof` check that the
   strict-caller had already disproved by reaching the cross-realm path. The
   structural-contract helper (`doesMatchPromiseContract` etc.) lived inside `Like`'s
   structural fallback, reachable only by paying for the re-run.

A separate force also bound: the per-case shape from #049 (bare `instanceof` for
subclass-admitting; `instanceof + proto-identity` for subclass-rejecting; structural-only
for factory functions) settled the question of WHAT a strict-identity entry point's
shortcut should look like. The remaining question was HOW to combine the local-realm
shortcut with the cross-realm structural chain — `||` between arms with a shared trailing
seal (as boxed primitives use) or a ternary committing to the right arm (no shared
trailer).

**Decision.** Rewrite `isPromise`, `isEventTarget`, and `isAbortSignal` as their own
two-axis ternary dispatch. The local-realm arm runs a named helper (the realm-fixed
`instanceof` + null-guard) gated to a single `proto-identity` follow-up; the cross-realm
arm runs `tag` + `constructor-name` + the structural-contract helper called directly:

```js
export function isPromise(value) {
  return (
    !!value &&
    (isCurrentRealmPromiseInstance(value)
      ? getPrototypeOf(value) === promisePrototype
      : getTypeSignature(value) === '[object Promise]' &&
        getDefinedConstructorName(value) === 'Promise' &&
        doesMatchPromiseContract(value))
  );
}
```

Three helpers are extracted at module scope, named for the scope they bundle:

- `isCurrentRealmPromiseInstance(value)` —
  `!!PromiseConstructor && value instanceof PromiseConstructor`.
- `isCurrentRealmEventTargetInstance(value)` — analogous for `EventTarget`.
- `isCurrentRealmAbortSignalInstance(value)` — analogous for `AbortSignal`.

Each helper does the bare null-guarded `instanceof` and nothing more. The proto-identity
arm is added ON TOP via the ternary in the strict predicate, because the same helper is
also consumed by the subclass-admitting `Like` sibling (which uses the bare `instanceof`
alone). The naming convention separates this from the `primitive.js` helpers
(`isCurrentRealmNativeString`, …) which bundle `instanceof + proto-identity` because they
have no `Like` consumer — `Native` names the full direct-instance test; `Instance` names
the bare `instanceof`.

**Rationale.** Three forces converge:

- **Bottom-seal availability decides ternary vs. `||`.** Boxed primitives have an
  engine-attested bottom seal (the `[[XData]]` internal-slot probe via the captured
  `X.prototype.valueOf`). Both arms of `isBoxedString` legitimately feed into the slot
  probe because the probe is inexpensive (one `valueOf.call`) and is the spoof-proof
  guarantee, even after the local-realm arm matches — it catches
  `Object.create(String.prototype)` and similar proto-identity-spoofing surfaces. So
  `||`-between-arms + trailing-seal is the right shape there.

  Promise / EventTarget / AbortSignal have no engine-attested bottom seal. The closest
  analogue (`doesMatchPromiseContract` etc.) is a three-descriptor-walk structural check,
  and on the local-realm arm it is already implied by `proto-identity` — a value with
  `Promise.prototype` necessarily inherits the contract methods. Pulling the contract to a
  shared trailing position would pay for it redundantly on the local-realm hot path.
  Keeping it inside an `||`'ed cross-realm arm would still fall through to it on
  local-realm subclass rejection (pay tag → constructor-name → contract to reach the same
  `false`). The two arms have different bottom semantics — `proto-identity` for
  local-realm, structural-contract for cross-realm — and the only structurally honest
  combination is a ternary that COMMITS to the right arm.

- **Subclass rejection moves from chain-walk to single comparison.** Under the cascade, a
  local-realm subclass passed `Like`'s `instanceof` arm, passed `tag` (subclasses inherit
  `Symbol.toStringTag` from the parent's prototype), and failed `constructor-name` — three
  comparisons plus a constructor-walk. Under the ternary, the same input passes
  `isCurrentRealmPromiseInstance` and fails `proto-identity` in two operations.
  Cross-realm subclasses still pay the cross-realm path, but reject at `constructor-name`
  before paying for the contract — strictly faster than the old `Like`-cascade ordering on
  every false-positive case.

- **Direct call to the structural-contract helper closes the wasted re-run.** When the
  cross-realm arm calls `doesMatchPromiseContract` directly rather than `isPromiseLike`,
  the `instanceof` check the latter would run has already been disproved by reaching the
  cross-realm arm. The direct call is the structurally honest cost: pay only for what is
  not already known.

The framing from #049 — "the public entry point is where the shortcut belongs; subclass
policy decides the shape" — was extended in this round with two additional rulings: (a)
bottom-seal availability decides ternary vs. `||`; (b) when no shared bottom seal exists,
the cross-realm arm calls the structural-contract helper directly, not the `Like` sibling.

**Consequences.** Observable behavior is unchanged across all three predicates. The
local-realm hot path is faster — `proto-identity` replaces tag + constructor-name + (via
`Like`) structural-contract. Local-realm subclass rejection moves from a tag +
constructor-name + implicit-contract chain to a single `proto-identity` mismatch.
Cross-realm direct instances pay `tag` → `constructor-name` → `contract` in
inexpensive-first order; cross-realm subclasses reject at `constructor-name` without
paying for the contract.

`thenable.js` and `evented.js` gain module-top realm-fixed `prototype` captures paired
with their existing constructor captures, used by the proto-identity arm:

- `promisePrototype = PromiseConstructor && PromiseConstructor.prototype`
- `eventTargetPrototype = EventTargetConstructor && EventTargetConstructor.prototype`
- `abortSignalPrototype = AbortSignalConstructor && AbortSignalConstructor.prototype`

`getPrototypeOf` newly imported from `@/config` in `evented.js` (already present in
`thenable.js` from prior work). The `&&` form is deliberate — it propagates the
realm-fixed `null` absence sentinel from the constructor capture to the prototype capture,
keeping the absence vocabulary uniform across paired bindings. The project-wide eslint
disable for `@typescript-eslint/prefer-optional-chain` (added in the same round) preserves
this pattern across the realm-fixed-capture idiom.

The "entry-point shortcut, per-case shape" canon from #049 now formalizes a fourth axis:

- **Ternary vs. `||` is decided by bottom-seal availability.** A shared engine-attested
  seal that both arms feed into → `||` between arms + trailing-seal. No shared seal →
  ternary committing to the right arm, with the structural-contract helper called directly
  on the cross-realm arm only.

Commit pending. See [`../architecture/thenable.md`](../architecture/thenable.md) and
[`../architecture/evented.md`](../architecture/evented.md) for the per-module mental-model
updates that accompany this decision.
