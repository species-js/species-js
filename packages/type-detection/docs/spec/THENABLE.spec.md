# thenable — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`thenable.d.ts`, `thenable.js`,
> `architecture/thenable.md`, decisions #021–#024, #036, #037). Status: **FROZEN
> 2026-06-18** — decidability check passed (local-realm vectors run against the real
> predicates through the `@/index.js` barrel). This spec is the base for the axis-1 suite;
> axes 2–4 derive alongside.

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

- `doesMatchPromiseContract(value?)` — declared in both `.js` and `.d.ts`.
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

`doesMatchPromiseContract` has no `!!value` guard of its own; it inherits nullish-safety
from `hasInertMethod` (which returns `false` for nullish input).

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
  UTILITY.spec.md `hIM/R6` + Resolved items #2). Residual: a Proxy with a throwing
  `getPrototypeOf` trap still throws via the `instanceof` arm
  (`isCurrentRealmPromiseInstance`) — separate surface, follow-up decision.

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
`!!value && (isCurrentRealmPromiseInstance(value) || doesMatchPromiseContract(value))`
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
`doesMatchPromiseContract`. Subclass-admitting because the `instanceof` arm carries no
proto-identity narrowing.

---

## `isPromise`

`isPromise<T = unknown>(value?: T): value is T & Promise<unknown>` Composition:
`!!value && (isCurrentRealmPromiseInstance(value) ? getPrototypeOf(value) === promisePrototype : getTypeSignature(value) === '[object Promise]' && getDefinedConstructorName(value) === 'Promise' && doesMatchPromiseContract(value))`
Spec basis: `Promise` identity — two-axis dispatch (decisions #023, #050).

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

**Cross-realm expectation (axis 2):** admit foreign-realm _direct_ `Promise` instances
(cross-realm arm); reject foreign-realm subclasses (constructor-name) — symmetric with the
local-realm subclass rejection.

**Spoof-resistance expectation (axis 3):** the three cross-realm markers are independent
and each closes a distinct false-positive class — `doesMatchPromiseContract` rejects
tag/ctor-name claimants lacking the methods; the `[[Class]]` tag rejects
contract-satisfiers tagged otherwise; the constructor-name closes the `Symbol.toStringTag`
spoof hole the tag alone leaves open (`isPromise/R3`). The one _unclosed_ surface is the
prototype-graft (`isPromise/B2`).

**Composition note (axis 4):** two-axis ternary over `isCurrentRealmPromiseInstance`; the
local-realm arm uses `getPrototypeOf` (`@/config`) and the realm-fixed `promisePrototype`
capture; the cross-realm arm uses `getTypeSignature` + `getDefinedConstructorName`
(`@/utility`)

- `doesMatchPromiseContract`.

**Policy flags:** `isPromise/R1`-`R2` encode the _current shipped_ subclass-rejection
behavior; if a subclass-admission policy is ever adopted these vectors invert.

---

## Helper specification (axis 4)

### `doesMatchPromiseContract(value?)` — `@internal`

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

All items surfaced while drafting this spec have been resolved; none remain open.

1. **`isCurrentRealmPromiseInstance` typed-surface asymmetry.** Was exported from
   `thenable.js` with `@internal` but undeclared in `thenable.d.ts`. **Resolution:**
   exporting an internal helper for the helper-unit axis obligates a parallel exported
   type declaration, even though `@internal` keeps it out of the built package's public
   surface. The `.d.ts` declaration was added (mirroring `doesMatchPromiseContract`); a
   package-wide scan confirmed it was the only `.js`-export missing from its `.d.ts`
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
