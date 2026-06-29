# thenable — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`thenable.d.ts`, `thenable.js`,
> `architecture/thenable.md`, decisions #021–#024, #036, #037, #050, #054). Status:
> **FROZEN 2026-06-18** — decidability check passed (local-realm vectors run against the
> real predicates through the `@/index.js` barrel). This spec is the base for the axis-1
> suite; axes 2–4 derive alongside. White-box annotations amended 2026-06-23 (decision
> #054) and 2026-06-25 (decision #059, registry-drop + constructor threading — the only
> `@internal` contract change, `hasPromiseIdentitySignal`); public behavioral vectors
> unchanged throughout — see Resolved items #4 and #5.

## Module contract

`type-detection / thenable` discriminates the Promise resolution protocol at three
meaningful levels, plus one type-only parallel refinement:

```
Thenable<T>                  (isThenable)      — callable `then` only
  ├── PromiseLike<T>         (isPromiseLike)   — full Promise.prototype method contract
  │     └── Promise<T>       (isPromise)       — Promise identity via two-axis dispatch
  └── AbortableThenable<T>   (no predicate)    — `then` with optional `onaborted` callback
```

`PromiseLike` and `Promise` form a strict superset chain; `AbortableThenable` is an
orthogonal refinement with no runtime predicate (decision #037). Every predicate is purely
structural — it reads descriptors and prototype-chain values, and never invokes the
value's methods or probes engine-internal slots.

## Surface inventory

**Public predicates (axis 1):** `isThenable`, `isPromiseLike`, `isPromise`.

**Exported `@internal` helpers (axis 4):**

- `doesImplementPromiseContract(value?)` — declared in both `.js` and `.d.ts`.
- `hasPromiseIdentitySignal(value?, name?)` — the two string-shape identity markers: the
  value's `[[Class]]` tag and the constructor `name` threaded in by the caller; does no
  constructor resolution of its own (decision #059).
- `isStructuralPromisePrototypeEquivalent(prototype, constructor)` — prototype-side
  structural validation with reciprocal own-constructor identity (decision #054).
- `isStructuralPromiseEquivalent(value, prototype?)` — `isPromise`'s cross-realm arm,
  orchestrating the value-side signal, the method contract, and prototype-equivalence
  (decision #054).
- `isCurrentRealmPromiseInstance(value)` — exported from both `thenable.js` and
  `thenable.d.ts` (the `.d.ts` declaration was added when item #1 below was resolved).

**Exported types without a predicate:** `Thenable<T>`, `PromiseLike<T>`,
`AbortableThenable<T>`. `AbortableThenable` is type-only by design — a delivered interface
for future external consumers; no type-detection `.js` imports it, so it carries no test
(its well-formedness is covered by the package `tsc` typecheck).

## Cross-cutting vectors

Applied identically by all three public predicates (each opens with a `!!value` guard):

- **CC/nullish** — `null`, `undefined`, omitted argument → all reject.
- **CC/falsy-primitive** — `0`, `''`, `false`, `NaN`, `0n` → reject via `!!value` before
  any property access.
- **CC/truthy-primitive** — `42`, `'x'`, `true`, `1n`, `Symbol()` → reject (truthy, but
  carry no `then` / contract in their prototype chain).

`doesImplementPromiseContract` has no `!!value` guard of its own; it inherits
nullish-safety from `hasInertMethod` (which returns `false` for nullish input).

---

## `isThenable`

`isThenable<T = unknown>(value?: T): value is T & Thenable<unknown>` Composition:
`!!value && (isCurrentRealmPromiseInstance(value) || hasInertMethod(value, 'then'))` Spec
basis: ECMA-262 `Get(value, "then")` resolution during `PromiseResolveThenableJob`.

**Admits**

- `isThenable/A1` — `Promise.resolve(1)` → true — local-realm `Promise` via the
  `instanceof` arm.
- `isThenable/A2` — `new (class extends Promise {})((r) => r())` → true — `instanceof`
  admits subclasses.
- `isThenable/A3` — `{ then() {} }` → true — own callable `then` data property.
- `isThenable/A4` — `Object.create({ then() {} })` → true — `then` found inherited via
  chain-walk.
- `isThenable/A5` — a cross-realm `Promise` (fixture) → true — `instanceof` misses;
  `hasInertMethod` finds the inherited `then`.
- `isThenable/A6` — `Object.assign(() => {}, { then() {} })` → true — a callable carrying
  a `then` data property is still a thenable.
- `isThenable/A7` — `{ then: class {} }` → true — a class is `typeof 'function'`, so it
  satisfies the callable-`then` contract (isThenable admits any callable `then`).
- `isThenable/A8` — a null-prototype object with an own callable `then`
  (`Object.assign(Object.create(null), { then() {} })`) → true — own data property found
  before the (absent) chain walk.

**Rejects**

- `isThenable/R1` — `{ then: 'nope' }` → false — `then` is present but not callable.
- `isThenable/R2` — `{ get then() { return () => {}; } }` → false — accessor descriptor
  rejected (inspect-without-invoke), even though the getter would return a callable.
- `isThenable/R3` — `{}` → false — no `then` anywhere in the chain.
- `isThenable/R4` — an own non-callable `then` shadowing an inherited callable `then`
  (`Object.assign(Object.create({ then() {} }), { then: 'nope' })`) → false — the
  chain-walk returns the FIRST descriptor found (the own, non-callable one), matching
  ECMA-262 `Get` shadowing.
- (plus all CC/nullish, CC/falsy-primitive, CC/truthy-primitive)

**Refuses to claim**

- `isThenable/B1` — the _arity or signature shape_ of `then` (a zero-arg `then` is
  admitted).
- `isThenable/B2` — whether the value honors the `resolve`/`reject` adoption protocol,
  whether callbacks fire, when, or how often.
- `isThenable/B3` — the `[[PromiseState]]` internal slot.
  `Object.create(Promise.prototype)` is admitted (inherits `then`, passes `instanceof`)
  despite not being a genuine Promise — structural detection cannot see internal slots.
- `isThenable/B4` — a throwing accessor `then` (`{ get then() { throw … } }`) → false,
  **not thrown** — the inert descriptor read never invokes the getter.
- `isThenable/B5` — a Proxy whose `getOwnPropertyDescriptor` trap throws → false, **not
  thrown** — `hasInertMethod` is throw-safe (hardened via `getInertDescriptor`; see
  UTILITY.spec.md `hIM/R6`).
- `isThenable/B6` — a Proxy whose `getPrototypeOf` trap throws → false on **all three**
  predicates, **not thrown** — `isCurrentRealmPromiseInstance`'s `instanceof` arm is now
  throw-safe too (wrapped `try/catch → false`).

**Cross-realm expectation (axis 2):** admit foreign-realm `Promise` instances and any
foreign object carrying a callable `then` (via the structural arm). No value is rejected
on realm membership alone.

**Spoof-resistance expectation (axis 3):** the only spoof surface is the accessor trap
(`isThenable/R2`). `isThenable` makes no identity claim, so there is nothing further to
spoof — an own callable `then` is admitted _by contract_, not by oversight.

**Composition note (axis 4):** drives `isCurrentRealmPromiseInstance` (instanceof arm) and
`hasInertMethod(_, 'then')` (structural arm).

---

## `isPromiseLike`

`isPromiseLike<T = unknown>(value?: T): value is T & PromiseLike<unknown>` Composition:
`!!value && (isCurrentRealmPromiseInstance(value) || doesImplementPromiseContract(value))`
Spec basis: the `Promise.prototype` method contract — ECMA-262 §27.2 (`then`, `catch`,
`finally`).

**Admits**

- `isPromiseLike/A1` — `Promise.resolve()` → true — `instanceof` arm.
- `isPromiseLike/A2` — a `Promise` subclass instance → true — `instanceof` arm
  (subclass-admitting, unlike `isPromise`).
- `isPromiseLike/A3` — `{ then() {}, catch() {}, finally() {} }` → true — full structural
  contract.
- `isPromiseLike/A4` — cross-realm `Promise` (fixture) → true — structural fallback.
- `isPromiseLike/A5` — a userland Promise-like (Bluebird/Q-shaped fixture with the three
  methods) → true.

**Rejects**

- `isPromiseLike/R1` — `{ then() {} }` → false — only `then`; missing `catch` and
  `finally`.
- `isPromiseLike/R2` — `{ then() {}, catch() {} }` → false — missing `finally`.
- `isPromiseLike/R3` — `{ then() {}, catch() {}, get finally() { return () => {}; } }` →
  false — `finally` is an accessor (rejected).
- (plus all cross-cutting vectors)

**Refuses to claim**

- `isPromiseLike/B1` — `Promise` _identity_. Any value satisfying the three-method
  contract is admitted; no `[[Class]]` tag or constructor-name check (that is
  `isPromise`'s job).
- `isPromiseLike/B2` — the `[[PromiseState]]` slot and adoption protocol (as
  `isThenable/B2-B3`).

**Cross-realm expectation (axis 2):** admit foreign-realm `Promise` instances (structural
fallback) and foreign contract-satisfiers.

**Spoof-resistance expectation (axis 3):** accessor traps on any of the three methods are
rejected. There is no identity to spoof — a non-Promise carrying the three methods is
admitted _by contract_.

**Composition note (axis 4):** drives `isCurrentRealmPromiseInstance` and
`doesImplementPromiseContract`. Subclass-admitting because the `instanceof` arm carries no
proto-identity narrowing.

---

## `isPromise`

`isPromise<T = unknown>(value?: T): value is T & Promise<unknown>` Composition:
`!!value && (isCurrentRealmPromiseInstance(value) ? getPrototypeOf(value) === promisePrototype : isStructuralPromiseEquivalent(value, getPrototypeOf(value)))`
where the cross-realm arm `isStructuralPromiseEquivalent` expands to the value-side
identity signal (`hasPromiseIdentitySignal`) + the method contract
(`doesImplementPromiseContract`) + prototype-equivalence
(`isStructuralPromisePrototypeEquivalent` — the fourth marker, prototype/constructor
reciprocal identity). Spec basis: `Promise` identity — two-axis dispatch (decisions #023,
#050, #054).

**Admits**

- `isPromise/A1` — `Promise.resolve()` → true — local-realm arm: `instanceof` +
  proto-identity.
- `isPromise/A2` — `new Promise(() => {})` → true — same.
- `isPromise/A3` — a cross-realm _direct_ `Promise` (fixture) → true — cross-realm arm:
  tag `'[object Promise]'` + constructor-name `'Promise'` + contract.

**Rejects**

- `isPromise/R1` — a _local-realm_ `Promise` subclass instance
  (`class MyPromise extends Promise {}`) → false — passes `instanceof` but fails
  proto-identity (`getPrototypeOf` is `MyPromise.prototype`).
- `isPromise/R2` — a _cross-realm_ `Promise` subclass (fixture) → false — constructor-name
  resolves to `'MyPromise'`, fails `=== 'Promise'`.
- `isPromise/R3` — tag-spoof
  `{ [Symbol.toStringTag]: 'Promise', then() {}, catch() {}, finally() {} }` → false — tag
  passes, but the constructor-walk reaches `Object`, not `Promise`.
- `isPromise/R4` — a `PromiseLike` non-Promise `{ then() {}, catch() {}, finally() {} }` →
  false — not `instanceof`; tag is `'[object Object]'`.
- `isPromise/R5` — `{ then() {} }` → false — not `instanceof`; tag mismatch.
- `isPromise/R6` — a tag-spoof carrying an OWN `constructor` named `Promise`
  (`{ [Symbol.toStringTag]: 'Promise', then(){}, catch(){}, finally(){}, constructor: function Promise(){} }`)
  → false — `getDefinedConstructor` walks the prototype-chain and **ignores the own
  `constructor` data property** (#047), so the walk reaches `Object`, not `Promise`.
  Strengthens `R3` (the own-`constructor` variant of the tag-spoof).
- `isPromise/R7` — a NULL-prototype tag-spoof with a full OWN contract
  (`Object.assign(Object.create(null), { [Symbol.toStringTag]: 'Promise', then, catch, finally })`)
  → false, **not thrown** — the constructor-walk pivots to the value's `[[Prototype]]`
  (here `null`), so `getNextAvailablePropertyDescriptor` finds no `constructor` and the
  resolved name is `undefined`, not `'Promise'`. Companion to `R3`/`R6`, exercising the
  null-`[[Prototype]]` branch of the cross-realm arm's constructor resolution.
- (plus all cross-cutting vectors)

**Refuses to claim**

- `isPromise/B1` — _subclass admission_: deliberately rejects both local- and cross-realm
  subclasses (a documented strictness; consumers needing subclasses compose a
  constructor-chain walk).
- `isPromise/B2` — the `[[PromiseState]]` slot. **Known admission (decision #052):**
  `Object.create(Promise.prototype)` passes the local-realm arm (`instanceof` true,
  proto-identity true) and is admitted despite carrying no Promise internal state.
  `Promise` is **structurally unsealable** — it exposes no inert internal-slot accessor
  (its only `[[PromiseState]]` readers, `then` / `catch` / `finally`, invoke
  `SpeciesConstructor` and allocate, so they cannot be used as an inspect-without-invoke
  probe the way boxed primitives use `valueOf`). Structural detection verifies _shape, not
  liveness_; the graft throws on first real use. Accept-and-document — see decision #052;
  a host-backed tier is deferred to Q.005.
- `isPromise/B3` — a throwing `Symbol.toStringTag` getter (with a full contract) → false,
  **not thrown** — the cross-realm arm's tag read goes through the throw-safe
  `getTypeSignature` (yields `undefined`, fails the `=== '[object Promise]'` check). The
  by-contract predicates (`isThenable`, `isPromiseLike`) admit such a value — they read
  the real methods, never the tag (`isThenable/B7` pairing).
- `isPromise/B4` — **unclosable spoofs (extend B2's shape-not-liveness boundary):** a
  Proxy lying `getPrototypeOf → Promise.prototype` passes the local-realm arm; a foreign
  `Promise` subclass whose constructor `.name` is forced to `'Promise'` passes the
  cross-realm arm. Structural detection cannot beat a fully-committed proxy/rename — named
  here, not closed. (cross-realm arm); reject foreign-realm subclasses (constructor-name)
  — symmetric with the local-realm subclass rejection.
- `isPromise/B5` — a value with own tag `'Promise'` + own `then`/`catch`/`finally` whose
  `[[Prototype]]` is a `Proxy` with a throwing `getOwnPropertyDescriptor` trap → false,
  **not thrown** — the cross-realm arm's constructor-walk pivots INTO the hostile proto,
  but `getDefinedConstructor` routes its descriptor reads through the throw-safe
  `getInertDescriptor` (decision #056), so the trap yields `undefined` (no reachable
  constructor) and the name fails `=== 'Promise'`. `isThenable` / `isPromiseLike` stay
  admitting — they find the own `then` / contract before any chain walk. Closes the last
  unguarded throw surface in `isPromise` (after the `getTypeSignature` and `instanceof`
  wraps); the same hardening makes every constructor-walk consumer (`@/object`,
  `@/function`, `@/primitive`, `@/evented`) throw-safe.

**Spoof-resistance expectation (axis 3):** the four cross-realm markers are independent
and each closes a distinct false-positive class — `doesImplementPromiseContract` rejects
tag/ctor-name claimants lacking the methods; the `[[Class]]` tag rejects
contract-satisfiers tagged otherwise; the constructor-name closes the `Symbol.toStringTag`
spoof hole the tag alone leaves open (`isPromise/R3`); and the prototype/constructor
reciprocal-identity marker (`isStructuralPromisePrototypeEquivalent`, decision #054)
rejects a value whose own markers are forged but whose prototype's own constructor
disagrees with the value's resolved constructor. The one _unclosed_ surface is the
prototype-graft (`isPromise/B2`).

**Composition note (axis 4):** two-axis ternary over `isCurrentRealmPromiseInstance`; the
local-realm arm uses `getPrototypeOf` (`@/config`) and the realm-fixed `promisePrototype`
capture; the cross-realm arm is `isStructuralPromiseEquivalent`, composing
`hasPromiseIdentitySignal` (tag via `getTypeSignature`, name threaded in by the caller),
`doesImplementPromiseContract`, and `isStructuralPromisePrototypeEquivalent` — each
structural helper resolving its object's constructor ONCE via `getDefinedConstructor` and
reusing it for both the name (via `getVerifiedOwnName`) and the reciprocal-identity
compare, the prototype leg under `{ assumePrototype: true }`, plus `getInertPrototypeOf`
(all `@/utility`). Decisions #054, #059.

**Policy flags:** `isPromise/R1`-`R2` encode the _current shipped_ subclass-rejection
behavior; if a subclass-admission policy is ever adopted these vectors invert.

---

## Helper specification (axis 4)

### `doesImplementPromiseContract(value?)` — `@internal`

Purely structural Promise-method-contract check; no `instanceof` fast-path (that is the
caller's job).
`hasInertMethod(value, 'then') && hasInertMethod(value, 'catch') && hasInertMethod(value, 'finally')`.

- `dMPC/A1` — `Promise.resolve()` → true — the three methods inherited from
  `Promise.prototype`.
- `dMPC/A2` — `{ then() {}, catch() {}, finally() {} }` → true — own data properties.
- `dMPC/A3` — `Object.create({ then() {}, catch() {}, finally() {} })` → true — inherited.
- `dMPC/R1` — `{ then() {} }` → false — short-circuits at the missing `catch`.
- `dMPC/R2` — `{ then() {}, catch() {} }` → false — missing `finally`.
- `dMPC/R3` — `{ then() {}, catch() {}, get finally() {} }` → false — accessor `finally`.
- `dMPC/R4` — `null`, `undefined` → false — via `hasInertMethod` nullish-safety (no own
  `!!value` guard).
- `dMPC/B1` — short-circuit order is `then` → `catch` → `finally`; the order is a cost
  optimization, not observable behavior beyond which method a malformed input fails at.

### `hasPromiseIdentitySignal(value?, name?)` — `@internal`

The two string-shape identity markers, independent of the method contract.
`getTypeSignature(value) === '[object Promise]' && name === 'Promise'`. The `name` is the
caller's already-resolved constructor name — the caller resolves the constructor once and
derives its name via `getVerifiedOwnName`; this helper does no constructor resolution of
its own (decision #059, which replaced the former `options.assumePrototype` parameter that
existed only to drive an internal `getDefinedConstructorName` call; the
prototype-vs-instance resolution distinction now lives entirely in the caller that
resolves the constructor).

- `hPIS/A1` — `(Promise.resolve(), 'Promise')` → true — both markers: tag
  `'[object Promise]'` and the threaded name `'Promise'`.
- `hPIS/A2` — `(Promise.prototype, 'Promise')` → true — a prototype object carries the
  Promise tag too; with the matching threaded name it passes.
- `hPIS/R1` — `(Promise.resolve(), 'Object')` → false — the tag passes, but the threaded
  name marker is load-bearing and rejects a non-`'Promise'` name.
- `hPIS/R2` — `({ [Symbol.toStringTag]: 'Promise' }, 'Object')` → false — the
  `Symbol.toStringTag` spoof is defeated by the threaded real constructor name.
- `hPIS/R3` — `({ then() {}, catch() {}, finally() {} }, 'Promise')` → false — tag
  `'[object Object]'` mismatch (a matching name cannot rescue a failed tag).
- `hPIS/R4` — `(Promise.resolve(), undefined)` → false — no reachable name was threaded in
  (the caller's `getVerifiedOwnName` found none).
- `hPIS/B1` — `(throwing Symbol.toStringTag getter, 'Promise')` → false, **not thrown** —
  the tag read goes through the throw-safe `getTypeSignature`.

### `isStructuralPromisePrototypeEquivalent(prototype, constructor)` — `@internal`

Validates that `prototype` IS structurally `Promise.prototype`, anchored on a reciprocal
own-constructor identity. Resolves the prototype's own constructor ONCE —
`const definedConstructor = constructor && getDefinedConstructor(prototype, { assumePrototype: true })`
— then
`!!constructor && constructor === definedConstructor && hasPromiseIdentitySignal(prototype, getVerifiedOwnName(definedConstructor)) && doesImplementPromiseContract(prototype)`.
The single resolution (`{ assumePrototype: true }`, ECMA-262 §10.2.6) feeds both the
reciprocal-identity compare and the threaded name; the falsy-`constructor` guard
short-circuits before any walk (decisions #054, #059).

- `iSPPE/A1` — `(Promise.prototype, Promise)` → true.
- `iSPPE/A2` — `(foreign Promise.prototype, foreign Promise constructor)` → true —
  realm-independent (markers and the reciprocal read are all structural).
- `iSPPE/R1` — `(Promise.prototype, undefined)` → false — falsy `constructor`
  short-circuits.
- `iSPPE/R2` — `(Object.prototype, Object)` → false — tag is `'[object Object]'`.
- `iSPPE/R3` — `(prototype, mismatchedConstructor)` → false — the reciprocal
  `constructor === definedConstructor` identity fails.

### `isStructuralPromiseEquivalent(value, prototype?)` — `@internal`

`isPromise`'s full cross-realm arm: the value-side identity signal + method contract +
prototype-equivalence. Resolves the value's constructor ONCE —
`const definedConstructor = getDefinedConstructor(value)` — then
`hasPromiseIdentitySignal(value, getVerifiedOwnName(definedConstructor)) && doesImplementPromiseContract(value) && isStructuralPromisePrototypeEquivalent(isObject(prototype) ? prototype : getInertPrototypeOf(value), definedConstructor)`.
The single resolution is threaded both into the value's name marker (via
`getVerifiedOwnName`) and down to the prototype helper as the reciprocal target (decision
#059); the prototype leg does its own assume-path resolution. `prototype` may be supplied
by the caller (`isPromise` passes its already-read `getPrototypeOf(value)`) or resolved
internally. These vectors are the white-box counterparts of the public `isPromise`
cross-realm vectors.

- `iSPE/A1` — a cross-realm _direct_ `Promise` (fixture) → true — mirrors `isPromise/A3`.
- `iSPE/R1` — a cross-realm `Promise` subclass (fixture) → false — instance name
  `'MyPromise'`; mirrors `isPromise/R2`.
- `iSPE/R2` — tag-spoof
  `{ [Symbol.toStringTag]: 'Promise', then() {}, catch() {}, finally() {} }` → false — the
  instance name walks to `'Object'`; mirrors `isPromise/R3`.
- `iSPE/R3` — a `PromiseLike` non-Promise → false — tag `'[object Object]'`; mirrors
  `isPromise/R4`.

### `isCurrentRealmPromiseInstance(value)` — `@internal` (declared in both `.js` and `.d.ts`)

`!!PromiseConstructor && value instanceof PromiseConstructor`. Assumes a truthy `value`
(the public callers guard with `!!value` first). Subclass-admitting — no proto-identity
narrowing (that is layered on by `isPromise`'s ternary).

- `iCRPI/A1` — `Promise.resolve()` → true.
- `iCRPI/A2` — a `Promise` subclass instance → true (subclass-admitting).
- `iCRPI/R1` — a cross-realm `Promise` (fixture) → false — `instanceof` against the local
  capture.
- `iCRPI/R2` — `{ then() {} }` → false — not a `Promise` instance.
- `iCRPI/B1` — when the runtime has no global `Promise`, returns `false` for every input
  via the `!!PromiseConstructor` guard (hard to exercise in a normal test environment;
  documents the embedding-safety branch — a coverage-axis concern).

---

## Resolved items

All items surfaced while drafting this spec have been resolved; none remain open. One
post-freeze amendment is recorded below (item 4).

1. **`isCurrentRealmPromiseInstance` typed-surface asymmetry.** Was exported from
   `thenable.js` with `@internal` but undeclared in `thenable.d.ts`. **Resolution:**
   exporting an internal helper for the helper-unit axis obligates a parallel exported
   type declaration, even though `@internal` keeps it out of the built package's public
   surface. The `.d.ts` declaration was added (mirroring `doesImplementPromiseContract`);
   a package-wide scan confirmed it was the only `.js`-export missing from its `.d.ts`
   (evented keeps its `isCurrentRealm*Instance` helpers module-local). Generalized into
   the spec process — see the surface-inventory step in [`./README.md`](./README.md).
2. **`isPromise/B2` prototype-graft admission.** `Object.create(Promise.prototype)` is
   admitted by the local-realm arm (`instanceof` + proto-identity) despite carrying no
   `[[PromiseState]]`. **Resolution: accept-and-document (decision #052).** `Promise` is
   structurally unsealable — it exposes no inert internal-slot accessor (its only
   `[[PromiseState]]` readers, `then` / `catch` / `finally`, invoke `SpeciesConstructor`
   and allocate, so they cannot serve as an inspect-without-invoke probe the way boxed
   primitives use `valueOf`). The admission stands as the documented structural boundary
   `isPromise/B2`; no code change. A consumer needing genuine Promise-instance identity
   must round-trip the value through `await`/`.then` at runtime, outside type-detection's
   structural remit. A host-backed hardening tier is deferred to Q.005. The general
   sealability principle is recorded in decision #052 and `architecture/README.md`.
3. **`AbortableThenable` — nothing to test.** It is a delivered interface, shipped purely
   to cover future external use/consumption of the type. No `.js` file in any
   type-detection module imports or consumes it; it lives solely in `thenable.d.ts`. It
   has no runtime predicate (decision #037), and the package never exercises it, so there
   is no behavior to assert. Its well-formedness is already guaranteed by the package
   typecheck (`tsc` over the `.d.ts`); it carries no spec vector and no test.
4. **Post-freeze amendment (2026-06-23) — `isPromise` cross-realm factoring.** The
   cross-realm arm was factored into `isStructuralPromiseEquivalent` over three new
   exported `@internal` helpers (`hasPromiseIdentitySignal`,
   `isStructuralPromisePrototypeEquivalent`, `isStructuralPromiseEquivalent`) and gained a
   fourth marker — prototype/constructor reciprocal identity via
   `{ assumePrototype: true }` (generalized from decision #047 to
   `getDefinedConstructorName`). **No behavioral vector changed** — every
   `isPromise/A*`/`R*`/`B*` admit-or-reject verdict is identical; the amendment touched
   only the white-box composition annotations and the axis-4 helper inventory/specs above.
   The freeze of the behavioral oracle is preserved. Full rationale — including the
   value-keyed-registry caveat and the thread-the-option-vs-registry- hardening choice —
   in **decision #054**.
5. **Post-freeze amendment (2026-06-25) — registry-drop + constructor threading (decision
   #059).** The constructor registries were removed; the structural helpers now thread the
   once-resolved constructor instead of caching it across calls.
   `hasPromiseIdentitySignal`'s `@internal` signature changed from `(value, options)` to
   `(value, name)` — it no longer resolves a constructor; the caller threads in the name,
   derived once via the new `getVerifiedOwnName`. **No public behavioral vector changed**
   — every `isPromise/A*`/`R*`/`B*` verdict is identical. The amendment touched the
   white-box composition annotations, the axis-4 `hasPromiseIdentitySignal` contract and
   its `hPIS` vectors (one added — `hPIS/R4`; `hPIS/R2` now asserts the threaded name
   defeats a `Symbol.toStringTag` spoof), and retired the value-keyed-registry caveat from
   amendment 4 (no cache remains to poison). The freeze of the behavioral oracle is
   preserved. Full rationale in **decision #059**.
