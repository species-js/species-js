# 043 — Per-family equality strategies and `objectIs` realm-fixed capture

**Date:** 2026-06-07

**Context.** Implementing decision #042's fourth marker required choosing _how_ to compare
the unboxed primitive value (from the captured `prototype.valueOf` call) to the boxed
value. The naive approach — `valueOf.call(value) === Constructor(value)` — appeared
uniform but turned out to be **incorrect for four of the five families** once the spec
mechanics of each constructor's coercion path were traced. The user discovered this
empirically through review iteration; the species-js form documents the resolution.

**Decision.** The five families ship four different equality shapes, each driven by the
spec mechanics of the corresponding constructor's coercion path:

- **String — direct `===`.** Both `String.prototype.valueOf.call(value)` and
  `String(value)` land on the same primitive string. No trap. Helper compares directly.

- **Number — `Object.is`.** Direct `===` fails for `new Number(NaN)` because `NaN !== NaN`
  is the spec-defined behavior of strict equality (ECMA-262 §7.2.16).
  `Object.is(NaN, NaN) === true` is the `SameValue` algorithm (§7.2.10), which is the
  semantically correct primitive for boxed-Number equality. The ±0 distinction
  (`Object.is(+0, -0) === false`) is irrelevant here because both sides derive from the
  same `value` — sign matches by construction. Helper uses `objectIs`.

- **Boolean — `String()` roundtrip.** Direct `===` _systematically_ fails for
  `new Boolean(false)`. Per ECMA-262 §20.3.1.1, `Boolean(value)` is `ToBoolean(value)`;
  per §7.1.2, `ToBoolean(Object) → true` for any object regardless of content. So
  `Boolean(new Boolean(false)) → true` while `valueOf` returns `false`. The constructor
  coercion does not unwrap the box. The fix routes both sides through `String()` (which
  uses `ToPrimitive("string")` and unwraps via the prototype's `toString` method):
  `String(false) === 'false'`, `String(new Boolean(false)) === 'false'`, match. Helper
  composes `isBooleanValue(unboxedValue) && String(unboxedValue) === String(value)`.

- **Symbol — description cross-check.** `Symbol(boxedSym)` throws TypeError because
  `ToString(primitive symbol)` throws unconditionally (§7.1.17, §20.4.1.1). The "equality"
  framing pivots to a property cross-check: compare `unboxedValue.description` (read from
  the primitive's `[[Description]]` internal slot via the prototype getter) against
  `value.description` (read via the boxed object's prototype chain). The cross-check
  **catches a real tampering surface that the valueOf probe alone misses**: an attacker
  can define an own data property `description` on a real boxed Symbol that shadows
  `Symbol.prototype.description`. The valueOf still works (slot is internal) but the
  observable description has been lied about; the cross-check catches the mismatch.
  Both-undefined case (`Symbol()` with no description) handled by direct equality — no
  `isStringValue` gate, which would falsely reject the descriptionless form. Helper
  composes
  `isSymbolValue(unboxedValue) && unboxedValue.description === value.description`.

- **BigInt — direct `===`.** `BigInt(value)` per §21.2.1.1 starts with
  `ToPrimitive(value, "number")`, which calls `valueOf` on a boxed BigInt and unwraps.
  Both sides land on the same primitive bigint. Helper compares directly.

To support the Number case, `objectIs = Object.is` is added to `@/config` as a realm-fixed
capture. It joins the cached-prototype-reference family alongside `objectAssign`,
`objectCreate`, `objectFreeze`, etc.

**Rationale.** The naive uniformity assumption ("use
`valueOf.call(value) === Constructor(value)` for all five") is broken by spec mechanics
that differ per constructor:

- For two families (String, BigInt) the constructor coercion unwraps via `ToPrimitive` and
  the equality holds.
- For Number, the constructor unwraps but `NaN !== NaN` breaks the strict-equality
  semantics; `Object.is` resolves cleanly.
- For Boolean, the constructor _does not_ unwrap (`ToBoolean(Object) → true`); the String
  roundtrip is the structural workaround.
- For Symbol, the constructor _throws_; the equality framing must shift to property
  cross-check, which fortunately also catches a real tampering surface.

Five families, four different equality strategies. Attempting unification by
parameterizing one helper would either lose precision (e.g. dropping the Boolean
String-roundtrip would silently re-introduce the `new Boolean(false)` regression) or
special-case its way back to per-family logic via runtime branches. The species-js form
uses five focused helpers, each named for its family, each documented with the
spec-mechanic rationale. Five clear shapes beats one parameterized shape with hidden
branches.

`objectIs` is a pure realm-fix capture (no boundary-retyping needed — `Object.is`'s lib
type is already precise as `(value1: any, value2: any) => boolean`, though even the `any`
parameters are fine here because the helper passes only `number` arguments from the
captured `valueOf` results). Distinct from the boundary-retyping pattern of decisions
#008, #017, #026, #034 which retype `any` returns to spec-precise types. `objectIs` joins
the same `@/config` capture family for the realm-fix benefit alone.

**Consequences.** The five `doesHaveStrictUnboxed{X}ValueEquality` helpers each implement
the family-correct equality. The `objectIs` capture at `@/config` is the second
realm-fix-only capture (alongside `toObjectString`'s pure-capture nature pre-retyping).
Per [[boxed-primitive-discrimination]] memory, the lesson generalizes: when writing
predicates over spec-defined wrapper types, **trace the constructor coercion path before
assuming uniform implementation**. The four-shape result here is inherent to ECMA-262, not
an implementation artifact.

The realm-fix-vs-boundary-retyping distinction may warrant a small clarification in the
`[[design-rulings]]` boundary-retyping ruling: not every `@/config` cached primitive needs
retyping; some need pure capture for realm-fix without any type-system change.

Commit `8f880ee`. See `../architecture/primitive.md` for the four-marker chain's
positioning within the discrimination lattice and the per-family equality table.

**Addendum (2026-06-09).** The Boolean strategy carries an unstated assumption that the
2026-06-08 audit (F4.1) surfaced and that the JSDoc now names explicitly: the boxed-side
comparison `String(value)` routes through `Boolean.prototype.toString`, while the unboxed
side `String(unboxedValue)` bypasses it via primitive-to-string coercion. The two sides
agree in well-behaved environments because the spec's `Boolean.prototype.toString` returns
`'true'` / `'false'` exactly matching the primitive coercion. In an adversarial
environment that has tampered with `Boolean.prototype.toString`, real boxed Booleans would
be falsely rejected by the fourth marker. This is the only asymmetry of its kind among the
five equality helpers (String/BigInt use direct `===`, Number uses `Object.is`, Symbol
cross-checks descriptions — none route through `prototype.toString` on either side). The
asymmetry is forced by the `ToBoolean(Object) → true` trap that closes off the
direct-`===` path. The package does not realm-fix `Boolean.prototype.toString` — the
tampering surface is unusual in practice and adding a capture would be defensive coding
without a matched threat model. The JSDoc in both `.js` and `.d.ts` now names the
assumption so test design and downstream callers can account for it.
