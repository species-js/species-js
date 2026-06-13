# 044 — Structural anchor for `isPlainObject`: spec-mechanic-anchored five-marker chain with own-descriptor discipline

**Date:** 2026-06-08

**Context.** The initial `isPlainObject` cross-realm fallback was a two-marker
string-shape check —
`getTypeSignature(value) === '[object Object]' && getDefinedConstructorName(value) === 'Object'`.
Both markers are cheap and cross-realm safe, but both are _string fingerprints_. Nothing
structural anchored them. An adversarial input that tampered with `Symbol.toStringTag` and
the four-source constructor walk (e.g., setting `constructor = Object` on a class
instance) could pass both markers despite being a class instance, not a Plain Object.

**Decision.** Pair the two cheap string-shape signal markers with a five-marker
spec-mechanic-anchored prototype contract, both extracted into named `@internal` helpers.
The fallback now reads:

```js
hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value);
```

`hasPlainObjectPrototypeContract` walks `value`'s prototype and the prototype's
constructor, then verifies five spec-mechanic invariants:

1. `isClass(constructor)` — the constructor is a built-in or `class`-syntax newable.
2. `getTypeSignature(prototype) === '[object Object]'` — the prototype's own `[[Class]]`
   tag.
3. `getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object'` — own data-property
   read; accessor-form yields `undefined` and fails.
4. `getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype` — round-trip
   identity; the constructor's own `prototype` data property points back to the prototype
   walked from `value`.
5. `getPrototypeOf(prototype) === null` — chain-depth check; every realm's
   `Object.prototype` carries this invariant.

The descriptor-via-`.value` discipline on markers 3 and 4 is uniform with `isClass`'s own
`getOwnPropertyDescriptor(value, 'prototype')?.writable === false` — read own data via
descriptors, never via direct property access.

**Rationale.** Four forces converge:

- **String fingerprints are spoof-weak in isolation.** `Symbol.toStringTag` is freely
  settable on any object, and the four-source constructor walk can be defeated by a
  tampered own `constructor` property. The conservative-narrowing posture (decision #010)
  calls for layered cross-validators; the two-marker fallback had only one tier of
  structural evidence.

- **Round-trip identity is the load-bearing closure.** Marker 4 (constructor's `prototype`
  data property ≡ the prototype walked from `value`) is the spoof closer at the root. A
  tampered `value.constructor = Object` makes markers 1, 2, 3 all pass — but the attacker
  would also need `Object.prototype === ValueProto`, which holds only for genuine Plain
  Objects (cross-realm or otherwise). Class instances fail because
  `Foo.prototype !== Object.prototype`.

- **Chain-depth is realm-uniform.** `Object.prototype.[[Prototype]] === null` in every
  realm. The marker rejects class instances and built-in container instances by structural
  shape, not by string fingerprint — same kind of upgrade the boxed-primitive valueOf-slot
  probe brought to the boxed predicates (decision #042).

- **Own-descriptor discipline is a unified rule.** Reading own data via
  `getOwnPropertyDescriptor(obj, key)?.value` (instead of `obj[key]`) skips inherited
  properties AND skips accessor-form definitions. The same discipline already governs
  `isClass`'s `writable` read on `prototype`; extending it to `name` and `prototype` data
  reads here closes the lying-accessor spoof variant uniformly. The rule generalizes: any
  structural check on a property that should be an own data-form reads through
  descriptor.value, not through `[[Get]]`.

**Consequences.** Cross-realm `isPlainObject` verdicts now rest on spec-mechanic
invariants the engine attests (the `[[Prototype]]` slot, the constructor's intrinsic
`name` and `prototype` data properties), not on string fingerprints alone. Class instances
with tampered `constructor` properties — previously a partial spoof surface — fail the
round-trip check cleanly. The residual spoof surface is an attacker who reconstructs the
spec mechanics of `Object` from scratch (writable:false `prototype` data property pointing
at a hand-crafted null-proto prototype, own `name === 'Object'` data property) —
structurally indistinguishable from a foreign-realm `Object`, which is not a spoof but a
parallel implementation.

Two `@internal` helpers carry the work: `hasPlainObjectIdentitySignal` (two-marker
string-shape signal — also reused by `isPlainOrDictionaryObject`'s fused dispatch) and
`hasPlainObjectPrototypeContract` (the five-marker contract). Both exported with parallel
`.d.ts` declarations carrying `@internal` tags per decision #015, matching the function
module's family pattern (`hasAsyncFunctionIdentitySignal` +
`hasAsyncFunctionPrototypeSurface`, etc.) — see the addendum below. `isClass` and
`getOwnPropertyDescriptor` from `@/config` are new imports in `@/object` for the
descriptor discipline. The fast path (`getPrototypeOf === Object.prototype`) is unchanged.

Compares with decision #042 (four-marker boxed-primitive discrimination) — both move the
posture from "two string fingerprints" to "spec-mechanic-anchored chain with
engine-attested internal-slot or shape evidence at the bottom." Same architectural move,
different domains.

See `../architecture/object.md` — "Structural anchor for `isPlainObject`" for the full
marker walk and spoof-surface analysis.

**Addendum (2026-06-08, commit `ee7e8f3`).** The initial landing exported only
`hasPlainObjectIdentitySignal` while `hasPlainObjectPrototypeContract` stayed module-local
— an asymmetric pair that violated decision #015's "All sub-helpers exported with parallel
`.d.ts` declarations." Resolved by promoting the prototype contract to exported with a
parallel `.d.ts` declaration carrying the full five-marker walkthrough; both now tagged
`@internal`. The family now matches the function module's exported-helpers pattern, and
both helpers are individually testable. Prose references in `isPlainObject`'s `.d.ts`
JSDoc upgraded from backticked names to `{@link}` since the referents are now documented
symbols.

**Addendum (2026-06-08).** The local-realm fast path was originally written as
`getPrototypeOf(value) === Object.prototype`. Promoted the module-local `objectPrototype`
capture in `@/config` (previously used only by `toObjectString` extraction and the
`hasOwnProperty` chain) to an exported `@internal` constant, then wired both
`isPlainObject` and `isPlainOrDictionaryObject`'s fast paths through it.
`Object.prototype` itself is non-writable per ECMA-262 §20.1.2.1, but `globalThis.Object`
is not — reaching for `Object.prototype` at each call site resolves through whatever
`Object` references at that moment. The capture forecloses the post-load
`globalThis.Object` reassignment surface. Same boundary-fixing posture as decisions #017
(`getPrototypeOf`), #034 (`objectCreate`), and #043 (`objectIs`); no TS-side retyping
needed here since the captured reference is a pure value rather than a method with a
lib-gap signature.
