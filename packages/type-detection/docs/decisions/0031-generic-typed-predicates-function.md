# 031 — Generic-typed predicates: `<T = unknown>(value?: T): value is T & X` family-wide

**Date:** 2026-06-05

**Context.** During the error-migration debugging round (commit `667e12b`), the recurring
_"my narrow flattens to `VerifiedFunction`"_ pain surfaced repeatedly. A consumer with
`value: ((this: O) => R) | undefined` from an earlier cast would lose that information the
moment `isFunction(value)` returned `true` — TS's `value is VerifiedFunction` narrow
_replaces_ the value's type with bare `VerifiedFunction`, discarding the more specific
caller-side narrowing. The workaround at consumer sites was an outer cast to recover the
function shape post-narrow — the same cascading-boilerplate pathology the
boundary-retyping ruling (#008, #017, #026) addresses on the call-side.

**Decision.** All 11 function-family predicates take the generic form
`<T = unknown>(value?: T): value is T & X`, where `X` is the predicate's previous narrow
target. Applied: `isCallable`, `isFunction`, `isNewableFunction`, `isES3Function`,
`isClass`, `isCustomClass`, `isBuiltInClass`, `isAsyncFunction`, `isGeneratorFunction`,
`isAsyncGeneratorFunction`, `isAnyGeneratorFunction`. The `.d.ts` carries the TS
signature; the `.js` JSDoc mirrors via `@template [T=unknown]` + `@param {T} [value]` +
`@returns {value is T & X}`. Each predicate carries a short doc paragraph naming the
family pattern with backticks for the form and a cross-reference to the family anchor
({@link isCallable} / {@link isFunction}).

**Rationale.** The intersection `T & X` distributes through `T`'s union:
`(A | B) & X = (A & X) | (B & X)`. Non-callable arms collapse to `never` —
`string & Callable = never`, `undefined & VerifiedFunction = never` — while callable arms
retain `T`'s call signature, augmented with `X`'s structural guarantees. For the common
case `T = unknown`, the intersection reduces to `X`, matching pre-generic behavior — every
existing call site is preserved with zero churn. Callers whose `value` already carries a
more specific function shape keep that shape post-narrow. The pattern is the sibling of
boundary-retyping on the narrow-side: that closes the call-side `any`-cascade at
`@/config`; this closes the narrow-side flatten at the predicate's declaration. Both
rulings address the same pathology — TS's default types are too lossy at a boundary, and
the cleanup work piles up at every consumer site instead of being absorbed once at the
boundary.

**Consequences.** All 11 family predicates ship the generic form (commit `9434960`, with
`isCallable` / `isFunction` precursors landing during the error-migration round's reserved
working tree). Downstream audit within species-js confirmed safe: all internal call sites
are `unknown`-typed inputs (in `utility/index.js`, `error.js`, `function.js`, `index.js`)
except for three `typeof Constructor` checks in `evented.js` / `thenable.js` where the
narrow yields `typeof Constructor & Callable`, which remains assignable to the outer
`typeof Constructor | null` cast — no consumer changes needed. The pattern generalizes
beyond the function family — see decision #036 for the follow-up sweep across `thenable`,
`evented`, and `error`. Primitive predicates (`isStringValue`, `isNumberValue`, etc.)
don't benefit — primitives have no richer shape to preserve — and stay as-is. Codified in
[[generic-predicate-pattern]] memory.
