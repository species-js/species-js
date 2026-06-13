# 039 — Generic-predicate pattern extended to the primitive family (supersedes #036's exclusion)

**Date:** 2026-06-07

**Context.** Decision #036 swept the generic predicate pattern
(`<T = unknown>(value?: T): value is T & X`) across `thenable`, `evented`, and `error`
families. The decision's closing exclusion read: _"Primitive predicates (`isStringValue`,
`isNumberValue`, etc.) don't benefit — primitives have no richer shape to preserve — and
stay as-is."_ That reading was correct for the value-only predicates as a narrow matter
(their narrow targets are bare primitive types) but missed two facts that surfaced during
the primitive module migration (#038):

1. **Literal-union callers benefit.** A caller with `value: 'on' | 'off' | number` narrows
   to `'on' | 'off'` after `isStringValue(value)` under the generic form, versus
   collapsing to bare `string` under the non-generic form. Real, if niche, value.
2. **The boxed and composite predicates clearly need it.** The new `isBoxedString`,
   `isBoxedNumber`, etc. narrow to wrapper-object types (`String & object` etc.) which
   carry richer shape. The composite `isString`, `isNumber`, etc. narrow to
   `XValue | BoxedX` unions; the generic intersection distributes through the union and
   preserves caller-side narrowing on both arms. If the boxed/composite predicates get the
   generic pattern but the value-only ones don't, the family becomes internally
   inconsistent — three sibling predicates in each family with two different signature
   shapes for no principled reason.

**Decision.** Apply the generic pattern to all 15 predicates in the primitive module
uniformly — value-only, boxed-only, and composite. Supersedes #036's value-only exclusion.
The package-wide form is now: every type-guard predicate (`isCallable` through
`isBigIntValue`) follows `<T = unknown>(value?: T): value is T & X`.

**Rationale.** Three forces converge:

- **Consistency within the family.** Three predicates per family with two signature shapes
  (value-only non-generic, boxed/composite generic) would be confusing for consumers and
  require explanation. One uniform shape across the family is the honest choice.
- **Real benefit for literal-union narrowing.** The case may be niche but is real —
  consumers writing `if (isStringValue(action))` on a `'play' | 'pause' | 0 | 1` union get
  the precise `'play' | 'pause'` narrow under the generic form. Under the non-generic form
  they get bare `string`, losing the literal-union information.
- **Same closure logic as #031.** The boundary-retyping pattern (decisions #008, #017,
  #026, #034) closes call-side `any`-cascades at `@/config`; the generic-predicate pattern
  closes narrow-side narrowing-loss at the predicate declaration. The pattern doesn't care
  whether the narrow target is a function type, an object interface, or a primitive type —
  it preserves caller-side T through the guard in all three cases.

**Consequences.** Five primitive value predicates get the generic upgrade alongside the
ten new boxed/composite predicates. Package-wide tally: 36 generic-typed predicates across
`@/function` (11) + `@/thenable` (3) + `@/evented` (4) + `@/error` (3) + `@/primitive`
(15). The exclusion text in #036's Consequences section ("don't benefit — stay as-is") is
now historical context, not an active ruling; this decision supersedes it explicitly. The
codified [[generic-predicate-pattern]] memory carries the updated full-coverage status.

Commit `5c5dbe7`. See `../architecture/primitive.md` for the family-pattern's expression
on primitives.
