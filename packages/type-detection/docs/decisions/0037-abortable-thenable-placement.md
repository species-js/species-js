# 037 — `AbortableThenable<T>` placement and design

**Date:** 2026-06-06

**Context.** The equip-js source defined `AbortableThenable<T> extends Thenable<T>` with a
three-channel `then` (fulfillment, rejection, abort) typed against `AbortError`. The
species-js round had deferred this migration via Q.004 until the `@/error` migration
landed (decisions #032–#035 shipped `AbortError` on 2026-06-05). Three sub-questions
remained:

1. **Return-type from chained `then`** — should the chain stay typed as
   `AbortableThenable<...>`, or degrade to `Thenable<...>` after the first abort-aware
   `then`?
2. **Refinement axis** — should `AbortableThenable<T>` refine `Thenable<T>` (the
   structural floor) or `PromiseLike<T>` (the chaining-method contract)?
3. **Placement** — should the interface ship in `thenable.d.ts` (extending the existing
   lattice with a fourth tier) or as its own `abortable-thenable.{js,d.ts}` module?

**Decision.** Three concrete choices:

- **Return preserved-abortable.** `then<TResult1, TResult2, TResult3>` returns
  `AbortableThenable<TResult1 | TResult2 | TResult3>`. The chain stays abortable so
  consumers can keep using `.then(_, _, onAborted)` further down without re-narrowing.
  Matches the equip-js precedent and parallels how `PromiseLike.then` returns
  `PromiseLike<...>` (refinement preserved through chaining).
- **Refine `Thenable<T>`, independent from `PromiseLike<T>`.** The abort channel and the
  chaining-method contract are orthogonal axes of refinement; a value can satisfy both,
  neither implies the other. The lattice gains a parallel branch: `Thenable<T>` is the
  structural floor, `PromiseLike<T>` adds chaining sugar, `AbortableThenable<T>` adds the
  abort channel, and `Promise<T>` is the realm-fixed intrinsic combining the chaining
  refinement.
- **Ship in `thenable.d.ts`, type-only, no predicate.** The interface lives in the
  existing `thenable.d.ts` rather than its own module — the lattice belongs together, and
  there is no `.js` runtime side. No `isAbortableThenable` predicate exists because a
  `Thenable` with a two-argument `then` and one with a three-argument `then` are
  runtime-indistinguishable (the third callback is optional, and a two-argument `then`
  gracefully ignores extras). The `.length` heuristic is spoof-trivial and not
  spec-required. Type-only documentation contract.

Refinements over the equip-js source landed alongside the migration: `out T` covariance
annotation matching `Thenable<T>` and `PromiseLike<T>` (decision #022); dropping the
redundant `| undefined` on optional callbacks (the `?` already widens, matching the
existing precision).

**Rationale.** Each choice has its own framing:

- **Return-preservation** matches the way `PromiseLike` already refines `Thenable.then`'s
  return to `PromiseLike` — refinement persistence through chaining is the established
  pattern in the lattice. Degrading to bare `Thenable<...>` after the first call would
  force consumers to re-narrow at every chain link, which loses the contract's value at
  the type-system level.
- **`Thenable<T>` refinement axis** keeps the abort channel orthogonal to the chaining
  surface. A consumer can model an abortable producer that returns a raw thenable without
  forcing `catch`/`finally` on the producer; conversely, a consumer can model a
  PromiseLike producer without forcing the abort channel.
- **Placement in `thenable.d.ts`** keeps the lattice together as a single conceptual unit.
  The interface is type-only — there is no runtime predicate to extract — so the "sibling
  pair vs subfolder" question of [[package-structure]] is moot; the file pair stays as-is.
- **No predicate** matches the realistic ceiling on runtime discrimination. The equip-js
  source also shipped no predicate for the same reason; that choice is preserved.

**Consequences.** Public surface: `AbortableThenable<T>` interface in
`@/type-detection/thenable`. Cross-module abort-channel surface is now complete across
three modules: `@/error` for the rejected-value side (`AbortError`, `AbortErrorName`,
`isAbortError`), `@/evented` for the producer side (`AbortSignalLike` /
`isAbortSignalLike` / `AbortSignal` / `isAbortSignal`), and `@/thenable` for the consumer
side (`AbortableThenable<T>`). The previously-deferred Q.004 is resolved. `evented.d.ts`'s
`AbortSignalLike` JSDoc's "Future use" forward-reference is updated to the current-state
cross-module description, replacing the deferred-to-error-migration framing. The thenable
module's `@module` doc is updated to mention the two independent refinements
(`PromiseLike` and `AbortableThenable`) of the `Thenable<T>` floor.

Commit `b234589`. See `../architecture/thenable.md` for the lattice's positioning and the
conceptual map.
