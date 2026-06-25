# 058 — Descriptor-batching and descriptor-memoization rejected (benchmark-driven)

**Date:** 2026-06-24

**Context.** `doesImplementPromiseContract` (and the analogous `isEventTarget` contract)
runs **three separate guarded prototype-chain walks** — one `hasInertMethod` per contract
key (`then`/`catch`/`finally`). Each `hasInertMethod` → `getInertDescriptor` →
`getNextAvailablePropertyDescriptor` → native `getOwnPropertyDescriptor`. The three walks
re-traverse the same chain three times, which _looked_ like the cold-path performance
killer. Two optimization hypotheses followed:

1. **Descriptor-batching** — replace the three walks with **one** walk that collects all
   three keys in a single chain traversal, via a generic
   `doesMatchInertContract(value, protocols)` built on a batched
   `getNextAvailablePropertyDescriptorsFor(value, keys)`. Two batched shapes were
   prototyped: `getOwnPropertyDescriptors` per level (read all own descriptors, filter),
   and targeted `getOwnPropertyDescriptor` per still-unfound key per level (no over-read).

2. **Descriptor-memoization** — keep the walk but cache descriptor reads in a `WeakMap`,
   on the premise (per #057's lesson that an allocating op is the one worth caching) that
   `getOwnPropertyDescriptor` allocates a fresh descriptor object per call. Two cache keys
   were prototyped: keyed by the **candidate** (cache the whole contract verdict), and
   keyed by the **walked object** (cache each `gOPD` at its prototype level — the
   "machine-room" hypothesis: distinct candidates share stable prototypes like
   `Promise.prototype` that recur across every walk).

The standing constraint: a generic/less-readable form is justified _only_ by a measured,
significant consumer-level gain — otherwise revert to the plain three-walk form. Each
variant was added to the benchmark harness (`test/_bench/memoization.bench.js`) and
measured against the live three-walk form across distinct (the dominant "classify once"
pattern) and repeated axes, plus a fixture purpose-built for the machine-room hypothesis
(distinct instances over one stable shared prototype: synthetic `objectCreate(proto)` and
real `Promise.resolve(n++)`).

**Decision.** Reject both. Keep `doesImplementPromiseContract` on the three-walk form
(`hasInertMethod(value, k, TRUSTED_DATA_CONFIRMATION)` ×3). Delete the batching machinery
— `doesMatchInertContract`, `getInertDescriptorsFor`,
`getNextAvailablePropertyDescriptorsFor`, and the named helpers
`isValidDescriptorProtocol` / `plugFirst`. Adopt **no** internal descriptor or `gOPD`
memoization. Retain `getInertDescriptor` plus the four single-key
`hasInert{Method,Getter,Setter,Value}` walks unchanged.

**Rationale — the numbers.**

Contract-walk variants (representative run; hz, higher is better):

| scenario                           | winner          | 3-walk vs batched | 3-walk vs targeted |
| ---------------------------------- | --------------- | ----------------- | ------------------ |
| own `then/catch/finally` (level-0) | **3-walk**      | 2.4–3.8× faster   | 1.06× (tie)        |
| foreign Promise, repeated          | **3-walk**      | 4.7–4.8× faster   | **1.60× faster**   |
| fresh cold-hit, distinct           | 3-walk/targeted | 1.5–2.1× faster   | wash (±noise)      |

- **`batched` (`getOwnPropertyDescriptors` per level) is the worst in every cell** — it
  over-reads _all_ own descriptors at every level to find three keys.
- **`targeted` is a wash with three-walk.** Run-to-run they trade the tie cases inside the
  ±8–15 % noise floor; the only margin that survives both runs is **three-walk +1.60× on
  the realistic foreign-Promise path**.
- **Why the batching intuition failed here:** `then`/`catch`/`finally` are _co-located_ on
  one prototype (`Promise.prototype`). A single walk saves almost no traversal when the
  keys share a level, while paying for a `Set` + result object + per-key bookkeeping. The
  three short-circuiting `&&` walks are tight, monomorphic, allocation-free. Batching can
  only win when a contract's keys span **different** prototype levels — which the Promise
  and EventTarget contracts do not.

Descriptor-memoization variants:

| cache key                      | repeated (hits)          | distinct (misses)                  | verdict      |
| ------------------------------ | ------------------------ | ---------------------------------- | ------------ |
| **candidate** (whole verdict)  | **3.5–5.3× faster**      | ~tie with 3-walk                   | caller's job |
| **walked object** (per-`gOPD`) | loses (1.7× on repeated) | **3.0× slower**, even shared-proto | rejected     |

- **Candidate-keyed memo wins big on hits** (caching a whole walk behind one
  `WeakMap.get`) and merely ties on misses — a genuinely different result from #057's
  `prototypeRegistry`, because the cached unit (a full contract walk) is far dearer than
  one `getPrototypeOf`. But its benefit only appears when the _same candidate_ is
  re-checked, the local hot path never runs the walk at all (it short-circuits via
  `instanceof` + proto-identity), and caching a verdict is the **consumer's concern** by
  codified ruling. A caller that re-detects the same value memoizes `isPromise(x)`
  directly — cheaper than, and the right home for, this cache.

- **Walked-object ("machine-room") memo loses ~3× even in its best case.** The recurrence
  premise was _correct_ — the shared prototype does recur across every walk — but a
  per-`gOPD` cache loses anyway: `WeakMap.get` + nested `Map.has`/`get` costs more than
  the cheap native `gOPD` it guards, the level-0 candidate (always distinct) pays full
  `WeakMap`-churn freight every walk, and `gOPD`'s descriptor allocation turns out to be
  cheap nursery garbage, not a meaningful cost. This is #057's granularity lesson
  confirmed one layer down at the descriptor read. Because the performance case fails
  first, the adversarial-staleness question it would have raised (caching a prototype's
  descriptor blinds the check to a later prototype mutation — a hole in exactly the
  cross-realm / adversarial posture the library markets) never needed adjudication.

The generalizable finding:

> **Coarse result-caching can win on recurrence; fine-grained native-op caching loses to
> the native op.** Recurrence is necessary but not sufficient — the cached operation must
> also be dearer than the cache lookup. A whole contract verdict clears that bar (5× on
> repeat) but belongs caller-side; a single `getOwnPropertyDescriptor` does not, even when
> its key recurs.

**Consequences.**

- **Behavior unchanged.** `doesImplementPromiseContract` keeps its semantics and its
  three-walk implementation; no spec vector moves. The full thenable suite is green
  (89/89). This is a "don't adopt" decision — the rejected machinery was prototype/WIP,
  never wired into a shipped predicate.

- **Import-graph cleanup (incidental).** Removing the batching machinery removed
  `utility`'s only use of `isArray`, which had been its only dependency on the `iterable`
  module. That edge had closed a module-load cycle
  (`primitive → utility → iterable → primitive`) whose eager
  `unguardedIsUnregisteredSymbol` call tripped a `symbolKeyFor` TDZ. Dropping the
  now-unused import breaks the cycle at its root; `iterable` keeps its self-contained
  Array static section. (A transient `config.isArray` export added while diagnosing the
  cycle was reverted as no longer load-bearing.)

- **The constructor registries remain a separate, still-open question** (#057). Their
  decision rides on the local-hot-path-bypass argument and a future structural-refactor
  benchmark pass, not on this one.

- **The benchmark harness is kept** as the standing cost instrument (per #057), now
  carrying the contract-variant groups.

Builds on #057 (benchmark methodology; the granularity / allocating-op threshold) and the
codified "memoization is the consumer's concern" ruling. Retires the descriptor-batching
and descriptor-memo threads.

Commit: _pending_.
