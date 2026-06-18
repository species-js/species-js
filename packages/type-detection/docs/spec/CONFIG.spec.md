# config — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`config/index.d.ts`, `config/index.js`, and the
> boundary-retyping decisions #008 (`toFunctionString`), #017 (`getPrototypeOf`), #026
> (the `Number.isXxx` retypes), #034 (`objectCreate`); the pattern itself is documented in
> `architecture/function.md` → "Boundary-retyping for lib `any`-gaps"). There is no
> `architecture/config.md` — config is infrastructure, not a discrimination domain.
> Status: **FROZEN 2026-06-19** — decidability check passed over the runtime-decidable
> dimensions (realm-fixity + tamper-immunity, the polyfill selectors, the four exported
> polyfill closures, the capture reads, and the preset shapes) via the `@/index.js`
> barrel, single realm; dimension B is typecheck-gated, not a runtime vector. No
> surprises: every polyfilled selector took the native branch in this runtime
> (identity-equal to its `Object.`/`Number.` intrinsic), the closures run the fallback
> logic correctly in isolation, captures are identity-equal, and the `Number.isXxx`
> no-coercion semantics hold. The polyfill closures (`hasOwn`, `isFiniteNumber`,
> `isInteger`, `isSafeInteger`) are exported `@internal` (#053-style) so the fallback path
> is directly testable (Resolved items #1). The eighth and final type-detection spec. Base
> for the axis-1 suite; axes 2–3 derive alongside.

## Module contract

`type-detection / config` is the **realm-fixed capture + boundary-retype layer**. It
captures `Object` / `Object.prototype` / `Function.prototype` / `Number` / `Math` members
once at module-load — pinning their identity to this realm — and re-exports them (plus
four descriptor presets) so every predicate reaches for a load-time-fixed reference
instead of `Object.x` at each call site. This shields the package from later tampering
with the global `Object`.

**What makes this spec different from the seven behavioral modules.** Config exports **no
predicates** and **no public surface** — all 30 exports are `@internal`, surfaced via the
subpath only for downstream packages needing the same building blocks. So there are almost
no admit/reject vectors. The contract instead has **three dimensions**:

- **(A) Realm-fixity** — each export is the load-time capture of its intrinsic, held in a
  module `const`, so it cannot be re-resolved by post-load mutation of the global. This is
  the module's reason to exist; it maps to the cross-realm axis.
- **(B) Boundary-retyped signatures** — five exports carry a `.d.ts` signature
  deliberately more precise than `typeof Object.X` (closing lib `any`-cascades and adding
  narrowing). This is a **type-level contract, verified by `pnpm run typecheck`, not by a
  runtime vector.** It is the module's primary deliverable.
- **(C) Polyfill-fallback spec-equivalence** — four selectors (`objectHasOwn` + the three
  `Number.isXxx` guards) use the native method when callable, else a spec-matching
  polyfill. The behavioral claim is that either branch matches spec semantics. The
  polyfill closures are **separately exported** (`hasOwn`, `isFiniteNumber`, `isInteger`,
  `isSafeInteger`) so the fallback path is directly unit-testable in isolation — without
  stubbing globals or reloading the module (#053-style; see Resolved items #1).

The headline finding of this round: **the config spec is dominated by type-level contract
(B) and realm-fixity invariant (A); the runtime-decidable band (C plus a few
preset/identity checks) is thin.** That is exactly why config is the lightest module — its
real work is typing and identity, not behavior.

## Surface inventory

All 30 exports are `@internal`; zero exported types. Re-confirmation gate: 30 `.js`
exports (26 `const` + 4 `function`) = 30 `.d.ts` declarations (26 `declare const` + 4
`declare function`); no drift.

**Descriptor presets (4) — plain data objects:** `defaultDescriptorOptions`,
`restrictedDescriptorOptions`, `restrictedAccessorOptions`, `sealedDescriptorOptions`.

**Prototype-method captures (3):** `objectPrototype` (`Object.prototype`),
`toObjectString` (`Object.prototype.toString`, for `.call(value)`), `toFunctionString`
(`Function.prototype.toString`, **retyped** `(this: Callable) => string` — #008).

**Object static captures (16):** `objectHasOwn` (**polyfill**), `objectAssign`,
`objectIs`, `objectCreate` (**retyped** 3-overload — #034), `objectFreeze`, `objectSeal`,
`objectKeys`, `objectValues`, `objectEntries`, `getOwnPropertyNames`,
`getOwnPropertySymbols`, `getPrototypeOf` (**retyped** `(o: unknown) => object | null` —
#017), `setPrototypeOf`, `defineProperty`, `getOwnPropertyDescriptor`,
`getOwnPropertyDescriptors`.

**Number static captures (3) — all retyped `(value: unknown) => value is number` (#026),
all polyfilled selectors:** `isFiniteNumberValue`, `isIntegerValue`, `isSafeIntegerValue`.

**Polyfill closures (4) — `@internal`, exported for isolated fallback-path testing
(#053-style):** `hasOwn` (the `Object.prototype.hasOwnProperty`-based fallback behind
`objectHasOwn`), `isFiniteNumber`, `isInteger`, `isSafeInteger` (the explicit fallbacks
behind the three Number selectors). Each is a function declaration; consuming code uses
the selector, which prefers native.

Boundary-retyped set (B): `toFunctionString`, `objectCreate`, `getPrototypeOf`,
`isFiniteNumberValue`, `isIntegerValue`, `isSafeIntegerValue`. Polyfilled-selector set
(C): `objectHasOwn`, `isFiniteNumberValue`, `isIntegerValue`, `isSafeIntegerValue`; their
closures `hasOwn`, `isFiniteNumber`, `isInteger`, `isSafeInteger`.

## Axis mapping for this module

| Axis | How it applies to config                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Thin — the only runtime behavior is the preset shapes, the polyfill-quartet semantics, and capture identity.                                                                       |
| 2    | The whole point — realm-fixity (A). A captured `const` cannot be re-resolved by global tampering.                                                                                  |
| 3    | Tamper-immunity is the adversarial face of (A): reassigning `globalThis.Object.x` does not affect the export.                                                                      |
| —    | (B) boundary-retyped signatures are a **type-level** contract — `pnpm run typecheck` is their gate, not a runtime suite. The spec records them so the typing intent is enumerable. |

---

## (A) Realm-fixity — identity capture

Every export is the module-load capture of its intrinsic, so at the current realm the
export **is** the native reference (or, for the polyfill quartet in a runtime that
provides the native, the native method — see (C)).

- `fix/A1` — identity: `objectIs === Object.is`, `objectKeys === Object.keys`,
  `getPrototypeOf === Object.getPrototypeOf`,
  `getOwnPropertyDescriptor === Object.getOwnPropertyDescriptor`,
  `objectCreate === Object.create`, `toObjectString === Object.prototype.toString`,
  `objectPrototype === Object.prototype` (representative set; the same holds for every
  non-polyfilled capture).
- `fix/A2` — tamper-immunity (the consequence of the `const` capture): after
  `Object.is = () => 'evil'`, `objectIs` still references the original `Object.is` and
  `objectIs(1, 1) === true`. Restored after the check. One representative export stands in
  for all — re-resolution immunity is a language guarantee of `const` binding, not a
  per-export behavior.

**Note:** `fix/A1` is the runtime-decidable form of realm-fixity within a single realm.
True cross-realm fixity (an iframe/worker/vm reassigning its own `Object`) is the same
guarantee one realm up; the captured `const` is structurally immune either way.

---

## (C) Polyfill-fallback spec-equivalence

Four exports pick native-when-callable, else a spec-matching polyfill. In this runtime
(Node, modern) the native branch is taken, so each export is identity-equal to its native
and exhibits native semantics.

### `objectHasOwn(o, key)`

- `oHO/A1` — `objectHasOwn === Object.hasOwn` (native branch taken in this runtime).
- `oHO/A2` — `objectHasOwn({ a: 1 }, 'a')` → true (own).
- `oHO/R1` — `objectHasOwn({}, 'toString')` → false (inherited, not own — the
  discriminator vs. `'toString' in {}`).
- `oHO/R2` — `objectHasOwn({}, 'nope')` → false.
- `oHO/B1` — `objectHasOwn(null, 'x')` / `objectHasOwn(undefined, 'x')` → **throws**
  (`ToObject` on nullish; both the native and the `hasOwnProperty.call` polyfill throw).
  This is the precondition behind `@/utility`'s `?? {}` guard in `hasInertValue`.

### `isFiniteNumberValue(value)` — also retyped `value is number`

- `iFNV/A1` — `isFiniteNumberValue === Number.isFinite` (native branch).
- `iFNV/A2` — `0`, `42`, `-3.5`, `Number.MAX_VALUE` → true.
- `iFNV/R1` — `Infinity`, `-Infinity`, `NaN` → false.
- `iFNV/R2` — `'5'`, `null`, `undefined`, `5n`, `{}` → false — **no coercion** (unlike the
  global `isFinite('5') === true`); this is the spec distinction the capture preserves.

### `isIntegerValue(value)` — also retyped `value is number`

- `iIV/A1` — `isIntegerValue === Number.isInteger` (native branch).
- `iIV/A2` — `0`, `42`, `-7`, `2 ** 53` → true (any integer-valued float, safe or not).
- `iIV/R1` — `1.5`, `NaN`, `Infinity`, `'5'` → false.

### `isSafeIntegerValue(value)` — also retyped `value is number`

- `iSIV/A1` — `isSafeIntegerValue === Number.isSafeInteger` (native branch).
- `iSIV/A2` — `0`, `Number.MAX_SAFE_INTEGER`, `-(2 ** 53 - 1)` → true.
- `iSIV/R1` — `2 ** 53` (= `MAX_SAFE_INTEGER + 1`), `1.5`, `NaN`, `'5'` → false (the
  lossless-round-trip bound; this is what `isValidPropertyKey` leans on).

### Polyfill closures (direct) — the fallback path tested in isolation

The four closures are exported so the fallback logic runs and is asserted regardless of
which branch the selector takes in the host runtime. These vectors target the closure
directly, so they are decidable even where the native shadows the selector. (Confirmed via
the `@/index.js` barrel in the decidability run.)

- `hasOwn/A1` — `hasOwn({ a: 1 }, 'a')` → true; `hasOwn({}, 'toString')` → false
  (own-only); `hasOwn({}, 'nope')` → false; `hasOwn(null, 'x')` → **throws** (`ToObject`,
  as `oHO/B1`).
- `isFiniteNumber/A1` — `0`, `42`, `-3.5` → true; `Infinity`, `NaN`, `'5'`, `null`, `5n` →
  false (the `isNumberValue` guard suppresses the global-`isFinite` coercion).
- `isInteger/A1` — `0`, `7`, `2 ** 53` → true; `1.5`, `NaN`, `'5'` → false.
- `isSafeInteger/A1` — `0`, `Number.MAX_SAFE_INTEGER` → true; `2 ** 53`, `1.5`, `'5'` →
  false.

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
  ±0 distinction `===` cannot express — the reason `@/primitive` uses `objectIs` for
  `BoxedNumber` equality).
- `cap/A4` — `getPrototypeOf([])` → `Array.prototype`;
  `getPrototypeOf(Object.create(null))` → `null` (the `object | null` return the #017
  retype promises).
- `cap/A5` — `objectCreate(null)` → an object with `getPrototypeOf(...) === null`;
  `objectCreate(Array.prototype)` → an object whose prototype is `Array.prototype` (the
  three-overload #034 retype; runtime is the native `Object.create`).

---

## (data) Descriptor presets — exact shape

Plain frozen-by-convention option objects consumed by `defineProperty` call sites. Vectors
assert the exact own-key/value shape.

- `dpo/A1` — `defaultDescriptorOptions` →
  `{ enumerable: false, writable: true, configurable: true }`.
- `dpo/A2` — `restrictedDescriptorOptions` →
  `{ enumerable: false, writable: false, configurable: true }`.
- `dpo/A3` — `restrictedAccessorOptions` → `{ enumerable: false, configurable: true }` (no
  `writable` — invalid on accessor descriptors).
- `dpo/A4` — `sealedDescriptorOptions` → `{ enumerable: false, configurable: false }`.

---

## (B) Boundary-retyped signatures — type-level contract (typecheck-gated, not runtime)

Recorded for enumerability; each is enforced by `pnpm run typecheck`, not by the
decidability run. The deviation from `typeof Object.X` is the deliverable.

- `ret/T1` — `toFunctionString: (this: Callable) => string` (#008) — encodes the
  non-callable-throws precondition lib omits. Runtime face: `cap/B1`.
- `ret/T2` — `getPrototypeOf: (o: unknown) => object | null` (#017) — replaces lib's
  `(o: any) => any`, closing the `any`-return cascade. Runtime face: `cap/A4`.
- `ret/T3` — `objectCreate` 3-overload (#034): `(null) => Record<PropertyKey, never>`,
  `(object) => object`, `(object | null, properties) => object`, with `ThisType<unknown>`
  over lib's `ThisType<any>`. Runtime face: `cap/A5`.
- `ret/T4` — `isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue`:
  `(value: unknown) => value is number` (#026) — replaces lib's non-narrowing `boolean`,
  propagating the narrow at call sites. Runtime face: the `iFNV`/`iIV`/`iSIV` vectors.

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

## Open items

None. The decidability run covers dimensions (A `fix/*`, `cap/*`), (C — the `oHO`/`iFNV`/
`iIV`/`iSIV` selectors plus the `hasOwn`/`isFiniteNumber`/`isInteger`/`isSafeInteger`
closures), and the presets (`dpo/*`); dimension (B `ret/T*`) is covered by `typecheck` in
the standard `pnpm run check`, not by the ephemeral decidability suite.
