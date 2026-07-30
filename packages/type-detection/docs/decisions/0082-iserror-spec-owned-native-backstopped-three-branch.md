# 082 — `isError` is spec-owned and native-backstopped: a three-branch module-load selection (resolves error item #3)

**Date:** 2026-07-30

**Context.** The public `isError` was bound once at module-load by a two-way gate retained
from the retired #032 (redesigned in body only by #065):

```js
export const isError = isFunction(nativeIsError) ? nativeIsError : isAnyError;
```

When native `Error.isError` was present this returned it **raw** — `isError` sometimes
literally _was_ the foreign native function, whose `DOMException` verdict this module does
not control. That produced an engine-dependent seam the frozen spec had to hedge around
(spec `isError/A2` "DOMException → engine-dependent, assert runtime-agnostically"; error
open item #3): native `Error.isError` reads the internal `[[ErrorData]]` slot, and engines
disagree on whether a `DOMException` carries it. On a slot-granting engine (a browser,
Node ≥ 23) `isError(new DOMException())` is `true`; on a hypothetical native that
withholds the slot from `DOMException` it would be `false` — the module's deterministic
`isDOMException` arm notwithstanding. A predicate whose answer for a real, well-formed
`DOMException` moves with the runtime is not the reliability contract this package holds
itself to. Item #3 asked whether to close that seam; the paired options were **A** (export
both `isError` and a promoted public `isAnyError`), **B** (drop `isError`, export only
`isAnyError`), and **D** (keep `isError`, make it spec-owned).

**Decision. Adopt option D: `isError` is OUR spec-owned predicate that USES native
`Error.isError` as an internal accelerator, never a raw passthrough.** It is bound once at
module-load by a three-way selection over the captured native, refined beyond the flat
option-D sketch with a load-time capability probe:

```js
export const isError = !isFunction(nativeIsError)
  ? isAnyError // 1  no native
  : nativeIsError(new DOMExceptionConstructor())
    ? (value) => nativeIsError(value) // 2  native admits DOMException
    : (value) => nativeIsError(value) || isDOMException(value); // 3  native withholds it
// (shipped via an object-method wrapper so each branch's function is named `isError`)
```

1. **No native** → the `isAnyError` polyfill body (unchanged).
2. **Native present AND it already recognizes a `DOMException`** — probed once at load via
   `nativeIsError(new DOMExceptionConstructor())` → **native alone**. On such an engine
   the `[[ErrorData]]` slot covers both arms (real `Error`s and real `DOMException`s carry
   it), so a structural DOMException backstop would be redundant on every call.
3. **Native present, but it does NOT recognize a `DOMException`** →
   `nativeIsError(value) || isDOMException(value)`: native for the `Error` arm, the
   deterministic cross-realm `isDOMException` backstopping the `DOMException` arm.

`isAnyError` **stays `@internal`, unchanged** (options A/B, which promoted or replaced it,
are declined). No type or exported function is renamed (the `GenericError` alias, error
open item #4, is separately declined). The generic `T` surface is applied over the
captured native even though it is non-generic per its ES2025 declaration — runtime
semantics unchanged, only the type-surface widens.

**Rationale.**

- **`isError` owns its contract.** The deepest defect of the old binding was that it
  sometimes returned a foreign function whose verdict we don't govern. A spec-owned
  predicate is the fix; the native method becomes an internal accelerator, not the public
  answer.
- **Best check per arm where native exists.** Native reads `[[ErrorData]]` for the `Error`
  arm — spec-precise, cross-realm (the slot is realm-independent), and rejects an
  `Object.create(Error.prototype)` graft precisely even in a stack-incapable engine, where
  the polyfill's stack-graft filter would stand down. The deterministic `isDOMException`
  carries the `DOMException` arm where native withholds the slot. Each arm uses the
  strongest available discriminator.
- **The load-time probe, not an unconditional `|| isDOMException`.** The flat option-D
  sketch OR'd `isDOMException` on every native-present call. The probe splits that: where
  native already admits `DOMException`s (branch 2) the backstop is pure redundant work per
  call and — decisively — reintroduces the slot-less-fake seam, since a slot-less
  `DOMException`-shaped synthetic that raw native rejects would be re-admitted by the
  structural backstop. Branch 2 keeps `isError` a precise slot-read; branch 3 adds the
  backstop only where it is load-bearing.
- **Closes the practically-meaningful fuzziness.** Every real `Error` and every real
  `DOMException` — local or cross-realm — is now admitted deterministically on every
  engine. The old `isError/A2` hedge is resolved for the well-formed set.
- **Fixes `isAbortError` for free, no re-gate.** It composes `isError`; the canonical
  abort error IS a `DOMException` named `'AbortError'`, so abort detection is now
  deterministic and `isAbortError ⇒ isError` holds on every engine.
- **Smallest change that closes #3.** Option B (drop `isError`) is the only literally
  universal partition, but removes native precision, removes the intuitive `isError` name,
  and re-centers a just-frozen module (public-API removal + vector-ID surgery). D keeps
  the surface, the axis-5 marked set (19), and every admit/reject vector; it changes only
  the binding body.

**Consequences.**

- **Error open item #3 → RESOLVED; item #4 (`GenericError` alias) → DECLINED.** `isError`
  is deterministic for every well-formed value; no open policy flags remain on the module.
- **The partition invariant stays asserted on the deterministic `isAnyError`**, not on
  `isError`. `isAnyError ≡ isGenericError ⊎ isDOMException` is unconditional; `isError`
  matches it for every well-formed value. Two residuals keep a narrow engine-dependence
  under branch 2 ONLY, on values outside the well-formed set: **(a)** a slot-LESS
  `DOMException`-shaped fake (a synthetic with the getter contract but no `[[ErrorData]]`,
  e.g. the axis-2 cross-realm fixture) — rejected by raw native, admitted by the
  polyfill/backstop; **(b)** a deliberately-malformed `DOMException` (own-data `name`
  flattening the inherited getter) — admitted by native's slot while both structural arms
  reject it, the sole break of the partition. Both are asserted via the deterministic
  `isAnyError`, never a baked-in native verdict.
- **Supersedes the #032 binding posture** (native-or-polyfill passthrough); retains #032's
  _capture posture_ (native captured once at load, realm-fixed) and #065's polyfill body.
- **No axis-5 / marked-set change.** The new branch bodies are all `@@throw-safe`
  (`nativeIsError` never throws; the load-time probe cannot throw —
  `DOMExceptionConstructor` is capture-validated or the never-instantiated
  `INSTANCE_LESS_CONSTRUCTOR` sentinel, `new DOMException()` is spec-total, and
  `Error.isError` reads a slot without throwing; `isDOMException` is throw-safe).
  `isError` stays a marked `export const`; the source-marker parse still matches
  `export (function|const)`.
- **Test-env note.** Node 22 has no native `Error.isError`, so the suite exercises branch
  1 (the `isAnyError` polyfill); the two native-present branches are covered
  runtime-agnostically (spec `isError/B2`). The axis-2 cross-realm DOMException fixture is
  a slot-less synthetic asserted via `isAnyError` (`iAE/A2`), never `isError`.
- **Canon updated in lockstep:** `src/error.{js,d.ts}` (the three-branch binding +
  parallel doc blocks), `docs/spec/ERROR.spec.md` (`## isError` section, module-contract
  diagram + invariant, open items #3/#4, surface inventory, test-env note, axis-5
  section), `docs/architecture/error.md` ("Native-backstopped capture at module-load", the
  mental-model diagram + invariant, the composition table), and
  `test/error/cross-realm.test.js` (the slot-less synthetic asserted via `isAnyError`).
