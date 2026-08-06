# 087 — Placement is role, not reliability (supersedes the placement principle stated in #013)

**Date:** 2026-08-06

**Context.** Three type-detection decisions drew this package's boundary from the outside,
and none of them was written from inside it.

#013 ruled that spec-guaranteed stringification stays in type-detection while heuristic
recognition comes here, and stated the general test in its Consequences: _"ask whether
ECMA-262 guarantees the stringification form. If yes, the predicate is foundation-tier; if
no, it is introspection-tier."_ #081 added the reliability tenet from the other side — a
spoofable signal is not a type-detection answer. Q.003 named two tenants and framed them
as the scope.

Applied to real candidates, the stated test gives the wrong answer. `isCustomClass` and
`isBuiltInClass` are spec-guaranteed, and #013 exists to keep them in type-detection — yet
they have **zero internal consumers**: nothing in type-detection's `src/` composes from
them, and `getFunctionSource` exists there solely to serve those two. By the stated test
they are foundation; by what they actually do they are leaves.

**Decision.** **Structural role decides the package; trust grade holds a veto.**

- A predicate that other code is **composed from** — load-bearing for further
  classification — belongs in `type-detection`.
- A predicate that is **terminal** — it answers a question at the edge of a system and
  nothing builds on it — belongs here, whether its evidence is spec-guaranteed, reliable,
  or forgeable.
- **Reliability is necessary but not sufficient** for foundation. #081's direction stands
  unchanged: below-reliable can never be foundation. Its converse fails: spec-guaranteed
  does not earn foundation on its own.

**Rationale.**

- **The two axes were conflated.** Trust grade (guaranteed / reliable / forgeable) and
  structural role (composed-from / terminal) are independent, and #013's test measures
  only the first. Separating them is what lets a spec-guaranteed predicate live here
  without contradiction, and it is why this package is not merely "the unreliable one".
- **"Used more often" was considered and rejected as a criterion.** It cannot be measured
  — the six downstream projects that would supply the evidence do not exist — and it makes
  placement a moving target, where a predicate earns promotion through adoption and the
  move is a breaking change on two public surfaces by the time it is warranted. That is an
  event-shaped condition with no defined observable, the shape that reliably rots. "Is it
  composed from" is the structural proxy, observable today, and it usually predicts
  frequency anyway.
- **The role axis is mechanically enforceable, which the reliability axis never was.**
  #088 gives this tier plain-`boolean` returns; a predicate that narrows nothing cannot be
  composed from in a type-safe chain, so the type system prevents a terminal predicate
  from quietly becoming load-bearing. A rule that the compiler upholds beats one that
  depends on each future author re-deriving it.
- **#013's own decision is untouched.** `isCustomClass` and `isBuiltInClass` stay where
  they are; only the general principle stated in its "Consequences" is replaced. Whether
  those two eventually migrate under the new axis is deliberately **held** — it is a
  public-surface move across two packages, and it reads better once both surfaces exist
  side by side.

**Consequences.**

- **Q.003 is resolved.** Its premise ("the package has not yet been scaffolded") is false,
  and its two named tenants are a **floor, not a scope** — they record what type-detection
  expelled, not what this package is for. The standalone-versus-subpath half was answered
  structurally by the scaffold long before it was recorded.
- **This package now has a scope statable from its own point of view**, which no prior
  document provided: terminal classification of callables, at whatever trust grade the
  evidence supports.
- **Q.003 is also the worked example of why this corpus exists.** It was a question about
  `function-introspection` filed in type-detection's decision folder, and it rotted there
  — nobody scaffolding this package had reason to walk another package's open questions.
  Decisions about this package are recorded here from now on; `decisions:check` already
  walks every `packages/*/docs/decisions` directory, so the reciprocity graph spans both
  corpora without change. ADR numbers continue the **global** sequence, because that graph
  is one map, keyed by number, and a restarted count would silently overwrite entries.
- The forward test for any future predicate: **is anything composed from it?** If yes, and
  it is reliable, it is foundation. If no, it belongs here regardless of how solid its
  evidence is.

Commit: _pending_.
