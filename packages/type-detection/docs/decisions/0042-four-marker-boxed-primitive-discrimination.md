# 042 — Four-marker boxed-primitive discrimination via `[[XData]]` internal-slot probe

**Date:** 2026-06-07

**Context.** The boxed-primitive predicates as originally shipped (decision #038) used a
three-marker structural chain — `typeof === 'object'`, the `[[Class]]` tag, and the
resolved constructor name. The chain is spoof-vulnerable: a value with
`[Symbol.toStringTag]: 'String'` on a class named `String` would pass all three markers
while having no underlying string. The tag and constructor name are observable from
userland and therefore forgeable; the actual spec-defined discriminator of a boxed String
is the `[[StringData]]` internal slot (similarly `[[NumberData]]`, `[[BooleanData]]`,
`[[SymbolData]]`, `[[BigIntData]]`), which is engine-internal and cannot be installed from
userland.

**Decision.** Add a fourth marker at the bottom of each boxed-predicate chain: a
spec-precise internal-slot probe via the captured `X.prototype.valueOf.call(value)`. The
wrapper-class prototype's `valueOf` throws TypeError on any receiver lacking the
spec-defined `[[XData]]` internal slot per ECMA-262 (e.g. §22.1.3.32
`String.prototype.valueOf` calls `thisStringValue` which throws unless the receiver has
`[[StringData]]`). A `try`/`catch` reduces the throw to `false`. The captured
`prototype.valueOf` references are realm-fixed at module-load at the top of
`primitive.js`.

Each family ships a focused helper:

- `doesHaveStrictUnboxedStringValueEquality(value)`
- `doesHaveStrictUnboxedNumberValueEquality(value)`
- `doesHaveStrictUnboxedBooleanValueEquality(value)`
- `doesHaveStrictUnboxedSymbolValueEquality(value)`
- `doesHaveStrictUnboxedBigIntValueEquality(value)`

All five are `@internal`, exported with parallel `.d.ts` declarations under a dedicated
"Unboxed-Value Equality Helpers" section.

**Rationale.** The fourth marker upgrades the floor of spoof resistance from _structural_
to _spec-precise_. The slot probe is engine-attested: a value either has `[[XData]]` or it
doesn't, and userland code has no mechanism to install or fake the slot. The
conservative-narrowing posture (decision #010) is preserved — the existing three markers
stay as cheap fail-fast gates that reject most non-boxed inputs in O(1) before reaching
the more expensive `try`/`catch`. Performance order is now: `!!value` →
`typeof === 'object'` → tag → constructor name → slot probe. The chain's safety ceiling is
the slot probe; the four upstream gates are bounded-cost insurance.

**Consequences.** The five `isBoxedX` predicates are materially harder to spoof than the
three-marker version. The shape of the equality check inside each helper varies by family
because of spec mechanics — see decision #043 for the per-family details. Captured
`prototype.valueOf` references stay module-local in `primitive.js` rather than promoted to
`@/config` because no other module uses them yet; promote if and when a second consumer
needs them. The five `@internal` declarations in `primitive.d.ts` follow the established
parallel-JSDoc convention.

Codified in [[boxed-primitive-discrimination]] memory with the full per-family
spec-mechanic walkthrough. Commit `8f880ee`.
