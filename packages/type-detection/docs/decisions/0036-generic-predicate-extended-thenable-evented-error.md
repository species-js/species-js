# 036 — Generic-predicate pattern extended to `thenable` / `evented` / `error`

**Date:** 2026-06-05

**Context.** Decision #031 named the generic-typed predicate pattern
(`<T = unknown>(value?: T): value is T & X`) and applied it family-wide across the 11
function-family predicates. The same pattern generalizes mechanically to any type-guard
predicate; the non-function families were reserved for a follow-up sweep so the family
audit could be done in one focused round per module.

**Decision.** Sweep the pattern across the three remaining type-guard families. 10
predicates updated:

- **thenable** — `isThenable`, `isPromiseLike`, `isPromise` (narrow targets:
  `T & Thenable<unknown>`, `T & PromiseLike<unknown>`, `T & Promise<unknown>`).
- **evented** — `isEventTargetLike`, `isEventTarget`, `isAbortSignalLike`, `isAbortSignal`
  (narrow targets: `T & EventTargetLike`, `T & EventTarget`, `T & AbortSignalLike`,
  `T & AbortSignal`).
- **error** — `isGenericError`, `isError`, `isAbortError` (narrow targets:
  `T & GenericError`, `T & GenericError`, `T & AbortError`).

The `.d.ts` form is the TS signature shown; the `.js` JSDoc mirrors via
`@template [T=unknown]` + `@param {T} [value]` + `@returns {value is T & X}`. Each
predicate carries the short family-pattern doc paragraph. Primitive predicates are
deliberately not swept — primitives carry no richer shape to preserve.

`isError` is a `const`-binding pattern, not a function declaration; the type-system
surface still widens via the JSDoc cast `import('@/error').isError` on the const
declaration. The cast continues to coerce the native-or-polyfill ternary result through
the new generic form. The native `Error.isError` is non-generic per its ES2025
declaration, but the cast at the binding site is what determines the public type — runtime
semantics are unchanged.

**Rationale.** Same as #031: the intersection `T & X` distributes through `T`'s union,
non-matching arms collapse to `never`, matching arms retain `T`'s shape augmented with
`X`'s guarantees, and `T = unknown` reduces to `X`. Backward-compatible at every existing
call site by construction. The sweep completes the package-wide consistency: every
type-guard predicate in `type-detection` now follows the same form.

**Consequences.** 21 generic-typed predicates across the four type-guard families. All
internal call sites within species-js continue to pass `unknown`-typed inputs (and
therefore see no behavioral change), except for the recursive `isError(prototype)` call
inside `hasErrorPrototypeContract` where `prototype: object` produces
`object & GenericError` — the boolean return is used at that call site, so no consumer
change is needed.

**Subtle finding — `(value = null)` parameter defaults are incompatible with the generic-T
signature.** Three predicates (`isEventTargetLike`, `isAbortSignalLike`, `isGenericError`)
had previously used the parameter-default-to-`null` pattern (decision #025) for nullish
unification. Under `<T = unknown>(value?: T)`, the parameter type widens to
`T | undefined` — and `null` is not assignable to `T | undefined` when `T` is generic. The
fix is to drop the default: the `!!value` body guard handles both null and undefined
identically at runtime, so the runtime semantics are preserved. The
parameter-default-to-`null` ruling still applies to non-generic predicates that use it for
strict-equality nullish unification — it just doesn't compose with the generic-T pattern
when both are wanted in the same signature. Watch for this interaction when refactoring
any future predicate that combines both patterns. Codified in
[[generic-predicate-pattern]] memory.

Commit `92784f8`.
[`../architecture/function.md`](../architecture/function.md#generic-typed-predicates-caller-side-narrowing-preserved)
§ "Generic-typed predicates: caller-side narrowing preserved" updated with the same
generalization-status and the `(value = null)` note.
