# 069 — `isGenericError` excludes `DOMException` by identity (current-realm) and contract (cross-realm); the partition-leak fix and the accepted realm asymmetry

**Date:** 2026-07-10

**Context.** `isGenericError` must exclude a `DOMException` of any kind (#065 / #067) —
the `Error`-not-`DOMException` arm. The as-shipped design excluded a current-realm
`DOMException` on its fast path (`!isCurrentRealmDOMExceptionInstance(value)`) but dropped
a value failing that guard to the alien fallback, whose `DOMException` exclusion was
**contract-gated**: `isAlienRealmGenericError` early-returns on
`isAlienRealmDOMException(value)`, and `isAlienRealmDOMException` itself gates on
`doesImplementDOMExceptionContract`. A throwaway partition probe (2026-07-10) exercised
the invariant `isError ≡ isGenericError ⊎ isDOMException` across current- and
foreign-realm inputs and found a **subset-law break**: a current-realm `DOMException`
subclass that flattens `name` to an own data field
(`class X extends DOMException { name = 'X' }`) returned `isGenericError = true` while
`isError = false` — a "generic error" that is not an error.

Root cause: the flattened `name` breaks the `DOMException` contract (#068 rejects it), so
the _contract-based_ exclusion no longer recognizes the value as a `DOMException`, and it
leaks into the generic prototype walk, which finds `Error.prototype` in its chain. The
rejection by `isDOMException` and the miss by the exclusion are the **same broken
contract** — that coupling is the defect. A first patch that routed `DOMException`s
through the generic (stack) contract inside `isAnyError` introduced a worse cross-engine
regression — a valid but stackless `DOMException` (a browser / Chrome `DOMException`,
which carries no `stack`) was rejected by the graft filter — and was reverted.

**Decision.** Anchor the current-realm `DOMException` exclusion on **identity**, applied
up front, before any contract test or prototype walk:

```
export function isGenericError(value) {
  if (!value || isCurrentRealmDOMExceptionInstance(value)) return false;
  if (isCurrentRealmGenericErrorInstance(value)) return doesImplementGenericErrorContract(value);
  return isAlienRealmGenericError(value);
}
```

`isCurrentRealmDOMExceptionInstance` is an `instanceof` check against the captured
`DOMException`; identity cannot be fooled by a broken contract, so a subclass that
flattens `name` is still excluded. The cross-realm half stays structural:
`isAlienRealmGenericError` early-returns on `isAlienRealmDOMException(value)`. The
exclusion therefore holds by two different means — **exact identity in the current realm,
structural contract across realms**.

**Rationale.** Anchoring on identity restores `isGenericError ⊆ isError` (a generic error
is an error) and keeps the partition disjoint. The cross-realm
`|| isAlienRealmDOMException` guard is load-bearing for a separate, engine-level reason:
where an engine makes `DOMException` subclass `Error` (Node), a `DOMException` is
`instanceof Error` **and** carries an own `stack` (from the internal `new Error()` the
constructor runs), so it satisfies the generic-error contract on its own — without the
explicit exclusion it would be readmitted on the alien path. `isAnyError` keeps its
`DOMException`-contract-first ordering (the getter shape, engine- independent); routing
`DOMException`s through the stack contract is exactly the reverted regression.

**Consequences.** Verified by the probe: the current-realm partition has **zero** law
violations; the flattened-name `DOMException` subclass resolves to **neither** arm
(`isGenericError = false`, `isDOMException = false`, `isError = false`); the "Chrome
stand-in" (valid `name` / `message` getters, no reachable `stack`) resolves to
`isDOMException = true`, `isError = true` (no regression).

**One accepted realm asymmetry.** A **foreign** flattened `DOMException` — a subclass of
the foreign `Error`, carrying a reachable `stack` — is classified as a generic `Error`
(`isGenericError = true`). The current-realm identity guard has no cross-realm equivalent
(`instanceof` cannot reach a foreign constructor), and the structural arm reads the value
as an `Error`; excluding it would require reintroducing the `[[Class]]`-tag reliance the
redesign abandoned. This is **not** a partition-law violation — the verdict is
self-consistent (`isGenericError ⊆ isError`, disjoint from `isDOMException`, which rejects
it) — it is an intent asymmetry: the exclusion is exact by provenance current-realm,
structural cross-realm. **Accept and document, not reconcile** — the same category and
ruling as the `isPlainObject` realm-asymmetry (object round) and the evented
`isEventTarget` tampered-input asymmetry (#063).

Builds on #065 (the disjoint partition), #067 (`DOMException` as a distinct arm), #060
(`INSTANCE_LESS_CONSTRUCTOR` + throw-safe `instanceof`), #068 (the `DOMException` contract
whose breakage motivates the identity anchor). Pinned by the axis-1 / axis-2 vectors
`isGenericError/R3`, `isGenericError/B2`, `isAnyError/R1`, `iARGE/B1` in `ERROR.spec.md`.

Commit: _pending_.
