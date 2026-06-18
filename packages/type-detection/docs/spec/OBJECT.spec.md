# object — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`object.d.ts`, `object.js`,
> `architecture/object.md`, decisions #040, #041, #044, #045, #046, #047). Status:
> **FROZEN 2026-06-18** — decidability check passed (6 suites over all 4 public
> predicates + the 2 exported helpers, via the `@/index.js` barrel, single realm). The run
> corrected one stale doc-comment claim — the `isDictionaryObject` `getDefinedConstructor`
> cross-validator admits (not rejects) an attached own `constructor` key (#047); the
> `object.{js,d.ts}` comments were fixed. Base for the axis-1 suite; axes 2–4 derive
> alongside.

## Module contract

`type-detection / object` discriminates non-null, non-function objects into three runtime
shapes plus a named union:

```
AnyObject               (isObject)                  — non-null, non-function object
  ├── PlainObject        (isPlainObject)             — direct constructor is built-in Object
  └── DictionaryObject   (isDictionaryObject)        — no prototype-chain (Object.create(null))
PlainOrDictionaryObject (isPlainOrDictionaryObject)  — PlainObject | DictionaryObject (lodash-equiv)
```

`PlainObject` and `DictionaryObject` are mutually exclusive (constructor === Object vs. no
prototype) and type-disjoint (`constructor: ObjectConstructor` vs. `constructor?: never`).
`isPlainObject` is **strict** (rejects `Object.create(null)`); the lodash-permissive set
is the fused `isPlainOrDictionaryObject`. Decisions #040 (structural subtype over
branding), #041/#046 (strict-vs-lodash), #044 (five-marker anchor), #045 (dictionary tag
cross-validator), #047 (`getDefinedConstructor` pivot).

## Surface inventory

**Public predicates (axis 1):** `isObject`, `isPlainObject`, `isDictionaryObject`,
`isPlainOrDictionaryObject`.

**Exported `@internal` helpers (axis 4):** `hasPlainObjectIdentitySignal` (two cheap
string-shape markers), `hasPlainObjectPrototypeContract` (the five-marker prototype
contract). Exporting these is what makes the cross-realm structural arm of `isPlainObject`
unit-testable on **local** plain objects (the helpers carry no local-realm fast-path, so
they run the realm-independent logic directly — no `vm` realm needed).

**Exported types without a predicate:** `AnyObject`, `PlainObject`, `DictionaryObject`,
`PlainOrDictionaryObject`.

Re-confirmation gate: 6 `.js` exports = 6 `.d.ts` declarations, no surface gap;
`architecture/object.md` matches the code (no drift).

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted → rejected by all four (the `isObject`
  gate).
- **CC/primitive** — `'x'`, `42`, `true`, `Symbol()`, `1n`, and falsy
  `0`/`''`/`false`/`NaN` → rejected (`!!value` + `typeof === 'object'`).
- **CC/function** — `() => {}`, `class {}`, `function(){}` → rejected
  (`typeof === 'function'`).

---

## `isObject`

`isObject<T = unknown>(value?: T): value is T & AnyObject` —
`!!value && typeof value === 'object'`. Realm-independent.

- `isObject/A1` — `{}`, `{ a: 1 }` → true.
- `isObject/A2` — `[]`, `new Date()`, `new Map()`, `/re/` → true (containers/instances are
  objects).
- `isObject/A3` — `Object.create(null)` → true (prototype-less still an object).
- `isObject/A4` — `new String('x')`, `new Number(1)` → true (boxed primitives are
  objects).
- `isObject/A5` — `new (class Foo {})()` → true (class instance).
- `isObject/R1` — primitives, nullish, functions → false (CC vectors).

**Cross-realm (axis 2):** trivially realm-safe (`typeof` is realm-independent). **Spoof:**
none (syntactic operator).

---

## `isPlainObject`

`isPlainObject<T = unknown>(value?: T): value is T & PlainObject` Composition:
`isObject(value) && (getPrototypeOf(value) === objectPrototype || (hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value)))`.

- `isPlainObject/A1` — `{}`, `{ a: 1 }`, `new Object()`, `Object.create(Object.prototype)`
  → true (local-realm fast-path: proto === `objectPrototype`).
- `isPlainObject/A2` — a cross-realm plain object (fixture) → true (structural arm:
  signal + five-marker contract). The structural _logic_ is pinned in-realm by the helper
  specs below.
- `isPlainObject/R1` — `[]` (constructor `Array`), `new Date()`, `new Map()`, `/re/` →
  false.
- `isPlainObject/R2` — `new (class Foo {})()` → false (constructor `Foo`, not `Object`).
- `isPlainObject/R3` — `Object.create(null)` → false (no constructor — that's
  `isDictionaryObject`).
- `isPlainObject/R4` — `new String('x')` → false (tag `'[object String]'`, proto
  `String.prototype`).
- `isPlainObject/R5` — `Object.create({ a: 1 })` → false (proto is a
  non-`Object.prototype` plain object; fails fast-path; contract marker 5
  `getPrototypeOf(prototype) === null` and constructor checks fail).
- (plus CC/nullish, CC/primitive, CC/function.)

**Refuses to claim:** prototype-less objects (delegated to `isDictionaryObject`).
**Cross-realm (axis 2):** admit foreign-realm plain objects via the structural arm.
**Spoof (axis 3):** the five-marker contract closes the tampered-`constructor`-pointer
spoof (round-trip identity marker 4) and the lying-accessor spoof (descriptor-via-`.value`
on markers 3/4); the chain-depth marker 5 rejects class/container instances structurally.
Residual: a from-scratch reconstruction of `Object`'s spec mechanics = a parallel
implementation, not a spoof. **Composition note (axis 4):** `isObject` gate → fast-path
`objectPrototype` ref → `hasPlainObjectIdentitySignal` +
`hasPlainObjectPrototypeContract`.

---

## `isDictionaryObject`

`isDictionaryObject<T = unknown>(value?: T): value is T & DictionaryObject` Composition:
`isObject(value) && getPrototypeOf(value) === null && getDefinedConstructor(value) === undefined && getTypeSignature(value) === '[object Object]'`.

- `isDictionaryObject/A1` — `Object.create(null)` → true.
- `isDictionaryObject/A2` — `Object.setPrototypeOf({}, null)` → true (prototype later
  nulled).
- `isDictionaryObject/A3` — `Object.assign(Object.create(null), { constructor: Object })`
  → **true** — a prototype-less hashmap carrying a user-supplied `'constructor'` data key
  is still a dictionary. `getDefinedConstructor` deliberately ignores an own `constructor`
  property (#047), so the key is data, not a reachable constructor. (This corrected a
  stale doc claim — see Resolved items #1.)
- `isDictionaryObject/R1` — `{}` → false (proto `Object.prototype`).
- `isDictionaryObject/R2` — `[]`, `new Date()`, `new (class {})()` → false (non-null
  proto).
- `isDictionaryObject/R3` — `Object.create({ a: 1 })` → false (non-null proto).
- `isDictionaryObject/R4` — a prototype-less object hand-decorated with own
  `Symbol.toStringTag` → false (the `getTypeSignature === '[object Object]'`
  cross-validator rejects the spoofed tag).
- (plus CC vectors.)

**Refuses to claim:** prototype-bearing plain objects (that's `isPlainObject`).
**Cross-realm (axis 2):** realm-orthogonal — prototype-less is prototype-less in every
realm. **Spoof (axis 3):** the `getTypeSignature === '[object Object]'` cross-validator
closes the spoofed-tag surface (`R4`). The `getDefinedConstructor === undefined` marker
does NOT reject an attached own `constructor` key (it is ignored by design, #047 — see
`A3`); it is defense-in-depth paired with `getPrototypeOf === null`. **Composition note
(axis 4):** `isObject` + `getPrototypeOf` (`@/config`) + `getDefinedConstructor` +
`getTypeSignature` (`@/utility`).

---

## `isPlainOrDictionaryObject`

`isPlainOrDictionaryObject<T = unknown>(value?: T): value is T & PlainOrDictionaryObject`
Fused: one `isObject` gate + one `getPrototypeOf` read, then dispatch —
`=== objectPrototype` → accept; `=== null` → verify the two dictionary cross-validators;
else → the cross-realm plain-object contract.

- `isPlainOrDictionaryObject/A1` — `{}`, `new Object()` → true (plain, fast-path).
- `isPlainOrDictionaryObject/A2` — `Object.create(null)` → true (dictionary branch).
- `isPlainOrDictionaryObject/A3` — a cross-realm plain object (fixture) → true
  (cross-realm fallback).
- `isPlainOrDictionaryObject/R1` — `[]`, `new Date()`, `new (class Foo {})()` → false.
- `isPlainOrDictionaryObject/R2` — `Object.create({ a: 1 })` → false
  (non-`objectPrototype`, non-null proto; fails the contract walk).
- (plus CC vectors.)

**Cross-realm / spoof (axes 2, 3):** inherits from the two strict predicates it fuses.
**Composition note (axis 4):** shares the gate + prototype read; drives
`getDefinedConstructor`, `getTypeSignature`, `hasPlainObjectIdentitySignal`,
`hasPlainObjectPrototypeContract`.

---

## Helper specification (axis 4)

### `hasPlainObjectIdentitySignal(value?)` — `@internal`

`getTypeSignature(value) === '[object Object]' && getDefinedConstructorName(value) === 'Object'`.

- `hPOIS/A1` — `{}`, `new Object()`, `Object.create(Object.prototype)` → true.
- `hPOIS/R1` — `[]` (tag `'[object Array]'`), `new Date()` (tag `'[object Date]'`) →
  false.
- `hPOIS/R2` — `Object.create(null)` → false (constructor-name resolves to `undefined`,
  not `'Object'`).
- `hPOIS/R3` — `new (class Foo {})()` → false (constructor-name `'Foo'`).

### `hasPlainObjectPrototypeContract(value?)` — `@internal` (the five-marker cross-realm anchor; runs the realm-independent logic on local values)

- `hPOPC/A1` — `{}`, `new Object()` → true (all five markers hold for a real plain
  object).
- `hPOPC/R1` — `[]` → false (marker 2: `getTypeSignature(Array.prototype)` is
  `'[object Array]'`).
- `hPOPC/R2` — `new (class Foo {})()` → false (marker 3: constructor `name` is `'Foo'`,
  not `'Object'`).
- `hPOPC/R3` — `Object.create(null)` → false (`isObject(prototype)` is false → no
  constructor → `isClass` fails).
- `hPOPC/R4` — a plain object whose `constructor` is tampered to point at the global
  `Object` while its prototype is a hand-crafted non-`Object.prototype` → false
  (round-trip marker 4: `Object.prototype !== value`'s prototype).

---

## Resolved items

1. **`isDictionaryObject` doc-comment inaccuracy (doc↔impl) — RESOLVED.** The decidability
   run caught a stale claim: `object.js` + `object.d.ts` stated that the
   `getDefinedConstructor === undefined` cross-validator "catches cases where the
   prototype is null but a `constructor` property has been explicitly attached to the
   value (a real spoof surface the cross-validator closes)." Verified false —
   `getDefinedConstructor` deliberately ignores an own `constructor` data property (#047),
   so `isDictionaryObject(Object.assign(Object.create(null), { constructor: Object }))` is
   **admitted** (`A3`), not rejected. The implementation is correct (a hashmap with a
   `'constructor'` key is still a dictionary); the doc-comments were corrected to describe
   the marker's real behavior (defense-in-depth paired with `getPrototypeOf === null`).
   `architecture/object.md` needed no change (it already attributed spoof-closing to the
   tag cross-validator only). Both structural helpers were already exported `@internal`
   (no #053-style action needed).

No open items.
