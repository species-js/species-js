# primitive — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`primitive.d.ts`, `primitive.js`,
> `architecture/primitive.md`, decisions #038, #039, #042, #043, #049, #050, #051, #053,
> #072, #074, #077; boxed-primitive memory). Status: **FROZEN 2026-06-18** — decidability
> check passed (23 cases over all 19 public predicates + the 10 exported helpers, run
> against the real implementations through the `#index` barrel). The run corrected the
> equality-helper behavior (they admit the same-family primitive too, not only the boxed
> form). Base for the axis-1 suite; axes 2–4 derive alongside.
>
> **Post-freeze amendment 2026-07-01:** two symbol-registry exports omitted at freeze are
> now covered — the public `isRegisteredSymbol` and its `@internal` helper
> `unguardedIsUnregisteredSymbol` (the decidability run tested 19 public predicates and
> read the gate as 29 = 29; the true surface is 20 public predicates, gate 31 = 31).
> Purely additive — new sections + inventory + corrected gate; no existing vector changes.
> See the Open / resolved items.
>
> **Post-freeze amendment 2026-07-26 (ADR #077):** the predicate signatures shown below
> are now DIRECT type guards — `isXValue(value?: unknown): value is XValue` (and the boxed
> / composite forms) — not the generic `<T = unknown>(value?: T): value is T & X`.
> Primitive narrows to its precise native/declared target directly; the generic pattern
> (#031) stays preferred only for broad-shape predicates (the `#function` family). Two-way
> strategy per ADR #077, revising #039's primitive-uniformity. Signature-only change;
> every admit/reject vector below is unchanged.
>
> **Post-freeze amendment 2026-07-27 (ADR #074):** the three Number static-method guards
> (`isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue`) and their three
> `@internal` polyfills (`isFiniteNumber` / `isInteger` / `isSafeInteger`) — relocated
> into `primitive` from `#config` by #074 — are now specified in a new "Number
> static-method predicates" section, with the polyfills added to the axis-4 helper
> inventory. The re-confirmation gate rises to **37 = 37** (was 31; +6 relocated exports).
> Additionally, the three realm-native helpers are named by their true exports —
> `isCurrentRealmNativeStringInstance` / `NumberInstance` / `BooleanInstance` (the
> `…Instance` suffix + export landed with the #074 relocation commit; the pre-rename short
> names used below were reconciled here). Purely additive + a name reconciliation; no
> existing behavioral vector changes.

## Module contract

`type-detection / primitive` discriminates JavaScript's five primitive families (`string`,
`number`, `boolean`, `symbol`, `bigint`) and their boxed wrapper-object forms. Each family
ships three predicates + three types; three union predicates plus a boxed umbrella sit at
the floor of the lattice:

```
Per family X ∈ { String, Number, Boolean, Symbol, BigInt }:
  XValue   (isXValue)   — primitive form, via `typeof === '<x>'`
  BoxedX   (isBoxedX)   — boxed wrapper-object form, via isObject + identity + [[XData]] slot probe
  XType    (isX)        — composite, isXValue || isBoxedX

Floor (cross-family):
  NullishPrimitive   (isNullishPrimitive)   — null | undefined
  BoxablePrimitive   (isBoxablePrimitive)   — the five primitive forms (typeof EXCLUSION)
  PrimitiveValue     (isPrimitiveValue)     — all seven ECMA-262 primitives
  BoxedPrimitive     (isBoxedPrimitive)     — any of the five boxed wrapper-object forms
```

The Number family additionally carries three static-method refinement guards over the
primitive form (`isFiniteNumberValue`, `isIntegerValue`, `isSafeIntegerValue` — relocated
from `#config` by #074), specified in their own section below.

Two structural axes govern the boxed predicates:

- **Constructor-aware families (`String` / `Number` / `Boolean`)** — `isObject` gate, then
  a two-branch identity check (local-realm `instanceof X` +
  `getPrototypeOf === X.prototype`, OR cross-realm `[[Class]]` tag + resolved
  constructor-name), then the `[[XData]]` slot probe sealing either branch.
- **Factory-function families (`Symbol` / `BigInt`)** — `isObject` gate + tag +
  ctor-name + slot probe; **no** `instanceof` branch (`new Symbol()` / `new BigInt()`
  throw; `instanceof` is incidental `OrdinaryHasInstance`, not identity). Decision #049.

The slot probe (`X.prototype.valueOf.call(value)`, captured realm-fixed) is the
engine-attested bottom seal both arms feed into — it cannot be forged from userland.
Crucially, it **closes** the prototype-graft surface that the thenable module's
`isPromise` leaves open: where `isPromise(Object.create(Promise.prototype))` is admitted
(no slot seal), `isBoxedString(Object.create(String.prototype))` is **rejected** (the
`valueOf` throws — no `[[StringData]]`). Decisions #042, #049, #050; the general
sealability principle (an inert internal-slot accessor is what makes a type sealable, and
why `Promise` lacks one) is decision #052.

## Surface inventory

**Public predicates — value (axis 1):** `isStringValue`, `isNumberValue`,
`isBooleanValue`, `isSymbolValue`, `isBigIntValue`.

**Public predicates — boxed (axis 1):** `isBoxedString`, `isBoxedNumber`,
`isBoxedBoolean`, `isBoxedSymbol`, `isBoxedBigInt`.

**Public predicates — composite (axis 1):** `isString`, `isNumber`, `isBoolean`,
`isSymbol`, `isBigInt`.

**Public predicates — floor (axis 1):** `isNullishPrimitive`, `isBoxablePrimitive`,
`isPrimitiveValue`, `isBoxedPrimitive`.

**Public predicate — symbol-registry (axis 1):** `isRegisteredSymbol` (whether a primitive
symbol was obtained from the global registry via `Symbol.for`).

**Public predicates — Number static-method (axis 1; relocated from `#config` by #074):**
`isFiniteNumberValue`, `isIntegerValue`, `isSafeIntegerValue` — the realm-fixed
`Number.isFinite` / `isInteger` / `isSafeInteger` (native method when callable, else the
polyfill), `.d.ts`-retyped to the type-guard `(value: unknown) => value is number`. Unlike
the `value?: unknown` predicates, these are `const`-bound (native-or-polyfill), so their
signature has no optional parameter and no argument default.

**Exported `@internal` helpers (axis 4) — equality (slot) probes:**
`doesHaveStrictUnboxedStringValueEquality`, `doesHaveStrictUnboxedNumberValueEquality`,
`doesHaveStrictUnboxedBooleanValueEquality`, `doesHaveStrictUnboxedSymbolValueEquality`,
`doesHaveStrictUnboxedBigIntValueEquality`.

**Exported `@internal` helpers (axis 4) — realm-resolution machinery (exported for
single-realm testability, decision #053):** `isCurrentRealmNativeStringInstance` /
`isCurrentRealmNativeNumberInstance` / `isCurrentRealmNativeBooleanInstance` (the shared
`instanceof + proto-identity` discriminators),
`resolvedViaES3NativePrimitiveTypesHotPaths` (the current-realm path of
`isBoxedPrimitive`), and `resolvedViaAlienRealmPrimitiveTypesEvaluation` (the alien-realm
path — testable with local-realm boxed values, so the cross-realm logic needs no foreign
realm).

**Exported `@internal` helper (axis 4) — symbol-registry:**
`unguardedIsUnregisteredSymbol` (the unguarded `Symbol.keyFor`-based unregistered-symbol
check that `isRegisteredSymbol` gates and negates).

**Exported `@internal` helpers (axis 4) — Number static-method polyfills (relocated by
#074):** `isFiniteNumber`, `isInteger`, `isSafeInteger` — the explicit fallback closures
behind the three public Number guards, exported so the polyfill path is unit-testable in
isolation regardless of whether the runtime has the native method.

**Module-local data (unexported — internal tables, covered transitively):** the
`unboxedPrimitiveValueEvaluations` dispatch `Map` (exercised through
`resolvedViaAlienRealmPrimitiveTypesEvaluation`) and the `nonBoxableTypeSignatures` `Set`
(exercised through the public `isBoxablePrimitive`).

**Exported types without a predicate:** the 5 `XValue`, 5 `BoxedX`, 5 `XType`, and the 4
floor types (`NullishPrimitive`, `BoxablePrimitive`, `PrimitiveValue`, `BoxedPrimitive`) —
type-only, verified by `tsc`, no runtime vector.

Re-confirmation gate: 37 `.js` exports = 37 `.d.ts` declarations, no surface gap (23
public predicates — the 20 family/floor/registry predicates plus the 3 Number-static
guards — + 5 equality helpers + 5 realm-resolution helpers + 1 symbol-registry helper + 3
Number-static polyfills).

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted argument → rejected by every predicate
  EXCEPT `isNullishPrimitive` and `isPrimitiveValue` (which admit them).
- **CC/value-vs-boxed** — for every family, the primitive form and the boxed form are
  mutually exclusive: `isXValue` admits only the primitive, `isBoxedX` admits only the
  boxed, `isX` admits both.
- **CC/cross-family** — each family's predicate rejects the other four families' values
  (e.g., `isStringValue(42) === false`).

---

## Value-predicate family — `isXValue`

`isXValue(value?: unknown): value is XValue` — composition `typeof value === '<x>'`.
Realm-independent (`typeof` reads identically in every realm) and the cheapest predicates
in the package.

| Family  | Predicate        | `typeof`    | primitive admits (examples)                         | boxed form rejected   |
| ------- | ---------------- | ----------- | --------------------------------------------------- | --------------------- |
| String  | `isStringValue`  | `'string'`  | `'x'`, `''`                                         | `new String('x')`     |
| Number  | `isNumberValue`  | `'number'`  | `42`, `NaN`, `Infinity`, `-Infinity`, `-0`          | `new Number(42)`      |
| Boolean | `isBooleanValue` | `'boolean'` | `true`, `false`                                     | `new Boolean(true)`   |
| Symbol  | `isSymbolValue`  | `'symbol'`  | `Symbol('x')`, `Symbol.for('x')`, `Symbol.iterator` | `Object(Symbol('x'))` |
| BigInt  | `isBigIntValue`  | `'bigint'`  | `1n`, `BigInt(1)`                                   | `Object(1n)`          |

**Shared vectors** (X over the five families):

- `isXValue/A1` — the primitive form (per-family examples above) → true.
- `isXValue/R1` — the family's boxed form → false (`typeof === 'object'`).
- `isXValue/R2` — another family's primitive (e.g., `isStringValue(42)`) → false.
- `isXValue/R3` — `null`, `undefined`, omitted → false.

**Family-specific admits worth pinning:**

- `isNumberValue/A-special` — `NaN`, `Infinity`, `-Infinity`, `-0` → true (all numeric
  primitives; finiteness is a separate concern — see the Number static-method predicates
  section, relocated into this module by #074).
- `isStringValue/A-empty` — `''` → true.
- `isSymbolValue/A-wellknown` — `Symbol.iterator`, `Symbol.for('x')` → true (well-known +
  registered symbols).

**Cross-realm expectation (axis 2):** trivially realm-safe — primitives carry no realm
identity, and `typeof` is realm-independent. A string produced in a foreign realm is just
a string.

**Spoof-resistance expectation (axis 3):** none required. `typeof` is a syntactic
operator, not a method dispatch; its result cannot be intercepted or overridden from
userland. These predicates have no spoof surface.

---

## Boxed-predicate family — `isBoxedX`

`isBoxedX(value?: unknown): value is BoxedX`. Two sub-shapes by family kind.

**Constructor-aware (`isBoxedString` / `isBoxedNumber` / `isBoxedBoolean`):**
`isObject(v) && (isCurrentRealmNativeXInstance(v) || (getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X')) && doesHaveStrictUnboxedXValueEquality(v)`

**Factory-function (`isBoxedSymbol` / `isBoxedBigInt`):**
`isObject(v) && getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X' && doesHaveStrictUnboxedXValueEquality(v)`

**Shared vectors** (X over the five families):

- `isBoxedX/A1` — a genuine boxed instance (`new String('x')`, `Object(42)`,
  `new Boolean(true)`, `Object(Symbol('x'))`, `Object(1n)`) → true.
- `isBoxedX/A-crossrealm` — a cross-realm boxed `X` (fixture) → true (structural arm:
  tag + ctor-name + slot).
- `isBoxedX/R1` — the primitive form → false (`isObject` gate rejects; `typeof` not
  `'object'`).
- `isBoxedX/R2` — `null`, `undefined` → false (`isObject` gate).
- `isBoxedX/R3` — a plain `{}` and other-family boxed (`isBoxedString(new Number(1))`) →
  false (tag / ctor-name mismatch).
- `isBoxedX/R-tagspoof` — `{ [Symbol.toStringTag]: 'X' }` → false (tag passes, but
  ctor-name walk reaches `Object`, and the slot probe throws — no `[[XData]]`).
- `isBoxedX/R-protograft` — `Object.create(X.prototype)` → **false** — the slot probe
  rejects it (`valueOf` throws; no `[[XData]]`). **The contrast with `isPromise/B2`: the
  engine-attested seal closes the prototype-graft surface here.**
- `isBoxedX/R-ctorspoof` — a userland class literally named `X` (e.g. `class String {}`) →
  false. The instance's `[[Class]]` tag is `'[object Object]'`, so the tag check fails
  before the constructor-name even matters (the ctor-name-spoof-alone case: a matching
  name cannot survive the tag marker). Exercised on `String` (`adversarial.test.js`).

**Constructor-aware-only vector:**

- `isBoxedX/R-subclass` — `new (class extends X {})(...)` for `X ∈ {String, Number}`
  (`Boolean` is also subclassable) → false (local arm fails proto-identity; cross-realm
  arm fails ctor-name walk → resolves to the subclass name).

**Per-family equality strategy (marker 4 — the `[[XData]]` slot probe; decision #043):**

| Family  | Equality form                                   | Spec trap closed                                                  |
| ------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| String  | `valueOf.call(v) === String(v)`                 | none — both unwrap via `ToPrimitive`                              |
| Number  | `Object.is(valueOf.call(v), Number(v))`         | `NaN !== NaN` — `Object.is` admits `new Number(NaN)`              |
| Boolean | `String(valueOf.call(v)) === String(v)`         | `ToBoolean(Object) → true` — stringify both sides to unwrap       |
| Symbol  | `valueOf.call(v).description === v.description` | `Symbol(boxed)` throws; description cross-check catches shadowing |
| BigInt  | `valueOf.call(v) === BigInt(v)`                 | none — `BigInt()` unwraps via `ToPrimitive`                       |

**Family-specific admits forced by the equality strategy:**

- `isBoxedNumber/A-NaN` — `new Number(NaN)` → true (`Object.is(NaN, NaN)` is `true`; `===`
  would reject).
- `isBoxedBoolean/A-false` — `new Boolean(false)` → true (stringified compare sidesteps
  the `ToBoolean(object) → true` trap that a direct value compare would fail).
- `isBoxedSymbol/R-descshadow` — a real boxed `Symbol` whose `description` own-data
  property has been shadowed
  (`Object.defineProperty(boxed, 'description', { value: 'x' })`) → false (the description
  cross-check diverges from the slot read; this residual tampering surface survives the
  slot probe alone).

**Cross-realm expectation (axis 2):** admit foreign-realm boxed `X` of every family via
the structural arm (tag + ctor-name + slot, all realm-independent). The local-realm
`instanceof` arm (constructor-aware families) is a fast-path only; its miss falls through
to the structural arm.

**Spoof-resistance expectation (axis 3):** three independent markers each close a class —
tag-spoof rejected by ctor-name walk; ctor-name-spoof rejected by tag; both-together
rejected by the `[[XData]]` slot probe (unforgeable). Proto-graft
(`Object.create(X.prototype)`) rejected by the slot probe. Description-shadow (Symbol)
rejected by the description cross-check.

**Composition note (axis 4):** drives `isObject` (`#object`), the module-local
`isCurrentRealmNativeXInstance` (constructor-aware families), `getTypeSignature` +
`getDefinedConstructorName` (`#utility`), and the exported
`doesHaveStrictUnboxedXValueEquality`.

---

## Composite-predicate family — `isX`

`isX(value?: unknown): value is XType` — composition `isXValue(v) || isBoxedX(v)`, the
cheaper `typeof` check first.

- `isX/A1` — the primitive form → true.
- `isX/A2` — the boxed form → true.
- `isX/R1` — another family (value or boxed) → false.
- `isX/R2` — `null`, `undefined`, `{}` → false.

**Cross-realm / spoof:** inherits from `isBoxedX` on the boxed arm; the value arm is
realm-safe and spoof-proof.

---

## Number static-method predicates — `isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue`

Three Number-family refinement guards over the primitive form, relocated into `primitive`
from `#config` by decision #074 (finite-number contract per #072). Each is `const`-bound
to the realm-fixed native method (`Number.isFinite` / `isInteger` / `isSafeInteger`,
captured at module-load) when callable, else to its `@internal` polyfill closure — so the
signature is `(value: unknown): value is number`, with **no** optional parameter and no
argument default (unlike the authored `value?: unknown` predicates). The `.d.ts` retypes
the lib's plain-boolean return to the type-guard form so narrowing propagates at the call
site.

All three operate only on the primitive number form: a leading `typeof === 'number'` gate
(native semantics, mirrored by the polyfill's `isNumberValue` lead) rejects every
non-number — including numeric **strings** and boxed `Number` objects — before any
arithmetic. This is the load-bearing distinction from the bare global `isFinite`, which
coerces its argument.

### `isFiniteNumberValue`

`isNumberValue(v) && isFinite(v)` semantics (native or polyfill).

- `isFiniteNumberValue/A1` — `0`, `-0`, `42`, `-1`, `3.14`, `Number.MAX_VALUE` → true.
- `isFiniteNumberValue/R1` — `NaN`, `Infinity`, `-Infinity` → false (non-finite numbers).
- `isFiniteNumberValue/R2` — `'42'` (numeric string) → false — the `typeof` gate
  suppresses the coercion the bare global `isFinite('42') === true` would apply. The
  load-bearing vector.
- `isFiniteNumberValue/R3` — non-numbers: `{}`, `[]`, `null`, `undefined`, omitted,
  `true`, `1n`, `Symbol()`, `new Number(42)` (boxed) → false.

### `isIntegerValue`

`isFiniteNumberValue(v) && Math.floor(v) === v` semantics.

- `isIntegerValue/A1` — `0`, `42`, `-7`, `2 ** 53` → true (an integer, though not a _safe_
  integer — see `isSafeIntegerValue`).
- `isIntegerValue/R1` — `3.14`, `-0.5` → false (fractional part).
- `isIntegerValue/R2` — `NaN`, `Infinity`, `-Infinity` → false (non-finite).
- `isIntegerValue/R3` — `'42'` and all non-numbers (per `R3` above) → false.

### `isSafeIntegerValue`

`isIntegerValue(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER` semantics — the lossless
round-trip range `[-(2^53 - 1), 2^53 - 1]`.

- `isSafeIntegerValue/A1` — `0`, `42`, `-7`, `Number.MAX_SAFE_INTEGER` (`2^53 - 1`),
  `-(Number.MAX_SAFE_INTEGER)` → true.
- `isSafeIntegerValue/B1` — the range edge: `Number.MAX_SAFE_INTEGER` → true, but
  `Number.MAX_SAFE_INTEGER + 1` (`2 ** 53`) → **false**. Pins exactly where safe-integer
  admission stops.
- `isSafeIntegerValue/R1` — `2 ** 53`, `2 ** 53 + 1` → false (integers outside the safe
  range).
- `isSafeIntegerValue/R2` — `3.14`, `NaN`, `Infinity` → false; `'42'` and all non-numbers
  → false.

**Cross-realm expectation (axis 2):** trivially realm-safe — they discriminate the
primitive number form (no realm identity), and the native method is realm-fixed at
module-load from `config`'s `globalContext`. No foreign-realm fixture required.

**Spoof-resistance expectation (axis 3):** none — no method dispatch on the value. The
native `Number.isX` never coerces and never throws; the polyfills gate on `typeof` /
`isFiniteNumberValue` before any arithmetic, reading no property off the candidate. Marked
`@@throw-safe` in both files.

**Composition note (axis 4):** `isFiniteNumberValue` drives `isNumberValue` + the captured
global `isFinite`; `isIntegerValue` drives `isFiniteNumberValue` + captured `Math.floor`;
`isSafeIntegerValue` drives `isIntegerValue` + captured `Math.abs` +
`Number.MAX_SAFE_INTEGER`. The three polyfills (`isFiniteNumber` / `isInteger` /
`isSafeInteger`) are their exported fallback forms — see the axis-4 helper section.

**Surface decision (resolved 2026-07-27, owner ruling — closes the #074 open item):** the
two internally-unused integer guards (`isIntegerValue`, `isSafeIntegerValue`; post-#072
only `isFiniteNumberValue` has an in-package consumer) **stay public** — they ship
exported without `@internal`, and downstream packages are the intended consumers. Not
pruned. The three `@internal` polyfill closures (`isFiniteNumber` / `isInteger` /
`isSafeInteger`) stay `@internal` — implementation detail, exported only for fallback-path
testability.

---

## Floor predicates

### `isNullishPrimitive`

`isObject`-free; `value = null` default collapses `undefined` → `null`, body is
`value === null` (decision #025).

- `isNullishPrimitive/A1` — `null`, `undefined`, omitted → true.
- `isNullishPrimitive/R1` — `0`, `''`, `false`, `NaN`, `0n`, `Symbol()`, `{}` → false.

### `isBoxablePrimitive`

`typeof`-result EXCLUSION: `!nonBoxableTypeSignatures.has(typeof value)` where the
rejected set is `{ 'undefined', 'function', 'object' }`.

- `isBoxablePrimitive/A1` — `'x'`, `42`, `true`, `Symbol('y')`, `1n` → true (the five
  primitive forms).
- `isBoxablePrimitive/R1` — `null` (`typeof 'object'`), `undefined`, `{}`, `() => {}` →
  false.
- `isBoxablePrimitive/R2` — any boxed form (`new String('x')`, …) → false
  (`typeof 'object'`).
- `isBoxablePrimitive/B1` — future-proof by design: a hypothetical future primitive with a
  new `typeof` result would be admitted without code change (the rejection set is
  spec-locked). `document.all` (`typeof 'undefined'`, legacy) is correctly rejected —
  browser-only, hard to exercise in the node test env.

### `isPrimitiveValue`

`isNullishPrimitive(v) || isBoxablePrimitive(v)`.

- `isPrimitiveValue/A1` — all seven primitives: `'x'`, `42`, `true`, `Symbol('y')`, `1n`,
  `null`, `undefined` → true.
- `isPrimitiveValue/R1` — `{}`, `() => {}`, `[]`, any boxed form → false.

### `isBoxedPrimitive`

`isObject(v) && (resolvedViaES3NativePrimitiveTypesHotPaths(v) || resolvedViaAlienRealmPrimitiveTypesEvaluation(v))`.
The ES3 hot-path covers local-realm `String` / `Number` / `Boolean`; the alien path covers
all cross-realm boxed primitives and every local-realm `Symbol` / `BigInt`
(factory-function carve-out).

- `isBoxedPrimitive/A1` — `new String('x')`, `Object(42)`, `Object(true)`,
  `Object(Symbol('y'))`, `Object(1n)` → true (all five families).
- `isBoxedPrimitive/A-NaN` — `new Number(NaN)` → true (`Object.is`).
- `isBoxedPrimitive/A-crossrealm` — a cross-realm boxed primitive of any family (fixture)
  → true (alien structural path).
- `isBoxedPrimitive/R1` — any primitive form (`'x'`, `42`, `Symbol('y')`, `1n`, …) →
  false.
- `isBoxedPrimitive/R2` — `null`, `undefined` → false (`isObject` gate).
- `isBoxedPrimitive/R3` — `{}` and any non-wrapper object → false (no `[[XData]]`;
  tag/ctor-name do not name a wrapper).
- `isBoxedPrimitive/R-tagspoof` — `{ [Symbol.toStringTag]: 'String' }` → false (slot probe
  via the dispatch map throws).

**Cross-realm (axis 2):** the alien path is the cross-realm path — covered by
`A-crossrealm` across all five families. **Spoof (axis 3):** same slot-probe seal as the
per-family boxed predicates, dispatched by tag through `unboxedPrimitiveValueEvaluations`.

---

## Registered-symbol predicate — `isRegisteredSymbol`

`isRegisteredSymbol(value?: unknown): boolean` — composition
`isSymbolValue(value) && !unguardedIsUnregisteredSymbol(value)`: gate to a primitive
symbol first (so the unguarded helper is never handed a non-symbol), then confirm
`Symbol.keyFor` resolves a registry key. A _registered_ symbol is one obtained from the
global registry via `Symbol.for`; _unregistered_ = created by `Symbol()` or a well-known
symbol. Registered symbols are notable for being rejected as `WeakMap` / `WeakSet` keys by
the engine. Not generic and not a type-guard — registered-ness is not a distinct TS type
(the narrow target would still be `symbol`).

- `isRegisteredSymbol/A1` — `Symbol.for('x')` → true (`Symbol.keyFor` resolves `'x'`).
- `isRegisteredSymbol/R1` — `Symbol('x')` → false (unregistered — no registry key).
- `isRegisteredSymbol/R2` — a well-known symbol (`Symbol.iterator`,
  `Symbol.asyncIterator`) → false (well-known symbols are not in the global registry).
- `isRegisteredSymbol/R3` — `Object(Symbol.for('x'))` (a boxed registered symbol) → false
  (the `isSymbolValue` gate admits only the primitive form, not the boxed wrapper).
- `isRegisteredSymbol/R4` — a non-symbol (`'x'`, `42`, `{}`, `null`, `undefined`, omitted)
  → false (`isSymbolValue` gate rejects first; the unguarded helper never runs).

**Cross-realm / spoof (axes 2–3):** realm-safe and spoof-proof. A symbol from a foreign
realm is still `typeof 'symbol'`, and `Symbol.keyFor` consults the per-agent global
registry (shared across same-agent realms), so registered-ness is a registry property, not
a realm-identity one — no foreign-realm fixture is required and there is no forgeable
surface on a primitive symbol.

---

## Helper specification (axis 4) — the five equality helpers

Each `doesHaveStrictUnboxedXValueEquality(value: unknown): boolean` is the marker-4 slot
probe for its family: `try { return <equality form>; } catch { return false; }`. Robust to
any input (no `isObject` gate of its own). **Spec mechanic confirmed by the decidability
run:** the captured `X.prototype.valueOf` (`thisXValue`) accepts BOTH a boxed `X` (via the
`[[XData]]` slot) AND the same-family **primitive** (it returns the primitive receiver
unchanged); it throws only for a value that is neither. So each helper admits both the
boxed and the primitive form of its family — in `isBoxedX` the upstream `isObject` gate is
what excludes the primitive, not the helper.

- `dHSUXVE/A1` — a genuine boxed `X` (`new String('x')`, `Object(42)`, …) → true.
- `dHSUXVE/A2` — the same-family **primitive** (`'x'`, `42`, `true`, `Symbol('x')`, `1n`)
  → true (`valueOf` returns the primitive receiver; `=== X(value)` holds).
- `dHSUXVE/R1` — a value that is neither a boxed `X` nor an `X` primitive (`{}`, `null`, a
  different family's primitive or boxed value) → false (`valueOf` throws → `catch`).
- `dHSUNumberVE/A-NaN` — `new Number(NaN)` and `NaN` → true (`Object.is`).
- `dHSUBooleanVE/A-false` — `new Boolean(false)` and `false` → true (stringified compare).
- `dHSUSymbolVE/R-descshadow` — description-shadowed boxed `Symbol` → false;
  `Object(Symbol())` / `Symbol()` (no description) → true (`undefined === undefined`).

These five are also reachable directly (exported `@internal`), so axis 4 unit-tests them
in isolation in addition to their composition inside the boxed predicates.

---

## Helper specification (axis 4) — the five realm-resolution helpers

All five assume an object-typed receiver (the public predicates apply the `isObject` gate
first), so the vectors below pass objects only. Exported `@internal` for single-realm
testability (decision #053).

### `isCurrentRealmNativeStringInstance` / `NumberInstance` / `BooleanInstance`

`value instanceof X && getPrototypeOf(value) === X.prototype` — the subclass-rejection
primitive; does NOT seal the slot.

- `iCRNX/A1` — `new X(...)` / `Object(prim)` for the family → true.
- `iCRNX/R1` — a direct instance of a _different_ family (e.g.
  `isCurrentRealmNativeStringInstance(new Number(1))`) → false.
- `iCRNX/R2` — a subclass instance (`new (class extends X {})(...)`) → false
  (proto-identity; bare `instanceof` would admit it).
- `iCRNX/R3` — a plain `{}` → false.
- `iCRNX/B1` — `Object.create(X.prototype)` → **true** (proto-identity holds). Pins the
  division of labor: this helper admits the graft; the downstream slot-probe is what
  rejects it.

### `resolvedViaES3NativePrimitiveTypesHotPaths`

The current-realm path of `isBoxedPrimitive`:
`(isCurrentRealmNativeStringInstance && slotString) || (…Number…) || (…Boolean…)`.

- `rVE3/A1` — `new String('x')`, `new Number(42)`, `new Boolean(true)`, `Object('x')`,
  `new Number(NaN)` → true.
- `rVE3/R1` — `Object(Symbol('x'))`, `Object(1n)` → false (factory carve-out — not on the
  ES3 path).
- `rVE3/R2` — `{}` → false; `Object.create(String.prototype)` → false (slot-probe rejects
  the graft).

### `resolvedViaAlienRealmPrimitiveTypesEvaluation` — single-realm cross-realm coverage

The alien-realm path: `tag && tag === ctorName && dispatchMap.get(tag)?.(value)`. Its
markers are realm-independent, so **local** boxed values exercise the cross-realm logic —
the marquee benefit of exporting it (no foreign realm needed).

- `rVAlien/A1` — `new String('x')`, `new Number(42)`, `new Boolean(true)`,
  `Object(Symbol('y'))`, `Object(1n)` → true (all five families resolve structurally with
  LOCAL values — the cross-realm path proven in a single realm).
- `rVAlien/A-crossrealm` — a genuine cross-realm boxed primitive (fixture) → true (same
  path, confirming realm-independence).
- `rVAlien/R1` — `{}` → false (tag `'Object'`, not a wrapper; no dispatch entry).
- `rVAlien/R-tagspoof` — `{ [Symbol.toStringTag]: 'String' }` → false (tag is `'String'`
  but the constructor-name walk reaches `Object` → mismatch).
- `rVAlien/R-protograft` — `Object.create(String.prototype)` → false (the `[[Class]]` tag
  resolves to `'Object'`, since the graft has no `[[StringData]]` and `String.prototype`
  carries no `Symbol.toStringTag`).

---

## Helper specification (axis 4) — the symbol-registry helper

### `unguardedIsUnregisteredSymbol`

`unguardedIsUnregisteredSymbol(value: symbol): boolean` —
`symbolKeyFor(value) === undefined` (the realm-fixed `Symbol.keyFor` capture).
"Unguarded": the caller must pass a symbol; on a non-symbol `Symbol.keyFor` throws, which
is why the public `isRegisteredSymbol` gates with `isSymbolValue` first.
`keyFor(value) === undefined` is the spec tell for an unregistered symbol. Exported
`@internal` for direct axis-4 testing.

- `uIUS/A1` — `Symbol('x')` → true (unregistered — `keyFor` returns `undefined`).
- `uIUS/A2` — a well-known symbol (`Symbol.iterator`) → true (unregistered).
- `uIUS/R1` — `Symbol.for('x')` → false (registered — `keyFor` returns `'x'`).
- `uIUS/B1` — precondition, not a runtime vector: a non-symbol receiver makes
  `Symbol.keyFor` throw. The helper is unguarded by contract, so the caller must gate —
  the public `isRegisteredSymbol` does via `isSymbolValue`. Documents the caller's
  obligation.

---

## Helper specification (axis 4) — the Number static-method polyfills

`isFiniteNumber` / `isInteger` / `isSafeInteger` — the explicit fallback closures behind
the three public Number guards, each exported `@internal` so the polyfill path is
unit-testable in isolation even on a runtime that has the native method (the public
`const` would otherwise bind the native one, leaving the fallback unexercised). Each is
itself a type guard `(value: unknown): value is number`.

- `isFiniteNumber` — `isNumberValue(v) && isFinite(v)` (captured global `isFinite`). Same
  admit/reject profile as `isFiniteNumberValue/A1..R3` — including `isFiniteNumber('42')`
  → false (the leading `isNumberValue` gate is what suppresses the global-`isFinite`
  coercion).
- `isInteger` — `isFiniteNumberValue(v) && Math.floor(v) === v`. Same profile as
  `isIntegerValue/A1..R3`.
- `isSafeInteger` — `isIntegerValue(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER`. Same
  profile as `isSafeIntegerValue/A1..R2`, including the `B1` range edge
  (`MAX_SAFE_INTEGER` → true, `MAX_SAFE_INTEGER + 1` → false).

Because the public guard and its polyfill share one behavioral profile, axis 4 tests the
polyfill directly (the fallback path) while axis 1 tests the public export (the native
path where present); the two must agree on every vector.

---

## Open / resolved items

1. **Architecture-doc naming drift (doc↔impl) — RESOLVED.** `architecture/primitive.md`
   (and `architecture/README.md`'s modules table) used the pre-rename floor names
   (`WrappablePrimitive`/`isWrappablePrimitive`, `Primitive`/`isPrimitive`) and predated
   the `isBoxedPrimitive` umbrella; the shipped code uses
   `BoxablePrimitive`/`isBoxablePrimitive`, `PrimitiveValue`/`isPrimitiveValue`, plus
   `isBoxedPrimitive` (the `wrappable → boxable` rename + umbrella, commit `1421afd`).
   Both docs were updated to the current surface (the floor lattice, the
   generic-predicates section, and a new `isBoxedPrimitive` umbrella paragraph). A
   `doc↔impl` drift the spec's re-confirmation gate surfaced, now closed.
2. **Module-local realm helpers and axis-4 reach — RESOLVED (decision #053).** The five
   realm-resolution helpers (`isCurrentRealmNativeStringInstance` / `NumberInstance` /
   `BooleanInstance`, `resolvedViaES3NativePrimitiveTypesHotPaths`,
   `resolvedViaAlienRealmPrimitiveTypesEvaluation`) are now exported `@internal` with
   parallel `.d.ts` declarations, so axis 4 unit-tests each in isolation. The decisive
   factor: the alien-realm resolver's markers are realm-independent, so the cross-realm
   code path is fully testable with local-realm boxed values — no iframe / worker / vm.
   Consistent with ADR #015 (function sub-helpers exported) and the thenable precedent
   (`isCurrentRealmPromiseInstance`). The two internal data tables
   (`unboxedPrimitiveValueEvaluations`, `nonBoxableTypeSignatures`) stay module-local,
   tested transitively. See decision #053.
3. **Symbol-registry predicate + helper omitted at freeze — RESOLVED (post-freeze
   amendment 2026-07-01).** `isRegisteredSymbol` (public) and
   `unguardedIsUnregisteredSymbol` (`@internal`) were present in `primitive.{js,d.ts}` but
   absent from the 2026-06-18 decidability run and this spec — the re-confirmation gate
   read 29 = 29 instead of the true 31 = 31. Both are now covered: the "Registered-symbol
   predicate" and "symbol-registry helper" sections, the surface inventory, and the
   corrected gate. `isRegisteredSymbol` is confirmed public (user ruling; wired via the
   barrel `export *` + the `./primitive` subpath). Surfaced while diagnosing Dependabot
   #14, whose newer `eslint-plugin-jsdoc` flagged the two helpers' then-stub `.js` JSDoc
   (fixed in `4bdfa77` by mirroring the canonical `.d.ts` docs down). Purely additive; no
   existing behavioral vector changed.
4. **Number static-method predicates relocated in but unspecified — RESOLVED (post-freeze
   amendment 2026-07-27, ADR #074).** The `1ddb19f` relocation moved six exports from
   `#config` into `primitive` — the three public guards `isFiniteNumberValue` /
   `isIntegerValue` / `isSafeIntegerValue` and their three `@internal` polyfills
   `isFiniteNumber` / `isInteger` / `isSafeInteger` — but this spec (and the gate)
   predated the move. Now covered: the "Number static-method predicates" section (axis 1),
   the "Number static-method polyfills" helper section (axis 4), the surface inventory,
   and the corrected gate (31 → 37). ADR #074's **open** surface question — whether the
   two internally-unused integer guards stay public or are pruned — was **resolved by
   owner ruling 2026-07-27: they stay public** (downstream packages are the intended
   consumers); the three polyfill closures stay `@internal`. Purely additive; no existing
   behavioral vector changed.
5. **Realm-native helper name drift (doc↔impl) — RESOLVED.** The same `1ddb19f` relocation
   renamed and exported the three constructor-aware realm discriminators
   `isCurrentRealmNativeString` / `Number` / `Boolean` → `…StringInstance` /
   `…NumberInstance` / `…BooleanInstance`, but the spec's inventory, helper section, and
   resolved-item 2 still carried the pre-rename short names (the `spec/README`
   throw-safety text already used the `…Instance` form, confirming it canonical). All spec
   references reconciled to the true exports; the `iCRNX` vector IDs are retained (stable,
   append-only). A `doc↔impl` drift the re-confirmation gate surfaced, now closed.
6. **Test-round gauntlet reconciliation (2026-07-27) — RESOLVED.** The axis-1–4 suites
   landed and the finalization gauntlet ran (bidirectional spec↔test vector-ID diff +
   cross-artifact semantic audit). It closed: (a) the test suites' vector-ID citations now
   use the spec's frozen ID space — X-placeholder for family-shared vectors (`isXValue/*`,
   `isBoxedX/*`, `isX/*`), concrete for family-specific / floor / Number-static /
   registry; template-interpolated it-names were deliteralized so every ID is greppable.
   (b) A new additive vector `isBoxedX/R-ctorspoof` (a userland `class String {}` → false
   via the tag marker) — the ctor-name-spoof-alone case the prose already described. (c)
   The three family-specific equality-helper vector IDs were normalized from the full
   helper name to the `dHSU{X}VE` abbreviation the shared vectors + tests already use
   (label-only, no behavioral change). (d) Two more `#config`→`#primitive` /
   short-`…Instance` stale spots the earlier amendment missed (resolved-item 5's
   completeness claim now holds), plus ADR forward-pointer hygiene (#039 / #051 ← #077;
   #026 ← #074; the decisions index). **One accepted exclusion:** `isBoxablePrimitive/B1`
   (the `document.all` future-proof boundary) is `typeof 'undefined'` legacy, browser-only
   — not exercisable in the node test env, so it is asserted in the spec as a documented
   boundary but carries no runtime test (the env-unreachable exclusion class, as in the
   error round). Bidirectional diff otherwise empty both ways.
