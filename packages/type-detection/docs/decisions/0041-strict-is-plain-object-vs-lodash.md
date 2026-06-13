# 041 — Strict `isPlainObject` vs lodash `_.isPlainObject`

**Date:** 2026-06-06

**Context.** Lodash's `_.isPlainObject(value)` is the long-established userland convention
for "is this a plain object?" but it is _permissive_: it admits both prototype-bearing
objects whose constructor is `Object` AND prototype-less objects (`Object.create(null)`).
Either form satisfies lodash's definition. The species-js migration could match that
semantic by composing the two discriminators, or could keep the two distinct as a stricter
contract.

**Decision.** Keep them distinct. `isPlainObject` admits _only_ prototype-bearing objects
whose direct constructor is the built-in `Object`. Prototype-less objects have their own
dedicated predicate, `isDictionaryObject`. The lodash semantic is recovered by
composition: `isPlainObject(v) || isDictionaryObject(v)`. The module-level JSDoc and both
predicates' per-symbol JSDoc name the strictness prominently with the composition recipe.

**Rationale.** Three forces converge:

- **The two forms are runtime-distinct.** A prototype-bearing object and a prototype-less
  object behave differently for nearly any operation that touches the prototype chain
  (property lookup miss, `instanceof`, `Object.prototype.toString.call` output, etc.).
  Consumers that need the discrimination need it strictly; consumers that don't care just
  compose.

- **Lodash semantic is recoverable; ours is not.**
  `isPlainObject(v) || isDictionaryObject(v)` reproduces the lodash semantic exactly. The
  reverse direction — recovering the strict semantic from a permissive predicate —
  requires the consumer to add the prototype check themselves, which is exactly the work
  the predicate is supposed to do.

- **The species-js convention strongly prefers explicit distinctions.** Decision #023 made
  the same call for `isPromise` (rejects subclasses by strict constructor-name equality);
  decisions #028 and #029 made the same call for `isEventTarget` / `isAbortSignal`. The
  "strict by default, compose for lenient" pattern is consistent across the package.

**Consequences.** The lodash conflict is real and documented. Consumers familiar with
lodash who pass a prototype-less object to `isPlainObject` and get `false` will
(correctly) reach for the JSDoc, see the strictness note, and either use
`isDictionaryObject` for the discrimination they actually need or compose the OR for the
lodash semantic. The strict form propagates better through downstream typing —
`isPlainObject(v)` narrows to `PlainObject` (constructor is `Object`), which is a stronger
guarantee than lodash's union.

The recipe `isPlainObject(v) || isDictionaryObject(v)` for lodash semantics is named in
both predicates' JSDoc and in the module-level @module block.

Commit `8e09b21`. Superseded for the recipe surface by decision #046, which replaces the
inline recipe with the dedicated `isPlainOrDictionaryObject` predicate.
