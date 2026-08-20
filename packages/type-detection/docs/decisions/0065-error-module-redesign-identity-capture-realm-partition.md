# 065 — Error module redesign: identity-capture + realm partition; the three-predicate split

**Date:** 2026-07-10

**Context.** #032 gave the error module a layered composition stack: a `[[Class]]`-tag
classifier — `hasErrorPrototypeContract` (a prototype descriptor-walk plus a loose
trailing-`'Error'` `toString` heuristic) → `doesMatchErrorContract` (tag dispatch over
`'[object Error]'` / `'[object DOMException]'` / `'[object Object]'`) → `isGenericError`
(the `@internal` polyfill body, `v instanceof Error || doesMatchErrorContract(v)`) →
`isError` (native-or-polyfill) → `isAbortError`. One public predicate discriminated the
whole error surface; `DOMException` had no dedicated predicate and rode inside the union.
Meanwhile the thenable / evented / object rounds had converged on a different, stronger
model — capture the realm's constructor + prototype once at load, validate the captured
prototype by shape, and dispatch per realm (a local `instanceof` fast-path, a cross-realm
throw-safe prototype-equivalence walk). The redesign question (user-led): should the error
module adopt that identity-capture + realm-partition model, and should it split the error
surface into an honest `Error` / `DOMException` distinction rather than one tag-classified
union?

**Decision.** Retire the tag-classifier and rebuild the module on identity-capture + realm
partition, exposing **three** public predicates that form a disjoint partition:

1. **Module-load identity capture.** Both `Error` and `globalContext.DOMException` are
   captured once via `getValidatedStandardConstructorAndPrototypeTuple`, each validated by
   an `is{GenericError,DOMException}PrototypeEquivalent` gate (a `[[Class]]`-tag +
   `getVerifiedOwnName` + `isClass` + `constructor.prototype === prototype` +
   prototype-contract chain). On failure the tuple collapses to the inert
   `[INSTANCE_LESS_CONSTRUCTOR, BLANK_DICTIONARY]` surrogate (#060 / #064), so every
   downstream `instanceof` is uniformly `false` rather than throwing.
2. **Three public predicates.** `isGenericError` (an `Error` that is NOT a
   `DOMException`), `isDOMException` (any `DOMException`), and `isError` (either — the
   `AnyError` union, native-or-polyfill). They form the invariant **`isError` ≡
   `isGenericError` ⊎ `isDOMException`**: a disjoint, engine-independent cover.
3. **Per-realm dispatch.** Each predicate confirms a current-realm value by a throw-safe
   `instanceof` fast-path plus a structural contract, and a foreign-realm value by a
   throw-safe prototype walk that matches the captured shape.
4. **Subclass-safe alien walk.** Each walk reads the constructor at every prototype level
   from that level's OWN `constructor` back-reference, never from the walked child. The
   genuine `Error` / `Error.prototype` pairing only co-locates on the level whose own
   `constructor` back-references it (`Error.prototype.constructor === Error`); reading
   from the child aligns only for a direct `new Error()` and silently misses every
   subclass level (`TypeError`, `class X extends Error`).
5. **`isError` retains #032's native-or-polyfill capture** — native ECMA-262
   `Error.isError` when the realm provides it, else the polyfill — but the polyfill body
   is now the realm-partitioned `isAnyError` (this cluster), not the tag-classifier.

**Rationale.** Three forces converge on the redesign:

- **Harmonization.** The thenable / evented / object rounds all run on capture + realm
  partition + prototype-equivalence; the tag-classifier was the last module still on a
  string-heuristic. Identity over `[[Class]]`-tag guessing makes error discrimination
  consistent with — and as spoof-resistant as — its siblings.
- **An honest `Error` / `DOMException` split.** Folding `DOMException` into a single union
  hid a real distinction that downstream consumers need (and that engines model
  inconsistently — see #067). Three predicates name the two arms and their union
  explicitly.
- **Cross-realm as a first-class partition, not a tag fallback.** The old design reached
  foreign errors only through the `'[object Error]'` tag; the new alien walk proves
  structural prototype-equivalence, and the own-back-reference constructor read is the one
  non-obvious mechanic that makes it subclass-correct.

**Consequences.** Retires the `@internal` `hasErrorPrototypeContract`,
`doesMatchErrorContract`, and the old union-body `isGenericError`. The **name
`isGenericError` is deliberately repurposed** — it named the `@internal` polyfill union
body that ADMITTED `DOMException`; it now names the public predicate that EXCLUDES it, an
exact inversion a reader carrying the old model will misread, so the `.d.ts` / spec state
the exclusion explicitly. New `@internal` surface (17 helpers) covering the stack
machinery, the structural / prototype contracts, the prototype-equivalence gates, the two
alien walks, the two current-realm instance checks, and the `isAnyError` polyfill body.

**Supersedes the layered tag-classifier structure of #032** — the native-or-polyfill
_capture posture_ is retained and re-affirmed; the composition stack beneath it is
replaced. #032 stands as the historical record. The stack-capability machinery and the
converges-not-widens reversal are #066; the `DOMException` type modeling is #067; the
`isDOMException` descriptor-kind contract is #068; the `isGenericError` `DOMException`
exclusion (and the partition-leak fix) is #069. #035 (`AbortError` suffix) and #036
(generic `<T>` surface) carry over unchanged.

Builds on #054 / #061 (cross-realm structural-equivalence model), #059 (intra-call
constructor threading), #060 (`INSTANCE_LESS_CONSTRUCTOR` sentinel + throw-safe
`instanceof`), #064 (the `BLANK_DICTIONARY` surrogate slot).
