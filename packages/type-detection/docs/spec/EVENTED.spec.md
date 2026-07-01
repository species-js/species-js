# evented — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`evented.d.ts`, `evented.js`,
> `architecture/evented.md`, decisions #027–#030, #036, #050, #053). Status: **FROZEN
> 2026-06-18** — decidability check passed (8 suites over all 4 public predicates + the 4
> exported helpers, run against the real implementations through the `@/index.js` barrel,
> single realm; no spec corrections needed). Base for the axis-1 suite; axes 2–4 derive
> alongside.
>
> **Post-freeze amendment 2026-07-01 (decisions #060–#062):** the strict tiers were lifted
> to cross-realm prototype-equivalence and the two tiers decomposed. The behavioral
> public-vector tables below stay frozen — the genuine-instance admits still hold, and the
> strict tiers only got stricter on un-enumerated spoofs — while the composition strings,
> helper mechanics, and axis-4 helper inventory are amended in place, and the new
> strict-arm helpers + stricter-reject vectors are appended. See the "Post-freeze
> amendment" Resolved item.

## Module contract

`type-detection / evented` discriminates the Web Platform's two event-handling contracts —
`EventTarget` and `AbortSignal` — as two parallel two-tier lattices, each with a
structural ("Like") tier and a realm-fixed identity tier:

```
EventTargetLike   (isEventTargetLike)   — the three EventTarget methods
  └── EventTarget  (isEventTarget)       — EventTarget identity via two-axis dispatch

AbortSignalLike   (isAbortSignalLike)   — EventTargetLike + `aborted` + `throwIfAborted`
  └── AbortSignal  (isAbortSignal)       — AbortSignal identity via two-axis dispatch
```

`AbortSignalLike extends EventTargetLike` (every abort-signal is an event-target). The
shape mirrors the thenable lattice exactly: the Like tier admits any value matching the
spec method set (duck-typing); the identity tier admits only the realm-fixed intrinsic via
a two-axis ternary (local-realm `instanceof` + proto-identity, OR a cross-realm arm
proving structural prototype-equivalence — a `[[Class]]` tag + constructor-name signal
gate followed by an own-descriptor prototype contract). Decisions #050 (two-axis
dispatch), #054 / #061 (cross-realm prototype-equivalence lift + strict/Like
decomposition), #060 (`INSTANCE_LESS_CONSTRUCTOR` sentinel), #062 (strict predicates drop
the generic), #028 (subclass rejection), #029 (the `aborted` accessor exception), #030
(`AbortSignalLike` minimum surface).

### Throw-safety (the universal invariant)

Every predicate answers a boolean on **every** input, including hostile ones, and never
propagates a throw: `isEventTargetLike` / `isEventTarget` / `isAbortSignalLike` /
`isAbortSignal` return their honest verdict on any throw on any path, and every
`@internal` helper returns its sentinel (`false` for the boolean probes) so the composing
predicate collapses to `false`. The hostile-input classes this module's reads are exposed
to, and the throw-safe reader each routes through:

- **prototype-trap** (a `Proxy` whose `getPrototypeOf` throws) → the `try/catch` in
  `isCurrentRealm{EventTarget,AbortSignal}Instance` (the `instanceof` walk, #060) and the
  strict-tier `getInertPrototypeOf`;
- **descriptor-trap** (a `Proxy` whose `getOwnPropertyDescriptor` throws — on a pivoted
  `[[Prototype]]` or a hostile `constructor`) → `getInertDescriptor`,
  `getDefinedConstructor`, `getVerifiedOwnName`, and `isClass` (each throw-safe at its own
  read), plus the `hasInertMethod` chain-walk of the Like-tier contract;
- **ownKeys-trap** (a `Proxy` whose `ownKeys` throws) → the `try/catch`-wrapped
  `getOwnPropertyDescriptors` inside
  `doesImplement{EventTarget,AbortSignal}PrototypeContract`;
- **aborted-getter-throw** (a throwing `aborted` accessor) → the `try/catch` in
  `doesImplementAbortSignalContract` and `doesImplementAbortSignalPrototypeContract` (the
  spec-defined direct read, #029).

One honest-by-contract asymmetry follows, not a leak. A **userland EventTarget whose
`aborted` getter throws** is admitted by `isEventTargetLike` (`true` — the EventTarget
contract never reads `aborted`) while the AbortSignal tier rejects it (`false` — its
`try/catch` collapses the throwing read). The invariant is "never throw", not "always
false"; the Like-tier verdict is honest.

The exhaustive `hostile-class × predicate` proof lives in the test suite (axis 3), not
here — see [`./README.md`](./README.md) → "Throw-safety — the universal invariant". The
member-surface `ownKeys`-trap is a **helper-level** boundary (`dIETPC/R2`, `dIASPC/R4`),
kept as axis-4 vectors.

## Surface inventory

**Public predicates (axis 1):** `isEventTargetLike`, `isEventTarget`, `isAbortSignalLike`,
`isAbortSignal`.

**Exported `@internal` helpers (axis 4):** twelve, six per family.

- realm-membership — `isCurrentRealmEventTargetInstance`,
  `isCurrentRealmAbortSignalInstance` (exported for single-realm testability per decision
  #053; see Resolved items).
- Like-tier contracts — `doesImplementEventTargetContract`,
  `doesImplementAbortSignalContract` (duck-typed, prototype-chain-walking).
- strict-tier signal gates — `hasEventTargetIdentitySignal`,
  `hasAbortSignalIdentitySignal` (tag + threaded constructor-name).
- strict-tier prototype contracts — `doesImplementEventTargetPrototypeContract`,
  `doesImplementAbortSignalPrototypeContract` (own-descriptor surface of the realm
  prototype).
- strict-tier prototype-equivalence — `isEventTargetPrototypeEquivalent`,
  `isAbortSignalPrototypeEquivalent` (the four-marker identity chain).
- strict-tier cross-realm arms — `isAlienRealmEventTarget`, `isAlienRealmAbortSignal`
  (signal gate + prototype-equivalence, constructor resolved once and threaded, #059).

**Exported types without a predicate:** `EventTargetLike`, `AbortSignalLike` (locally
defined, decision #027). The narrow targets `EventTarget` / `AbortSignal` are the
`lib.dom.d.ts` globals, not defined here.

Re-confirmation gate: 16 `.js` exports = 16 `.d.ts` declarations, no surface gap.

**Test-environment note:** the decidability run executes in Node (vitest). `EventTarget`,
`AbortController`, `AbortSignal`, `AbortSignal.timeout()`, `AbortSignal.any()` are all
present (Node ≥ 15). DOM subclasses (`document`, `Element`, `Window`, `XMLHttpRequest`)
are NOT — subclass vectors use a synthetic `class extends EventTarget {}`; DOM types are
cited as the real-world instances axis 2 (cross-realm/browser) will cover. `AbortSignal`
is not `new`-able (`new AbortSignal()` throws), so an `AbortSignal` _subclass_ is not
readily constructible — its subclass-rejection is theoretical, noted where relevant.

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted → rejected by all four public predicates
  (leading `!!value` / `!!prototype`). The `doesImplementXContract` helpers document a
  "truthy assumed by the caller" contract, but their impl still rejects nullish (via
  `hasInertMethod`'s parameter-default-to-`null` gate) — pinned below as defense-in-depth
  beyond the documented contract.
- **CC/empty** — `{}` → rejected everywhere (no method contract).

---

## `isEventTargetLike`

`isEventTargetLike<T = unknown>(value?: T): value is T & EventTargetLike` Composition:
`!!value && (isCurrentRealmEventTargetInstance(value) || doesImplementEventTargetContract(value))`
Spec basis: DOM WHATWG `EventTarget` — `dispatchEvent` + `addEventListener` +
`removeEventListener`.

**Admits**

- `isEventTargetLike/A1` — `new EventTarget()` → true (instanceof arm).
- `isEventTargetLike/A2` — a subclass instance `new (class extends EventTarget {})()` →
  true (instanceof admits subclasses; real-world: `document`, `Element`, `Window`,
  `XMLHttpRequest`).
- `isEventTargetLike/A3` —
  `{ dispatchEvent() {}, addEventListener() {}, removeEventListener() {} }` → true
  (structural).
- `isEventTargetLike/A4` — `new AbortController().signal` → true (an `AbortSignal` is an
  `EventTarget`).
- `isEventTargetLike/A5` — a cross-realm `EventTarget` (fixture) → true (structural
  fallback).

**Rejects**

- `isEventTargetLike/R1` — `{ dispatchEvent() {}, addEventListener() {} }` (missing
  `removeEventListener`) → false.
- `isEventTargetLike/R2` —
  `{ dispatchEvent() {}, addEventListener() {}, get removeEventListener() { return () => {}; } }`
  → false (accessor rejected).
- `isEventTargetLike/R3` — `{}` → false; (plus CC/nullish).

**Refuses to claim**

- `isEventTargetLike/B1` — `EventTarget` _identity_: any value with the three callable
  methods is admitted; no tag/ctor-name check (that is `isEventTarget`'s job).

**Cross-realm (axis 2):** admit foreign-realm `EventTarget` + subclasses (structural arm).
**Spoof (axis 3):** accessor traps on any of the three methods rejected; no identity to
spoof — contract admits a userland 3-method object. **Composition note (axis 4):** drives
`isCurrentRealmEventTargetInstance` + `doesImplementEventTargetContract`.
Subclass-admitting (bare `instanceof`, no proto-identity).

---

## `isEventTarget`

`isEventTarget(value?: unknown): value is EventTarget` (non-generic, #062) Composition:
`const proto = getInertPrototypeOf(value); !!proto && (isCurrentRealmEventTargetInstance(value) ? proto === eventTargetPrototype : EventTargetConstructor !== INSTANCE_LESS_CONSTRUCTOR && isAlienRealmEventTarget(value, proto))`
Spec basis: `EventTarget` identity — two-axis dispatch (#050) lifted to cross-realm
prototype-equivalence (#054 / #061), subclass rejection (#028).

**Admits**

- `isEventTarget/A1` — `new EventTarget()` → true (local arm: instanceof +
  proto-identity).
- `isEventTarget/A2` — a cross-realm _direct_ `EventTarget` (fixture) → true (cross-realm
  arm: tag `'[object EventTarget]'` + ctor-name `'EventTarget'` + contract).
- `isEventTarget/A3` — a LOCAL object grafted onto the real prototype,
  `Object.create(EventTarget.prototype)` (bare, or carrying a tampered
  `Symbol.toStringTag`) → true (the local arm is prototype-identity: the value genuinely
  has `eventTargetPrototype`, so provenance and surface markers are not read). See "Realm
  asymmetry on tampered inputs".

**Rejects**

- `isEventTarget/R1` — a subclass instance `new (class extends EventTarget {})()` → false
  (passes instanceof, fails proto-identity; real-world: `document`/`Element`/`Window`).
- `isEventTarget/R2` — tag-spoof `{ [Symbol.toStringTag]: 'EventTarget' }` → false (not
  instanceof; the cross-realm signal gate fails — the resolved constructor-name is
  `Object`, not `EventTarget`).
- `isEventTarget/R3` — a userland 3-method object (`isEventTargetLike/A3`) → false (not
  instanceof; `[[Class]]` tag is `'[object Object]'`).
- `isEventTarget/R4` — `new AbortController().signal` → false (an `AbortSignal`, not a
  direct `EventTarget` — proto-identity is `AbortSignal.prototype`). (plus CC/nullish.)

**Refuses to claim**

- `isEventTarget/B1` — _subclass admission_: deliberately rejects local- and cross-realm
  subclasses (consumers needing subclasses use `isEventTargetLike`).

**Cross-realm (axis 2):** admit foreign-realm direct `EventTarget`; reject foreign
subclasses (constructor-name signal gate + prototype round-trip). **Spoof (axis 3):** the
cross-realm arm proves structural prototype-equivalence — the tag + constructor-name
signal gate rejects tag/name claimants, and `isEventTargetPrototypeEquivalent`
(constructor is-a-class, prototype tag, `constructor.prototype === prototype` round-trip,
own-descriptor method contract) rejects a plain object carrying the right tag + name +
method-names but not the real prototype shape (decision #061). **Composition note (axis
4):** prototype resolved once via `getInertPrototypeOf` and threaded (#059); two-axis
ternary over `isCurrentRealmEventTargetInstance`; local arm
`prototype === eventTargetPrototype`; cross-realm arm `isAlienRealmEventTarget` guarded by
`EventTargetConstructor !== INSTANCE_LESS_CONSTRUCTOR`.

### Realm asymmetry on tampered inputs (deliberate)

`isEventTarget` answers via two arms that weigh evidence differently, and for a
**tampered** input they can disagree _by realm_:

- **Local-realm arm** — `prototype === eventTargetPrototype`, pure identity. It is **blind
  to surface tampering and to provenance**: a LOCAL object grafted onto the real
  `EventTarget.prototype` — `Object.create(EventTarget.prototype)`, even carrying a
  spoofed or throwing `Symbol.toStringTag` — is admitted (`true`, `isEventTarget/A3`),
  because identity is decisive: the value genuinely has the real `eventTargetPrototype`.
  (It never ran the `EventTarget` constructor, so it has no internal slots and its
  inherited `dispatchEvent` throws when actually called — but that is a functional
  concern, not a type-identity one; provenance / brand detection is deliberately out of
  scope, #050.)
- **Cross-realm arm** — `hasEventTargetIdentitySignal` +
  `isEventTargetPrototypeEquivalent`, structural. Lacking a local `eventTargetPrototype`
  to match on, it has **only** surface markers to go on, so the same tag tampering
  (spoofed tag → tag mismatch; throwing tag → throw-safe `getTypeSignature` yields a
  non-matching signature) makes it **reject** (`false`).

So the _same_ tag-tampered graft can read `true` locally and `false` cross-realm. This is
**inherent to having a fast identity path at all**, and the local answer is the
more-correct one (identity outranks a cosmetic marker). It is **not** a defect and is
**not** reconciled: forcing the local fast-path to also read the tag would cost its
O(1)-identity nature and would wrongly reject a genuine local instance. **Every
_legitimate_ (untampered, genuinely-constructed) instance agrees across realms** (`true`);
the divergence appears _only_ under tampering. `isAbortSignal` behaves identically (a
graft onto `abortSignalPrototype`). Pinned in `adversarial.test.js` (local bare /
spoofed-tag / throwing-tag grafts → `true`; the foreign spoofed-tag counterpart →
`false`), consistent with the `isPlainObject` ruling from the object round.

---

## `isAbortSignalLike`

`isAbortSignalLike<T = unknown>(value?: T): value is T & AbortSignalLike` Composition:
`!!value && (isCurrentRealmAbortSignalInstance(value) || doesImplementAbortSignalContract(value))`
Spec basis: DOM WHATWG `AbortSignal` minimum surface — `EventTargetLike` + boolean
`aborted` + callable `throwIfAborted` (#030).

**Admits**

- `isAbortSignalLike/A1` — `new AbortController().signal` → true (instanceof arm).
- `isAbortSignalLike/A2` — `AbortSignal.timeout(1000)` and `AbortSignal.any([])` → true
  (instanceof arm).
- `isAbortSignalLike/A3` —
  `{ dispatchEvent(){}, addEventListener(){}, removeEventListener(){}, aborted: false, throwIfAborted(){} }`
  → true (structural).
- `isAbortSignalLike/A4` — a cross-realm `AbortSignal` (fixture) → true (structural
  fallback).

**Rejects**

- `isAbortSignalLike/R1` — `new EventTarget()` → false (no abort surface — `aborted` /
  `throwIfAborted` missing).
- `isAbortSignalLike/R2` — `{ aborted: false, throwIfAborted() {} }` (no EventTarget
  methods) → false.
- `isAbortSignalLike/R3` —
  `{ …EventTarget methods…, aborted: 'yes', throwIfAborted() {} }` → false (`aborted` not
  a boolean).
- `isAbortSignalLike/R4` —
  `{ …EventTarget+abort surface…, get aborted() { throw new Error(); } }` → false
  (throwing getter → `try/catch` → false). (plus CC/nullish.)

**Refuses to claim**

- `isAbortSignalLike/B1` — `AbortSignal` _identity_: any value matching the contract is
  admitted; no tag/ctor-name check.

**Cross-realm (axis 2):** admit foreign-realm `AbortSignal` (structural). **Spoof (axis
3):** the `aborted` getter is read directly (spec-defined accessor, #029) but wrapped in
`try/catch` (throwing getter → false); accessor trap on `throwIfAborted` rejected via
`hasInertMethod`. **Composition note (axis 4):** drives
`isCurrentRealmAbortSignalInstance` + `doesImplementAbortSignalContract`.
Subclass-admitting.

---

## `isAbortSignal`

`isAbortSignal(value?: unknown): value is AbortSignal` (non-generic, #062) Composition:
`const proto = getInertPrototypeOf(value); !!proto && (isCurrentRealmAbortSignalInstance(value) ? proto === abortSignalPrototype : AbortSignalConstructor !== INSTANCE_LESS_CONSTRUCTOR && isAlienRealmAbortSignal(value, proto))`
Spec basis: `AbortSignal` identity — two-axis dispatch (#050) lifted to cross-realm
prototype-equivalence (#054 / #061), subclass rejection (#028).

**Admits**

- `isAbortSignal/A1` — `new AbortController().signal` → true (local arm: instanceof +
  proto-identity).
- `isAbortSignal/A2` — `AbortSignal.timeout(1000)` and `AbortSignal.any([])` → true (both
  are direct `AbortSignal` instances; proto-identity holds).
- `isAbortSignal/A3` — a cross-realm _direct_ `AbortSignal` (fixture) → true (cross-realm
  arm).

**Rejects**

- `isAbortSignal/R1` — `new EventTarget()` → false (not an `AbortSignal`; no abort
  surface).
- `isAbortSignal/R2` — tag-spoof `{ [Symbol.toStringTag]: 'AbortSignal' }` → false (not
  instanceof; the cross-realm signal gate fails — the resolved constructor-name is
  `Object`, not `AbortSignal`).
- `isAbortSignal/R3` — an `AbortSignalLike` userland object (`isAbortSignalLike/A3`) →
  false (not instanceof; tag is `'[object Object]'`).
- `isAbortSignal/R4` — `new AbortController()` (the controller, not its `.signal`) →
  false. (plus CC/nullish.)

**Refuses to claim**

- `isAbortSignal/B1` — _subclass admission_: rejects subclasses (theoretical —
  `AbortSignal` is not `new`-able, so a subclass is not readily constructible; the
  proto-identity / ctor-name gates would reject one).

**Cross-realm (axis 2):** admit foreign-realm direct `AbortSignal`. **Spoof (axis 3):** as
`isEventTarget`, the cross-realm arm proves structural prototype-equivalence via
`isAbortSignalPrototypeEquivalent` — additionally invoking the prototype's `aborted`
getter with the real receiver (`try/catch`-guarded, #029) and requiring the
readonly-accessor shape (getter, no setter) the Like tier does not. **Composition note
(axis 4):** prototype resolved once via `getInertPrototypeOf` and threaded (#059);
two-axis ternary over `isCurrentRealmAbortSignalInstance`; cross-realm arm
`isAlienRealmAbortSignal` guarded by
`AbortSignalConstructor !== INSTANCE_LESS_CONSTRUCTOR`.

---

## Helper specification (axis 4)

### `doesImplementEventTargetContract(value)` — `@internal`

`hasInertMethod(v, 'dispatchEvent') && hasInertMethod(v, 'addEventListener') && hasInertMethod(v, 'removeEventListener')`.
Purely structural (prototype-chain-walking); no `instanceof`. Documents "truthy assumed by
the caller"; still nullish-safe in impl (see `dIETC/R3`). Scoped to exactly these three
canonical WHATWG methods — the Observable-proposal `when()` is deliberately not required
(#028); a `when`-bearing value still passes (see `dIETC/A4`).

- `dIETC/A1` — `new EventTarget()` → true (methods inherited from prototype).
- `dIETC/A2` — a subclass instance / `new AbortController().signal` → true (inherited).
- `dIETC/A3` — `{ dispatchEvent(){}, addEventListener(){}, removeEventListener(){} }` →
  true (own).
- `dIETC/A4` — the three methods plus a `when()` method → true (`when` neither required
  nor rejected; the Observable-proposal addition is out of contract, #028).
- `dIETC/R1` — missing any of the three (`isEventTargetLike/R1`) → false (short-circuits).
- `dIETC/R2` — accessor on any of the three → false.
- `dIETC/R3` — `{}`, `null`, `undefined`, `42` → false (`hasInertMethod` nullish-safe).

### `doesImplementAbortSignalContract(value)` — `@internal`

`try { hasInertMethod(v, 'throwIfAborted') && isBooleanValue(v.aborted) && doesImplementEventTargetContract(v) } catch { false }`.
Order is load-bearing: the nullish-safe `throwIfAborted` gate first, then the direct
`aborted` read (accessor exception #029), then the EventTarget contract. Like-tier: reads
the `aborted` VALUE in any descriptor shape (a plain data boolean is admitted) — the
strict `doesImplementAbortSignalPrototypeContract` is the one that requires the accessor
shape.

- `dIASC/A1` — `new AbortController().signal`, `AbortSignal.timeout(1000)` → true.
- `dIASC/R1` — `new EventTarget()` → false (no `throwIfAborted` / `aborted`).
- `dIASC/R2` — `{ aborted: false, throwIfAborted(){} }` (no EventTarget methods) → false.
- `dIASC/R3` — `aborted` present but non-boolean → false.
- `dIASC/R4` — throwing `aborted` getter → false (`try/catch`).
- `dIASC/R5` — `{}`, `null` → false.

### `isCurrentRealmEventTargetInstance(value)` / `isCurrentRealmAbortSignalInstance(value)` — `@internal`

`try { value instanceof XConstructor } catch { false }`. Assumes a truthy receiver
(callers guard `!!value`). Subclass-admitting — no proto-identity (layered on by the
strict predicate's ternary). Throw-safe: a hostile right-hand side (patched
`Symbol.hasInstance`, a throwing prototype-walk) yields `false`, not a throw (#060).

- `iCRETI/A1` — `new EventTarget()` → true; a subclass instance → true
  (subclass-admitting).
- `iCRETI/A2` — `new AbortController().signal` → true (an `AbortSignal` IS an
  `EventTarget` instance).
- `iCRETI/R1` — a cross-realm `EventTarget` (fixture) → false (`instanceof` against the
  local capture).
- `iCRETI/R2` — `{}`, userland 3-method object → false.
- `iCRASI/A1` — `new AbortController().signal`, `AbortSignal.timeout(1000)` → true.
- `iCRASI/R1` — `new EventTarget()` → false (not an `AbortSignal`); a cross-realm
  `AbortSignal` → false.
- `iCRXI/B1` — when the runtime lacks the global `X`, `XConstructor` is the
  `INSTANCE_LESS_CONSTRUCTOR` sentinel, so `value instanceof XConstructor` is `false` for
  every input without throwing (#060; embedding-safety branch, a coverage-axis concern).

### `hasEventTargetIdentitySignal(value, name)` / `hasAbortSignalIdentitySignal(value, name)` — `@internal`

The inexpensive two-marker signal gate of the cross-realm arm:
`name === '<X>' && getTypeSignature(value) === '[object <X>]'`. `name` is the
caller-threaded, already-resolved constructor name; `value` is assumed an object. Pure, no
throw surface of its own.

- `hETIS/A1` — `(new EventTarget(), 'EventTarget')` → true.
- `hETIS/R1` — `(new EventTarget(), 'Object')` → false (name mismatch — the marker that
  rejects a tag-only spoof once the constructor-name resolves to `Object`).
- `hETIS/R2` — `({ [Symbol.toStringTag]: 'Nope' }, 'EventTarget')` → false (tag mismatch).
- `hASIS/A1` — `(new AbortController().signal, 'AbortSignal')` → true.
- `hASIS/R1` — `(new AbortController().signal, 'EventTarget')` → false (name mismatch).

### `doesImplementEventTargetPrototypeContract(prototype)` — `@internal`

`try { the three EventTarget methods are OWN callable data descriptors of prototype } catch { false }`.
Reads the prototype's OWN descriptors (not a chain-walk), because the strict tier admits
only direct instances whose `[[Prototype]]` IS the realm `EventTarget.prototype`. A
presence-check of exactly these three, not an exact member set — the Observable-proposal
`when()` is deliberately not required (#028), so a `when`-bearing prototype still passes.

- `dIETPC/A1` — `EventTarget.prototype` → true (the three methods are own callable data
  props).
- `dIETPC/A2` — a modern `EventTarget.prototype` that also carries `when()` → true (extra
  own members allowed; `when` neither required nor rejected, #028).
- `dIETPC/R1` — `Object.prototype` → false (no such methods).
- `dIETPC/R2` — a `Proxy` prototype whose `getOwnPropertyDescriptors` trap throws → false
  (throw-safe).

### `doesImplementAbortSignalPrototypeContract(prototype, value)` — `@internal`

`try { aborted is a getter (no setter, invoked as aborted.get.call(value) → boolean) && reason is a getter (no setter) && onabort is a get/set pair && throwIfAborted is a callable own data prop } catch { false }`.
The spec-faithful readonly-accessor shape (#029), with `value` threaded as the `aborted`
getter's receiver.

- `dIASPC/A1` — `(AbortSignal.prototype, new AbortController().signal)` → true.
- `dIASPC/R1` — `(EventTarget.prototype, new EventTarget())` → false (no
  `aborted`/`reason`/`onabort`).
- `dIASPC/R2` — a prototype whose `aborted` is a plain DATA boolean (no getter) → false —
  the strict-tier marker that rejects exactly what the Like tier admits.
- `dIASPC/R3` — `aborted` getter present but returns a non-boolean → false.
- `dIASPC/R4` — a throwing `aborted` getter or a hostile descriptor trap → false
  (throw-safe).

### `isEventTargetPrototypeEquivalent(prototype, constructor)` / `isAbortSignalPrototypeEquivalent(prototype, constructor, value)` — `@internal`

The four-marker identity chain:
`isClass(constructor) && getTypeSignature(prototype) === '[object <X>]' && getInertDescriptor(constructor, 'prototype')?.value === prototype && doesImplement<X>PrototypeContract(prototype[, value])`.
AbortSignal threads `value` as the `aborted`-getter receiver.

- `iETPE/A1` — `(EventTarget.prototype, EventTarget)` → true.
- `iETPE/R1` — `(EventTarget.prototype, function EventTarget() {})` → false (`constructor`
  is not a class — `isClass` fails).
- `iETPE/R2` — a grafted prototype whose `constructor.prototype !== prototype` → false
  (the round-trip anti-graft marker).
- `iASPE/A1` — `(AbortSignal.prototype, AbortSignal, new AbortController().signal)` →
  true.
- `iASPE/R1` — the AbortSignal analogue of `iETPE/R2` (graft) → false.

### `isAlienRealmEventTarget(value, prototype)` / `isAlienRealmAbortSignal(value, prototype)` — `@internal`

The composed cross-realm arm:
`ctor = getDefinedConstructor(prototype, { assumePrototype: true }); has<X>IdentitySignal(value, getVerifiedOwnName(ctor)) && is<X>PrototypeEquivalent(prototype, ctor[, value])`.
Resolves the constructor once and threads it (#059).

- `iARET/A1` — a cross-realm _direct_ `EventTarget` and its prototype (fixture) → true.
- `iARET/R1` — a plain object carrying tag `'[object EventTarget]'`, constructor-name
  `'EventTarget'`, and the three method-NAMES but not the real prototype shape → false
  (prototype-equivalence fails — the #061 spoof closure; cf. the realm-asymmetry ruling in
  Resolved items).
- `iARET/R2` — a cross-realm subclass → false (constructor-name signal gate).
- `iARAS/A1` — a cross-realm _direct_ `AbortSignal` and its prototype (fixture) → true.
- `iARAS/R1` — a cross-realm `EventTarget` (not an `AbortSignal`) → false (tag/name gate).

---

## Resolved items

1. **`isCurrentRealm{EventTarget,AbortSignal}Instance` exported `@internal` for
   single-realm testability (decision #053).** They were module-local; ADR #053
   pre-decided exporting them for parity with thenable (`isCurrentRealmPromiseInstance`)
   and primitive when the evented spec was written. Done — both now carry parallel `.d.ts`
   declarations under a "Realm-Membership Helpers" section; the re-confirmation gate is 8
   = 8. This closes ADR #053's forward-consistency note for evented.

2. **Post-freeze amendment 2026-07-01 — strict/Like decomposition + cross-realm
   prototype-equivalence lift (decisions #060–#062).** After the 2026-06-18 freeze, the
   evented refactor: (a) replaced the `null` constructor-capture with the
   `INSTANCE_LESS_CONSTRUCTOR` sentinel + throw-safe `instanceof` (#060); (b) lifted
   `isEventTarget` / `isAbortSignal` from the old three-marker structural chain (tag +
   constructor-name + `doesMatchXContract`) to full cross-realm structural
   prototype-equivalence, mirroring `isPromise` (#054), via four new strict-arm helpers
   per family — `hasXIdentitySignal`, `doesImplementXPrototypeContract`,
   `isXPrototypeEquivalent`, `isAlienRealmX` (#061); (c) reverted an interim-stricter
   `isAbortSignalLike` to lenient duck-typing and renamed `doesMatch*Contract` →
   `doesImplementXContract` (both Like contracts now `doesImplement*`); and (d) dropped
   the `<T = unknown>` generic from the strict predicates (#062). The behavioral
   public-vector tables stayed frozen (genuine-instance admits unchanged); the composition
   strings, helper mechanics, and the axis-4 inventory (4 → 12 `@internal` helpers, gate 8
   = 8 → 16 = 16) were amended in place; the eight strict-arm helper specs were appended;
   and the `dMETC` / `dMASC` helper-vector IDs were renamed `dIETC` / `dIASC` to track the
   function rename.

3. **Realm-asymmetry ruling (carried from the object round).** The strict predicates'
   local identity-fast-path and cross-realm structural arm can disagree for a tampered
   value: a plain object grafted onto the real `EventTarget.prototype` is admitted by
   `isEventTarget` locally (its `[[Prototype]]` genuinely IS `eventTargetPrototype`),
   while a foreign-realm look-alike carrying only tag + name + method-names is rejected by
   `isEventTargetPrototypeEquivalent` (see `iARET/R1`). Accepted and documented, not
   reconciled — local identity outranks surface markers, consistent with the
   `isPlainObject` ruling from the object round. **Formalized for object-parity
   (2026-07-01):** promoted from prose to the numbered `isEventTarget/A3` admit vector +
   the `isEventTarget` "Realm asymmetry on tampered inputs" subsection, and pinned by the
   `adversarial.test.js` asymmetry block (local bare / spoofed-tag / throwing-tag grafts →
   `true`; the foreign spoofed-tag counterpart → `false`) — matching the object module's
   dedicated subsection + vector + test treatment of the identical phenomenon.

No open items.
