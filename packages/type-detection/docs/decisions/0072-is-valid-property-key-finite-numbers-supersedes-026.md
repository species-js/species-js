# 072 — `isValidPropertyKey` admits finite numbers (not safe-integers), excludes `bigint` — supersedes #026

**Date:** 2026-07-23

**Context.** `isValidPropertyKey` is the module's one narrowing type-guard,
`value is PropertyKey`, and it gates `getNextAvailablePropertyDescriptor` — and thence the
whole inert-probe layer — so its line is load-bearing. Its numeric arm has now held three
different shapes:

- **pre-#026:** `isStringValue || isSymbolValue || (isNumberValue && Number.isFinite)` —
  finite numbers.
- **#026 (2026-06-04):** tightened the numeric arm to `isSafeIntegerValue`, rejecting
  non-integer floats (`1.5`) and unsafe integers (`2 ** 53`) as "hazardous keys" (float
  lookup surprises, precision loss).
- **subsequent undocumented drift:** the numeric arm became `isNumberValue`, which wrongly
  admitted `NaN` and `±Infinity`.

Neither of the latter two is correct. Per ECMA-262 a property key is a `String` or a
`Symbol`; every other value that reaches a property access runs through `ToPropertyKey` →
`ToString`. So a validator's real question is not "can this be a key?" (almost anything
can) but "is this a **deliberate** key rather than an accidental/hazardous coercion?" —
Job-1 (coercion-safety) validation. The downstream descriptor walk already stringifies the
key, so the `1` / `'1'` aliasing is consciously accepted.

**Decision.** `isValidPropertyKey(value)` is
`typeof value === 'string' || typeof value === 'symbol' || isFiniteNumberValue(value)`,
narrowing to the lib `PropertyKey` (`string | number | symbol`).

- **Accept:** `string`, `symbol`, and any **finite** `number` — including non-integer
  floats (`1.5`) and integers beyond the safe range (`2 ** 53`).
- **Reject:** `NaN`, `±Infinity`, `bigint`, `boolean`, `null`, `undefined`, `object`.

This **supersedes #026's `isValidPropertyKey` tightening** (safe-integer → finite),
restoring the pre-#026 numeric semantics via the named `isFiniteNumberValue` predicate
that #026 itself introduced. #026's three `Number` type-guards (`isFiniteNumberValue` /
`isIntegerValue` / `isSafeIntegerValue`) **remain canonical** — this decision only
re-selects which one composes into `isValidPropertyKey`.

**Rationale.**

- **Keys are strings; numbers are spellings.** `obj[1.5]` is `obj['1.5']` and
  `obj[2 ** 53]` is `obj['9007199254740992']` — deterministic and round-trip-clean _as
  keys_. #026's precision / lookup-surprise concern targets numeric identity
  (`2 ** 53 === 2 ** 53 + 1`), not **key** identity — which is just the string. So `1.5`
  and large finite integers are the legitimate keys they appear to be.
- **General-purpose, not array-index.** #026's safe-integer bound is array-index-grade
  (`0 … 2³² − 2`). `isValidPropertyKey` gates an arbitrary descriptor walk, not TypedArray
  / array-index access, so integer / safe-integer tightening wrongly rejects valid keys.
  If a caller ever needs the array-index line, `isIntegerValue` / `isSafeIntegerValue` are
  still exported.
- **`NaN` / `±Infinity` are error-state numbers.** They stringify (`'NaN'` / `'Infinity'`)
  but are ~never an intended key, so they are excluded on the same "signals-a-mistake"
  basis as `null` / `undefined` (bug signal) and `boolean` (a boolean key is essentially
  always a mistake — an intent line, honestly named, since `true` stringifies as cleanly
  as a number).
- **`bigint` is excluded — for a different reason than `NaN`/`±Infinity`.** A `bigint`
  coerces cleanly (`1n` → `'1'`) and would be a perfectly deliberate-looking key, so the
  error-state argument does **not** apply to it. It is excluded because it is **not a
  member of the lib `PropertyKey`** (`string | number | symbol`): admitting `1n` while
  narrowing to `value is PropertyKey` would be unsound — the guard would narrow away the
  very case that passed. TypeScript's own `PropertyKey` deliberately omits `bigint`, a
  mainstream precedent for exactly this line; `bigint` also carries the `1n` / `1` / `'1'`
  cross-type aliasing wrinkle. A caller holding a bigint id normalizes with `String(id)`.
  Admitting bigint would require replacing the lib `PropertyKey` narrow target with a
  bespoke union — a layering smell for zero new keys (only a new spelling of an existing
  string key).

**Consequences.** Contract change visible to consumers, relative to both prior states:

- `isValidPropertyKey(1.5)` → `true` (was `false` under #026).
- `isValidPropertyKey(2 ** 53)` → `true` (was `false` under #026).
- `isValidPropertyKey(NaN)` / `isValidPropertyKey(Infinity)` → `false` (were `true` under
  the `isNumberValue` drift).
- `isValidPropertyKey(1n)` → `false` (unchanged; now with an explicit soundness
  rationale).

Downstream, `getNextAvailablePropertyDescriptor` now admits finite-number keys it
previously rejected — harmless, the descriptor read stringifies them anyway. The frozen
`UTILITY.spec.md` `iVPK` vectors are rewritten as part of the utility-round spec
reconciliation (accept `1.5` / `2 ** 53`; keep `NaN` / `±Infinity` / `1n` / boolean /
nullish / object as rejects; the "Refuses to claim" note reverses to a positive claim
about finite keys, with `NaN`/`±Infinity` and `bigint` as the two distinct-reason
refusals). `#026` is marked superseded on its `isValidPropertyKey` aspect only; its
`Number`-predicate additions stand.

Implementation note: the `string` / `symbol` arms are inlined `typeof` checks (one
`typeof value` read, two compares) rather than composing `isStringValue` / `isSymbolValue`
— a hot-path micro-form for a predicate on the descriptor-walk path; the numeric arm
composes `isFiniteNumberValue`.
