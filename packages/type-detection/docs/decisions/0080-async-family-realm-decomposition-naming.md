# 080 — Function realm decomposition, async + generator families: `isCurrentRealm*Instance` / `isAlienRealm*` naming (aligns function with the newer-module convention)

**Date:** 2026-07-28

**Status:** proposed (drafted during the function test round; frozen-spec amendment
pending owner ruling — see Consequences).

**Context.** The function module detected async functions with the orchestrator + single
"shape helper" pattern (ADR #0006, #0014): `isAsyncFunction` inlined the same-realm
`value instanceof %AsyncFunction%` fast path and delegated the cross-realm structural
check to one helper, `hasAsyncFunctionShape`. Meanwhile the newer cross-realm modules —
`error`, `evented`, `thenable`, `abort` (ADRs #060, #061, #065) — converged on an explicit
**two-arm realm decomposition** with a settled vocabulary:

- `isCurrentRealm<X>Instance` — the same-realm arm, a `try/catch`-wrapped `instanceof`
  against the captured local intrinsic (throw-safe per #060).
- `isAlienRealm<X>` — the cross-realm structural arm.

The function family was the last outlier still on the single-`has<X>Shape` framing, with
its same-realm arm unnamed and inlined. Two costs followed: the inline
`value instanceof AsyncFunctionConstructor` in `isAsyncFunction` was **not** wrapped, so a
hostile `getPrototypeOf` `Proxy`-trap could propagate; and the same-realm arm could not be
tested in isolation the way every newer module's round tests it.

**Decision.**

1. **Rename** `hasAsyncFunctionShape` → **`isAlienRealmAsyncFunction`** (the cross-realm
   structural arm; the six-marker body is unchanged).
2. **Extract** the inlined same-realm check into
   **`isCurrentRealmAsyncFunctionInstance`**, a `try/catch`-wrapped
   `value instanceof %AsyncFunction%`. Wrapping makes it throw-safe: a hostile
   `[[Prototype]]` now yields `false` instead of propagating.
3. Both arms take the generic family signature
   `<T = unknown>(value?: T): value is T & AsyncFunction` and carry the `@@throw-safe`
   marker in `.js` and `.d.ts`. Both stay `@internal`, exported for testing.
4. `isAsyncFunction`'s body becomes
   `isFunction(value) && (isCurrentRealmAsyncFunctionInstance(value) || isAlienRealmAsyncFunction(value))`
   — behavior-preserving, with the instanceof arm now throw-safe.
5. **Naming convention (settled):** the same-realm arm carries the `Instance` suffix
   (`isCurrentRealm<X>Instance`); the alien arm carries none (`isAlienRealm<X>`). Matches
   `isCurrentRealmPromiseInstance` / `isAlienRealmPromise`,
   `isCurrentRealmGenericErrorInstance` / `isAlienRealmGenericError`, etc.
6. **Constructor-intrinsic cast honesty.** `AsyncFunctionConstructor`,
   `GeneratorFunctionConstructor`, and `AsyncGeneratorFunctionConstructor` are typed
   `NewableFunction` — the honest "newable constructor" — not the species **instance**
   types (`AsyncFunction`, `GeneratorFunction`, `AsyncGeneratorFunction`). An intrinsic is
   the constructor of the species, not an instance of it (`%AsyncFunction%` has a
   `prototype` and, called, returns a new async function — it is not itself an
   async-function value with `prototype: undefined`). The instance-typed casts compiled
   only because `instanceof`'s RHS merely needs `Function`-assignability. This restores
   ADR #007 (intrinsic constructor-capture casts are `NewableFunction`), from which the
   instance-typed casts had silently departed.
7. **`@@throw-safe` marker applied to the function module** this round, in both files (per
   #076: function is one of the sequenced pre-marker modules; its round applies the marker
   as a first-class deliverable).

**Rationale.**

- **One vocabulary for cross-realm predicates.** A reader learns `isCurrentRealm*Instance`
  / `isAlienRealm*` once and it holds across `error`, `evented`, `thenable`, `abort`, and
  now `function`. The lone `has*Shape` outlier was avoidable drift.
- **Throw-safety gain, not just cosmetics.** Naming the same-realm arm is what lets it
  wrap the `instanceof`; the previously inlined form was the one remaining unwrapped
  `instanceof` in the async path.
- **Independent testability.** Two named arms let the function round's
  `hostile × predicate` matrix score each arm on its own, exactly as the newer modules'
  rounds do.
- **Type honesty.** A captured intrinsic is a `NewableFunction`; typing it as the instance
  type misdescribes what the binding holds.

**Consequences.**

- **Supersedes the single-shape-helper framing (ADR #0006, #0014) for the whole function
  module.** Applied to **both** families in this round: `hasAsyncFunctionShape` →
  `isAlienRealmAsyncFunction` (+ `isCurrentRealmAsyncFunctionInstance`);
  `hasGeneratorFunctionShape` → `isAlienRealmGeneratorFunction` (+
  `isCurrentRealmGeneratorFunctionInstance`); `hasAsyncGeneratorFunctionShape` →
  `isAlienRealmAsyncGeneratorFunction` (+ `isCurrentRealmAsyncGeneratorFunctionInstance`).
  The four public orchestrators (`isAsyncFunction`, `isGeneratorFunction`,
  `isAsyncGeneratorFunction`, `isAnyGeneratorFunction`) now carry `@@throw-safe` — sound
  once `isFunction` became throw-safe, since each is
  `isFunction && (wrapped-instanceof || safe-structural)`.
- **Alien-arm return shape — resolved (owner ruling: promote).** Every realm arm in both
  families is a generic guard: `isAlienRealmGeneratorFunction` →
  `value is T & GeneratorFunction` and `isAlienRealmAsyncGeneratorFunction` →
  `value is T & AsyncGeneratorFunction`, matching `isAlienRealmAsyncFunction` and every
  `isCurrentRealm*Instance`. The `@internal` sub-condition helpers (`has*IdentitySignal`,
  `has*PrototypeSurface`, `hasConstructSlot`) stay `boolean` — each tests a single marker,
  not a species.
- **Frozen-spec amendment owed (both families).** `FUNCTION.spec.md` (FROZEN) names
  `hasAsyncFunctionShape` (~7 refs, dedicated section) **and** `hasGeneratorFunctionShape`
  / `hasAsyncGeneratorFunctionShape` (~11 refs). Per the amend-vs-append discipline (#054)
  the renames are recorded as a **frozen-spec amendment**, owner-driven; not applied
  unilaterally.
- **`architecture/function.md`** (the orchestrator + shape-helper pattern description, and
  its `hasAsyncFunctionShape` example) to be updated to the two-arm framing.
- **Historical ADRs left intact.** #0006, #0014, #0016, #0018 reference
  `hasAsyncFunctionShape` as the name at their time; append-only, not rewritten.
- **No runtime behavior change** to `isAsyncFunction`; the same-realm arm is now
  throw-safe (a strict improvement). The `index` star-export picks up the renamed/new
  symbols automatically — the `@internal` surface gains
  `isCurrentRealmAsyncFunctionInstance` and loses `hasAsyncFunctionShape`; `dist/` carries
  the old name until the next build.
