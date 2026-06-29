# 057 — `prototypeRegistry` dropped; `getInertPrototypeOf` is throw-safe-only

**Date:** 2026-06-23

**Context.** The constructor-resolution layer carried three module-scoped `WeakMap`
memoizations — `prototypeRegistry` (behind `getInertPrototypeOf`), `constructorRegistry`,
and `constructorNameRegistry`. The latter two were keyed by `(value, assumePrototype)`
after #054/#055; `prototypeRegistry` cached `getPrototypeOf(value)` per value. The
memoization had been added on intuition, never measured. After the thenable hardening
rounds — and after #055 had to spend real effort fixing a cache-coherence bug
(cross-caller poisoning) that existed _only because_ the cache existed — the premise was
worth testing: does the memoization actually earn its keep, given the spec's own ruling
that "memoization is the consumer's concern"?

A benchmark harness (`test/_bench/memoization.bench.js`) was built to measure each
registry head-to-head against a faithful no-cache reimplementation of the same algorithm,
across the decisive axis: **distinct objects** (cache always misses — the dominant
"classify each value once" pattern) vs **repeated object** (cache hits — the re-detection
pattern). The result for the prototype cache was unambiguous:

| `getInertPrototypeOf`   | winner   | margin |
| ----------------------- | -------- | ------ |
| distinct (cache misses) | no-cache | 3.67×  |
| repeated (cache hits)   | no-cache | 1.13×  |

The cache lost on distinct **and on hits**. `getPrototypeOf` is a trivial engine intrinsic
— cheaper to call than a `WeakMap.get` round-trip plus the `isValidWeakKey` register
guard. So caching it is pure overhead in every case. And `prototypeRegistry` is the one
registry on a hot path: `isPromise` calls `getInertPrototypeOf` on every call (for the
proto-identity compare), so the tax was paid on the common path, not just the rare
structural one.

**Decision.** Remove `prototypeRegistry`, `registerPrototype`, and
`getRegisteredPrototype`. Rewrite `getInertPrototypeOf` as throw-safe-only:

```js
export function getInertPrototypeOf(value = null) {
  if (value === null) return void 0;
  try {
    return nativeGetPrototypeOf(value);
  } catch {
    return void 0;
  }
}
```

The throw-safety (the `#029` trust boundary, so a hostile `getPrototypeOf` Proxy-trap
yields `undefined` rather than propagating) is retained — that is the helper's only
remaining job, and it is load-bearing for every descriptor walk and structural check that
composes it. Only the cache is gone.

**Rationale.**

- **Measured, not reasoned.** The cache was added on a hunch; it is removed on numbers.
  The benchmark shows no input distribution under which the prototype cache pays — it
  loses 3.67× on the dominant distinct-object pattern and still loses 1.13× even on cache
  hits.

- **`getPrototypeOf` is below the caching threshold.** A memo only wins when the cached
  computation is dearer than a `WeakMap` round-trip plus the key-validity guard.
  `getPrototypeOf` is not; it is a single intrinsic. The hot-path predicate-level delta
  from removing the cache is below the measurement noise floor — which is itself the
  confirmation that caching it never mattered.

- **Simplification + a deleted hazard.** Removing the registry deletes code, eliminates
  unbounded `WeakMap` churn over every distinct object ever inspected, and de-taxes
  `isPromise`'s hot path. It carries none of the dual-interpretation complexity the
  constructor registries needed.

- **Consistency with the spec ruling.** "Memoization is the consumer's concern." A
  consumer that re-detects the same objects in a hot loop can memoize the predicate at
  their level; the library should not presume the access pattern.

**Consequences.**

- **Behavior unchanged.** `getInertPrototypeOf` returns exactly what it returned before
  (object / callable / `null` / `undefined`), just uncached. The full test suite is green;
  no spec vector moves. This is a robustness/cost change, not a contract change.

- **First step in unwinding the registry layer.** This removes one of the three
  registries. The two constructor registries (`constructorRegistry`,
  `constructorNameRegistry`) are **retained for now** — the benchmark shows they are
  _bimodal_: ~2× slower on distinct objects but 4.5–13.8× faster on repeated detection of
  the same object (the saved op there is `getOwnPropertyDescriptor`, which allocates).
  Removing them is a larger, structural refactor (intra-call value-threading to preserve
  single-call dedup; cross-call memo handed to the consumer) and will be decided on its
  own benchmark-prototype pass and ADR.

- **Partially unwinds #054/#055.** Those decisions generalized and then hardened the
  _constructor_ registries' keying; #055 also fixed the prototype-and-constructor
  poisoning hazard. #055 was correct given the caches existed — the benchmark is what
  revealed the prototype cache should not exist at all. The remaining
  `(value, assumePrototype)` keying from #055 still governs the two constructor
  registries.

- **The benchmark harness is kept** (`test/_bench/memoization.bench.js`, a `*.bench.js`
  not picked up by the normal `test/**/*.test.js` run) as the standing instrument for the
  pending structural-refactor decision and any future cost question.

Builds on #029 (trust boundary, the retained throw-safety) and the measurement
methodology; begins unwinding the registry layer of #054/#055.

Commit: _pending_.
