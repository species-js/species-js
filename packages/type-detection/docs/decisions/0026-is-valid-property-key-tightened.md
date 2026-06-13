# 026 — `isValidPropertyKey` tightened to safe-integer + three new `Number` type-guards in `@/config`

**Date:** 2026-06-04

**Context.** The previous `isValidPropertyKey` accepted `isStringValue`, `isSymbolValue`,
and `isNumberValue && Number.isFinite` — any finite number, including non-integer floats
like `1.5` and integers beyond `Number.MAX_SAFE_INTEGER`. Floats coerce to strings
(`"1.5"`) at runtime with lookup surprises; integers past `MAX_SAFE_INTEGER` lose
precision in the round-trip. Both were admissible by the previous predicate; both
introduce real lookup hazards. The predicate's name connotes "safely usable as a key" —
the connotation was looser than the implementation.

**Decision.** Tighten `isValidPropertyKey` to accept only safe integers as numeric keys:
the range `[-(2^53 - 1), 2^53 - 1]` where numeric values round-trip losslessly. To support
this, add three new cached `Number` type-guards to `@/config`: `isFiniteNumberValue`
(`Number.isFinite` with `typeof` polyfill fallback), `isIntegerValue` (`Number.isInteger`
composed over `isFiniteNumberValue`), and `isSafeIntegerValue` (`Number.isSafeInteger`
composed over `isIntegerValue` with `Math.abs ≤ MAX_SAFE_INTEGER` bound). Each carries a
polyfill fallback for runtimes lacking the native method.

**Rationale.** Property-key validity is a load-bearing structural claim — the predicate
gates `getNextAvailablePropertyDescriptor`, which gates `hasInertMethod`, which gates
every contract predicate that walks the prototype chain. Admitting numbers with hazardous
runtime semantics propagates the hazard downstream. Restricting to safe integers makes the
predicate's name honest. The three new primitives form a clean composition hierarchy
(finite → integer → safe-integer), and each is boundary-retyped in the `.d.ts` per #008 to
a type-guard `(value: unknown) => value is number` — the lib types `Number.isXxx` as
`(number: unknown) => boolean` (non-narrowing), which forced casts at consumer sites.

**Consequences.** Contract change visible to downstream consumers:
`isValidPropertyKey(1.5)` now returns `false`; same for `isValidPropertyKey(2 ** 60)`. The
`@/utility` callers of `isValidPropertyKey` see the same tightening
(`getNextAvailablePropertyDescriptor` rejects hazardous keys), which propagates into every
contract predicate. The three new `@/config` primitives are public exports, available for
any downstream package that needs the same realm-fixed `Number` type-guards. The
boundary-retyping pattern from #008 / #017 now has a third instance, reinforcing it as the
canonical solution for closing lib `any`-/`boolean`-gaps.
