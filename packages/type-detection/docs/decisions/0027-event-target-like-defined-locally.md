# 027 — `EventTargetLike` / `AbortSignalLike` defined locally rather than re-exporting the DOM globals

**Date:** 2026-06-04

**Context.** TypeScript's `lib.dom.d.ts` declares global `EventTarget` and `AbortSignal`
interfaces with the structural shapes the evented module needs. Unlike the thenable
round's #022 — where the lib's `PromiseLike` was strictly poorer than what we needed — the
lib's `EventTarget` is structurally compatible with the duck-typed contract: a value
satisfying our `EventTargetLike` also satisfies the lib's `EventTarget` and vice versa.
`AbortSignal` is partially compatible — the lib carries more members than the structural
contract requires (see #030).

**Decision.** Define local `EventTargetLike` and `AbortSignalLike` interfaces in
`evented.d.ts` rather than re-exporting the DOM globals. `EventTargetLike` mirrors the
lib's `EventTarget` shape precisely (including `EventListenerOrEventListenerObject`,
`AddEventListenerOptions`, `EventListenerOptions`). `AbortSignalLike` extends
`EventTargetLike` with the minimum spec-required testable surface —
`readonly aborted: boolean` and `throwIfAborted(): void`.

**Rationale.** Three reasons converge:

- **Duck-typing intent at the type-name level.** `isEventTargetLike` narrows to a "Like"
  name, signaling the structural-contract reading. Re-exporting `EventTarget` would lose
  the distinction at the predicate site between "is a member of the EventTarget set
  structurally" and "is the EventTarget intrinsic."
- **Package-owned predicate target.** The package controls evolution of its type. If
  `lib.dom.d.ts` adds a method to `EventTarget` in a future TS release, the predicate's
  contract doesn't automatically change.
- **Runtime-without-DOM usability.** Environments lacking the DOM lib still get a usable
  contract type from this package alone.

**Consequences.** Consumers of `@species-js/type-detection/evented` get the local types.
The lib's globals still exist; the local exports live in their own namespace. The
`AbortSignalLike` minimum-surface choice — which members are deliberately omitted — is
captured separately in #030.
