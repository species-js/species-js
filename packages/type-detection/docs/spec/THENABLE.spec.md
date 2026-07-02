# thenable — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`thenable.d.ts`, `thenable.js`,
> `architecture/thenable.md`, decisions #021–#024, #036, #037, #050, #054). Status:
> **FROZEN 2026-06-18** — decidability check passed (local-realm vectors run against the
> real predicates through the `@/index.js` barrel). This spec is the base for the axis-1
> suite; axes 2–4 derive alongside. White-box annotations amended 2026-06-23 (decision
> #054) and 2026-06-25 (decision #059, registry-drop + constructor threading — the only
> `@internal` contract change, `hasPromiseIdentitySignal`); public behavioral vectors
> unchanged throughout — see Resolved items #4 and #5. Re-validated 2026-06-29 — adopted
> the package-wide clean throw-safety model (universal invariant + axis-3
> `hostile × predicate` matrix; refuses-to-claim demoted to prose), fixed the
> `getInertPrototypeOf` rename drift, and closed the `isPromise/A2` + throw-safety-cell
> coverage gaps; no admit/reject verdict changed — see Resolved items #6. Amended
> 2026-07-02 (evented/object-round parity back-port) — three coupled changes to
> `isPromise`: (a) a new `@internal` `doesNotShadowPromiseContract` gate ANDed onto the
> local fast-path, so an own-level contract/`constructor` shadow on a `Promise.prototype`
> graft is now demoted `is`→`Like` (decision #063; new reject vectors `isPromise/R8`,`R9`)
> while the BARE graft stays admitted (`isPromise/B2`, unsealable, #052); (b) `isPromise`
> dropped its `<T=unknown>` generic (decision #062 — strict identity to one intrinsic);
> (c) the realm-asymmetry on a tag-tampered graft was formalized (`isPromise/A4` + a
> subsection). Surface 5→6 helpers. **The one prior public verdict change:** a tampered
> graft that WAS admitted is now rejected — see Resolved items #7.

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

### Throw-safety (the universal invariant)

Every predicate answers a boolean on **every** input, including hostile ones, and never
propagates a throw: `isThenable` / `isPromiseLike` / `isPromise` return `false` on any
throw on any path, and every `@internal` helper returns its sentinel (`undefined` for
readers, `false` for probes) so the composing predicate collapses to `false`. The
hostile-input classes this module's reads are exposed to, and the throw-safe reader each
routes through:

- **prototype-trap** (a `Proxy` whose `getPrototypeOf` throws) → `getInertPrototypeOf`,
  and the `try/catch`-wrapped `instanceof` inside `isCurrentRealmPromiseInstance`;
- **descriptor-trap** (a `Proxy` whose `getOwnPropertyDescriptor` throws, including on a
  pivoted `[[Prototype]]`) → `hasInertMethod` / `getDefinedConstructor`, both via
  `getInertDescriptor`;
- **accessor-throw** (`{ get then() { throw } }`) → the inert descriptor read never
  invokes the getter;
- **tag-getter-throw** (a throwing `Symbol.toStringTag`) → `getTypeSignature`.

A throwing-tag value carrying a real method contract is **admitted** by `isThenable` /
`isPromiseLike` (they read the methods, never the tag) and **rejected** by `isPromise`
(its tag read yields `undefined`) — an honest by-contract verdict, not a leak. The
exhaustive `hostile-class × predicate` proof lives in the test suite (axis 3), not here —
see [`./README.md`](./README.md) → "Throw-safety — the universal invariant".

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
- `doesNotShadowPromiseContract(value)` — the `#063` own-surface integrity gate: `true`
  when the value owns no name in the reserved denylist (`constructor`, `then`, `catch`,
  `finally`); throw-safe, fail-closed. ANDed onto `isPromise`'s local fast-path.

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

**Refuses to claim** (prose — semantic scope, asserts nothing)

`isThenable` does not verify `then`'s _arity or signature shape_ (a zero-arg `then` is
admitted), nor whether the value honors the `resolve`/`reject` adoption protocol (whether
callbacks fire, when, or how often), nor the `[[PromiseState]]` internal slot — structural
detection reads shape, not liveness.

**Boundary (axis 3):**

- `isThenable/B3` — `Object.create(Promise.prototype)` → **true** (inherits `then`, passes
  `instanceof`) despite carrying no `[[PromiseState]]`; admitted by design, pinned to mark
  the structurally-unsealable graft (decision #052).

Throw-safety against a throwing accessor `then`, descriptor-trap, or prototype-trap is the
universal invariant (see the Module contract's _Throw-safety_ paragraph) and is proven by
the axis-3 `hostile × predicate` matrix in the test suite. The former per-input vectors
`isThenable/B4`–`B6` are **withdrawn**, subsumed by that matrix — no behavior changed.

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

**Refuses to claim** (prose — semantic scope, asserts nothing)

`isPromiseLike` makes no `Promise` _identity_ claim — any value satisfying the
three-method contract is admitted, with no `[[Class]]` tag or constructor-name check (that
is `isPromise`'s job) — and it does not probe the `[[PromiseState]]` slot or adoption
protocol. Like `isThenable`, it admits the `Object.create(Promise.prototype)` graft on
contract. Throw-safety is the universal invariant (axis-3 matrix).

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

`isPromise(value?: unknown): value is Promise<unknown>` — strict identity to the concrete
`Promise` intrinsic, so intentionally **non-generic** (decision #062), unlike the
subclass-admitting `isThenable` / `isPromiseLike`. Composition: after the `!!value` guard
the prototype is resolved ONCE via the throw-safe `getInertPrototypeOf(value)` (decision
#059 threading) and that single read is threaded into both dispatch arms —
`isCurrentRealmPromiseInstance(value) ? prototype === promisePrototype && doesNotShadowPromiseContract(value) : isStructuralPromiseEquivalent(value, prototype)`
— where the local-realm arm now ANDs the `#063` own-surface integrity gate onto its
proto-identity check (reject an own-level contract override), and the cross-realm arm
`isStructuralPromiseEquivalent` expands to the value-side identity signal
(`hasPromiseIdentitySignal`) + the method contract (`doesImplementPromiseContract`) +
prototype-equivalence (`isStructuralPromisePrototypeEquivalent` — the fourth marker,
prototype/constructor reciprocal identity). Spec basis: `Promise` identity — two-axis
dispatch (decisions #023, #050, #054).

**Admits**

- `isPromise/A1` — `Promise.resolve()` → true — local-realm arm: `instanceof` +
  proto-identity.
- `isPromise/A2` — `new Promise(() => {})` → true — same.
- `isPromise/A3` — a cross-realm _direct_ `Promise` (fixture) → true — cross-realm arm:
  tag `'[object Promise]'` + constructor-name `'Promise'` + contract.
- `isPromise/A4` — a LOCAL `Object.create(Promise.prototype)` graft carrying only a
  spoofed own `Symbol.toStringTag` → true — the local identity arm is tag-blind
  (`instanceof` + proto-identity), and the cosmetic tag is symbol-keyed so the `#063`
  own-shadow gate does not see it. The realm-asymmetry admit (see the subsection below);
  its foreign counterpart rejects.

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
- `isPromise/R8` — an own-`then`-shadow graft
  (`Object.assign(Object.create(Promise.prototype), { then() {} })`) → false, **demoted**.
  Passes `instanceof` + proto-identity, but the OWN `then` overrides the inherited
  contract — an instance-level subclass layer, rejected by `doesNotShadowPromiseContract`
  (#063). The demotion LANDS: `isPromiseLike` and `isThenable` still admit the same
  instance (asserted together in `adversarial.test.js`). The #028 subclass rejection
  applied to the own layer.
- `isPromise/R9` — an own-`constructor`-shadow graft
  (`Object.assign(Object.create(Promise.prototype), { constructor })`) → false,
  **demoted** — same gate, the `constructor` back-reference is in the denylist.
  `isPromiseLike` / `isThenable` still admit the same instance.
- (plus all cross-cutting vectors)

**Refuses to claim** (prose — semantic scope, asserts nothing)

`isPromise` deliberately rejects both local- and cross-realm `Promise` _subclasses_ (a
documented strictness — see `isPromise/R1`-`R2`; consumers needing subclasses compose a
constructor-chain walk on top), and it does not probe the `[[PromiseState]]` slot.

Two structural limits are named but unclosable (shape-not-liveness, extending decision
#052): a `Proxy` lying `getPrototypeOf → Promise.prototype` passes the local-realm arm,
and a foreign `Promise` subclass whose constructor `.name` is forced to `'Promise'` passes
the cross-realm arm. A fully committed proxy/rename cannot be beaten structurally.

**Boundary (axis 3):**

- `isPromise/B2` — the BARE `Object.create(Promise.prototype)` → **true**. Known admission
  (decision #052): passes the local-realm arm (`instanceof` + proto-identity) despite
  carrying no Promise internal state. `Promise` is **structurally unsealable** — it
  exposes no inert internal-slot accessor (its only `[[PromiseState]]` readers, `then` /
  `catch` / `finally`, invoke `SpeciesConstructor` and allocate, so they cannot serve as
  an inspect-without-invoke probe the way boxed primitives use `valueOf`). Structural
  detection verifies _shape, not liveness_; the graft throws on first real use. A
  host-backed tier is deferred to Q.005. The `#063` own-shadow gate leaves B2 standing —
  the bare graft owns nothing to shadow (`dNSP/A2` → true); it closes only the own-level
  override (`R8`/`R9`), not the hollow graft. Orthogonal own state (`{ id }`, not a
  reserved name) likewise stays admitted — the gate is a scalpel, not a blanket.

Throw-safety against a throwing `Symbol.toStringTag` getter and a descriptor-trap on the
value's (or its pivoted `[[Prototype]]`'s) reads is the universal invariant: the
cross-realm arm routes the tag read through `getTypeSignature` and the constructor-walk
through `getInertDescriptor` (decision #056), so the by-contract predicates (`isThenable`,
`isPromiseLike`) still admit a throwing-tag value while `isPromise` rejects it. The former
per-input vectors `isPromise/B3` and `isPromise/B5` are **withdrawn**, subsumed by the
axis-3 `hostile × predicate` matrix — no behavior changed.

**Spoof-resistance expectation (axis 3):** the four cross-realm markers are independent
and each closes a distinct false-positive class — `doesImplementPromiseContract` rejects
tag/ctor-name claimants lacking the methods; the `[[Class]]` tag rejects
contract-satisfiers tagged otherwise; the constructor-name closes the `Symbol.toStringTag`
spoof hole the tag alone leaves open (`isPromise/R3`); and the prototype/constructor
reciprocal-identity marker (`isStructuralPromisePrototypeEquivalent`, decision #054)
rejects a value whose own markers are forged but whose prototype's own constructor
disagrees with the value's resolved constructor. The one _unclosed_ surface is the BARE
prototype-graft (`isPromise/B2`, #052); an own-level contract/`constructor` override on
that graft is now closed by the `#063` own-shadow gate (`isPromise/R8`,`R9`).

**Composition note (axis 4):** two-axis ternary over `isCurrentRealmPromiseInstance`; the
local-realm arm compares the once-resolved `getInertPrototypeOf` (`@/utility`) read
against the realm-fixed `promisePrototype` capture; the cross-realm arm is
`isStructuralPromiseEquivalent`, composing `hasPromiseIdentitySignal` (tag via
`getTypeSignature`, name threaded in by the caller), `doesImplementPromiseContract`, and
`isStructuralPromisePrototypeEquivalent` — each structural helper resolving its object's
constructor ONCE via `getDefinedConstructor` and reusing it for both the name (via
`getVerifiedOwnName`) and the reciprocal-identity compare, the prototype leg under
`{ assumePrototype: true }`, plus `getInertPrototypeOf` (all `@/utility`). Decisions #054,
#059.

**Policy flags:** `isPromise/R1`-`R2` encode the _current shipped_ subclass-rejection
behavior; if a subclass-admission policy is ever adopted these vectors invert.

### Realm asymmetry on tampered inputs (deliberate)

The two arms weigh evidence differently, so for a TAMPERED input they can disagree by
realm. The local-realm arm is identity-based (`instanceof` + proto-identity + the
string-keyed own-shadow gate) and blind to a cosmetic `Symbol.toStringTag`: a LOCAL graft
carrying only a spoofed tag is admitted (`isPromise/A4` → true), because it genuinely
carries `Promise.prototype` and the tag is a symbol key the gate does not read. The
cross-realm arm, lacking a local prototype to match, reads the tag via `getTypeSignature`,
so the SAME shape from a foreign realm rejects (`false`). Decision #063 reconciled the
**behavioral** half of this asymmetry — own-level method / `constructor` shadowing is now
rejected in BOTH realms (locally by the gate, cross-realm by the structural contract) —
while the **cosmetic** tag half stays local-admit / cross-realm-reject by design, the
residual #063 leaves standing (parallel to `OBJECT.spec.md` and `EVENTED.spec.md`).

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

The short-circuit order (`then` → `catch` → `finally`) is a cost optimization, not
observable behavior (refuses-to-claim prose; the former `dMPC/B1` ID is withdrawn).
Throw-safety follows from `hasInertMethod` and is covered by the axis-3 matrix.

### `hasPromiseIdentitySignal(value?, name?)` — `@internal`

The two string-shape identity markers, independent of the method contract.
`name === 'Promise' && getTypeSignature(value) === '[object Promise]'`. The `name` is the
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
by the caller (`isPromise` passes its already-read `getInertPrototypeOf(value)`) or
resolved internally via the same throw-safe reader. These vectors are the white-box
counterparts of the public `isPromise` cross-realm vectors.

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

### `doesNotShadowPromiseContract(value)` — `@internal` (the #063 own-surface integrity gate)

`!getOwnPropertyNames(value).some(isValueOfBoundSet, disallowedPromiseContractShadowKeys)`,
wrapped `try/catch → false`. The denylist is the string-keyed set
`{ constructor, then, catch, finally }` — the `constructor` back-reference plus the
`Promise.prototype` method contract (ECMA-262 §27.2); a genuine direct `Promise` inherits
all four and owns none. `Symbol.toStringTag` is deliberately excluded (symbol key,
invisible to `getOwnPropertyNames`; cosmetic once proto-identity holds). ANDed onto
`isPromise`'s local fast-path so an own-level override demotes `is`→`Like` (decision
#063); it does NOT seal the bare graft (decision #052).

- `dNSP/A1` — a genuine `Promise` (`Promise.resolve()`, a subclass instance) → true (owns
  none of its contract — state in internal slots; the no-false-negative guarantee).
- `dNSP/A2` — the bare `Object.create(Promise.prototype)` graft → true (owns nothing to
  shadow — this is why `isPromise/B2` stays admitted).
- `dNSP/A3` — a graft carrying orthogonal own state (`{ id }`) → true (scalpel over
  reserved names, not a blanket own-property ban).
- `dNSP/R1` — an own `then` shadowing the inherited method → false.
- `dNSP/R2` — an own `constructor` shadowing the back-reference → false.
- `dNSP/B1` — a hostile `ownKeys` trap that throws → false, **not thrown** (fail-closed: a
  clean own surface cannot be confirmed → treat as shadowed). The helper-level
  throw-safety boundary; also pinned through the public `isPromise` by the axis-3
  `ownKeysTrapAtOwnShadowGate` matrix row.

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
6. **Re-validation pass (2026-06-29) — clean throw-safety model + rename-drift fix.** The
   module was re-validated under the two-round playbook and adopted the package-wide clean
   model (see `docs/spec/README.md` → "Throw-safety — the universal invariant"). Three
   changes, **no public admit/reject verdict altered**:
   - **Throw-safety promoted to a universal invariant**, stated once in the Module
     contract and proven by an axis-3 `hostile × predicate` matrix in the test suite. The
     former per-input predicate throw-safety vectors `isThenable/B4`–`B6` and
     `isPromise/B3`/`B5` are **withdrawn** (IDs retired, behavior unchanged); the
     refuses-to-claim notes (`isThenable/B1`-`B2`, `isPromiseLike/B1`-`B2`,
     `isPromise/B1`, the unclosable-spoof `isPromise/B4`, `dMPC/B1`) are demoted to
     **prose**. The testable-boundary grafts (`isThenable/B3`, `isPromise/B2`) and the
     helper-unit vectors (`hPIS/B1`, `iCRPI/B1`) keep their IDs. The dangling
     `isThenable/B7` reference is resolved (folded into the invariant).
   - **Rename drift fixed.** The 2026-06-29 `getInertPrototypeOf` rename had left
     `getPrototypeOf` stragglers in `isPromise`'s composition formula and
     Composition/helper notes; the spec now mirrors the threaded `getInertPrototypeOf`
     code.
   - **Coverage gap closed.** `isPromise/A2` (`new Promise(() => {})`) gained its missing
     matrix row; the axis-3 throw-safety matrix filled the previously-empty
     `isPromiseLike`/`isPromise` × accessor-throw and `isPromise` × descriptor-trap cells.

7. **Evented/object-round parity back-port (impl change, 2026-07-02) — RESOLVED.** A
   conformance audit of `thenable` (the oldest test-covered module) against the standards
   the `evented` and `object` rounds aggregated (ADRs #052–#063) found it conforming on
   the mechanical conventions (#059 threading, #053 seam-export — thenable is the
   precedent, throw-safety invariant + matrix, six-file suite, frozen-spec discipline) but
   with three real gaps, now closed. **Unlike the object round, this one DOES change a
   public verdict** (a hardening): a tampered `Promise.prototype` graft that was admitted
   is now rejected.
   - **#063 own-shadow gate on `isPromise`.** A new `@internal`
     `doesNotShadowPromiseContract` (denylist `{ constructor, then, catch, finally }`,
     string-keyed own-name membership via `isValueOfBoundSet`, `try/catch → false`) is
     ANDed onto the local fast-path:
     `prototype === promisePrototype && doesNotShadowPromiseContract(value)`. An own-level
     override of a contract method or the `constructor` demotes `is`→`Like`
     (`isPromise/R8`, `R9`) — the #028 subclass rejection applied to the own layer,
     exactly parallel to evented's `isEventTarget/R5,R6`. The BARE graft (`isPromise/B2`)
     stays admitted: `Promise` is unsealable (#052), and the gate is strictly weaker than
     a slot-seal (it catches the override, not the hollow graft). Verified: a genuine
     `Promise` owns ZERO denylist keys (`dNSP/A1`) — no false-negatives. Surface 5→6
     helpers (parallel `.d.ts`).
   - **#062 non-generic strict predicate.** `isPromise` dropped its `<T=unknown>` generic
     (it narrows to one intrinsic, `Promise`); `isThenable` / `isPromiseLike` keep theirs
     (subtype-spectrum). Signature is now
     `isPromise(value?: unknown): value is Promise<unknown>`.
   - **Realm-asymmetry formalized + doc cross-references.** A tag-tampered local graft is
     admitted (`isPromise/A4`) while its foreign counterpart rejects — formalized in a new
     subsection tying the split to #063 (behavioral half reconciled, cosmetic-tag half the
     residual), parallel to object/evented. The `isPromise` docs, previously silent on the
     decisions they were subject to, now cite #052 (bare graft), #062 (non-generic), and
     #063 (own-shadow).

   Decision-aligned with #063 (which line 89 explicitly forecasts the `isPromise`
   generalization) + #052 + #062 — no new ADR. Verified: 121 tests / 5 files green,
   typecheck clean.
