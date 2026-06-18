# evented — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`evented.d.ts`, `evented.js`,
> `architecture/evented.md`, decisions #027–#030, #036, #050, #053). Status: **FROZEN
> 2026-06-18** — decidability check passed (8 suites over all 4 public predicates + the 4
> exported helpers, run against the real implementations through the `@/index.js` barrel,
> single realm; no spec corrections needed). Base for the axis-1 suite; axes 2–4 derive
> alongside.

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
a two-axis ternary (local-realm `instanceof` + proto-identity, OR cross-realm `[[Class]]`
tag + constructor-name + structural contract). Decisions #050 (two-axis dispatch), #028
(subclass rejection), #029 (the `aborted` accessor exception), #030 (`AbortSignalLike`
minimum surface).

## Surface inventory

**Public predicates (axis 1):** `isEventTargetLike`, `isEventTarget`, `isAbortSignalLike`,
`isAbortSignal`.

**Exported `@internal` helpers (axis 4):**

- contract helpers — `doesMatchEventTargetContract`, `doesMatchAbortSignalContract`
  (declared in both `.js` and `.d.ts`).
- realm-membership helpers — `isCurrentRealmEventTargetInstance`,
  `isCurrentRealmAbortSignalInstance` (exported for single-realm testability per decision
  #053; see Resolved items).

**Exported types without a predicate:** `EventTargetLike`, `AbortSignalLike` (locally
defined, decision #027). The narrow targets `EventTarget` / `AbortSignal` are the
`lib.dom.d.ts` globals, not defined here.

Re-confirmation gate: 8 `.js` exports = 8 `.d.ts` declarations, no surface gap.

**Test-environment note:** the decidability run executes in Node (vitest). `EventTarget`,
`AbortController`, `AbortSignal`, `AbortSignal.timeout()`, `AbortSignal.any()` are all
present (Node ≥ 15). DOM subclasses (`document`, `Element`, `Window`, `XMLHttpRequest`)
are NOT — subclass vectors use a synthetic `class extends EventTarget {}`; DOM types are
cited as the real-world instances axis 2 (cross-realm/browser) will cover. `AbortSignal`
is not `new`-able (`new AbortSignal()` throws), so an `AbortSignal` _subclass_ is not
readily constructible — its subclass-rejection is theoretical, noted where relevant.

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted → rejected by all four public predicates
  (leading `!!value`); the `doesMatchXContract` helpers also reject nullish (via
  `hasInertMethod`'s parameter-default-to-`null` gate).
- **CC/empty** — `{}` → rejected everywhere (no method contract).

---

## `isEventTargetLike`

`isEventTargetLike<T = unknown>(value?: T): value is T & EventTargetLike` Composition:
`!!value && (isCurrentRealmEventTargetInstance(value) || doesMatchEventTargetContract(value))`
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
`isCurrentRealmEventTargetInstance` + `doesMatchEventTargetContract`. Subclass-admitting
(bare `instanceof`, no proto-identity).

---

## `isEventTarget`

`isEventTarget<T = unknown>(value?: T): value is T & EventTarget` Composition:
`!!value && (isCurrentRealmEventTargetInstance(value) ? getPrototypeOf(value) === eventTargetPrototype : getTypeSignature(value) === '[object EventTarget]' && getDefinedConstructorName(value) === 'EventTarget' && doesMatchEventTargetContract(value))`
Spec basis: `EventTarget` identity — two-axis dispatch (#050, #028).

**Admits**

- `isEventTarget/A1` — `new EventTarget()` → true (local arm: instanceof +
  proto-identity).
- `isEventTarget/A2` — a cross-realm _direct_ `EventTarget` (fixture) → true (cross-realm
  arm: tag `'[object EventTarget]'` + ctor-name `'EventTarget'` + contract).

**Rejects**

- `isEventTarget/R1` — a subclass instance `new (class extends EventTarget {})()` → false
  (passes instanceof, fails proto-identity; real-world: `document`/`Element`/`Window`).
- `isEventTarget/R2` — tag-spoof `{ [Symbol.toStringTag]: 'EventTarget' }` → false (not
  instanceof; tag passes but ctor-name walk reaches `Object` and the contract is absent).
- `isEventTarget/R3` — a userland 3-method object (`isEventTargetLike/A3`) → false (not
  instanceof; `[[Class]]` tag is `'[object Object]'`).
- `isEventTarget/R4` — `new AbortController().signal` → false (an `AbortSignal`, not a
  direct `EventTarget` — proto-identity is `AbortSignal.prototype`). (plus CC/nullish.)

**Refuses to claim**

- `isEventTarget/B1` — _subclass admission_: deliberately rejects local- and cross-realm
  subclasses (consumers needing subclasses use `isEventTargetLike`).

**Cross-realm (axis 2):** admit foreign-realm direct `EventTarget`; reject foreign
subclasses (ctor-name). **Spoof (axis 3):** three cross-realm markers each close a class —
contract rejects tag/ctor-name claimants lacking the methods; tag rejects
contract-satisfiers tagged otherwise; ctor-name closes the `Symbol.toStringTag` spoof
hole. **Composition note (axis 4):** two-axis ternary over
`isCurrentRealmEventTargetInstance`; local arm `getPrototypeOf` + `eventTargetPrototype`;
cross-realm arm `getTypeSignature` + `getDefinedConstructorName` +
`doesMatchEventTargetContract`.

---

## `isAbortSignalLike`

`isAbortSignalLike<T = unknown>(value?: T): value is T & AbortSignalLike` Composition:
`!!value && (isCurrentRealmAbortSignalInstance(value) || doesMatchAbortSignalContract(value))`
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
`isCurrentRealmAbortSignalInstance` + `doesMatchAbortSignalContract`. Subclass-admitting.

---

## `isAbortSignal`

`isAbortSignal<T = unknown>(value?: T): value is T & AbortSignal` Composition:
`!!value && (isCurrentRealmAbortSignalInstance(value) ? getPrototypeOf(value) === abortSignalPrototype : getTypeSignature(value) === '[object AbortSignal]' && getDefinedConstructorName(value) === 'AbortSignal' && doesMatchAbortSignalContract(value))`
Spec basis: `AbortSignal` identity — two-axis dispatch (#050, #028).

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
  instanceof; no contract; ctor-name walk reaches `Object`).
- `isAbortSignal/R3` — an `AbortSignalLike` userland object (`isAbortSignalLike/A3`) →
  false (not instanceof; tag is `'[object Object]'`).
- `isAbortSignal/R4` — `new AbortController()` (the controller, not its `.signal`) →
  false. (plus CC/nullish.)

**Refuses to claim**

- `isAbortSignal/B1` — _subclass admission_: rejects subclasses (theoretical —
  `AbortSignal` is not `new`-able, so a subclass is not readily constructible; the
  proto-identity / ctor-name gates would reject one).

**Cross-realm (axis 2):** admit foreign-realm direct `AbortSignal`. **Spoof (axis 3):** as
`isEventTarget`, three independent cross-realm markers; the contract's `aborted`
direct-read is `try/catch`-guarded. **Composition note (axis 4):** two-axis ternary over
`isCurrentRealmAbortSignalInstance`; cross-realm arm uses `doesMatchAbortSignalContract`
directly.

---

## Helper specification (axis 4)

### `doesMatchEventTargetContract(value?)` — `@internal`

`hasInertMethod(v, 'dispatchEvent') && hasInertMethod(v, 'addEventListener') && hasInertMethod(v, 'removeEventListener')`.
Purely structural; no `instanceof`.

- `dMETC/A1` — `new EventTarget()` → true (methods inherited from prototype).
- `dMETC/A2` — a subclass instance / `new AbortController().signal` → true (inherited).
- `dMETC/A3` — `{ dispatchEvent(){}, addEventListener(){}, removeEventListener(){} }` →
  true (own).
- `dMETC/R1` — missing any of the three (`isEventTargetLike/R1`) → false (short-circuits).
- `dMETC/R2` — accessor on any of the three → false.
- `dMETC/R3` — `{}`, `null`, `undefined`, `42` → false (`hasInertMethod` nullish-safe).

### `doesMatchAbortSignalContract(value?)` — `@internal`

`try { hasInertMethod(v, 'throwIfAborted') && isBooleanValue(v.aborted) && doesMatchEventTargetContract(v) } catch { false }`.
Order is load-bearing: the nullish-safe `throwIfAborted` gate first, then the direct
`aborted` read (accessor exception #029), then the EventTarget contract.

- `dMASC/A1` — `new AbortController().signal`, `AbortSignal.timeout(1000)` → true.
- `dMASC/R1` — `new EventTarget()` → false (no `throwIfAborted` / `aborted`).
- `dMASC/R2` — `{ aborted: false, throwIfAborted(){} }` (no EventTarget methods) → false.
- `dMASC/R3` — `aborted` present but non-boolean → false.
- `dMASC/R4` — throwing `aborted` getter → false (`try/catch`).
- `dMASC/R5` — `{}`, `null` → false.

### `isCurrentRealmEventTargetInstance(value)` / `isCurrentRealmAbortSignalInstance(value)` — `@internal`

`!!XConstructor && value instanceof XConstructor`. Assumes a truthy receiver (callers
guard `!!value`). Subclass-admitting — no proto-identity (layered on by the strict
predicate's ternary).

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
- `iCRXI/B1` — when the runtime lacks the global `X`, returns `false` for every input via
  the `!!XConstructor` guard (embedding-safety branch; a coverage-axis concern).

---

## Resolved items

1. **`isCurrentRealm{EventTarget,AbortSignal}Instance` exported `@internal` for
   single-realm testability (decision #053).** They were module-local; ADR #053
   pre-decided exporting them for parity with thenable (`isCurrentRealmPromiseInstance`)
   and primitive when the evented spec was written. Done — both now carry parallel `.d.ts`
   declarations under a "Realm-Membership Helpers" section; the re-confirmation gate is 8
   = 8. This closes ADR #053's forward-consistency note for evented.

No open items.
