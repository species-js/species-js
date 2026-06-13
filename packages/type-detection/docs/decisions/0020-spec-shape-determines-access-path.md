# 020 — Spec-shape determines the access path: descriptor-first for own-data, direct access for inherited

**Date:** 2026-06-03

**Context.** `getDefinedConstructorName` was reading `constructor.name` via direct
property access. The earlier `.d.ts` doc had claimed descriptor-based protection that the
impl never carried (`Q.001`). The candidate fix was to switch to a descriptor-based read.
While contemplating extending the same defense to `getDefinedConstructor`'s
meta-constructor steps (`constructor.constructor` at steps 2 and 4), the user observed
that `GeneratorFunction` and `Generator` reference each other through prototype-chain
inheritance, and that for unknown reciprocal-reference types the descriptor hierarchy is
not knowable in advance.

**Decision.** The right defensive pattern depends on the spec shape of the property being
read, not on a generic "always descriptor-first" rule:

- **Own-data properties** (e.g. `name` on a function, per ECMA-262 §10.2.9
  `SetFunctionName`) → descriptor-first read with no direct-access fallback. The
  descriptor's `value` is the canonical access path; an accessor leaves `value` as
  `undefined`, which the downstream narrow correctly rejects.
- **Inherited properties** (e.g. `constructor` on an instance, the meta-constructor
  `constructor.constructor`, `Symbol.toStringTag` via the prototype chain) → direct
  property access. The engine's prototype-chain walk is the spec-correct resolution;
  descriptor-first returns `undefined` for the inherited case anyway, and the `??`
  fallback to direct access does the actual work every time.

Applied: `getDefinedConstructorName` switched to descriptor-only read on `name`.
`getDefinedConstructor`'s meta-constructor reads at steps 2 and 4 kept as direct
`constructor?.constructor` access, with code comments naming the intent so a future
defensive-tightening instinct does not undo the choice.

**Rationale.** Trying to be defensive at the descriptor level for inherited properties
fights inheritance: the descriptor read returns `undefined`, the fallback kicks in, the
path that produces the answer is the fallback every time, and the descriptor read adds a
function call for nothing. Worse, the "defense" doesn't actually catch the spoof it
targets — if the own descriptor is an accessor, `descriptor.value` is `undefined` and the
`??` fallback invokes the accessor anyway. The `name`-vs-`constructor` asymmetry is
structural: `name` is own data per spec; `constructor` is inherited per spec. The
defensive pattern follows the spec shape.

**Consequences.** Resolves `Q.001`. `getDefinedConstructorName` now reads `name` via the
property descriptor and rejects accessor-based spoofing without invoking the getter.
`getDefinedConstructor`'s meta-constructor steps preserve the prototype-chain walk that
spec-correct reciprocal references depend on (e.g. `%GeneratorFunction%`'s `constructor`
inheriting from `%Function.prototype%`). The rule generalizes for any future property read
in this package: ask whether the spec defines the property as own-data or inherited, then
pick the access path accordingly. Codified in [[design-rulings]] as "spec-shape determines
the access path."
