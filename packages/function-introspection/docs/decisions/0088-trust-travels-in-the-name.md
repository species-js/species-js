# 088 — Trust travels in the name: the `doesIndicate` prefix, plain `boolean`, and no second carrier

**Date:** 2026-08-06

**Context.** #087 places terminal classification here regardless of trust grade, so this
package holds predicates whose evidence ranges from spec-guaranteed to trivially forgeable
— `doesIndicateBoundFunction` reads a `name` prefix that any caller can redefine. A
consumer needs to know which kind of answer they are holding, and the question is where
that information lives.

Three carriers were designed in sequence. A `@@indicative` marker comment above each doc
block, mirroring the `@@throw-safe` convention. An `indicative/` folder giving the tier
its own import path. And a naming schema on the identifier itself. All three were built;
two were removed.

**Decision.**

- **The identifier carries the grade.** A `doesIndicate…` export answers "does the value
  carry each mark of X", never "is the value X". The transformation is a total rewrite
  rule — `isX` → `doesIndicateX` — mechanical and regex-checkable rather than a judgment
  call per name, and it preserves the noun so the pair stays visibly related.
- **Such a predicate returns a plain `boolean` and grants no narrowing.** The generic
  predicate pattern (`<T = unknown>(value?: T): value is T & X`) deliberately **stops** at
  this tier.
- **No marker and no tier folder.** Modules are named for their **subject** — `bound`,
  matching type-detection's per-domain scheme — never for their trust grade.

**Rationale.**

- **A name cannot drift from itself.** A marker is a separate artifact from the thing it
  marks: it can be forgotten on a new export, diverge from the code, or survive a re-grade
  it should have blocked. An export cannot be declared without a name. The marker's only
  advantage over the identifier was machine-checkability, and the identifier is equally
  greppable — so it was strictly dominated, not merely redundant.
- **The `@@throw-safe` precedent does not carry over.** That marker exists because
  throw-safety has **no other carrier** — it is not in the name, not in the signature, not
  inferable. Here the property has two better carriers. Reaching for the existing
  convention without asking what made it necessary would have imported its cost and none
  of its justification.
- **Withholding the type guard keeps the compiler honest.** A `value is X` signature makes
  TypeScript treat the narrowing as settled everywhere downstream, and forgeable evidence
  does not earn that. A caller who wants the narrow writes the assertion, at the point
  where the trust is theirs to extend.
- **And it makes #087's role axis structural.** A predicate that narrows nothing cannot be
  composed from in a type-safe chain, so this tier cannot quietly become load-bearing. The
  boundary is upheld by the type system rather than by discipline.
- **A grade in a filename is the marker problem one level up.** It also forces a symmetric
  counterpart — a `reliable.js` the moment a trustworthy terminal predicate arrives — and
  symmetry destroys the asymmetry that makes the mark informative. **The marked set must
  stay the minority**, or the mark carries no information at all.
- **The rewrite rule generalizes; renaming most predicates would not.** The value of
  `doesIndicate` depends on `is` remaining the unmarked default.

**Consequences.**

- The first application is `doesIndicateBoundFunction`, whose two inherent false positives
  are documented rather than fixed: a `Proxy` has no `[[SourceText]]` slot and stringifies
  exactly as a bound function does, and `Function.prototype` is genuinely both anonymous
  and native.
- **An `indicative/` folder and subpath were built and then removed**, along with a
  `/source` subpath that held a single function. Recorded so the shape is not re-proposed:
  a subpath is a consumer-facing claim of coherence, and one function does not make one.
  The package's modules are sibling `name.{js,d.ts}` pairs at the `src/` root.
- **TRIP CONDITION for reintroducing a marker:** the naming schema covers **predicates
  only**. A non-boolean best-effort export — a source-form classifier returning a string,
  a descriptor of syntactic shape — has no `doesIndicate` slot, and only a marker could
  grade it. So the decision is "not yet", not "never".
- No folder/name consistency gate is built. One module set this small is caught at review,
  and a gate over a set that small is the empty-denominator shape this workspace has
  already cleaned out once.
- Builds on #087 (which places these predicates here) and #081 (which established that a
  spoofable signal is not a type-detection answer).

Commit: _pending_.
