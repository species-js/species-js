# 077 — Direct narrowing for primitive predicates: the two-way strategy (revises #039)

**Date:** 2026-07-26

**Context.** Decision #031 introduced the generic type-guard form
`<T = unknown>(value?: T): value is T & X` for the `#function` family — it preserves a
caller's subtype through the guard, which matters when a predicate's narrow depends on the
input type (a broad-shape target). #036 extended it to `#thenable` / `#evented` /
`#error`, and **#039 extended it uniformly to every `#primitive` predicate** ("no further
exclusions stand"; #051 carried it to the floor predicates), overriding #036's earlier
value-only exclusion.

A primitive-round review re-examined that uniformity and it does not hold up for the
primitive predicates: their target type `X` (`string`, `BoxedString`, `PrimitiveValue`, …)
is already the maximally precise, honest type the runtime proves. Field-tested against
`tsc` (workspace TS 6.0.3):

- A plain `value is X` type-guard already FILTERS a caller's union to the exact passing
  members — a caller `'x' | 'y' | 42 | {k:1}` narrows to `'x' | 'y' | 42` under
  `isPrimitiveValue`, and to `'x' | 'y'` under `isStringValue` — cleanly reduced and
  assignable.
- The generic `T & X` form yields the SAME members but as an UNREDUCED intersection
  (`({k:1} | 'x' | 'y' | 42) & PrimitiveValue`, with a residual `{k:1} & string` arm) that
  is noisier AND fails to assign to the clean precise type.

So for primitive the generic wrapper adds no precision and produces worse types.

**Decision.**

1. **Primitive predicates narrow DIRECTLY** — `(value?: unknown): value is X` — across the
   value-only, boxed-only, composite, and generic-union floor predicates. The `<T>` /
   `@template` / `@typeParam` machinery and the "Generic in `T`" doc paragraph are removed
   from both `.js` and `.d.ts`.
2. **The generic pattern remains the preferred form where it benefits** — predicates whose
   target is a broad shape worth carrying the caller's subtype through, i.e. the
   `#function` family (#031). This is a **two-way strategy**: generic where the narrow's
   value depends on the caller's input type; direct where `X` is already the maximal
   honest type.
3. **This revises #039's primitive-uniformity, not #031's intent.** #031 established the
   generic form as the _preferred-where-it-benefits_ pattern, never the sole rule; #039
   over-generalized it to "uniform, no exclusions" for primitive. That primitive scope
   (and its #051 floor extension) is what is walked back. #036's extension to `#thenable`
   / `#evented` / `#error` is untouched here — whether those revisit direct narrowing is a
   separate per-family call.

**Rationale.**

- **Honest, precise types over machinery.** A runtime detector proves an ABSOLUTE fact
  ("this is an `X`") independent of the caller's declared type; `value is X` states
  exactly that. Intersecting with a caller's `T` can only no-op (the `unknown` default
  collapses to `X`), leave an unreduced intersection, or degrade to `never` — never
  improve precision for an already-maximal `X`.
- **Consistent with the package's own detection philosophy** — "detection takes the widest
  input (`unknown`) and puts the knowledge in the RETURN type, never the parameter." The
  generic form put `T` in both param and return; direct narrowing honors the rule.
- **Evidence, not assertion.** The `tsc` field-test (a `never`-reveal probe inside the
  guard branch) is the ground truth; an earlier object-typed probe mis-suggested the
  opposite and was corrected — reserve conclusions for what the compiler actually does.

**Consequences.**

- `primitive.{js,d.ts}`: 16 predicates detemplatized; `isNullishPrimitive`'s
  `/** @type {T} */ (null)` default cast is gone (bare `value = null`). **No runtime
  behavior change** — types/docs only.
- Canon reconciled in the same round: `primitive.d.ts` module-header narrowing section
  rewritten; `architecture/primitive.md` `## Generic-typed predicates` →
  `## Narrowing strategy — direct type guards`; `PRIMITIVE.spec.md` amended
  (signature-only; every admit/reject vector unchanged).
- Revises the primitive scope of #039 (and #051's floor extension); leaves #031 (function)
  and #036 (thenable / evented / error) standing.
- Any broad-shape predicate keeps the generic form; a future per-family review may apply
  the same field-test where a family's benefit is unclear.
