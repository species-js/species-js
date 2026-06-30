# 061 — Evented strict identity lifted to cross-realm prototype-equivalence; strict/Like decomposition

**Date:** 2026-07-01

**Context.** `isEventTarget` / `isAbortSignal` previously used a three-marker structural
chain on their cross-realm arm: the `[[Class]]` tag, constructor-name equality, and the
duck-typed method-surface `doesMatch*Contract`. This is weaker than `isPromise`, which
#054 had already lifted to full cross-realm structural prototype-equivalence. The
asymmetry let a foreign-realm object spoof `EventTarget` / `AbortSignal` by carrying the
right tag + name + method names without the real prototype shape. A manual trace through
`AbortSignal` implementations exposed both that the duck-typed contract was too lenient
for the strict tier, and that it is exactly what the lenient Like tier needs.

**Decision.** Mirror the #054 / #048 cross-realm prototype-equivalence pattern onto both
EventTarget and AbortSignal, and decompose each predicate into two tiers.

- **Strict** (`isEventTarget` / `isAbortSignal`): resolve the prototype once via
  `getInertPrototypeOf` (#059 threading), then a local-realm fast-path
  (`isCurrentRealm*Instance` + `prototype === Xprototype`) OR a cross-realm arm
  `isAlienRealmX` = `hasXIdentitySignal` (tag + threaded constructor-name front-gate) AND
  `isXPrototypeEquivalent` (`constructor` is a class + tag + constructor `prototype`
  round-trip via `getInertDescriptor` + the own-descriptor
  `doesImplementXPrototypeContract`). For AbortSignal the prototype contract reads the
  spec accessors — `aborted` (boolean getter, no setter), `reason` (getter, no setter),
  `onabort` (get/set pair), `throwIfAborted` (callable) — and invokes the `aborted` getter
  with the real receiver (#029 spec-direct read), throw-safe.
- **Lenient** (`isEventTargetLike` / `isAbortSignalLike`): keep the duck-typed
  method-surface contract, renamed `doesMatch*Contract` → `doesImplement*Contract`. The
  Like tier admits a plain-data `aborted` in any descriptor shape — deliberately NOT
  requiring the native readonly-accessor shape (#030).

**Rationale.** Identity is proven by prototype structure, not method-name presence, so a
foreign object cannot spoof the strict predicate by name alone — evented reaches the same
cross-realm strictness as `isPromise` (#054). Subclasses stay rejected on both arms by the
prototype round-trip / constructor-name (#028 preserved). The split makes the tiers
honest: strict = "is exactly this intrinsic, any realm"; Like = "quacks like one"
(userland + subclass admission) — a library consumer expects `*Like` permissive and `isX`
exact. An interim variant that made `isAbortSignalLike` stricter (falsifying a plain
writable `aborted` data property as unsafe) was considered and reverted: the leniency
belongs to the Like tier by #030, and the strictness now lives wholly in the identity tier
— so the Like check returns to duck-typing. Reuses #059 threading (resolve
prototype/constructor once, pass down; helpers never re-read).

**Consequences.** Eight new `@internal` helpers (four per family): `hasXIdentitySignal`,
`doesImplementXPrototypeContract`, `isXPrototypeEquivalent`, `isAlienRealmX`. The
`doesMatch*Contract` → `doesImplement*Contract` rename requires package-wide doc
propagation (Step 4 doc-mirror: ADR #029, spec, architecture). Foreign-realm tampered
objects that previously passed the strict predicate by name + tag + methods are now
correctly rejected — the same identity-fast-path-vs-structural-arm realm-asymmetry already
accepted for `object` applies here. The evented spec and architecture docs must mirror the
new decomposition.

Builds on #054 (is-promise cross-realm structural equivalence), #048 (two-axis dispatch),
#050 (lift-from-like cascade strict identity), #059 (constructor/prototype threading),
#028 (subclass rejection), #029 (aborted direct-read), #030 (Like minimum surface). Pairs
with #060 (sentinel makes the local-realm `instanceof` fast-path throw-safe) and #062 (the
strict generic-drop the decomposition motivates).

Commit: _pending_.
