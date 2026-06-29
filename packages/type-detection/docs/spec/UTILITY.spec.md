# utility — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`utility/index.d.ts`, `utility/index.js`,
> `architecture/utility.md`, decisions #020 (inert/property-access discipline), #025
> (parameter-default-to-`null`), #026 (`isSafeIntegerValue` retype), #047 (inert
> constructor walk), #048 (lowercase-name precedence)). Status: **FROZEN 2026-06-19** —
> decidability check passed (44 suites over all 15 public functions, via the `@/index.js`
> barrel, single realm). No surprises — the canon was accurate and every vector matched
> the real impl on the first run. The three inert-probe siblings
> (`hasInertGetter`/`Setter`/ `Value`) were promoted from `@internal` to public after the
> run (Resolved items #1). Base for the axis-1 suite; axes 2–4 derive alongside. Amended
> 2026-06-25 — the `getInertPrototypeOf` rename (was `guardedGetPrototypeOf`) and the
> retirement of the `getOwnPropertyDescriptors{Keys,KeySet}` pair in favour of
> `getOwnPropertyKeys` + the throw-safe `getInertOwnProperty{Names,Symbols,Keys}` family
> (see Resolved items #2).

## Module contract

`type-detection / utility` hosts the cross-realm-safe primitives that feed every
domain-specific predicate: descriptor-chain walks, inert (inspect-without-invoke) method
and accessor probes, tag/type-signature readers, the tamper-resistant inert constructor
walk, and the public type-name resolver. It sits below every domain in the dependency
graph and carries no domain-specific knowledge.

The uniform discipline (decision #020): every property read is **descriptor-based**, and
accessor invocation is **deliberately avoided** — "inert" throughout. Reads split by
spec-shape — own-data via `getOwnPropertyDescriptor(...).value`; inherited via the
prototype-chain walk in `getNextAvailablePropertyDescriptor`. The constructor walk (#047)
is tamper-resistant: a user-supplied own `constructor` data property cannot influence the
result.

This module is almost entirely **readers and probes**, not type-guards. The single
narrowing predicate is `isValidPropertyKey` (`value is PropertyKey`); everything else
returns `boolean`, a `string`/`Set`/descriptor, or `undefined`.

## Surface inventory

**Public functions (axis 1) — 15:**

- Prototype-property probes: `hasOwnPrototype`, `hasOwnWritablePrototype` (boolean).
- Property-key: `isValidPropertyKey` (the one narrowing guard → `value is PropertyKey`),
  `getNextAvailablePropertyDescriptor` (chain walk → descriptor | undefined),
  `getOwnPropertyKeys` (→ `(string | symbol)[]`, own string + symbol keys).
- Inert (inspect-without-invoke) probes: `hasInertMethod` (callable data property),
  `hasInertGetter` (accessor `get`), `hasInertSetter` (accessor `set`), `hasInertValue`
  (data-descriptor presence) — each resolved along the prototype-chain. All four are
  public by design: an inert probe is a general-purpose introspection primitive, useful to
  anyone doing reflection, so the accessor/data siblings are first-class exports alongside
  `hasInertMethod`, not `@internal` helpers.
- Type-signature readers: `getTypeSignature`, `getTaggedType` (each overloaded: omitted
  arg → `undefined`).
- Constructor inspection: `getDefinedConstructor`, `getDefinedConstructorName`.
- Type resolution: `resolveType` (overloaded: omitted arg → `undefined`).

**Exported `@internal` helpers — 3:** the throw-safe own-key readers
`getInertOwnPropertyNames`, `getInertOwnPropertySymbols`, `getInertOwnPropertyKeys` (added
post-freeze 2026-06-25; see Resolved items #2). The inert _probe_ set
(`hasInertGetter`/`hasInertSetter`/`hasInertValue`) is public — its former `@internal`
tags were removed (Resolved items #1).

**Exported types (8):** `PropertyDescriptor`, `PropertyDescriptorMap`,
`DefinedConstructorAccessorOptions`, `BlankType`, `ConstructorName`, `TaggedType`,
`ResolvedType`, `TypeSignature`.

Re-confirmation gate (as amended 2026-06-25): 14 public `.js` value exports + 3
`@internal` own-key readers, each with a matching `.d.ts` declaration; the retired
`getOwnPropertyDescriptorsKeys` / `getOwnPropertyDescriptorsKeySet` pair was removed and
the public `getOwnPropertyKeys` added (Resolved items #2); 8 type exports match;
`architecture/utility.md` matches the code. The exact surface tally is re-derived during
the utility test round.

## Cross-cutting vectors

- **CC/nullish-safe** — `hasOwnPrototype`, `hasOwnWritablePrototype`,
  `getOwnPropertyKeys`, `getInertOwnPropertyNames`/`Symbols`/`Keys`,
  `getDefinedConstructor`, `getDefinedConstructorName`, `isValidPropertyKey` all accept
  `null`/`undefined`/omitted without throwing (each returns its empty/false/undefined
  floor). The inert probes (`hasInertMethod`/`Getter`/`Setter`/`Value`) take `null` as the
  parameter default and short-circuit `type !== null` first.
- **CC/inert** — no function in this module ever invokes an accessor getter/setter or a
  stored callable. Every "callable?" question is answered from the descriptor's `value`/
  `get`/`set` field, never by property access. A getter that throws on access must never
  fire (see `gNAPD/B1`, `hIM/R3`).
- **CC/omitted-vs-undefined** — `getTypeSignature`, `getTaggedType`, `resolveType`
  distinguish an omitted call (→ `undefined`) from an explicit `undefined` argument (→
  `'[object Undefined]'` / `'Undefined'`), via `args.length`.

---

## `hasOwnPrototype`

`hasOwnPrototype(value?: unknown): boolean` —
`!!value && !!getOwnPropertyDescriptor(value, 'prototype')`.

- `hOP/A1` — `function f() {}`, `class C {}`, `function* () {}`, `Array` → true (own
  `prototype` descriptor present).
- `hOP/R1` — `() => {}`, `({ m() {} }).m`, `async function () {}` → false (no own
  `prototype`; arrow inherits from `Function.prototype`).
- `hOP/R2` — `(function () {}).bind(null)` → false (`bind` strips the own `prototype`
  slot).
- `hOP/R3` — `{}`, `[]`, `42`, `'x'`, CC/nullish → false (no own `prototype`).

**Cross-realm (axis 2):** realm-safe — own-descriptor read, no intrinsic identity.

---

## `hasOwnWritablePrototype`

`hasOwnWritablePrototype(value?: unknown): boolean` —
`!!value && getOwnPropertyDescriptor(value, 'prototype')?.writable === true`.

- `hOWP/A1` — `function f() {}`, `function* () {}`, `async function* () {}` → true (own
  writable `prototype`).
- `hOWP/R1` — `class C {}`, `Array`, `Map`, `Symbol` → false (own `prototype` is readonly
  — the ES3-vs-class tell).
- `hOWP/R2` — `() => {}`, `async function () {}` → false (no own `prototype`).
- `hOWP/R3` — `(function () {}).bind(null)`, `{}`, CC/nullish → false.

**Cross-realm (axis 2):** realm-safe. **Composition note:** the structural discriminator
`isES3Function` (`@/function`) drives this.

---

## `isValidPropertyKey`

`isValidPropertyKey(value?: unknown): value is PropertyKey` —
`isStringValue(value) || isSymbolValue(value) || isSafeIntegerValue(value)`. The one
narrowing guard.

- `iVPK/A1` — `'x'`, `''`, `'1.5'` → true (any string is a valid key).
- `iVPK/A2` — `Symbol()`, `Symbol.iterator` → true.
- `iVPK/A3` — `0`, `42`, `-5`, `Number.MAX_SAFE_INTEGER` → true (safe integers).
- `iVPK/R1` — `1.5`, `NaN`, `Infinity`, `-Infinity` → false (non-integer / non-finite).
- `iVPK/R2` — `Number.MAX_SAFE_INTEGER + 1`, `2 ** 53` → false (beyond safe-integer; the
  round-trip loses precision).
- `iVPK/R3` — `null`, `undefined`/omitted, `{}`, `[]`, `true`, `1n` → false (not a string,
  symbol, or safe integer — `1n` is a bigint, not a number).

**Refuses to claim:** that finite-non-integer numbers (`1.5`) are usable keys — they
coerce to surprising string keys at runtime, so they are deliberately excluded (#026).

---

## `getNextAvailablePropertyDescriptor`

`getNextAvailablePropertyDescriptor(value: unknown, key: PropertyKey): PropertyDescriptor | undefined`
— walks own properties first, then up the `[[Prototype]]` chain, returning the first
descriptor found. Getter never invoked.

- `gNAPD/A1` — `({ a: 1 }, 'a')` → a data descriptor with `value: 1` (own).
- `gNAPD/A2` — `({}, 'toString')` → the data descriptor from `Object.prototype`
  (inherited; `value` is callable).
- `gNAPD/A3` — `([], 'length')` → the own data descriptor for `length`.
- `gNAPD/B1` — `({ get x() { throw new Error('boom'); } }, 'x')` → the accessor descriptor
  returned as-is, **without throwing** (the getter is not invoked — the inert guarantee).
- `gNAPD/R1` — `({}, 'nonexistent')` → `undefined` (chain exhausted).
- `gNAPD/R2` — `({ a: 1 }, 1.5)` / `({ a: 1 }, {})` → `undefined` (invalid key
  short-circuits before any walk).
- `gNAPD/R3` — `(null, 'x')` → `undefined` (the `value = null` default + loop guard).

**Cross-realm (axis 2):** realm-safe — descriptor reads + `getPrototypeOf` are
realm-independent. **Composition note (axis 4):** the chain-walk primitive behind
`hasInertMethod`/`Getter`/`Setter`/`Value` and `getDefinedConstructor`.

---

## `getOwnPropertyKeys`

`getOwnPropertyKeys(value?: unknown): (string | symbol)[]` —
`getOwnPropertyNames(value ?? !0).concat(getOwnPropertySymbols(value ?? !0))`. All own
keys — string-named and symbol-keyed, enumerable and non-enumerable. The raw form; the
throw-safe twin is `getInertOwnPropertyKeys`.

- `gOPK/A1` — `Object.defineProperty({ a: 1 }, 'b', { value: 2 })` → `['a', 'b']`
  (non-enumerable `b` included).
- `gOPK/A2` — `{ [Symbol('s')]: 1, a: 1 }` → `['a', Symbol(s)]` (symbol keys INCLUDED —
  contrast the retired `getOwnPropertyDescriptorsKeys`, which was string-only).
- `gOPK/A3` — `{}` → `[]`; `Object.create(null)` → `[]`.
- `gOPK/R1` — `null`, `undefined`/omitted → `[]` (the `?? !0` coerces nullish to a boxed
  `true`, dodging the `getOwnPropertyNames(null)` throw).

**Cross-realm (axis 2):** realm-safe.

---

## `getInertOwnPropertyNames` / `getInertOwnPropertySymbols` / `getInertOwnPropertyKeys` — `@internal`

The throw-safe variants of `getOwnPropertyNames` / `getOwnPropertySymbols` / {@link
getOwnPropertyKeys}: each wraps its read so a hostile `Proxy` `ownKeys` trap (or nullish
input) yields `[]` rather than propagating. `getInertOwnPropertyKeys` concatenates the
other two.

- `gIOPN/A1` — own string names incl. non-enumerable; nullish → `[]`; a `Proxy` whose
  `ownKeys` trap throws → `[]`, **not thrown**.
- `gIOPS/A1` — own symbol keys; nullish → `[]`; throwing `ownKeys` trap → `[]`, **not
  thrown**.
- `gIOPK/A1` — string + symbol keys (the two above concatenated); throwing trap → `[]`.

These feed the function-family proto-surface helpers, e.g.
`new Set(getInertOwnPropertyNames(getInertPrototypeOf(value)))`.

**Cross-realm (axis 2):** realm-safe.

---

## `hasInertMethod`

`hasInertMethod(type?: unknown, key?: PropertyKey): boolean` —
`type !== null && isCallable(getNextAvailablePropertyDescriptor(type, key)?.value)`.
Public inert probe for a callable data property reachable through the chain.

- `hIM/A1` — `(Promise.resolve(), 'then')` → true (inherited callable).
- `hIM/A2` — `({ then() {} }, 'then')`, `({ then: () => {} }, 'then')` → true (own
  callable).
- `hIM/R1` — `({}, 'then')` → false (no such key).
- `hIM/R2` — `({ then: 5 }, 'then')` → false (data descriptor, value not callable).
- `hIM/R3` — `({ get then() { return () => {}; } }, 'then')` → false (accessor descriptor
  rejected — even though its getter would return a callable, it is never invoked).
- `hIM/R4` — `(null, 'then')`, `(undefined, 'then')` → false (nullish short-circuit).
- `hIM/R5` — `({ then() {} }, 1.5)` → false (invalid key → `undefined` descriptor →
  `isCallable(undefined)` false).
- `hIM/R6` — a Proxy whose `getOwnPropertyDescriptor` (or `getPrototypeOf`) trap
  **throws**, or a value whose `get then()` accessor throws on access → **false, not
  thrown**. The descriptor walk runs through the private throw-swallowing
  `getInertDescriptor` wrapper (Resolved items #2). The four inert probes share this
  guarantee.

**Cross-realm (axis 2):** realm-safe. **Spoof (axis 3):** the accessor-rejection (`R3`) is
the inert guarantee — a lying `get then()` cannot fire; a throwing trap/accessor yields
`false` (`R6`), not an exception. **Composition note (axis 4):** `getInertDescriptor`
(wrapping `getNextAvailablePropertyDescriptor`) → `isCallable`.

---

## `getTypeSignature`

`getTypeSignature(value): TypeSignature` / `getTypeSignature(): undefined` — reads the
`[[Class]]` tag via the cached `Object.prototype.toString.call`.

- `gTS/A1` — `[]` → `'[object Array]'`; `new Date()` → `'[object Date]'`;
  `Promise.resolve()` → `'[object Promise]'`.
- `gTS/A2` — `null` → `'[object Null]'`; `undefined` (explicit) → `'[object Undefined]'`.
- `gTS/A3` — `{ [Symbol.toStringTag]: 'Custom' }` → `'[object Custom]'` (custom tag
  honored).
- `gTS/A4` — `42` → `'[object Number]'`; `'x'` → `'[object String]'`; `() => {}` →
  `'[object Function]'`.
- `gTS/B1` — omitted call `getTypeSignature()` → `undefined` (distinguished from explicit
  `undefined` via `args.length`).
- `gTS/B2` — a value whose `Symbol.toStringTag` is an accessor that **throws** on read →
  `undefined`, **not thrown** (throw-safe; the `toObjectString.call` is wrapped
  `try/catch`). `getTaggedType` and `resolveType` inherit this (they compose
  `getTypeSignature`). Extends decision #029 to the tag read.

**Cross-realm (axis 2):** realm-safe — the cached `toObjectString` is realm-fixed and
immune to a missing/overridden instance `toString`. **Throw-safe (axis 3):** a hostile
`Symbol.toStringTag` getter yields `undefined`, not an exception (`gTS/B2`).

---

## `getTaggedType`

`getTaggedType(value): TaggedType` / `getTaggedType(): undefined` — the tag substring of
`getTypeSignature`, `[object …]` unwrapped.

- `gTT/A1` — `[]` → `'Array'`; `new Date()` → `'Date'`; `null` → `'Null'`.
- `gTT/A2` — `{ [Symbol.toStringTag]: 'Custom' }` → `'Custom'`.
- `gTT/A3` — `undefined` (explicit) → `'Undefined'`.
- `gTT/B1` — omitted call `getTaggedType()` → `undefined` (the `isStringValue`
  short-circuit on `getTypeSignature`'s `undefined`).

**Cross-realm (axis 2):** realm-safe (inherits from `getTypeSignature`).

---

## `getDefinedConstructor`

`getDefinedConstructor(value?: unknown, options?: { assumePrototype?: boolean }): NewableFunction | undefined`
— the inert, tamper-resistant constructor walk (#047). Pivot: callable values walk from
themselves; non-callable values walk from their `[[Prototype]]` (bypassing the value's own
`constructor`).

- `gDC/A1` — `[]` → `Array`; `new Date()` → `Date`; `{}` → `Object`; `42` → `Number`;
  `'x'` → `String` (primitives box through `getPrototypeOf`).
- `gDC/A2` — `function () {}` → `Function`; `async () => {}` → `%AsyncFunction%`;
  `function* () {}` → `%GeneratorFunction%` (callable pivot — walks from the value to its
  own constructor).
- `gDC/A3` — `(function* () {})()` (a Generator instance) → `%GeneratorFunction%` — the
  two-stage walk: the first `constructor` descriptor lands on
  `%GeneratorFunction.prototype%` (an object, not a function), and the follow-up walk
  recovers the function constructor.
- `gDC/A4` — `getDefinedConstructor(Object.prototype, { assumePrototype: true })` →
  `Object` (skips the walk-up; reads the own `constructor` descriptor mandated by ECMA-262
  §10.2.6).
- `gDC/R1` — `Object.create(null)` → `undefined` (no reachable `constructor`).
- `gDC/R2` — `null`, `undefined`/omitted → `undefined`.

**Cross-realm (axis 2):** realm-safe — descriptor-walk, no intrinsic identity. **Spoof
(axis 3):** the non-callable pivot bypasses the value's own `constructor`, so
`getDefinedConstructor({ constructor: 'tampered' })` → `Object` and
`getDefinedConstructor({ constructor: Array })` → `Object` (the override cannot redirect
the structural read). Fully inert — accessor getters on `constructor` are never invoked.
**Composition note (axis 4):** `isCallable` (pivot) → `getNextAvailablePropertyDescriptor`
→ `isFunction` (callability verified; `[[Construct]]` asserted, not probed).

---

## `getDefinedConstructorName`

`getDefinedConstructorName(value?: unknown): ConstructorName | undefined` — the
constructor's `name` via `getOwnPropertyDescriptor(constructor, 'name').value`, narrowed
by `isStringValue`.

- `gDCN/A1` — `[]` → `'Array'`; `new Date()` → `'Date'`; `42` → `'Number'`.
- `gDCN/A2` — `(function* () {})()` → `'GeneratorFunction'`; `async () => {}` →
  `'AsyncFunction'`.
- `gDCN/A3` — `new (function () {})()` → `''` — an anonymous function expression has an
  own `name` data descriptor whose value is the empty string (pin this; `''` is a real
  string, not `undefined`).
- `gDCN/R1` — a constructor whose `name` is replaced with an accessor
  (`Object.defineProperty(C, 'name', { get: () => 'Spoofed' })`) → `undefined` (the
  descriptor `value` is undefined; the accessor never fires).
- `gDCN/R2` — a constructor whose `name` is a non-string (`{ value: 123 }`) → `undefined`
  (the `isStringValue` narrow rejects it).
- `gDCN/R3` — `Object.create(null)`, `null`, omitted → `undefined`.

**Cross-realm (axis 2):** realm-safe. **Spoof (axis 3):** own-data descriptor read with no
direct-access fallback closes the `name`-accessor spoof (`R1`) and the non-string-`name`
spoof (`R2`); inherits the tamper-resistant constructor walk. **Composition note (axis
4):** `getDefinedConstructor` → `getOwnPropertyDescriptor(…, 'name').value` →
`isStringValue`.

---

## `resolveType`

`resolveType(value): ResolvedType` / `resolveType(): undefined` — the two-axis dispatch
(#048): a Unicode-uppercase-leading constructor name wins outright; otherwise the tag from
`getTaggedType`, except a non-empty lowercase name beats the uninformative `'Object'` tag.

- `rT/A1` — `[]` → `'Array'`; `Promise.resolve()` → `'Promise'`; `new Date()` → `'Date'`
  (PascalCase constructor name wins — axis 1).
- `rT/A2` — `null` → `'Null'`; `undefined` (explicit) → `'Undefined'` (no constructor
  name; tag is the canonical answer).
- `rT/A3` — `Object.create(null)` → `'Object'` (no reachable constructor; tag `'Object'`).
- `rT/A4` — `new (function foo() {})()` → `'foo'` — a non-empty lowercase name beats the
  `'Object'` tag (axis 2).
- `rT/A5` — `new (function () {})()` → `'Object'` — empty name carries no information, so
  the tag wins.
- `rT/B1` — omitted call `resolveType()` → `undefined` (via `args.length`).

**Cross-realm (axis 2):** realm-safe. **Spoof (axis 3):** a `Symbol.toStringTag` override
on a value whose constructor name is PascalCase is short-circuited at axis 1 (the tag is
not consulted) — e.g. a `class Foo` carrying `[Symbol.toStringTag] = 'Bar'` resolves to
`'Foo'` (`rT/A6`); and the tamper-resistant `getDefinedConstructorName` walk means a user
`constructor` data property cannot influence the read. **Composition note (axis 4):**
`getDefinedConstructorName` + `getTaggedType` under the `startsWithUpperCase` regex.

- `rT/A6` — `(() => { class Foo {} ; return new Foo(); })()` with
  `Foo.prototype[Symbol.toStringTag] = 'Bar'` → `'Foo'` (constructor name wins over the
  tag override).

---

## Inert-sibling probes (axis 1)

The accessor/data siblings of `hasInertMethod`, public by the same rationale (see Surface
inventory + Resolved items #1). Same chain-walk + descriptor-shape discipline; fully
inert.

### `hasInertGetter(type?, key?)`

`type !== null && isCallable(getNextAvailablePropertyDescriptor(type, key)?.get)`.

- `hIG/A1` — `({ get x() {} }, 'x')` → true (accessor with callable getter).
- `hIG/R1` — `({ x: () => {} }, 'x')` → false (data descriptor — `?.get` is undefined).
- `hIG/R2` — `({ set x(v) {} }, 'x')` → false (setter-only accessor; no `get`).
- `hIG/R3` — `({}, 'x')`, `(null, 'x')` → false.

### `hasInertSetter(type?, key?)`

`type !== null && isCallable(getNextAvailablePropertyDescriptor(type, key)?.set)`.

- `hIS/A1` — `({ set x(v) {} }, 'x')` → true (accessor with callable setter).
- `hIS/R1` — `({ get x() {} }, 'x')` → false (getter-only; no `set`).
- `hIS/R2` — `({ x: 1 }, 'x')` → false (data descriptor).
- `hIS/R3` — `({}, 'x')`, `(null, 'x')` → false.

### `hasInertValue(type?, key?)`

`type !== null && objectHasOwn(getNextAvailablePropertyDescriptor(type, key) ?? {}, 'value')`.
Uses `objectHasOwn(descriptor, 'value')`, not `?.value !== undefined`, so a data
descriptor holding `undefined` is still recognized (matches ECMA-262 §6.2.5.1
`IsDataDescriptor`).

- `hIV/A1` — `({ x: 5 }, 'x')` → true (data descriptor present).
- `hIV/A2` — `({ x: undefined }, 'x')` → **true** — a data descriptor whose value is
  `undefined` is still a data descriptor (the reason for `objectHasOwn` over
  `?.value !== undefined`; pin this).
- `hIV/A3` — `({}, 'toString')` → true (inherited data descriptor from
  `Object.prototype`).
- `hIV/R1` — `({ get x() {} }, 'x')` → false (accessor descriptor has no `value` field).
- `hIV/R2` — `({}, 'nonexistent')` → false (no descriptor → `?? {}` →
  `objectHasOwn({}, 'value')` false).
- `hIV/R3` — `(null, 'x')` → false.

---

## Resolved items

1. **Inert-probe siblings promoted to public — RESOLVED.** `hasInertGetter`,
   `hasInertSetter`, and `hasInertValue` were originally tagged `@internal`. The design
   owner ruled them first-class public exports alongside `hasInertMethod`: an inert
   (inspect-without-invoke) probe is a general-purpose introspection primitive useful to
   any consumer doing reflection, so the accessor-`get`, accessor-`set`, and data-presence
   probes belong on the public surface, not locked to module scope. They were already
   exported with parallel `.d.ts` declarations (originally for the helper-unit axis), so
   the change was purely removing the `@internal` tag from both files — no new export, no
   new declaration. Public-function count: 12 → 15; `@internal` helpers: 3 → 0. No
   behavior change; the `hIG/*`, `hIS/*`, `hIV/*` vectors are unaffected.

2. **Inert probes hardened against throwing traps — RESOLVED (2026-06-22).** An
   adversarial probe of the `thenable` round found that a Proxy whose
   `getOwnPropertyDescriptor` / `getPrototypeOf` trap throws made `hasInertMethod` (and
   the sibling probes) **propagate the exception** rather than return a boolean — a sharp
   edge for a type-guard, and the same class the `evented` module already hardened
   (decision #029 / F7.2). The design owner ruled: harden. The four inert probes now route
   their descriptor walk through a private `getInertDescriptor` wrapper
   (`try { getNextAvailablePropertyDescriptor(…) } catch { undefined }`), so a hostile
   trap yields `false` (`hIM/R6`). The raw `getNextAvailablePropertyDescriptor` stays
   un-guarded for callers that want the honest throw (e.g. `getDefinedConstructor`).
   Doc-only behavior addition; no signature change. This benefits every module composing
   the inert probes (thenable, evented, error, …).

3. **Tag read hardened (`getTypeSignature`) — RESOLVED (2026-06-22).** The follow-up to
   #2: a throwing `Symbol.toStringTag` getter made `getTypeSignature` (and thus
   `getTaggedType`, `resolveType`, and every tag-reading predicate) propagate. Now wrapped
   `try/catch → undefined` (`gTS/B2`). Package-wide tag-read throw-safety in one place.
   The sibling residual — `instanceof` in the per-module `isCurrentRealm*` helpers — was
   hardened in each module's own file (thenable's `isCurrentRealmPromiseInstance` done;
   evented / primitive / function inline `instanceof` to be wrapped in their rounds). The
   unclosable proxy/rename spoofs (shape-not-liveness) are documented boundaries, not
   bugs.

4. **Property-key helper retirement + inert own-key family — RESOLVED (2026-06-25).** Two
   surface changes landed during the `function` / `object` rounds:
   - **Rename:** `guardedGetPrototypeOf` → `getInertPrototypeOf` (the throw-safe prototype
     reader), aligning it with the `getInert*` naming of the rest of the inert layer. Pure
     rename; same behavior. All `src` + doc references updated (only `dist/` build
     artifacts carry the old name until the next build).
   - **Retirement:** the `getOwnPropertyDescriptorsKeys` /
     `getOwnPropertyDescriptorsKeySet` pair was removed. The function-family proto-surface
     helpers migrated to `new Set(getInertOwnPropertyNames(getInertPrototypeOf(value)))`,
     leaving the pair with no consumers (reference-checked: dead). In their place: the
     public `getOwnPropertyKeys` (own string **and symbol** keys — a superset of the old
     string-only `…Keys`) and the throw-safe `@internal` family `getInertOwnPropertyNames`
     / `getInertOwnPropertySymbols` / `getInertOwnPropertyKeys`. The retired sections'
     `gOPDK/*` / `gOPDKS/*` vectors are replaced by `gOPK/*` and `gIOP{N,S,K}/*` above.
     ADR #011 (the `Set` shape-probe decision) stands — only the underlying key-reader
     changed, the `Set`-membership probe pattern is intact; #011 is left as append-only
     history. Full vector tables for the new helpers are reconciled in the utility test
     round.

## Open items

None. `architecture/utility.md` declares the public surface complete with no open
questions.
