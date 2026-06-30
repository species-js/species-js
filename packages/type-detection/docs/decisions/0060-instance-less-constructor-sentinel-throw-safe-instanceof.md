# 060 — INSTANCE_LESS_CONSTRUCTOR sentinel; throw-safe instanceof realm-instance guard

**Date:** 2026-07-01

**Context.** The evented module captures the `EventTarget` / `AbortSignal` globals at
module load. When a global is absent (pre-Node-15, special embeddings) the capture was
`null`, and `isCurrentRealmEventTargetInstance` / `isCurrentRealmAbortSignalInstance`
guarded with `!!Constructor && value instanceof Constructor` to skip the `instanceof` when
null. A manual trace through dual-patched `AbortSignal` constructors surfaced two
problems: (1) the `instanceof` operator itself throws when its right-hand side is tampered
— a patched `Symbol.hasInstance` or a hostile prototype-walk — and the throw propagated
out of the predicate; (2) the `null` capture forced a presence-guard at every call site
and a `null`-typed prototype capture.

**Decision.** Introduce `INSTANCE_LESS_CONSTRUCTOR` (`@internal`, `@/utility`) — a
never-instantiated function — as the realm-fixed stand-in for a missing global. The
evented captures become `isCallable(X) ? X : INSTANCE_LESS_CONSTRUCTOR` (never `null`).
Each realm-instance helper becomes a bare
`try { return value instanceof Constructor } catch { return false }`. The absent-global
prototype capture becomes `objectCreate(null)` so the local-realm prototype-identity
compare can never match.

**Rationale.** A never-instantiated function makes `instanceof` always `false` without a
presence guard — no value ever carries it on its prototype chain — so the sentinel both
removes the `null` special-case and returns the correct answer for free. The `try`/`catch`
is the package-wide throw-safety invariant applied to the `instanceof` operator: a hostile
or dual-patched right-hand side is absorbed to `false`, never propagated, preserving the
boolean-return predicate contract. `objectCreate(null)` for the absent prototype is the
boundary-retyping pattern (#034) — a non-null object identity-distinct from any real
value's prototype.

**Consequences.** `instanceof`-based realm checks are throw-safe across the whole evented
surface; dual-patched constructors no longer crash the predicates. New `@internal` export
`INSTANCE_LESS_CONSTRUCTOR`; its `.d.ts` carries an initializer-with-body like the
`TRUSTED_DATA_CONFIRMATION = true` precedent (typechecks — verified). The `null` is
removed from the constructor/prototype capture types. The cross-realm arms keep an
explicit `X !== INSTANCE_LESS_CONSTRUCTOR` sentinel guard so the structural arm is skipped
when the realm genuinely lacks the global.

Builds on #034 (boundary-retyping `objectCreate`) and the package-wide throw-safety
invariant. Relates to #027 / #028 (evented locality and subclass rejection). Pairs with
#061 (the strict decomposition whose fast-path this guards).

Commit: _pending_.
