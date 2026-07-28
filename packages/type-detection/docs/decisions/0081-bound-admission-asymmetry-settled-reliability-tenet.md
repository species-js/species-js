# 081 — Bound-admission asymmetry is settled: unreliable signals stay out of type-detection (closes Q.002)

**Date:** 2026-07-28

**Context.** The function lattice admits bound variants on its non-newable respectively
its non-strict newable side (`isNewableFunction`, `hasConstructSlot`, `isAsyncFunction`,
`isGeneratorFunction`, `isAsyncGeneratorFunction`, `isAnyGeneratorFunction`) and rejects
them on its strict newable side (`isES3Function`, `isClass`). Decision #005 introduced
this rule as a consequence of spec mechanics; Q.002 (open-questions) then re-opened it as
a **policy** question, on the following premise: the fingerprint matrix from decision #009
shows bound detection is now closed-form and cheap — `own_proto: false` plus
`name.value.startsWith('bound ')`. If every species can cheaply tell bound from unbound,
the historical justification for the asymmetry dissolves, and the live question becomes
_which_ predicates _should_ be strict-bound versus lenient-bound now that both cost the
same. This ADR settles that question.

**Decision. Close Q.002; keep the shipped asymmetry.** The inexpensive bound tell —
`name.startsWith('bound ')` — is **spoofable**: `name` is an ordinary, writable own
property, forgeable on any non-bound function
(`Object.defineProperty(fn, 'name', { value: 'bound x' })`, or an object literal key
`{ 'bound x'() {} }`). The only spec-reliable bound tell is `[[BoundTargetFunction]]`,
which is unobservable. A signal that can be forged is by definition **unreliable**, and
unreliable classification signals do not belong in a type-detection library whose whole
contract is spec-invariant, cross-realm-robust, hostile-input-safe reliability. They
belong to a deliberately more forgiving _function-introspection_ toolkit — which is
exactly where the bound tell already lives, as the spec-unreliable `isBoundFunction`
(Q.003).

Consequently:

1. **No predicate here reads the bound tell.** The asymmetry is the free residue of each
   predicate's spec-invariant discriminator: `isES3Function` / `isClass` key on an **own**
   `prototype` descriptor, which `bind` strips → bound forms are rejected without any
   bound-specific probe; the newable gate keys on `[[Construct]]` and the species
   predicates key on `[[Prototype]]`-chain markers, all of which survive `bind` → bound
   forms are admitted, likewise with no probe.
2. **"Re-balancing" is declined on principle, not on feasibility.** Making the species
   predicates reject bound is _possible_ (the cheap tell exists) but would require
   importing the spoofable `name`-prefix signal — outside this package's reliability
   tenet.
3. **Semantic coherence.** A bound `ES3Function` / `ClassConstructor` has genuinely lost
   the own-slot shape that _defines_ it, so it is no longer that shape. A bound async or
   generator function remains that species by every spec-invariant marker (`[[Class]]`
   tag, resolved constructor name, proto-surface, intrinsic), so it is correctly still
   that species.

**Rationale.**

- **Reliability is the contract.** A classification that flips under a forged `name`
  descriptor is not a type-detection answer; it is a heuristic. Admitting the spoofable
  tell to force symmetry would trade a spec-invariant guarantee for a cosmetic one — the
  same reasoning that keeps source-string parsing (`Function.prototype.toString`) in
  introspection (#013).
- **The asymmetry needs no defense as a weighed trade-off.** It is not "strictness on one
  side, leniency on the other, balanced by taste." It is what falls out when every
  predicate reads only its own spec-invariant discriminator. Symmetry would cost a
  spoofable dependency; the asymmetry costs nothing.
- **Clean division of labor.** Type-detection answers spec-invariant structure;
  function-introspection answers the softer, spoofable, `name`/source-derived questions —
  arrow-vs-concise and bound-vs-unbound (Q.003). Closing Q.002 sharpens that boundary
  rather than blurring it.

**Consequences.**

- **Q.002 moves open → SETTLED.** `open-questions.md` is updated; `FUNCTION.spec.md`'s
  `[Q.002]` tags are **retained** as findable cross-refs — a future flip is still a
  findable diff, but the decision is now made, not pending.
- **No code or behavior change.** This records the principle behind the shipped behavior;
  #005's behavioral rule stands unchanged.
- **Reinforces Q.003.** `isBoundFunction` (the spoofable bound tell) is confirmed
  introspection-tier, not type-detection — the natural home for the signal this ADR
  declines.
- The `FUNCTION.spec.md` amendment of 2026-07-28 (realm decomposition #080, throw-safety
  #073/#076) records this closure alongside its Resolved items.
