# 062 — Strict identity predicates excluded from the generic `<T = unknown>` family

**Date:** 2026-07-01

**Context.** #031 / #036 / #039 established the `<T = unknown>(value?: T): value is T & X`
generic-predicate family pattern, which preserves caller-side narrowing through the
type-guard, and #051 already carved out one exclusion. `isEventTarget` / `isAbortSignal`
carried `<T = unknown> → value is T & EventTarget`. But these strict predicates narrow to
a single concrete intrinsic.

**Decision.** Strict identity predicates that narrow to one concrete intrinsic drop the
`<T = unknown>` generic and the `T &` intersection:
`isEventTarget(value?: unknown): value is EventTarget`,
`isAbortSignal(value?: unknown): value is AbortSignal`. The `*Like` predicates keep the
generic (`<T = unknown> → value is T & XLike`).

**Rationale.** When a predicate admits only values that are exactly `EventTarget`, there
is no caller-side type left to preserve — `T & EventTarget` collapses to `EventTarget` for
every admitted value, so the generic carries no information and is noise on the signature.
The `*Like` predicates admit a genuine subtype-spectrum (userland impls, subclasses), so
their caller-side `T` is real information worth threading — they keep the generic. The
rule is principled: generic iff the predicate admits a subtype-spectrum. Consistent with
#051's precedent of excluding a case from the generic family when the pattern does not
earn its keep.

**Consequences.** `isEventTarget` / `isAbortSignal` signatures simplify on both `.js`
(`@param {unknown}`, `@returns {value is EventTarget}`) and `.d.ts`. Establishes the
family rule — strict concrete-intrinsic predicates are non-generic; subtype-spectrum
(`*Like`) predicates are generic — applicable forward to any future strict/Like pair. No
runtime behavior change; type-surface only.

Builds on #031 / #036 / #039 (generic-predicate family) and #051 (per-case generic
exclusion). Pairs with #061 (the strict/Like decomposition that motivates it).

Commit: _pending_.
