# config — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`config/index.d.ts`, `config/index.js`, and the
> boundary-retyping decisions #008 (`toFunctionString`), #017 (`getPrototypeOf`), #034
> (`objectCreate`); the pattern itself is documented in `architecture/function.md` →
> "Boundary-retyping for lib `any`-gaps"). There is no `architecture/config.md` — config
> is infrastructure, not a discrimination domain. Status: **FROZEN 2026-06-19** —
> decidability check passed over the runtime-decidable dimensions (realm-fixity +
> tamper-immunity, the polyfill selectors, the four exported polyfill closures, the
> capture reads, and the preset shapes) via the `#index` barrel, single realm; dimension B
> is typecheck-gated, not a runtime vector. No surprises: every polyfilled selector took
> the native branch in this runtime (identity-equal to its `Object.`/`Number.` intrinsic),
> the closures run the fallback logic correctly in isolation, captures are identity-equal,
> and the `Number.isXxx` no-coercion semantics hold. The polyfill closures (`hasOwn`,
> `isFiniteNumber`, `isInteger`, `isSafeInteger`) are exported `@internal` (#053-style) so
> the fallback path is directly testable (Resolved items #1). The eighth and final
> type-detection spec. Base for the axis-1 suite; axes 2–3 derive alongside.

> **Amended 2026-07-24 (ADR #074 / #075).** The three `Number.isXxx` guards
> (`isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue`) and their `@internal`
> polyfill closures (`isFiniteNumber` / `isInteger` / `isSafeInteger`) **relocated to
> `primitive`** (#074); their vectors move to `PRIMITIVE.spec.md`. `config` also shed its
> last runtime import and is now a true leaf (#075). **Export count is unchanged at 30** —
> a coincidence: the six relocated Number exports are offset by six exports the original
> inventory never listed (`globalContext`, `objectFromEntries`, `defineProperties`,
> `BLANK_DICTIONARY`, `BLANK_TYPE`, `INSTANCE_LESS_CONSTRUCTOR`). Those six were
> **pre-existing drift, deferred to the config Round-2 retro-audit** — RESOLVED 2026-07-29
> (see the next banner: five inventoried + vector-covered, `BLANK_TYPE` removed, count →
> 29). The FROZEN status above records the 2026-06-19 run (Number trio then present); the
> inventory and axis sections below reflect the post-relocation surface.

> **Amended 2026-07-29 (config round — the deferred Round-2 reconciliation).** The
> deferred six-export drift is resolved. `globalContext`, `objectFromEntries`,
> `defineProperties`, `BLANK_DICTIONARY`, and `INSTANCE_LESS_CONSTRUCTOR` are now
> inventoried and vector-covered (`fix/A3`, the extended `fix/A1`, and the new
> `(sentinels)` section `blank/*` + `ilc/*`); `BLANK_TYPE` was **removed** as an
> unconsumed `@internal` export (Resolved items #2). **Export count 30 → 29 values + 2
> exported types** (`BlankType` / `BlankDictionary` — both stay **public** by intent;
> visibility SETTLED 2026-08-04, no code change, Open items #1). The founding "no public
> surface / all `@internal`" framing is corrected to the real two-tier surface — a curated
> public API (the four presets, `objectHasOwn`, `objectCreate`) over the `@internal`
> primitives (the `@internal` toggling shipped in `f161805` alongside the typedoc
> docs-visibility fix). `getPrototypeOf` corrected `object | null` →
> `object | Callable | null` (`ret/T2`, `cap/A4`). **Status: AMENDED — the vectors added
> this round (`fix/A3`, `blank/*`, `ilc/*`) are now driven by the standing config suite
> (`test/config/spec.test.js`, 21 vectors green, mutation-probed).**

> **Amended 2026-08-19 (descriptor-preset rework).** The four presets are replaced by
> **ten** covering the full visible/hidden × writable × configurable grid, each paired
> with an exported `*Options` interface that pins its flags as literal types instead of
> widening them to `boolean`. The old four survive **by value** — every one has an exact
> equivalent in the new set — so `dpo/A1`–`A4` keep the shapes they always asserted and
> only the symbol each names changes; the six genuinely new shapes append as
> `dpo/A5`–`A10` per the README's append-only rule. Mapping and the two things the old set
> had hidden are in Resolved items #3. **Export count 29 → 35 values + 12 exported types**
> (the ten `*Options` interfaces plus `BlankType` / `BlankDictionary`); the `@internal`
> count is **unchanged at 23**. Vocabulary is now spec-aligned: `readOnly` = non-writable
> but still configurable, `frozen` = `Object.freeze`'s pair (data only), `sealed` =
> `configurable: false` (accessors only). **Status: AMENDED — `dpo/A5`–`A10` are
> re-decidability PENDING.** The six new shapes have never been through a decidability run
> and `test/config/spec.test.js` does not yet cover them; the vectors below are reasoned
> from the canon, not yet executed.

## Module contract

`type-detection / config` is the **realm-fixed capture + boundary-retype layer**. It
captures `Object` / `Object.prototype` / `Function.prototype` members once at module-load
— pinning their identity to this realm — and re-exports them (plus ten descriptor presets)
so every predicate reaches for a load-time-fixed reference instead of `Object.x` at each
call site. This shields the package from later tampering with the global `Object`.

**What makes this spec different from the seven behavioral modules.** Config exports **no
predicates** — it is a capture/retype layer, not a discrimination domain — so there are
almost no admit/reject vectors. What it exposes splits into two tiers:

- a **curated public surface** — the ten descriptor presets with their paired `*Options`
  interfaces, `objectHasOwn`, `objectCreate`, and the `BlankType` / `BlankDictionary`
  shape types — the value-added building blocks a downstream package is meant to reach for
  directly, and the only exports present in the generated API docs;
- a larger body of **`@internal` realm-fixed primitives** — the raw `Object` /
  `Function.prototype` captures, the polyfill closure, and the `#060` sentinels —
  importable via the subpath but omitted from the public API docs.

The contract has **three dimensions**, cutting across both tiers:

- **(A) Realm-fixity** — each export is the load-time capture of its intrinsic, held in a
  module `const`, so it cannot be re-resolved by post-load mutation of the global. This is
  the module's reason to exist; it maps to the cross-realm axis.
- **(B) Boundary-retyped signatures** — three exports carry a `.d.ts` signature
  deliberately more precise than `typeof Object.X` (closing lib `any`-cascades and adding
  narrowing). This is a **type-level contract, verified by `pnpm run typecheck`, not by a
  runtime vector.** It is the module's primary deliverable.
- **(C) Polyfill-fallback spec-equivalence** — one selector (`objectHasOwn`) uses the
  native method when callable, else a spec-matching polyfill. The behavioral claim is that
  either branch matches spec semantics. The polyfill closure is **separately exported**
  (`hasOwn`) so the fallback path is directly unit-testable in isolation — without
  stubbing globals or reloading the module (#053-style; see Resolved items #1).

The headline finding of this round: **the config spec is dominated by type-level contract
(B) and realm-fixity invariant (A); the runtime-decidable band (C plus a few
preset/identity checks) is thin.** That is exactly why config is the lightest module — its
real work is typing and identity, not behavior.

## Surface inventory

**35 value exports** (12 public + 23 `@internal`) **plus 12 exported types** (the ten
`*Options` interfaces, plus `BlankType` / `BlankDictionary` — those two public by intent,
settled 2026-08-04; Open items #1). Re-confirmation gate: 35 `.js` exports (34 `const` + 1
`function`) = 35 `.d.ts` value declarations (34 `declare const` + 1 `declare function`)
plus 12 type declarations (the ten `*Options` interfaces + `BlankType` /
`BlankDictionary`); parity re-verified 2026-08-19.

**Public value surface (12):** the ten descriptor presets, `objectHasOwn` (the floor-safe
own-property selector), and `objectCreate` (the 3-overload retype). The remaining 23 value
exports are `@internal` realm-fixed primitives, grouped below.

_(This config-round reconciliation folds in the previously un-sectioned exports —
`globalContext`, `objectFromEntries`, `defineProperties`, `BLANK_DICTIONARY`,
`INSTANCE_LESS_CONSTRUCTOR`; `BLANK_TYPE` was removed as an unconsumed export. The former
"zero exported types" claim was itself drift — `BlankType` / `BlankDictionary` have been
exported since #0064.)_

**Realm capture (1) — `@internal`:** `globalContext` (`globalThis`, the root global-object
capture from which the `Object` / `Function.prototype` members below are read).

**Descriptor presets (10) — public, plain data objects**, each paired with a public
`*Options` interface pinning its flags as literal types: `defaultDataDescriptor`,
`defaultDataAccessor`, `defaultEntryDescriptor`, `defaultEntryAccessor`,
`readOnlyDataDescriptor`, `readOnlyEntryDescriptor`, `frozenDataDescriptor`,
`frozenEntryDescriptor`, `sealedDataAccessor`, `sealedEntryAccessor`.

**Prototype-method captures (3) — `@internal`:** `objectPrototype` (`Object.prototype`),
`toObjectString` (`Object.prototype.toString`, for `.call(value)`), `toFunctionString`
(`Function.prototype.toString`, **retyped** `(this: Callable) => string` — #008).

**Object static captures (18):** two **public** — `objectHasOwn` (**polyfill selector**)
and `objectCreate` (**retyped** 3-overload — #034); sixteen **`@internal`** —
`objectAssign`, `objectIs`, `objectFreeze`, `objectSeal`, `objectKeys`, `objectValues`,
`objectEntries`, `objectFromEntries`, `getOwnPropertyNames`, `getOwnPropertySymbols`,
`getPrototypeOf` (**retyped** `(o: unknown) => object | Callable | null` — #017),
`setPrototypeOf`, `defineProperty`, `defineProperties`, `getOwnPropertyDescriptor`,
`getOwnPropertyDescriptors`.

**Polyfill closure (1) — `@internal`, exported for isolated fallback-path testing
(#053-style):** `hasOwn` (the `Object.prototype.hasOwnProperty`-based fallback behind
`objectHasOwn`). It is a function declaration; consuming code uses the selector, which
prefers native.

**Object- & function-shape sentinels (2) — `@internal`:** `BLANK_DICTIONARY` (the
never-mutated `objectCreate(null)`, typed `BlankDictionary`; the absent-global capture
surrogate and, paired with the next, the failure surrogate of `#utility`'s
`getValidatedStandardConstructorAndPrototypeTuple` — #060) and `INSTANCE_LESS_CONSTRUCTOR`
(a never-invoked function statement cast to `NewableFunction`; its untouched `prototype`
makes `x instanceof INSTANCE_LESS_CONSTRUCTOR` uniformly `false` without throwing — #060).

**Exported types (12) — all public.** Ten `*Options` interfaces, one per descriptor preset
(`DefaultDataDescriptorOptions`, `DefaultDataAccessorOptions`,
`DefaultEntryDescriptorOptions`, `DefaultEntryAccessorOptions`,
`ReadOnlyDataDescriptorOptions`, `ReadOnlyEntryDescriptorOptions`,
`FrozenDataDescriptorOptions`, `FrozenEntryDescriptorOptions`,
`SealedDataAccessorOptions`, `SealedEntryAccessorOptions`), each pinning that preset's
flags as literal types so the declared shape survives to the consumer instead of widening
to `boolean`. The accessor types carry no `writable` member at all — it is invalid on an
accessor descriptor, so the type offers no place to put it.

Plus the two object-shape types, **public by intent (settled 2026-08-04)**: `BlankType`
(`Record<PropertyKey, never>`, the empty ordinary object shape — type-only, its
`BLANK_TYPE` carrier removed in the 2026-07-29 round) and `BlankDictionary`
(`BlankType & { constructor?: never }`, the never-mutated `Object.create(null)` shape,
whose carrier `BLANK_DICTIONARY` is `@internal`); the object-shape vocabulary from #0064.

**Types and carriers are tagged independently — that is the design, not drift.** A type is
public when it is vocabulary a downstream package may import to describe its own values; a
carrier constant is `@internal` when its whole contract is identity, so it means nothing
outside the package that compares against it. `BLANK_DICTIONARY` is exactly that: a single
realm-fixed sentinel, compared by reference and never read for keys, so exporting the
instance would hand a consumer something they cannot use and must not substitute — while
the type describing its shape is genuinely reusable. The same rule explains the other
asymmetry visible in this round: the `BLANK_TYPE` **constant** was removed as unconsumed,
while the `BlankType` **type** was kept. A value export earns its keep by being called; a
type earns it by being nameable.

Boundary-retyped set (B): `toFunctionString`, `objectCreate`, `getPrototypeOf`.
Polyfilled-selector set (C): `objectHasOwn`; its closure `hasOwn`.

## Axis mapping for this module

| Axis | How it applies to config                                                                                                                                                                                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Thin — the preset shapes (`dpo/*`), `objectHasOwn` semantics (`oHO/*`), `objectCreate` overloads (`cap/A5`), the sentinel contracts (`blank/*`, `ilc/*`), and capture identity/behavior (`fix/*`, `cap/*`). The presets, `objectHasOwn`, and `objectCreate` are also the module's public API surface. |
| 2    | The whole point — realm-fixity (A). A captured `const` cannot be re-resolved by global tampering.                                                                                                                                                                                                     |
| 3    | Tamper-immunity is the adversarial face of (A): reassigning `globalThis.Object.x` does not affect the export.                                                                                                                                                                                         |
| —    | (B) boundary-retyped signatures are a **type-level** contract — `pnpm run typecheck` is their gate, not a runtime suite. The spec records them so the typing intent is enumerable.                                                                                                                    |

---

## (A) Realm-fixity — identity capture

Every export is the module-load capture of its intrinsic, so at the current realm the
export **is** the native reference (or, for `objectHasOwn` in a runtime that provides the
native, the native method — see (C)).

- `fix/A1` — identity: `objectIs === Object.is`, `objectKeys === Object.keys`,
  `getPrototypeOf === Object.getPrototypeOf`,
  `getOwnPropertyDescriptor === Object.getOwnPropertyDescriptor`,
  `objectCreate === Object.create`, `objectFromEntries === Object.fromEntries`,
  `defineProperties === Object.defineProperties`,
  `toObjectString === Object.prototype.toString`, `objectPrototype === Object.prototype`
  (representative set; the same holds for every non-polyfilled capture).
- `fix/A2` — tamper-immunity (the consequence of the `const` capture): after
  `Object.is = () => 'evil'`, `objectIs` still references the original `Object.is` and
  `objectIs(1, 1) === true`. Restored after the check. One representative export stands in
  for all — re-resolution immunity is a language guarantee of `const` binding, not a
  per-export behavior.
- `fix/A3` — `globalContext === globalThis` — the realm-capture root. Every `Object.X` /
  `Function.prototype.X` capture in `fix/A1` is read from it, so its fixity underwrites
  the whole set. A `const` binding to `globalThis`, tamper-immune like the rest.

**Note:** `fix/A1` is the runtime-decidable form of realm-fixity within a single realm.
True cross-realm fixity (an iframe/worker/vm reassigning its own `Object`) is the same
guarantee one realm up; the captured `const` is structurally immune either way.

---

## (C) Polyfill-fallback spec-equivalence

One export (`objectHasOwn`) picks native-when-callable, else a spec-matching polyfill. In
this runtime (Node, modern) the native branch is taken, so the export is identity-equal to
its native and exhibits native semantics.

### `objectHasOwn(o, key)`

- `oHO/A1` — `objectHasOwn === Object.hasOwn` (native branch taken in this runtime).
- `oHO/A2` — `objectHasOwn({ a: 1 }, 'a')` → true (own).
- `oHO/R1` — `objectHasOwn({}, 'toString')` → false (inherited, not own — the
  discriminator vs. `'toString' in {}`).
- `oHO/R2` — `objectHasOwn({}, 'nope')` → false.
- `oHO/B1` — `objectHasOwn(null, 'x')` / `objectHasOwn(undefined, 'x')` → **throws**
  (`ToObject` on nullish; both the native and the `hasOwnProperty.call` polyfill throw).
  This is the precondition behind `#utility`'s `?? {}` guard in `hasInertValue`.

### Polyfill closure (direct) — the fallback path tested in isolation

The `hasOwn` closure is exported so the fallback logic runs and is asserted regardless of
which branch the selector takes in the host runtime. The vector targets the closure
directly, so it is decidable even where the native shadows the selector. (Confirmed via
the `#index` barrel in the decidability run.)

- `hasOwn/A1` — `hasOwn({ a: 1 }, 'a')` → true; `hasOwn({}, 'toString')` → false
  (own-only); `hasOwn({}, 'nope')` → false; `hasOwn(null, 'x')` → **throws** (`ToObject`,
  as `oHO/B1`).

---

## (A/runtime) Capture behavior — representative reads

The non-polyfilled captures are the native methods, so their behavior is the platform's. A
representative band confirms the captures are wired correctly (not that the spec
re-defines `Object`'s behavior):

- `cap/A1` — `toObjectString.call([])` → `'[object Array]'`; `toObjectString.call(null)` →
  `'[object Null]'` (realm-independent `[[Class]]` read).
- `cap/A2` — `toFunctionString.call(function f() {})` → a string starting `'function'`;
  `toFunctionString.call(Array)` → contains `'[native code]'`.
- `cap/B1` — `toFunctionString.call({})` → **throws** `TypeError` — the spec-required
  non-callable-receiver constraint that the `(this: Callable)` retype (#008) encodes. The
  retype makes this a compile-time error too; at runtime it throws.
- `cap/A3` — `objectIs(NaN, NaN)` → true; `objectIs(0, -0)` → false (the NaN-equality and
  ±0 distinction `===` cannot express — the reason `#primitive` uses `objectIs` for
  `BoxedNumber` equality).
- `cap/A4` — `getPrototypeOf([])` → `Array.prototype`;
  `getPrototypeOf(Object.create(null))` → `null`;
  `getPrototypeOf(class X extends Array {})` → `Array` — a **callable** prototype (a
  class's parent), exercising the `Callable` arm of the `object | Callable | null` #017
  retype. The three cases cover all three arms of the return.
- `cap/A5` — `objectCreate(null)` → an object with `getPrototypeOf(...) === null`;
  `objectCreate(Array.prototype)` → an object whose prototype is `Array.prototype` (the
  three-overload #034 retype; runtime is the native `Object.create`).

---

## (data + accessor) Descriptor presets — exact shape

Plain frozen-by-convention option objects consumed by `defineProperty` call sites. Vectors
assert the exact own-key/value shape.

Listed in the source file's structural order — configurable before non-configurable,
visible (`Data`) before hidden (`Entry`), descriptor before accessor — so the section can
be walked in parallel against `config/index.js` for completeness. IDs are append-only, so
the sequence is deliberately non-contiguous: `A1`–`A4` predate the 2026-08-19 rework and
assert exactly the shapes they always did (Resolved items #3).

**Configurable**

- `dpo/A5` — `defaultDataDescriptor` →
  `{ enumerable: true, writable: true, configurable: true }`.
- `dpo/A6` — `defaultDataAccessor` → `{ enumerable: true, configurable: true }` (no
  `writable` — invalid on accessor descriptors).
- `dpo/A1` — `defaultEntryDescriptor` →
  `{ enumerable: false, writable: true, configurable: true }`.
- `dpo/A3` — `defaultEntryAccessor` → `{ enumerable: false, configurable: true }` (no
  `writable` — invalid on accessor descriptors).
- `dpo/A7` — `readOnlyDataDescriptor` →
  `{ enumerable: true, writable: false, configurable: true }`.
- `dpo/A2` — `readOnlyEntryDescriptor` →
  `{ enumerable: false, writable: false, configurable: true }`.

**Non-configurable**

- `dpo/A8` — `frozenDataDescriptor` →
  `{ enumerable: true, writable: false, configurable: false }`.
- `dpo/A9` — `frozenEntryDescriptor` →
  `{ enumerable: false, writable: false, configurable: false }`.
- `dpo/A10` — `sealedDataAccessor` → `{ enumerable: true, configurable: false }` (no
  `writable` — invalid on accessor descriptors).
- `dpo/A4` — `sealedEntryAccessor` → `{ enumerable: false, configurable: false }` (no
  `writable` — invalid on accessor descriptors).

---

## (sentinels) Object- & function-shape constants

Two module-constructed `@internal` constants, paired in `#utility`'s failure-surrogate
tuple (#060). Their contracts are structural, asserted directly.

### `BLANK_DICTIONARY` — the never-mutated `objectCreate(null)`

- `blank/A1` — prototype-less + empty: `getPrototypeOf(BLANK_DICTIONARY) === null`;
  `getOwnPropertyNames(BLANK_DICTIONARY).length === 0` and
  `getOwnPropertySymbols(BLANK_DICTIONARY).length === 0` (no own key of either kind).
- `blank/A2` — stable module singleton: the same reference across reads, compared by
  identity as the absent-global capture surrogate and never read for keys — its
  never-mutated emptiness is the whole contract.

### `INSTANCE_LESS_CONSTRUCTOR` — the inert `instanceof` stand-in

- `ilc/A1` — `typeof INSTANCE_LESS_CONSTRUCTOR === 'function'` (a genuine function
  statement, cast to `NewableFunction` for the tuple's constructor slot).
- `ilc/A2` — `x instanceof INSTANCE_LESS_CONSTRUCTOR` → **false** for every representative
  `x` (`{}`, `[]`, `new Date()`, the constructor itself) and **never throws**: nothing is
  ever constructed from it, and its `prototype` is a normal object, so the `instanceof`
  walk is well-formed and empty. This is the contract that lets callers run
  `value instanceof INSTANCE_LESS_CONSTRUCTOR` unguarded (#060).

---

## (B) Boundary-retyped signatures — type-level contract (typecheck-gated, not runtime)

Recorded for enumerability; each is enforced by `pnpm run typecheck`, not by the
decidability run. The deviation from `typeof Object.X` is the deliverable.

- `ret/T1` — `toFunctionString: (this: Callable) => string` (#008) — encodes the
  non-callable-throws precondition lib omits. Runtime face: `cap/B1`.
- `ret/T2` — `getPrototypeOf: (o: unknown) => object | Callable | null` (#017) — replaces
  lib's `(o: any) => any`, closing the `any`-return cascade. The `Callable` arm keeps a
  function-valued `[[Prototype]]` (a class's parent, `Function.prototype`)
  narrow-and-callable rather than collapsing to a bare `object`. Runtime face: `cap/A4`.
- `ret/T3` — `objectCreate` 3-overload (#034): `(null) => Record<PropertyKey, never>`,
  `(object) => object`, `(object | null, properties) => object`, with `ThisType<unknown>`
  over lib's `ThisType<any>`. Runtime face: `cap/A5`.

_(`ret/T4` — the `isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue`
`value is number` retypes under #026 — relocated to `primitive` with the predicates
themselves; see ADR #074 and `PRIMITIVE.spec.md`.)_

---

## Resolved items

1. **Polyfill closures exported for direct testing — RESOLVED (#053-style).** The four
   polyfilled selectors (`objectHasOwn` + the three `Number.isXxx` guards) pick
   native-when-callable, so on a modern runtime the polyfill arm is never reached through
   the selector — leaving the fallback logic unverified and uncoverable. The design owner
   ruled the fix is to **export each polyfill as a named `@internal` closure** (`hasOwn`,
   `isFiniteNumber`, `isInteger`, `isSafeInteger`) with a parallel `.d.ts` declaration, so
   the fallback path is unit-tested directly — the same export-for-testability pattern as
   ADR #053. The alternative (a native-absence reload harness stubbing globals +
   `vi.resetModules()`) was rejected as fragile and global-state-polluting. The selectors
   keep choosing native; the closures make the fallback decidable on any runtime,
   including the below-floor `Number` trio (ES2015) whose fallback the ES2020 floor
   otherwise renders unreachable. Surface: 26 → 30 exports; no behavior change to the
   selectors.

   _Update (2026-07-24, ADR #074):_ the three `Number.isXxx` selectors and their closures
   (`isFiniteNumber` / `isInteger` / `isSafeInteger`) relocated to `primitive`; this
   resolved item's export-for-testability pattern now applies in `config` only to
   `objectHasOwn` / `hasOwn`. The below-floor `Number`-trio testability rationale moves
   with them to `PRIMITIVE.spec.md`.

2. **`BLANK_TYPE` removed — unconsumed export (config round, 2026-07-29).** The #0064
   carrier constant for the `BlankType` shape had zero consumers anywhere in the package
   (`@internal`, never imported) — aspirational symmetry with `BLANK_DICTIONARY` that
   nothing used. Removed, per "an export earns its keep." `BlankType` the _type_ remains
   (it composes `BlankDictionary`), now carrier-less; #0064 was fronted with a
   supersession pointer, and the `#object` architecture docs updated. Surface: 30 → 29
   value exports.

3. **Descriptor presets reworked 4 → 10 (2026-08-19).** The presets now cover the full
   visible/hidden × writable × configurable grid, and each is paired with an exported
   `*Options` interface that pins its flags as literal types — before this, both the `.js`
   and the `.d.ts` widened every flag to `boolean`, so no consumer or IDE could see which
   preset it held. Every old preset survived **by value**, so no vector was withdrawn and
   none renumbered:

   | vector   | old symbol                    | shape                             | now carried by            |
   | -------- | ----------------------------- | --------------------------------- | ------------------------- |
   | `dpo/A1` | `defaultDescriptorOptions`    | `{ e: false, w: true, c: true }`  | `defaultEntryDescriptor`  |
   | `dpo/A2` | `restrictedDescriptorOptions` | `{ e: false, w: false, c: true }` | `readOnlyEntryDescriptor` |
   | `dpo/A3` | `restrictedAccessorOptions`   | `{ e: false, c: true }`           | `defaultEntryAccessor`    |
   | `dpo/A4` | `sealedDescriptorOptions`     | `{ e: false, c: false }`          | `sealedEntryAccessor`     |

   Two things the old set had hidden. **All four were `enumerable: false`** — the
   inventory only ever covered the hidden half of the grid, so `dpo/A5`–`A10` are the
   visible half plus `frozenEntryDescriptor`. And **`sealedDescriptorOptions` was a
   misnomer**: named `Descriptor`, it carried no `writable`, so it had been an accessor
   shape all along — `sealedEntryAccessor` is what it always was.

   Vocabulary is now spec-aligned. `Object.seal` clears `configurable` and leaves
   `writable` untouched, so **`sealed`** names the non-configurable accessors;
   `Object.freeze` clears both, so **`frozen`** names the non-configurable, non-writable
   data descriptors; the still-configurable non-writable pair is **`readOnly`**, which
   claims only what holds, since a `configurable: true` property can be redefined back to
   writable. There is deliberately no frozen accessor: on an accessor `seal` and `freeze`
   produce identical descriptors, and `configurable: false` says nothing about mutability
   because that depends on whether a `set` was supplied — which a preset cannot know.

## Open items

1. **`BlankType` / `BlankDictionary` type visibility — RESOLVED 2026-08-04 (owner ruling).
   Both stay PUBLIC; no code change.** Parked in the config round because both types were
   public while neither appears in a public runtime signature (`objectCreate(null)`
   returns `#object`'s `DictionaryObject`) and `BlankType`'s carrier had been removed.

   **Ruling and reasoning.** The types are public _deliberately_: they are shape
   vocabulary a downstream package may import and work with, and `#object`'s taxonomy
   names them to distinguish the three blank shapes. `BLANK_DICTIONARY` is a different
   question with a different answer — it is a real value with a real `.js` counterpart,
   consumed inside the package, and its entire contract is identity, so it is `@internal`.
   Types and carriers are tagged independently by design; see the Surface inventory note
   above for the general rule and the `BLANK_TYPE`-removed / `BlankType`-kept asymmetry it
   explains.

   **Verified before closing (6 checks, all passing).** (1) Neither type carries
   `@internal`. (2) `BLANK_DICTIONARY` is `@internal` in **both** `.js` and `.d.ts` —
   parity holds. (3) The constant has genuine internal consumers — `utility/index.js`
   imports it and returns it in the `[INSTANCE_LESS_CONSTRUCTOR, BLANK_DICTIONARY]`
   surrogate tuple. (4) No `{@link}` anywhere targets an `@internal` constant; every such
   reference is backticked. (5) The public type doc blocks link only to public symbols
   (`BlankType`, `BlankDictionary`, `DictionaryObject`). (6) Both types are genuinely
   reachable by a consumer — re-exported through the root barrel
   (`export * from '#config'`) **and** via the declared `./config` subpath, so the
   downstream-vocabulary rationale is actual rather than aspirational.

   Point (5) is why the current state needed no repair: because both types are public, the
   existing `{@link}` graph is already legal. Tagging `BlankDictionary` `@internal` would
   have forced two links (in `BlankType`'s doc and `objectCreate`'s) to become backticks —
   a repair the chosen ruling avoids entirely.

_(The 2026-07-24 "config Round-2 retro-audit" deferral is RESOLVED by this round — the six
drifted exports are inventoried, `BLANK_TYPE` removed; see Resolved items #2 and the
2026-07-29 banner. Taxonomy settled: `BLANK_DICTIONARY` / `INSTANCE_LESS_CONSTRUCTOR` form
the new `(sentinels)` group; their narrowing casts are dimension-A shape notes, not
dimension B — which stays the three lib-gap retypes.)_

The 2026-06-19 decidability run covers dimensions (A `fix/A1`–`A2`, `cap/*`), (C — the
`oHO` selector plus the `hasOwn` closure), and the presets (`dpo/*`); dimension (B
`ret/T*`) is `typecheck`-gated. The vectors added this round (`fix/A3`, `blank/*`,
`ilc/*`) are now driven by `test/config/spec.test.js` (21 vectors, green; mutation-probed)
— decidability confirmed.
