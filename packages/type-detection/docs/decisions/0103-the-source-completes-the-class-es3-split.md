# 103 — A read-only `prototype` no longer decides the class/ES3 split; the source completes it (amends #003)

**Date:** 2026-10-03

**Enforced by:** nobody — the verdicts are pinned by `FUNCTION.spec.md`'s vectors and the
function suite, which runs under `test`, a script with no `scripts/*.mjs` source to cite
this record back (#102, R4)

**Context.** #003 defines the two strict newable species by one descriptor: `ES3Function`
owns a writable `prototype`, `ClassConstructor` a read-only one. That held for every
unmodified value, and failed for a modified one. `Object.freeze` makes an ES3 function's
`prototype` read-only; so does `defineProperty(f, 'prototype', { writable: false })`
without freezing anything; and a future stable type identity that locks the slot would do
the same. Each was classified as a class. No descriptor read can tell why a `prototype` is
read-only, so the descriptor cannot repair it.

**Decision.** This amends #003's definition of both strict species.

1. A **writable** own `prototype` still settles `ES3Function`, without reading the source
   — a class's `prototype` is non-writable by spec.
2. A **read-only** one is completed by the source. A class signature — the `class` keyword
   prefix, or the native-source form — makes it a `ClassConstructor`; its absence an
   `ES3Function`.
3. The source test is public, as `doesUnboundNewableSourceMatchEitherClassSignature` and
   its exact negation. Both take a `string` the caller vouches for: the source of an
   **unbound newable** function, a precondition the names carry. No predicate here
   classifies a bound newable — `bind` strips the own `prototype` both species are read
   from — so the source test never needs to. Not `@@throw-safe` — the type contract is the
   guarantee.
4. The native form is matched anchored at both ends, from the `function` keyword through a
   header free of `{` to the `[native code]` body. Every unbound native newable — a
   built-in or a `Proxy` — renders a fixed header, so a body ending in a line comment
   reading `{ [native code]` cannot imitate it.

**Rationale.** Source strings guaranteed by ECMA-262 belong in this package (#013's
decision; its placement test was replaced by #087's structural role, under which `isClass`
is composed-from and stays). Under the unbound-newable precondition `startsWith('class')`
is exact and every comment form is free, so no comment-aware parser is needed, and the
anchored native form is exact on every engine. Only a bound function renders a
caller-chosen header, and the precondition excludes it by the same descriptor read the
predicates already make.

**Consequences.**

- `isClass` now reads the source of every class and built-in it reaches. Measured on V8
  against the descriptor-only predicate, over three runs: about +0.2 µs for a custom class
  and +0.3 to +0.6 µs for a built-in such as `Object` or `Map`, roughly 2–4×.
  `Function.prototype.toString` is most of it (about 0.16 µs on `Map`); the signature test
  is under 0.1 µs. The writable ES3 path never reads the source and is unchanged.
  `#object`, `#thenable`, `#evented` and `#error` pay it on their `isClass(constructor)`
  marker.
- A callable `Proxy` renders in the native form whatever it wraps, so a `Proxy` around a
  locked ES3 function reads as a class. A boundary: no standard read sees through a
  `Proxy`.
- `type-identity` keeps a local writable-only `isES3Function`. Following this is that
  package's decision, not drift.

**Trip condition.** Reopen if ECMA-262 or an engine renders an unbound native newable with
a `{` in its header, or a class source without the leading `class` keyword.
