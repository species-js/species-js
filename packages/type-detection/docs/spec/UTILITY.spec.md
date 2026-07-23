# utility — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`utility/index.d.ts`, `utility/index.js`,
> `architecture/utility.md`, decisions #020 (inert/property-access discipline), #025
> (parameter-default-to-`null`), #047 (inert constructor walk), #048 (lowercase-name
> precedence), #072 (`isValidPropertyKey` finite numbers), #073 (throw-safe vocabulary +
> `@@throw-safe` marker + public surface)). Status: **FROZEN 2026-06-19; re-swept
> 2026-07-23** for the utility round.
>
> The 2026-07-23 sweep reconciled the spec with the committed code: the `Inert → Safe`
> throw-safety rename (#073, `getInertPrototypeOf → getSafePrototypeOf`,
> `getInertOwnProperty* → getSafeOwnProperty*`,
> `getInertDescriptor → getNextAvailableSafeDescriptor`); the `@@throw-safe` marker as the
> throw-safety oracle; the settled public surface (only `isValueOfBoundSet` and
> `getValidatedStandardConstructorAndPrototypeTuple` remain `@internal`); the new
> `hasOwnNonWritablePrototype` and the now-public `isValidWeakKey` / `getSafePrototypeOf`
> / `getSafeOwnProperty*` / `getNextAvailableSafeDescriptor` / `getVerifiedOwnName`
> sections; the `isValidPropertyKey` finite-number contract (#072); and the
> `getTaggedType` / `resolveType` `| undefined` throw widenings. White-box annotations
> (formulas, names, counts, composition notes) were amended in place; the newly documented
> surface was appended as new sections; the behavioral vector tables for unchanged
> functions are untouched. Earlier history: decidability check passed 2026-06-19 (44
> suites); inert-probe siblings promoted to public (Resolved #1); throw-safety hardening
> (Resolved #2/#3); property-key helper retirement + safe own-key family (Resolved #4).

## Module contract

`type-detection / utility` hosts the cross-realm-safe primitives that feed every
domain-specific predicate: descriptor-chain walks, inert (inspect-without-invoke) method
and accessor probes, tag/type-signature readers, the tamper-resistant constructor walk,
weak-key and property-key validation, and the public type-name resolver. It sits below
every domain in the dependency graph and carries no domain-specific knowledge.

Two orthogonal safety properties run through the module, and #073 gave each its own word
(they were both called "inert" before):

- **getter-inertness** — inspection that never invokes an accessor getter/setter or a
  stored callable. Every "callable?" question is answered from the descriptor's
  `value`/`get`/`set` field. Named "inert" (`hasInertMethod` and its siblings; "fully
  inert" in prose). The uniform read discipline (decision #020): every property read is
  **descriptor-based**, split by spec-shape — own-data via
  `getOwnPropertyDescriptor(...).value`; inherited via the prototype-chain walk in
  `getNextAvailablePropertyDescriptor`.
- **throw-safety** — a read wrapped in `try/catch` (or a design-inert `typeof`/predicate
  chain) so a hostile `Proxy` trap yields a sentinel (`undefined` / `false` / `[]`) rather
  than propagating (decisions #029, #056; ADR #073). Named "Safe" (`getSafePrototypeOf`,
  `getSafeOwnProperty*`, `getNextAvailableSafeDescriptor`). The exact throw-safe set is
  flagged in source with the proprietary `/* @@throw-safe */` marker (#073) — the oracle
  for the throw-safety test suite (the flagged set must equal the tested set).

The constructor walk (#047) is tamper-resistant: a user-supplied own `constructor` data
property cannot influence the result.

This module is almost entirely **readers and probes**, not type-guards. The two narrowing
predicates are `isValidWeakKey` (`value is WeakKey`) and `isValidPropertyKey`
(`value is PropertyKey`); everything else returns `boolean`, a
`string`/array/tuple/descriptor, or `undefined`.

## Surface inventory

**Public functions (axis 1) — 22:**

- Weak-key validation: `isValidWeakKey` (narrowing guard → `value is WeakKey`).
- Throw-safe prototype access: `getSafePrototypeOf` (→
  `object | Callable | null | undefined`).
- Own-`prototype` predicates: `hasOwnPrototype`, `hasOwnWritablePrototype`,
  `hasOwnNonWritablePrototype` (boolean).
- Property-key: `isValidPropertyKey` (narrowing guard → `value is PropertyKey`),
  `getOwnPropertyKeys` (raw, → `(string | symbol)[]`),
  `getNextAvailablePropertyDescriptor` (raw chain walk → descriptor | undefined).
- Throw-safe property-key readers: `getSafeOwnPropertyNames`, `getSafeOwnPropertySymbols`,
  `getSafeOwnPropertyKeys`, `getNextAvailableSafeDescriptor` (the throw-safe twin of the
  raw chain walk).
- Inert (inspect-without-invoke) probes: `hasInertMethod` (callable data property),
  `hasInertGetter` (accessor `get`), `hasInertSetter` (accessor `set`), `hasInertValue`
  (data-descriptor presence) — each resolved along the prototype-chain, and throw-safe via
  `getNextAvailableSafeDescriptor`.
- Verified-name reader: `getVerifiedOwnName` (own `name` descriptor `value`, narrowed to a
  string primitive).
- Type-signature readers: `getTypeSignature`, `getTaggedType` (each overloaded: omitted
  arg → `undefined`; a hostile tag getter → `undefined`).
- Constructor inspection: `getDefinedConstructor`, `getDefinedConstructorName`.
- Type resolution: `resolveType` (overloaded: omitted arg → `undefined`).

**Exported `@internal` helpers — 2:** `isValueOfBoundSet` (the `this`-bound Set-membership
callback for `Array.prototype.some`/`every`/`filter`) and
`getValidatedStandardConstructorAndPrototypeTuple` (the realm-fixed intrinsic-pair
capture). Both are exported for white-box testability (ADR #053), not for the public
surface.

The whole `getSafeOwnProperty*` family, `getSafePrototypeOf`, `getVerifiedOwnName`, and
`getNextAvailableSafeDescriptor` were **promoted from `@internal` to public** in #073 — a
throw-safe reflection primitive is general-purpose (the same rationale that promoted the
`hasInert*` siblings, Resolved #1).

**Re-exported constant (1):** `TRUSTED_DATA_CONFIRMATION` (from `#foundation`).

**Exported types (9):** `PropertyDescriptor`, `PropertyDescriptorMap`,
`DefinedConstructorAccessorOptions`, `ConstructorName`, `TaggedType`, `ResolvedType`,
`TypeSignature`, `WeakKey`, `PredicateFunction`.

Re-confirmation gate (as re-tallied 2026-07-23): 22 public `.js` value exports + 2
`@internal` helpers + the `TRUSTED_DATA_CONFIRMATION` re-export, each with a matching
`.d.ts` declaration; 9 type exports match; `architecture/utility.md` matches the code; the
`@@throw-safe` flagged set matches the throw-safe surface below.

## Cross-cutting vectors

- **CC/nullish-safe** — `getSafePrototypeOf`, `hasOwnPrototype`,
  `hasOwnWritablePrototype`, `hasOwnNonWritablePrototype`, `getOwnPropertyKeys`,
  `getSafeOwnPropertyNames`/`Symbols`/`Keys`, `getDefinedConstructor`,
  `getDefinedConstructorName`, `getVerifiedOwnName`, `isValidPropertyKey`,
  `isValidWeakKey` all accept `null`/`undefined`/omitted without throwing (each returns
  its empty/false/undefined floor). The inert probes (`hasInertMethod`/`Getter`/`Setter`/
  `Value`) take `null` as the parameter default and short-circuit `type !== null` first.
- **CC/inert** — no function in this module ever invokes an accessor getter/setter or a
  stored callable. Every "callable?" question is answered from the descriptor's `value`/
  `get`/`set` field, never by property access. A getter that throws on access must never
  fire (see `hIM/R3`, `gVON/R1`).
- **CC/throw-safe** — every function carrying the `/* @@throw-safe */` marker answers
  (returns its sentinel) rather than propagating on a hostile input: a `Proxy` whose
  `getPrototypeOf` / `getOwnPropertyDescriptor` / `ownKeys` trap throws, or a throwing
  `Symbol.toStringTag` / accessor. The two **raw** forms `getOwnPropertyKeys` and
  `getNextAvailablePropertyDescriptor` are deliberately NOT marked — they propagate; their
  throw-safe twins (`getSafeOwnPropertyKeys`, `getNextAvailableSafeDescriptor`) absorb.
  The exhaustive proof lives in `throw-safety.test.js` (the `hostile × predicate` matrix,
  completeness-guarded against the flagged set); this spec states the invariant once.
- **CC/omitted-vs-undefined** — `getTypeSignature`, `getTaggedType`, `resolveType`
  distinguish an omitted call (→ `undefined`) from an explicit `undefined` argument (→
  `'[object Undefined]'` / `'Undefined'`), via `args.length`.

---

## `isValidWeakKey`

`isValidWeakKey(value?: unknown): value is WeakKey` — an object, a function, or (where the
runtime supports it) an unregistered symbol. A narrowing guard. The implementation is
selected once at module-load by the `createIsValidWeakKeyPredicate` factory: it probes
whether the realm admits symbols as weak keys (the ES2023 capability) and only then
enables the symbol branch, which additionally excludes registered symbols via
`unguardedIsUnregisteredSymbol`. Symbol-supporting realm:
`weakKeyTypeSignatures.has(typeof (value ?? void 0)) && (keyType !== 'symbol' || unguardedIsUnregisteredSymbol(value))`;
otherwise `!!value && weakKeyTypeSignatures.has(typeof value)`.

- `iVWK/A1` — `{}`, `[]`, `new Date()`, `Object.create(null)` → true (objects).
- `iVWK/A2` — `function () {}`, `() => {}`, `class C {}` → true (callables are objects).
- `iVWK/A3` — `Symbol()`, `Symbol('x')` → true **on engines that admit symbol weak keys**
  (ES2023); the symbol branch additionally requires an unregistered symbol.
- `iVWK/R1` — `Symbol.for('x')` → false (registered symbol — rejected even where symbols
  are admitted, matching the engine's own refusal to hold it weakly).
- `iVWK/R2` — `'x'`, `42`, `true`, `1n` → false (primitives other than symbol).
- `iVWK/R3` — `null`, `undefined`/omitted → false (the `value ?? void 0` coercion makes
  `typeof null` `'undefined'`, not `'object'`; the non-symbol branch guards with
  `!!value`).

**Capability boundary (axis 3):** `iVWK/A3` is realm-capability-gated — on an engine
without ES2023 symbol-as-weak-key support the symbol branch is disabled and `Symbol()` →
false. The selection is fixed once at module-load.

**Cross-realm (axis 2):** realm-safe — `typeof` + `Set` membership, no intrinsic identity.

---

## `getSafePrototypeOf`

`getSafePrototypeOf(value?: unknown): object | Callable | null | undefined` —
`try { return nativeGetPrototypeOf(value); } catch { return undefined; }`. The throw-safe
prototype reader; no memoization (#057). `@@throw-safe`.

- `gSPO/A1` — `{}` → `Object.prototype`; `[]` → `Array.prototype`; `Object.create(null)` →
  `null`.
- `gSPO/A2` — `42` → `Number.prototype`; `'x'` → `String.prototype`; `true` →
  `Boolean.prototype` (primitives box through `getPrototypeOf`).
- `gSPO/A3` — `function () {}` → `Function.prototype`.
- `gSPO/R1` — `null`, `undefined`/omitted → `undefined` (`nativeGetPrototypeOf(nullish)`
  throws → caught).
- `gSPO/B1` — a `Proxy` whose `getPrototypeOf` trap throws → `undefined`, **not thrown**.

**Cross-realm (axis 2):** realm-safe — `getPrototypeOf` is realm-independent.

---

## `hasOwnPrototype`

`hasOwnPrototype(value?: unknown): boolean` —
`try { return !!getOwnPropertyDescriptor(value, 'prototype'); } catch { return false; }`.
`@@throw-safe`.

- `hOP/A1` — `function f() {}`, `class C {}`, `function* () {}`, `Array` → true (own
  `prototype` descriptor present).
- `hOP/R1` — `() => {}`, `({ m() {} }).m`, `async function () {}` → false (no own
  `prototype`; arrow inherits from `Function.prototype`).
- `hOP/R2` — `(function () {}).bind(null)` → false (`bind` strips the own `prototype`
  slot).
- `hOP/R3` — `{}`, `[]`, `42`, `'x'`, CC/nullish → false (no own `prototype`).
- `hOP/B1` — a `Proxy` whose `getOwnPropertyDescriptor` trap throws → false, **not
  thrown** (the `try/catch` absorbs it; replaces the former `!!value` guard).

**Cross-realm (axis 2):** realm-safe — own-descriptor read, no intrinsic identity.

---

## `hasOwnWritablePrototype`

`hasOwnWritablePrototype(value?: unknown): boolean` —
`try { return getOwnPropertyDescriptor(value, 'prototype')?.writable === true; } catch { return false; }`.
`@@throw-safe`.

- `hOWP/A1` — `function f() {}`, `function* () {}`, `async function* () {}` → true (own
  writable `prototype`).
- `hOWP/R1` — `class C {}`, `Array`, `Map`, `Symbol` → false (own `prototype` is readonly
  — the ES3-vs-class tell).
- `hOWP/R2` — `() => {}`, `async function () {}` → false (no own `prototype`).
- `hOWP/R3` — `(function () {}).bind(null)`, `{}`, CC/nullish → false.
- `hOWP/B1` — a `Proxy` whose `getOwnPropertyDescriptor` trap throws → false, **not
  thrown**.

**Cross-realm (axis 2):** realm-safe. **Composition note:** the structural discriminator
`isES3Function` (`#function`) drives this.

---

## `hasOwnNonWritablePrototype`

`hasOwnNonWritablePrototype(value?: unknown): boolean` —
`try { return getOwnPropertyDescriptor(value, 'prototype')?.writable === false; } catch { return false; }`.
The named complement of `hasOwnWritablePrototype` over own-`prototype` bearers; the
class-vs-ES3 tell that drives `isClass` (`#function`). `@@throw-safe`.

- `hONWP/A1` — `class C {}`, `Array`, `Map`, `Symbol` → true (own `prototype` is
  non-writable — a `ClassConstructor`).
- `hONWP/R1` — `function f() {}`, `function* () {}` → false (own writable `prototype` — an
  `ES3Function`).
- `hONWP/R2` — `() => {}`, `{}`, `[]`, CC/nullish → false — **no own `prototype` at all**,
  so `?.writable` is `undefined` and `undefined === false` is `false` (pin this:
  `hasOwnWritablePrototype` and `hasOwnNonWritablePrototype` are NOT exhaustive — a value
  with no own `prototype` answers `false` to both).
- `hONWP/B1` — a `Proxy` whose `getOwnPropertyDescriptor` trap throws → false, **not
  thrown**.

**Cross-realm (axis 2):** realm-safe.

---

## `isValidPropertyKey`

`isValidPropertyKey(value?: unknown): value is PropertyKey` —
`typeof value === 'string' || typeof value === 'symbol' || isFiniteNumberValue(value)`. A
narrowing guard, and the general-purpose key validator (ADR #072). `@@throw-safe` (a
design-inert `typeof`/predicate chain).

- `iVPK/A1` — `'x'`, `''`, `'1.5'` → true (any string is a valid key).
- `iVPK/A2` — `Symbol()`, `Symbol.iterator` → true.
- `iVPK/A3` — `0`, `42`, `-5`, `Number.MAX_SAFE_INTEGER` → true (finite integers).
- `iVPK/A4` — `1.5`, `-2.5`, `2 ** 53`, `Number.MAX_SAFE_INTEGER + 1` → true (finite
  non-integers and large finite integers — every finite number coerces to a deterministic
  string key, `obj[1.5] === obj['1.5']`; ADR #072, superseding #026's safe-integer
  tightening).
- `iVPK/R1` — `NaN`, `Infinity`, `-Infinity` → false (non-finite; error-state numbers).
- `iVPK/R2` — `1n`, `true`, `{}`, `[]`, `null`, `undefined`/omitted → false (not a string,
  symbol, or finite number — `1n` is a bigint).

**Refuses to claim (reversed by #072):** finite numbers, including `1.5` and `2 ** 53`,
ARE claimed valid keys. The two deliberate refusals target values that _do_ coerce to
valid key strings but are excluded for distinct reasons: `NaN` / `±Infinity`
(usable-via-coercion but error-state, ~never an intended key); and `bigint`
(usable-via-coercion — `1n` → `'1'` — but NOT a member of the lib `PropertyKey`, so
admitting it would break the `value is PropertyKey` narrow; TypeScript's own `PropertyKey`
omits it; a bigint id normalizes via `String(id)`).

---

## `getOwnPropertyKeys`

`getOwnPropertyKeys(value?: unknown): (string | symbol)[]` —
`getOwnPropertyNames(value ?? !0).concat(getOwnPropertySymbols(value ?? !0))`. All own
keys — string-named and symbol-keyed, enumerable and non-enumerable. The **raw** form (not
`@@throw-safe`); the throw-safe twin is `getSafeOwnPropertyKeys` (the raw/throw-safe
pairing used across this module).

- `gOPK/A1` — `Object.defineProperty({ a: 1 }, 'b', { value: 2 })` → `['a', 'b']`
  (non-enumerable `b` included).
- `gOPK/A2` — `{ [Symbol('s')]: 1, a: 1 }` → `['a', Symbol(s)]` (symbol keys INCLUDED).
- `gOPK/A3` — `{}` → `[]`; `Object.create(null)` → `[]`.
- `gOPK/R1` — `null`, `undefined`/omitted → `[]` (the `?? !0` coerces nullish to a boxed
  `true`, dodging the `getOwnPropertyNames(null)` throw).

**Throws (not throw-safe):** a `Proxy` whose `ownKeys` trap throws propagates — the raw
form; use `getSafeOwnPropertyKeys` for the absorbing twin.

**Cross-realm (axis 2):** realm-safe.

---

## `getNextAvailablePropertyDescriptor`

`getNextAvailablePropertyDescriptor(value: unknown, key: PropertyKey): PropertyDescriptor | undefined`
— walks own properties first, then up the `[[Prototype]]` chain via `getSafePrototypeOf`,
returning the first descriptor found. Getter never invoked. The **raw** form (not
`@@throw-safe`); the throw-safe twin is `getNextAvailableSafeDescriptor`.

- `gNAPD/A1` — `({ a: 1 }, 'a')` → a data descriptor with `value: 1` (own).
- `gNAPD/A2` — `({}, 'toString')` → the data descriptor from `Object.prototype`
  (inherited; `value` is callable).
- `gNAPD/A3` — `([], 'length')` → the own data descriptor for `length`.
- `gNAPD/B1` — `({ get x() { throw new Error('boom'); } }, 'x')` → the accessor descriptor
  returned as-is, **without throwing** (the getter is not invoked — the inert guarantee).
- `gNAPD/R1` — `({}, 'nonexistent')` → `undefined` (chain exhausted).
- `gNAPD/R2` — `({ a: 1 }, {})` → `undefined`: a non-`PropertyKey` fails the
  `isValidPropertyKey` guard and short-circuits before any walk. Contrast
  `({ a: 1 }, 1.5)` → also `undefined`, but `1.5` IS a valid key per ADR #072 (finite
  number), so it resolves via chain-exhaustion, NOT the guard — a distinct path with the
  same result. Both are asserted (the former pins the guard, the latter the #072 seam); a
  numeric non-key is no longer available.
- `gNAPD/R3` — `(null, 'x')` → `undefined` (the `value = null` default + loop guard).

**Throws (not throw-safe):** the `getSafePrototypeOf` step is absorbed, but the own
`getOwnPropertyDescriptor` read is raw — a `Proxy` whose `getOwnPropertyDescriptor` trap
throws propagates. `getNextAvailableSafeDescriptor` wraps the whole walk.

**Cross-realm (axis 2):** realm-safe. **Composition note (axis 4):** the raw chain-walk
primitive; its throw-safe twin backs `hasInertMethod`/`Getter`/`Setter`/`Value` and
`getDefinedConstructor`.

---

## `getSafeOwnPropertyNames` / `getSafeOwnPropertySymbols` / `getSafeOwnPropertyKeys`

The throw-safe variants of `getOwnPropertyNames` / `getOwnPropertySymbols` /
`getOwnPropertyKeys`: each wraps its read so a hostile `Proxy` `ownKeys` trap (or nullish
input) yields `[]` rather than propagating. `getSafeOwnPropertyKeys` concatenates the
other two. Public since #073. All three `@@throw-safe`.

- `gSOPN/A1` — own string names incl. non-enumerable; nullish → `[]`; a `Proxy` whose
  `ownKeys` trap throws → `[]`, **not thrown**.
- `gSOPS/A1` — own symbol keys; nullish → `[]`; throwing `ownKeys` trap → `[]`, **not
  thrown**.
- `gSOPK/A1` — string + symbol keys (the two above concatenated); throwing trap → `[]`.

These feed the function-family proto-surface helpers, e.g.
`new Set(getSafeOwnPropertyNames(getSafePrototypeOf(value)))`.

**Cross-realm (axis 2):** realm-safe.

---

## `getNextAvailableSafeDescriptor`

`getNextAvailableSafeDescriptor(type: unknown, key: PropertyKey): PropertyDescriptor | undefined`
—
`try { return getNextAvailablePropertyDescriptor(type, key); } catch { return undefined; }`.
The throw-safe twin of the raw chain walk; public since #073, and the walker behind every
inert probe and `getDefinedConstructor`. `@@throw-safe`.

- `gNASD/A1` — same accept behavior as `gNAPD/A1-A3` (own then inherited descriptor
  returned as-is; getter never invoked).
- `gNASD/R1` — chain exhausted / invalid key → `undefined`.
- `gNASD/B1` — a `Proxy` whose `getOwnPropertyDescriptor` **or** `getPrototypeOf` trap
  throws → `undefined`, **not thrown** (the wrapper absorbs what the raw twin propagates).

**Cross-realm (axis 2):** realm-safe. **Composition note (axis 4):** wraps
`getNextAvailablePropertyDescriptor`; composed by `hasInertMethod`/`Getter`/`Setter`/
`Value` and `getDefinedConstructor`.

---

## `hasInertMethod`

`hasInertMethod(type?: unknown, key?: PropertyKey): boolean` —
`type !== null && isCallable(getNextAvailableSafeDescriptor(type, key)?.value)`. Public
inert probe for a callable data property reachable through the chain. `@@throw-safe`.

- `hIM/A1` — `(Promise.resolve(), 'then')` → true (inherited callable).
- `hIM/A2` — `({ then() {} }, 'then')`, `({ then: () => {} }, 'then')` → true (own
  callable).
- `hIM/R1` — `({}, 'then')` → false (no such key).
- `hIM/R2` — `({ then: 5 }, 'then')` → false (data descriptor, value not callable).
- `hIM/R3` — `({ get then() { return () => {}; } }, 'then')` → false (accessor descriptor
  rejected — even though its getter would return a callable, it is never invoked).
- `hIM/R4` — `(null, 'then')`, `(undefined, 'then')` → false (nullish short-circuit).
- `hIM/R5` — `({ then() {} }, {})` → false (invalid key → `undefined` descriptor →
  `isCallable(undefined)` false).
- `hIM/R6` — a Proxy whose `getOwnPropertyDescriptor` (or `getPrototypeOf`) trap
  **throws**, or a value whose `get then()` accessor throws on access → **false, not
  thrown**. The descriptor walk runs through the throw-safe
  `getNextAvailableSafeDescriptor` (#073). The four inert probes share this guarantee.

**Cross-realm (axis 2):** realm-safe. **Spoof (axis 3):** the accessor-rejection (`R3`) is
the inert guarantee — a lying `get then()` cannot fire; a throwing trap/accessor yields
`false` (`R6`), not an exception. **Composition note (axis 4):**
`getNextAvailableSafeDescriptor` → `isCallable`.

---

## `getTypeSignature`

`getTypeSignature(value): TypeSignature | undefined` / `getTypeSignature(): undefined` —
reads the `[[Class]]` tag via the cached `Object.prototype.toString.call`. `@@throw-safe`.

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
  `try/catch`). `getTaggedType` and `resolveType` inherit this. Extends decision #029 to
  the tag read.

**Cross-realm (axis 2):** realm-safe — the cached `toObjectString` is realm-fixed and
immune to a missing/overridden instance `toString`. **Throw-safe (axis 3):** a hostile
`Symbol.toStringTag` getter yields `undefined`, not an exception (`gTS/B2`).

---

## `getTaggedType`

`getTaggedType(value): TaggedType | undefined` / `getTaggedType(): undefined` — the tag
substring of `getTypeSignature`, `[object …]` unwrapped. `@@throw-safe`.

- `gTT/A1` — `[]` → `'Array'`; `new Date()` → `'Date'`; `null` → `'Null'`.
- `gTT/A2` — `{ [Symbol.toStringTag]: 'Custom' }` → `'Custom'`.
- `gTT/A3` — `undefined` (explicit) → `'Undefined'`.
- `gTT/B1` — omitted call `getTaggedType()` → `undefined` (the `isStringValue`
  short-circuit on `getTypeSignature`'s `undefined`).
- `gTT/B2` — a value whose `Symbol.toStringTag` accessor **throws** on read → `undefined`,
  **not thrown** (inherits `getTypeSignature`; the same short-circuit handles both the
  no-argument and the throwing-tag cases — this is why the value overload's return type is
  `TaggedType | undefined`).

**Cross-realm (axis 2):** realm-safe (inherits from `getTypeSignature`).

---

## `getDefinedConstructor`

`getDefinedConstructor(value?: unknown, options?: { assumePrototype?: boolean }): NewableFunction | undefined`
— the inert, tamper-resistant constructor walk (#047). Pivot: callable values walk from
themselves; non-callable values walk from their `[[Prototype]]` (bypassing the value's own
`constructor`). `@@throw-safe`.

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
- `gDC/B1` — a `Proxy` whose `getOwnPropertyDescriptor` / `getPrototypeOf` trap throws
  during the walk → `undefined`, **not thrown** (the walk routes through
  `getNextAvailableSafeDescriptor`; decision #056).

**Cross-realm (axis 2):** realm-safe — descriptor-walk, no intrinsic identity. **Spoof
(axis 3):** the non-callable pivot bypasses the value's own `constructor`, so
`getDefinedConstructor({ constructor: 'tampered' })` → `Object` and
`getDefinedConstructor({ constructor: Array })` → `Object` (the override cannot redirect
the structural read). Fully inert — accessor getters on `constructor` are never invoked.
**Composition note (axis 4):** `isCallable` (pivot) → `getNextAvailableSafeDescriptor` →
`isFunction` (callability verified; `[[Construct]]` asserted, not probed).

---

## `getDefinedConstructorName`

`getDefinedConstructorName(value?: unknown): ConstructorName | undefined` — the
constructor's `name` via `getVerifiedOwnName(getDefinedConstructor(value, options))`.
`@@throw-safe`.

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
4):** `getDefinedConstructor` → `getVerifiedOwnName`.

---

## `getVerifiedOwnName`

`getVerifiedOwnName(value?: unknown): string | undefined` —
`try { const name = getOwnPropertyDescriptor(value, 'name')?.value; return isStringValue(name) ? name : undefined; } catch { return undefined; }`.
Generic and constructor-agnostic: the own `name` descriptor's data value, only when a
string primitive. Own-only (no chain walk; `getVerifiedNextAvailableName` reserved).
`@@throw-safe`.

- `gVON/A1` — `function foo() {}` → `'foo'`; `class Bar {}` → `'Bar'` (own `name` string).
- `gVON/A2` — an anonymous function expression `(function () {})` → `''` (own `name` is
  the empty string — a real string; pin this). `new Function()` is NOT empty: its own
  `name` is `'anonymous'` (also a real string), so it returns `'anonymous'`, not `''`.
- `gVON/R1` — a value whose `name` is an accessor (`get name()`) → `undefined` (descriptor
  `value` is undefined; the getter is never invoked).
- `gVON/R2` — a value whose own `name` is a non-string (`{ value: 123 }`) → `undefined`
  (the `isStringValue` narrow rejects it).
- `gVON/R3` — `{}` (no own `name`), `null`, `undefined`/omitted → `undefined`.
- `gVON/B1` — a `Proxy` whose `getOwnPropertyDescriptor` trap throws → `undefined`, **not
  thrown**.

**Cross-realm (axis 2):** realm-safe. **Composition note (axis 4):** behind
`getDefinedConstructorName`.

---

## `resolveType`

`resolveType(value): ResolvedType | undefined` / `resolveType(): undefined` — the two-axis
dispatch (#048): a Unicode-uppercase-leading constructor name wins outright; otherwise the
tag from `getTaggedType`, except a non-empty lowercase name beats the uninformative
`'Object'` tag. `@@throw-safe`.

- `rT/A1` — `[]` → `'Array'`; `Promise.resolve()` → `'Promise'`; `new Date()` → `'Date'`
  (PascalCase constructor name wins — axis 1).
- `rT/A2` — `null` → `'Null'`; `undefined` (explicit) → `'Undefined'` (no constructor
  name; tag is the canonical answer).
- `rT/A3` — `Object.create(null)` → `'Object'` (no reachable constructor; tag `'Object'`).
- `rT/A4` — `new (function foo() {})()` → `'foo'` — a non-empty lowercase name beats the
  `'Object'` tag (axis 2).
- `rT/A5` — `new (function () {})()` → `'Object'` — empty name carries no information, so
  the tag wins.
- `rT/A6` — `(() => { class Foo {} ; return new Foo(); })()` with
  `Foo.prototype[Symbol.toStringTag] = 'Bar'` → `'Foo'` (constructor name wins over the
  tag override).
- `rT/B1` — omitted call `resolveType()` → `undefined` (via `args.length`).
- `rT/B2` — a value with **no reachable constructor AND a throwing `Symbol.toStringTag`
  getter** (e.g.
  `Object.assign(Object.create(null), { get [Symbol.toStringTag]() { throw 0; } })`) →
  `undefined`, **not thrown**: `getDefinedConstructorName` → `undefined` (no ctor) and
  `getTaggedType` → `undefined` (throwing tag), so the final ternary falls through to the
  `undefined` tag. This is why the value overload's return type is
  `ResolvedType | undefined`.

**Cross-realm (axis 2):** realm-safe. **Spoof (axis 3):** a `Symbol.toStringTag` override
on a value whose constructor name is PascalCase is short-circuited at axis 1 (the tag is
not consulted, `rT/A6`); and the tamper-resistant `getDefinedConstructorName` walk means a
user `constructor` data property cannot influence the read. **Composition note (axis 4):**
`getDefinedConstructorName` + `getTaggedType` under the `startsWithUpperCase` regex.

---

## Inert-sibling probes (axis 1)

The accessor/data siblings of `hasInertMethod`, public by the same rationale (see Surface
inventory + Resolved items #1). Same chain-walk + descriptor-shape discipline; fully
inert; throw-safe via `getNextAvailableSafeDescriptor`. All three `@@throw-safe`.

### `hasInertGetter(type?, key?)`

`type !== null && isCallable(getNextAvailableSafeDescriptor(type, key)?.get)`.

- `hIG/A1` — `({ get x() {} }, 'x')` → true (accessor with callable getter).
- `hIG/R1` — `({ x: () => {} }, 'x')` → false (data descriptor — `?.get` is undefined).
- `hIG/R2` — `({ set x(v) {} }, 'x')` → false (setter-only accessor; no `get`).
- `hIG/R3` — `({}, 'x')`, `(null, 'x')` → false.

### `hasInertSetter(type?, key?)`

`type !== null && isCallable(getNextAvailableSafeDescriptor(type, key)?.set)`.

- `hIS/A1` — `({ set x(v) {} }, 'x')` → true (accessor with callable setter).
- `hIS/R1` — `({ get x() {} }, 'x')` → false (getter-only; no `set`).
- `hIS/R2` — `({ x: 1 }, 'x')` → false (data descriptor).
- `hIS/R3` — `({}, 'x')`, `(null, 'x')` → false.

### `hasInertValue(type?, key?)`

`type !== null && objectHasOwn(getNextAvailableSafeDescriptor(type, key) ?? {}, 'value')`.
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

## Exported `@internal` helpers (axis 4)

Exported for white-box testability (ADR #053), not the public surface.

### `getValidatedStandardConstructorAndPrototypeTuple` — `@internal`

`getValidatedStandardConstructorAndPrototypeTuple(constructor: unknown, doesPassAsConstructorPrototype: PredicateFunction): [NewableFunction, object | null] | [INSTANCE_LESS_CONSTRUCTOR, BlankDictionary]`
— the realm-fixed intrinsic-pair capture. Accepts the pair only when `constructor` is
newable, the injected predicate passes on its own `prototype`, and (for a non-`null`
prototype) `prototype.constructor === constructor` reciprocates. Any failure —
non-newable, rejected prototype, broken back-reference, or a throwing descriptor/accessor
— collapses to the total inert surrogate `[INSTANCE_LESS_CONSTRUCTOR, BLANK_DICTIONARY]`
(#060), so every caller destructures both slots and uses `instanceof` without a presence
guard. `@@throw-safe`.

- `gVSC/A1` — `(Promise, doesImplementPromisePrototypeContract)` →
  `[Promise, Promise.prototype]` (valid pair; reciprocal `constructor`).
- `gVSC/R1` — `(nonNewable, pred)` → the surrogate tuple.
- `gVSC/R2` — `(Ctor, pred)` where the prototype fails the injected predicate → surrogate.
- `gVSC/R3` — `(Ctor, pred)` where `prototype.constructor !== Ctor` (broken
  back-reference) → surrogate.
- `gVSC/B1` — a hostile descriptor/accessor throws during the walk → surrogate, **not
  thrown**.

**Cross-realm (axis 2):** realm-safe — runs at module-load against the real intrinsic.

### `isValueOfBoundSet` — `@internal`

`isValueOfBoundSet(this: ReadonlySet<unknown>, value: unknown): boolean` —
`this.has(value)`. A `this`-bound Set-membership callback for
`Array.prototype.some`/`every`/`filter` (`names.some(isValueOfBoundSet, denylistSet)`),
allocation-free vs a per-call closure.

- `iVOBS/A1` — bound to `new Set(['a', 'b'])`: `'a'` → true; `'c'` → false.

**Throw-safe:** `Set.prototype.has` does not throw; the callback answers on any element.

---

## Resolved items

1. **Inert-probe siblings promoted to public — RESOLVED.** `hasInertGetter`,
   `hasInertSetter`, and `hasInertValue` were originally tagged `@internal`. The design
   owner ruled them first-class public exports alongside `hasInertMethod`: an inert
   (inspect-without-invoke) probe is a general-purpose introspection primitive useful to
   any consumer doing reflection. They were already exported with parallel `.d.ts`
   declarations, so the change was purely removing the `@internal` tag. No behavior
   change; the `hIG/*`, `hIS/*`, `hIV/*` vectors are unaffected.

2. **Inert probes hardened against throwing traps — RESOLVED (2026-06-22).** A Proxy whose
   `getOwnPropertyDescriptor` / `getPrototypeOf` trap throws made `hasInertMethod` (and
   its siblings) **propagate** rather than return a boolean — a sharp edge for a
   type-guard (decision #029 / F7.2). The four inert probes now route their descriptor
   walk through the throw-safe wrapper
   (`try { getNextAvailablePropertyDescriptor(…) } catch { undefined }`), so a hostile
   trap yields `false` (`hIM/R6`). The raw `getNextAvailablePropertyDescriptor` stays
   un-guarded for callers that want the honest throw. (The wrapper was a private
   `getInertDescriptor`; #073 renamed it to the now-public
   `getNextAvailableSafeDescriptor`.)

3. **Tag read hardened (`getTypeSignature`) — RESOLVED (2026-06-22).** A throwing
   `Symbol.toStringTag` getter made `getTypeSignature` (and thus `getTaggedType`,
   `resolveType`, and every tag-reading predicate) propagate. Now wrapped
   `try/catch → undefined` (`gTS/B2`). Package-wide tag-read throw-safety in one place.
   The `| undefined` return-type consequence was later reconciled onto `getTaggedType` and
   `resolveType`'s value overloads (see Resolved #6).

4. **Property-key helper retirement + safe own-key family — RESOLVED (2026-06-25).**
   `guardedGetPrototypeOf` → `getSafePrototypeOf` (throw-safe prototype reader); the
   `getOwnPropertyDescriptorsKeys` / `getOwnPropertyDescriptorsKeySet` pair was removed in
   favour of the public `getOwnPropertyKeys` (own string **and** symbol keys) and the
   throw-safe own-key readers. ADR #011 (the `Set` shape-probe decision) stands.

5. **`Inert → Safe` vocabulary disentanglement + `@@throw-safe` marker + public surface —
   RESOLVED (2026-07-23, ADR #073).** "Inert" now names only getter-inertness (the
   `hasInert*` probes); throw-safety is named "Safe" —
   `getInertPrototypeOf → getSafePrototypeOf`,
   `getInertOwnProperty* → getSafeOwnProperty*`,
   `getInertDescriptor → getNextAvailableSafeDescriptor`. The `/* @@throw-safe */` source
   marker enumerates the throw-safe set (the test-round oracle). Public surface settled:
   only `isValueOfBoundSet` and `getValidatedStandardConstructorAndPrototypeTuple` remain
   `@internal`; the `getSafeOwn*` family, `getSafePrototypeOf`, `getVerifiedOwnName`, and
   `getNextAvailableSafeDescriptor` are public. New `hasOwnNonWritablePrototype` (the
   class-vs-ES3 tell backing `isClass`); `hasOwnPrototype` / `hasOwnWritablePrototype`
   rewritten from a `!!value` guard to `try/catch`. Public-function count re-tallied 15 →
   22; `@internal` 3 → 2. Newly documented sections above: `isValidWeakKey`,
   `getSafePrototypeOf`, `hasOwnNonWritablePrototype`,
   `getSafeOwnProperty{Names,Symbols,Keys}`, `getNextAvailableSafeDescriptor`,
   `getVerifiedOwnName`, `getValidatedStandardConstructorAndPrototypeTuple`,
   `isValueOfBoundSet`.

6. **`isValidPropertyKey` finite numbers + `getTaggedType` / `resolveType` `| undefined` —
   RESOLVED (2026-07-23, ADRs #072/#073).** `isValidPropertyKey`'s numeric arm is
   `isFiniteNumberValue`, not `isSafeIntegerValue` (#026 superseded in part): non-integer
   floats (`1.5`) and unsafe integers (`2 ** 53`) are admitted as the valid string keys
   they coerce to; `NaN` / `±Infinity` and `bigint` are the two distinct-reason refusals.
   The `iVPK` vector table is rewritten above (accept `iVPK/A4`; the "Refuses to claim"
   note reverses). Separately, `getTaggedType` and `resolveType` value overloads widened
   to `| undefined` — a hostile `Symbol.toStringTag` getter makes both return `undefined`
   at runtime (`gTT/B2`, `rT/B2`), matching `getTypeSignature`.

## Open items

None. `architecture/utility.md` declares the public surface complete with no open
questions.
