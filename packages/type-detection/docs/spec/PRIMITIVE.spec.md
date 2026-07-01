# primitive — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`primitive.d.ts`, `primitive.js`,
> `architecture/primitive.md`, decisions #038, #039, #042, #043, #049, #050, #051, #053;
> boxed-primitive memory). Status: **FROZEN 2026-06-18** — decidability check passed (23
> cases over all 19 public predicates + the 10 exported helpers, run against the real
> implementations through the `@/index.js` barrel). The run corrected the equality-helper
> behavior (they admit the same-family primitive too, not only the boxed form). Base for
> the axis-1 suite; axes 2–4 derive alongside.
>
> **Post-freeze amendment 2026-07-01:** two symbol-registry exports omitted at freeze are
> now covered — the public `isRegisteredSymbol` and its `@internal` helper
> `unguardedIsUnregisteredSymbol` (the decidability run tested 19 public predicates and
> read the gate as 29 = 29; the true surface is 20 public predicates, gate 31 = 31).
> Purely additive — new sections + inventory + corrected gate; no existing vector changes.
> See the Open / resolved items.

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

**Exported `@internal` helpers (axis 4) — equality (slot) probes:**
`doesHaveStrictUnboxedStringValueEquality`, `doesHaveStrictUnboxedNumberValueEquality`,
`doesHaveStrictUnboxedBooleanValueEquality`, `doesHaveStrictUnboxedSymbolValueEquality`,
`doesHaveStrictUnboxedBigIntValueEquality`.

**Exported `@internal` helpers (axis 4) — realm-resolution machinery (exported for
single-realm testability, decision #053):** `isCurrentRealmNativeString` /
`isCurrentRealmNativeNumber` / `isCurrentRealmNativeBoolean` (the shared
`instanceof + proto-identity` discriminators),
`resolvedViaES3NativePrimitiveTypesHotPaths` (the current-realm path of
`isBoxedPrimitive`), and `resolvedViaAlienRealmPrimitiveTypesEvaluation` (the alien-realm
path — testable with local-realm boxed values, so the cross-realm logic needs no foreign
realm).

**Exported `@internal` helper (axis 4) — symbol-registry:**
`unguardedIsUnregisteredSymbol` (the unguarded `Symbol.keyFor`-based unregistered-symbol
check that `isRegisteredSymbol` gates and negates).

**Module-local data (unexported — internal tables, covered transitively):** the
`unboxedPrimitiveValueEvaluations` dispatch `Map` (exercised through
`resolvedViaAlienRealmPrimitiveTypesEvaluation`) and the `nonBoxableTypeSignatures` `Set`
(exercised through the public `isBoxablePrimitive`).

**Exported types without a predicate:** the 5 `XValue`, 5 `BoxedX`, 5 `XType`, and the 4
floor types (`NullishPrimitive`, `BoxablePrimitive`, `PrimitiveValue`, `BoxedPrimitive`) —
type-only, verified by `tsc`, no runtime vector.

Re-confirmation gate: 31 `.js` exports = 31 `.d.ts` declarations, no surface gap (20
public predicates + 5 equality helpers + 5 realm-resolution helpers + 1 symbol-registry
helper).

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

`isXValue<T = unknown>(value?: T): value is T & XValue` — composition
`typeof value === '<x>'`. Realm-independent (`typeof` reads identically in every realm)
and the cheapest predicates in the package.

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
  primitives; finiteness is a separate concern, `@/config`).
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

`isBoxedX<T = unknown>(value?: T): value is T & BoxedX`. Two sub-shapes by family kind.

**Constructor-aware (`isBoxedString` / `isBoxedNumber` / `isBoxedBoolean`):**
`isObject(v) && (isCurrentRealmNativeX(v) || (getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X')) && doesHaveStrictUnboxedXValueEquality(v)`

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

**Composition note (axis 4):** drives `isObject` (`@/object`), the module-local
`isCurrentRealmNativeX` (constructor-aware families), `getTypeSignature` +
`getDefinedConstructorName` (`@/utility`), and the exported
`doesHaveStrictUnboxedXValueEquality`.

---

## Composite-predicate family — `isX`

`isX<T = unknown>(value?: T): value is T & XType` — composition
`isXValue(v) || isBoxedX(v)`, the cheaper `typeof` check first.

- `isX/A1` — the primitive form → true.
- `isX/A2` — the boxed form → true.
- `isX/R1` — another family (value or boxed) → false.
- `isX/R2` — `null`, `undefined`, `{}` → false.

**Cross-realm / spoof:** inherits from `isBoxedX` on the boxed arm; the value arm is
realm-safe and spoof-proof.

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
- `doesHaveStrictUnboxedNumberValueEquality/A-NaN` — `new Number(NaN)` and `NaN` → true
  (`Object.is`).
- `doesHaveStrictUnboxedBooleanValueEquality/A-false` — `new Boolean(false)` and `false` →
  true (stringified compare).
- `doesHaveStrictUnboxedSymbolValueEquality/R-descshadow` — description-shadowed boxed
  `Symbol` → false; `Object(Symbol())` / `Symbol()` (no description) → true
  (`undefined === undefined`).

These five are also reachable directly (exported `@internal`), so axis 4 unit-tests them
in isolation in addition to their composition inside the boxed predicates.

---

## Helper specification (axis 4) — the five realm-resolution helpers

All five assume an object-typed receiver (the public predicates apply the `isObject` gate
first), so the vectors below pass objects only. Exported `@internal` for single-realm
testability (decision #053).

### `isCurrentRealmNativeString` / `Number` / `Boolean`

`value instanceof X && getPrototypeOf(value) === X.prototype` — the subclass-rejection
primitive; does NOT seal the slot.

- `iCRNX/A1` — `new X(...)` / `Object(prim)` for the family → true.
- `iCRNX/R1` — a direct instance of a _different_ family (e.g.
  `isCurrentRealmNativeString(new Number(1))`) → false.
- `iCRNX/R2` — a subclass instance (`new (class extends X {})(...)`) → false
  (proto-identity; bare `instanceof` would admit it).
- `iCRNX/R3` — a plain `{}` → false.
- `iCRNX/B1` — `Object.create(X.prototype)` → **true** (proto-identity holds). Pins the
  division of labor: this helper admits the graft; the downstream slot-probe is what
  rejects it.

### `resolvedViaES3NativePrimitiveTypesHotPaths`

The current-realm path of `isBoxedPrimitive`:
`(isCurrentRealmNativeString && slotString) || (…Number…) || (…Boolean…)`.

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
   realm-resolution helpers (`isCurrentRealmNativeString` / `Number` / `Boolean`,
   `resolvedViaES3NativePrimitiveTypesHotPaths`,
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
