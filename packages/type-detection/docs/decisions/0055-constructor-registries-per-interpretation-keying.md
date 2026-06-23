# 055 — Constructor registries hardened to per-interpretation keying; #054's deferral overturned

**Date:** 2026-06-23

**Context.** Decision #047 introduced the `assumePrototype` option on
`getDefinedConstructor` so a prototype object resolves its OWN `constructor` data property
(ECMA-262 §10.2.6) rather than walking up its `[[Prototype]]`. Decision #054 generalized
the option to `getDefinedConstructorName`, and explicitly NAMED a hazard it then chose to
defer: the memoization behind both accessors — `constructorRegistry` and
`constructorNameRegistry` — keyed by value ALONE. A single object resolves to two
legitimately-different constructors depending on the option:

```js
getDefinedConstructor(Promise.prototype); // Object  (walked up)
getDefinedConstructor(Promise.prototype, { assumePrototype: true }); // Promise (own §10.2.6)
```

A value-keyed cache can hold only one, so a no-option and an `assumePrototype` resolution
of the SAME object poison each other — whichever runs first wins the cache.

#054 deferred the fix on the premise that the collision was unreachable IN FLOW: within a
predicate's own call graph, the instance is resolved option-less and the prototype
assume-only, and those are distinct objects (see #054's rationale). That premise was wrong
for callers OUTSIDE the flow. Adversarial re-analysis confirmed the hazard is reachable
through the package's PUBLIC exports:

```js
getDefinedConstructorName(foreignPromise.prototype); // public, no-option → caches 'Object'
isPromise(aForeignPromiseInstance); // → false  (WRONG; should be true)
```

The first call (a legitimate public use of `getDefinedConstructorName` on a prototype
object) poisons the foreign `Promise.prototype`'s name entry; the second call's
cross-realm arm then reads that stale `'Object'` and rejects a genuine foreign `Promise`.
Verified empirically, symmetric across both orderings and reproducible via BOTH public
entry points (`getDefinedConstructorName` and `getDefinedConstructor`).

**Decision.** Overturn #054's deferral and key both registries by
`(value, assumePrototype)`.

Each registry becomes a two-level map — a `WeakMap` on the value, holding a small `Map`
keyed by the interpretation:

```js
const constructorRegistry =
  /** @type {WeakMap<WeakKey, Map<string, NewableFunction>>} */ (new WeakMap());
const constructorNameRegistry = /** @type {WeakMap<WeakKey, Map<string, string>>} */ (
  new WeakMap()
);

function whichConstructorStorageKey(assumePrototype) {
  return assumePrototype ? 'proto' : 'default';
}
```

Every touchpoint threads the flag:

- `getDefinedConstructor` — `getRegisteredConstructor(value, assumePrototype)` for the
  fast-path read; `registerConstructor(value, ctor, assumePrototype)` on both resolution
  branches.
- `getDefinedConstructorName` — destructures `assumePrototype` once and threads it through
  the **slot-aware** `hasRegisteredConstructorName(value, assumePrototype)` guard, the
  `getRegisteredConstructorName(value, assumePrototype)` read, and the
  `registerConstructorName(value, name, assumePrototype)` write; `options` is passed
  straight to the inner `getDefinedConstructor` (no rebuild).

The guard reads the specific slot (`registry.get(key)?.has(slot)`), not mere outer-key
presence — without that, a filled `default` slot would falsely report the empty `proto`
slot as cached and return `undefined`.

**Rationale.** Three forces.

- **The two-phase lesson.** Threading the disambiguator through callers (the #054 fix) is
  sufficient ONLY while the dual interpretation stays in-flow. The moment a public entry
  point lets an external caller resolve the same object under either interpretation, the
  cache itself must distinguish them. Reachability — not in-flow analysis — is the correct
  test for whether a value-keyed cache is sound over a dual-interpretation key.

- **Cost-aware.** The inner `Map` is allocated lazily, only on first registration per
  object, and is bounded to two entries (`proto` | `default`). There is no per-call
  allocation on the read path. The earlier interim form's `objectAssign(options, …)` —
  which both allocated and mutated the caller's `options` — was dropped; `options` flows
  through unchanged.

- **Soundness restored.** The slot-aware guard makes `getRegisteredConstructorName`'s
  `/** @type {string} */` cast sound again: the read is reached only when the slot exists.
  The guard tests slot presence with `.has(slot)` (not truthiness), so the empty-string
  `''` name of an anonymous function remains a valid cached value rather than a cache
  miss.

**Consequences.**

- **Poisoning closed** in both directions and via both public entry points —
  probe-verified: each registry resolves `default → 'Object'` and `proto → 'Promise'`
  independently regardless of call order, and `isPromise(foreignPromise)` returns `true`
  after a public-API poison attempt through either accessor.

- **Memoization-correctness only — no behavioral-vector change.** No predicate's
  admit/reject verdict changes; THENABLE.spec.md and every other spec are untouched. This
  ADR records a cache-internals decision, not a contract change.

- **#054's "deferred latent caveat" is superseded.** The cross-caller hazard #054 recorded
  is now closed at the source; a forward-pointer is added to #054.

- **The thenable helper-test contamination discipline is downgraded to
  belt-and-suspenders.** The per-file "resolve each prototype object under one
  option-setting; use an isolated realm for the lone no-option vector" rule (and
  `createForeignRealm()` in `test/_cross-realm.js`) is no longer load-bearing for
  production correctness, but is kept: the registries still persist across `it`s within a
  file, so the discipline keeps helper vectors order-independent and self-documenting.

Builds directly on #054 (overturns its registry deferral) and #047 (`assumePrototype`
origin). Independent of the open `isPromise` constructor-walk throw-safety gap, which is
tracked separately.

Commit: _pending_ (batched with the thenable structural-equivalence refactor).
