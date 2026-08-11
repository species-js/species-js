# 090 — Proven admission earns the `is` prefix

**Date:** 2026-08-11

**Context.** #087 places terminal classification in this package whatever its trust grade,
"spec-guaranteed, reliable" or forgeable alike. #088 then puts the grade in the
identifier. A `doesIndicate…` export rests on forgeable marks. `is…` is left as the
unmarked default, and its value depends on staying the default.

`bound` was the first module here, and it is indicative-grade. Every export written before
this ADR therefore carried `doesIndicate…`. From the outside the package began to look
like the indicative one. A note in the project's own memory recorded exactly that
misreading, claiming #088 "mandated `doesIndicate…`" here. It does not. Neither ADR says
so, and #087 says the opposite in as many words.

`arrow` and `concise` are the first reliable-grade modules in the package. They arrived
with eight `is…` predicates and no written account of what entitled them to the default.
The naming was right; its justification was missing. That is the shape which later reads
as an accident and invites a well-meaning rename in either direction.

**Decision.** An export here may take the `is…` prefix when every admission is proven and
every ambiguity is refused. All four must hold:

- **Admission rests on evidence the caller cannot forge.** `[[SourceText]]` read through
  the realm-fixed `Function.prototype.toString`, a spec-defined tag, or an own-`prototype`
  read. Never `name`, never an instance `toString`, never any writable property.
- **Where one shape could belong to two kinds, a non-source signal settles it.** The
  predicate does not guess from the likelier reading.
- **Where no such signal exists, the answer is refused.** An undecidable case returns
  `false`. Silence is the permitted failure. A wrong admission is not.
- **Every documented boundary is a MISS, never a FALSE POSITIVE.** Recall may degrade;
  binding, wrapping and post-hoc tampering all hide a value from these predicates.
  Precision may not.

A predicate meeting all four is named `is…` and MAY grant narrowing. One failing any of
them takes `doesIndicate…` under #088 and grants none.

**Rationale.**

- **The default has to be earned, or the mark it contrasts with means nothing.** #088's
  case for `doesIndicate…` rests on the marked set staying the minority. That cuts both
  ways. Grant `is…` on structural role alone and the two prefixes distinguish modules
  rather than evidence. A consumer could no longer read the grade off the name. Stating
  what `is…` costs is what keeps `doesIndicate…` informative.
- **Refusal is the load-bearing clause, not the evidence list.** A predicate can read only
  unforgeable signals and still be dishonest. It need only pick the likelier of two
  readings once the signals run out. `concise` has exactly one such case:
  `async function(){}`, which a method named `function` and an anonymous async function
  expression produce identically — same source, tag, own-property set, prototype and
  `name`. It is refused. That refusal is what makes every admission the module does make a
  proof.
- **The asymmetry is testable, which is why it is a property and not an aspiration.**
  "Every failure is a miss" is checkable over a corpus: no vector may be admitted that the
  oracle rejects. Across the whole hardening round of both modules, every defect found was
  a false negative. A spec can assert that as a standing law. "We were careful" cannot be
  asserted at all.
- **Narrowing follows from the same test.** #088 withholds the type guard from
  `doesIndicate…` because forgeable evidence does not earn a compiler-wide commitment. The
  converse holds here. A proven admission is exactly the admission a `value is X`
  signature may encode.
- **Placement did not decide this and must not appear to.** #087 already ruled that role
  chooses the package and grade rides separately. Deriving a naming rule from the package
  would re-conflate the two axes it took an ADR to separate.

**Consequences.**

- **`arrow` and `concise` ship eight `is…` predicates**: `isArrowFunction`,
  `isAsyncArrowFunction`, `isAnyArrowFunction`, `isPlainConciseMethod`,
  `isConciseAsyncMethod`, `isConciseGeneratorMethod`, `isConciseAsyncGeneratorMethod`,
  `isAnyConciseMethod`. Each meets all four criteria, and each has its boundaries
  enumerated in its module doc. The package now holds both grades, which is what #087
  predicted.
- **This ADR supersedes nothing and amends nothing.** It records a rule #088 left implicit
  by only ever exercising the other branch. #088's sentence "no variant may be named
  `is…`" is scoped to the bound pair, where the question was conjunction of forgeable
  marks. It is not a package-wide prohibition. Reading it as one is the misreading this
  ADR closes.
- **The memory note claiming a departure from #088 was wrong, and is corrected.** It is
  recorded here because the claim survived several sessions and fed a planned "departure
  ADR" that would have written a contradiction into the log. The governing text was three
  files away the whole time. Repo canon supersedes any paraphrase of it.
- **TRIP CONDITION.** If a future predicate here cannot prove one of its admissions, the
  prefix stops being honest and that export takes `doesIndicate…` instead. The check is
  the boundary list in each module's doc. A boundary describing a wrong ANSWER rather than
  a silence is the violation, and it is visible at review without a gate.
- **No naming gate is built**, for #088's reason unchanged. The export set is small enough
  to catch at review, and a gate over a set this small is the empty-denominator shape this
  workspace has already cleaned out once.
- Builds on #087 (role chooses the package, grade rides separately) and #088 (the
  identifier carries the grade).

Commit: _pending_.
