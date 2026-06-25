# 059 — Constructor registries dropped; intra-call constructor threading + `getVerifiedOwnName`; `isValidWeakKey` kept as public candidate

**Date:** 2026-06-25

**Context.** #057 removed `prototypeRegistry` on measured numbers and left the two
_constructor_ registries (`constructorRegistry`, `constructorNameRegistry`) standing
pending their own benchmark-prototype pass. This is that pass.

The registries exist for exactly one reason: to deduplicate a **within-call**
double-resolution. The thenable cold path resolves a value's constructor twice per object
— once as a name (`getDefinedConstructorName`, which internally composes
`getDefinedConstructor` + a `name` read) and once as a function (`getDefinedConstructor`)
— and it does so for BOTH the value and its prototype (the reciprocal-identity proof). ~4
constructor walks per cross-realm call. The registries turn the second walk of each pair
into a cache hit.

The benchmark (`test/_bench/memoization.bench.js`) measured a faithful no-registry
**threaded** reimplementation — resolve the constructor once, derive its name from that
resolved constructor, pass it down — against the registry-backed code, across the decisive
axis (distinct objects = the dominant "classify each value once" pattern, vs repeated
object = re-detection):

| path                         | winner                 | margin     |
| ---------------------------- | ---------------------- | ---------- |
| distinct (the dominant path) | **threaded, no cache** | 2.14×      |
| resolver-level, distinct     | **no cache**           | 1.71–2.66× |
| repeated-foreign (rare)      | registry               | 1.4–1.6×   |

The registry wins only the rare repeated-detection-of-the-same-object case — which is the
**consumer's** concern by codified ruling ("memoization is the consumer's concern"), and
which the local hot path never reaches anyway (`isPromise` short-circuits on `instanceof`

- proto-identity before any of this runs). On the path that carries the traffic, the cache
  is pure overhead: `Map` allocation + two `.set`s × two registries per object, on values
  that never recur — plus the #055 cross-caller poisoning hazard and unbounded `WeakMap`
  churn.

**Decision.** Delete both constructor registries and unwind the double-resolution by
**threading the once-resolved constructor**, not caching it.

1. **Delete** `constructorRegistry`, `constructorNameRegistry`,
   `whichConstructorStorageKey`, `registerConstructor`, `getRegisteredConstructor`,
   `registerConstructorName`, `getRegisteredConstructorName`,
   `hasRegisteredConstructorName`.

2. **`getDefinedConstructor`** becomes a registry-free pivot-and-walk: the inert two-stage
   walk of #047/#056 unchanged, just with the `fastResult` lookup and the two
   `registerConstructor` writes removed.

3. **New `getVerifiedOwnName(value)`** (`@internal`, `@/utility`) — the verified own
   `name` of any value: reads the value's OWN `name` property descriptor and returns its
   data `value` only when that value is a string primitive; `undefined` otherwise. Generic
   and constructor-agnostic. Own-descriptor read only; the chain-walking counterpart is
   reserved under the name **`getVerifiedNextAvailableName`**, mirroring the
   `getOwnPropertyDescriptor` / `getNextAvailablePropertyDescriptor` pair. Inert (an
   accessor `name` is rejected, never invoked) and throw-safe (the own read is wrapped, so
   a nullish input or a hostile `getOwnPropertyDescriptor` Proxy-trap yields `undefined`).

4. **`getDefinedConstructorName`** is reimplemented as
   `getVerifiedOwnName(getDefinedConstructor(value, options))` — same public signature, no
   registry, no internal double-resolution.

5. **Thread the once-resolved constructor through the thenable structural helpers.**
   `hasPromiseIdentitySignal` changes signature from `(value, options)` to
   `(value, name)`: it no longer resolves any constructor; the caller resolves it once and
   threads the name in. `options` drops entirely (it was consumed only by the removed
   internal `getDefinedConstructorName` call; the `getTypeSignature` tag read does not use
   it). `isStructuralPromiseEquivalent` and `isStructuralPromisePrototypeEquivalent` each
   resolve their object's constructor once and reuse it for both the name (via
   `getVerifiedOwnName`) and the reciprocal-identity compare.

6. **Keep `isValidWeakKey`** (and its `WeakKey` type) as a deliberate **public-candidate**
   predicate, even though deleting the registries removes its only internal consumers
   (`registerConstructor` / `registerConstructorName`). See the rationale.

**Rationale.**

- **Threading replaces caching on the path that matters.** The win lands on the dominant
  distinct path (2.14×); the only case the cache won is rare, caller-owned, and off the
  hot path. Same precision (the value-contract + prototype-contract double walk is
  deliberate defence-in-depth, not redundancy — #058 already showed merging the walks
  loses), less state, faster where the traffic is.

- **`getVerifiedOwnName` is generic, not "the constructor-name helper."** The operation is
  "read a verified string `name` from a thing's own descriptor" — it knows nothing about
  constructors; `getDefinedConstructorName` is merely its first caller. The name encodes
  the access granularity (`Own`) rather than the mechanism (`Descriptor`), because the
  only inert way to read a property here is through its descriptor, so `Own` implies the
  descriptor route; and it rides the established `getOwnPropertyDescriptor` /
  `getNextAvailablePropertyDescriptor` axis, reserving `getVerifiedNextAvailableName` as
  the named seam for a future inherited-`name` read.

- **Throw-safety made explicit (beyond a pure mechanical extraction).** The old name read
  (`getOwnPropertyDescriptor(constructor, 'name')`, raw) ran only after the tag check
  short-circuited inside `hasPromiseIdentitySignal`. Threading hoists the name resolution
  ahead of the tag check, so it now runs unconditionally — a bare read would be a NEW
  throw surface (a hostile Proxy-function resolved as the constructor). Wrapping the own
  read in `getVerifiedOwnName` removes that surface and also closes the pre-existing raw
  read, consistent with #056's "constructor-resolution layer is throw-safe" direction.

- **`isValidWeakKey` kept as a fundamental predicate.** "Can this value be a `WeakMap` /
  `WeakSet` key?" is a genuine type-category question carrying real spec-edge knowledge
  (the ES2023 symbol-as-weak-key capability, registered-symbol exclusion) — exactly what
  this package exists to encapsulate. Its zero-consumer state after this decision is a
  transient snapshot mid-hardening, not a trend: the ongoing module rounds and the
  downstream `equip-js` `identity`/`object` migrations build the weak-key-keyed structures
  it serves. The "untested public surface" objection is answered by scheduling its
  battle-testing for the **utility** test round; the "don't fix a public shape before a
  second consumer" caution does not bite a predicate whose `(value) => value is WeakKey`
  shape is unambiguous. The multiplicative-cost caution targets _accidental/speculative_
  surface — this is a deliberate, recorded promotion of a fundamental, so it is exempt by
  intent. (This retracts the #057 note that `isValidWeakKey`'s "sole internal consumer"
  would be deleted with the registries: it survives as public surface; only its registry
  consumers go.)

**Consequences.**

- **Behavior unchanged.** Every public predicate returns exactly what it returned before;
  no public spec vector moves. The thenable suite is green (90/90, one new white-box
  vector `hPIS/R4`). This is a structure/cost change, not a contract change — for the
  public surface.

- **One `@internal` contract changed.** `hasPromiseIdentitySignal` is now `(value, name)`,
  not `(value, options)`. The frozen `THENABLE.spec.md` axis-4 white-box section and its
  `hPIS` helper vectors are **amended in place** to match (the public behavioral vectors
  stay frozen), per the frozen-spec amend-in-place ruling. The helper's `hPIS` unit suite
  is rewritten around the threaded `name`; `hPIS/R2` now proves the threaded real name
  defeats a `Symbol.toStringTag` spoof.

- **Retires the registry layer and its hazard.** #054 generalized and #055 hardened the
  `(value, assumePrototype)` keying for correctness; #055 also fixed the cross-caller
  poisoning bug. Those decisions were correct _given the caches existed_ — this decision
  removes the caches entirely, so the keying scheme and the poisoning hazard are both gone
  for good. The per-file helper-test contamination discipline #054/#055 demanded is now
  fully moot (no cache to poison); the obsolete `CONTAMINATION NOTE` was dropped from the
  helper suite. #056's throw-safety (routing constructor reads through
  `getInertDescriptor`) is retained and extended in spirit by `getVerifiedOwnName`'s
  wrapped own read.

- **Completes the #057 registry-unwind.** All three registries (`prototypeRegistry` #057,
  `constructorRegistry` + `constructorNameRegistry` here) are now gone. The library keeps
  only intra-call dedup (by threading); cross-call recurrence is handed back to the
  consumer, restoring the "memoization is the consumer's concern" ruling the registries
  had bent.

- **The benchmark harness is kept** (`test/_bench/memoization.bench.js`) as the standing
  cost instrument. Its prose header still references the now-deleted registries and will
  be refreshed.

Builds on #047 (inert pivot-and-walk), #056 (throw-safe constructor reads), #057
(registry-unwind, the measurement methodology). Supersedes the registry portions of #054
and #055 (the `(value, assumePrototype)` keying and the poisoning fix retire with the
caches; their lessons stay as history). Founded on the 2026-06 benchmark sessions.

Commit: _pending_.
