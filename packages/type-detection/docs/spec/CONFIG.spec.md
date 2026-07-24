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
> `BLANK_DICTIONARY`, `BLANK_TYPE`, `INSTANCE_LESS_CONSTRUCTOR`). Those six are
> **pre-existing drift, deferred to the config Round-2 retro-audit** — not inventoried
> here. The FROZEN status above records the 2026-06-19 run (Number trio then present); the
> inventory and axis sections below reflect the post-relocation surface.

## Module contract

`type-detection / config` is the **realm-fixed capture + boundary-retype layer**. It
captures `Object` / `Object.prototype` / `Function.prototype` members once at module-load
— pinning their identity to this realm — and re-exports them (plus four descriptor
presets) so every predicate reaches for a load-time-fixed reference instead of `Object.x`
at each call site. This shields the package from later tampering with the global `Object`.

**What makes this spec different from the seven behavioral modules.** Config exports **no
predicates** and **no public surface** — all 30 exports are `@internal`, surfaced via the
subpath only for downstream packages needing the same building blocks. So there are almost
no admit/reject vectors. The contract instead has **three dimensions**:

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

All 30 exports are `@internal`; zero exported types. Re-confirmation gate: 30 `.js`
exports (29 `const` + 1 `function`) = 30 `.d.ts` declarations (29 `declare const` + 1
`declare function`); parity verified. (Six of the 30 — `globalContext`,
`objectFromEntries`, `defineProperties`, `BLANK_DICTIONARY`, `BLANK_TYPE`,
`INSTANCE_LESS_CONSTRUCTOR` — are shipping but not yet sectioned below: pre-existing drift
deferred to the config Round-2 retro-audit, per the amendment banner.)

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

**Polyfill closure (1) — `@internal`, exported for isolated fallback-path testing
(#053-style):** `hasOwn` (the `Object.prototype.hasOwnProperty`-based fallback behind
`objectHasOwn`). It is a function declaration; consuming code uses the selector, which
prefers native.

Boundary-retyped set (B): `toFunctionString`, `objectCreate`, `getPrototypeOf`.
Polyfilled-selector set (C): `objectHasOwn`; its closure `hasOwn`.

## Axis mapping for this module

| Axis | How it applies to config                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Thin — the only runtime behavior is the preset shapes, the `objectHasOwn` polyfill semantics, and capture identity.                                                                |
| 2    | The whole point — realm-fixity (A). A captured `const` cannot be re-resolved by global tampering.                                                                                  |
| 3    | Tamper-immunity is the adversarial face of (A): reassigning `globalThis.Object.x` does not affect the export.                                                                      |
| —    | (B) boundary-retyped signatures are a **type-level** contract — `pnpm run typecheck` is their gate, not a runtime suite. The spec records them so the typing intent is enumerable. |

---

## (A) Realm-fixity — identity capture

Every export is the module-load capture of its intrinsic, so at the current realm the
export **is** the native reference (or, for `objectHasOwn` in a runtime that provides the
native, the native method — see (C)).

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

## Open items

**Deferred — config Round-2 retro-audit.** Six shipping exports are not yet inventoried or
vector-covered above: `globalContext`, `objectFromEntries`, `defineProperties`,
`BLANK_DICTIONARY`, `BLANK_TYPE`, `INSTANCE_LESS_CONSTRUCTOR` — pre-existing drift
surfaced during the #074 relocation (2026-07-24). Taxonomy placement (are the `BLANK_*`
sentinels and `INSTANCE_LESS_CONSTRUCTOR` a new group; is any of them boundary-retyped /
dimension B?) is a design call for that audit.

The decidability run covers dimensions (A `fix/*`, `cap/*`), (C — the `oHO` selector plus
the `hasOwn` closure), and the presets (`dpo/*`); dimension (B `ret/T*`) is covered by
`typecheck` in the standard `pnpm run check`, not by the ephemeral decidability suite.
