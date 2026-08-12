# 092 — Built bundles are smoke-tested, because nothing else executes them

**Date:** 2026-08-12

**Context.** Preparing the first release surfaced a gap nobody had named: **no gate has
ever executed a built artifact.** The 1674 + 3746 specs import source through `#index`.
`pack:check` inspects tarball contents. `attw` and `publint` resolve types and metadata.
`entries:check` (#091) asserts static parity and deliberately stops short of file
existence.

Every one of those stays green for a bundle that is structurally perfect and functionally
broken — an export tree-shaken away, a dependency mis-inlined, a UMD that loads and throws
on first call. That is the last unguarded segment of the delivery seam, and it is the
segment a release publishes through, under a version number npm will not let us reuse.

**Decision.** `smoke:check` (`scripts/check-bundle-smoke.mjs`) loads every artifact each
publishable package promises — the `exports["."]` runtime conditions plus `unpkg` — and
asserts the exports are present, correctly shaped, and callable. It runs in `check:full`
after `build`, and in CI on all three operating systems.

**Rationale.**

- **Execution is the only instrument that can see this.** Presence and shape are necessary
  and not sufficient; a predicate stubbed to a constant satisfies both. So every package
  ships `smoke.probes.mjs`, and each probe carries a positive AND a negative case.
- **Probes cross the dependency seam on purpose.** A probe touching only the package's own
  code would pass on a bundle whose dependency was dropped. Each one reaches through to
  type-detection, which is an external import in the module builds and inlined in the UMD.
- **The expected surface is READ from the source entry**, never hand-listed, so there is
  no second list to drift — the failure mode #085's curated entry already exists to
  prevent.
- **The UMD is executed in a realm with no module plumbing.** No `require`, `module`,
  `exports` or `define`, which is what proves self-containment rather than assuming it.
  Web globals ARE provided: a browser has `EventTarget`, and withholding it would fail
  honest code for the wrong reason.
- **A missing `dist/` is an ERROR, never a skip.** A smoke gate that quietly passes with
  nothing to load reports success in exactly the situation it exists to catch.

**Alternatives.** Testing the built output inside vitest was considered and rejected: the
suites deliberately resolve workspace dependencies to SOURCE (#089), so they are the wrong
place to assert anything about `dist/`. Keeping this manual — it had been step 3 of a
written verification recipe — is what left the gap open until a release forced the
question.

**Consequences.** `check:full` grows one step (~0.6 s). Every publishable package now owes
a `smoke.probes.mjs`; the gate reports a package without one as a problem rather than
skipping it, because presence-only coverage is half a gate.

`type-identity` and `custom-domain` are marked `private: true`. Both are one-line
scaffolds exporting nothing, and the gate refused to pass them — correctly, since a
publishable package whose entry exports nothing makes every comparison vacuous. `private`
is the honest state until they have content, and it also removes them from the release.
Reverse it in the same commit that gives either one a real surface.

Verified by mutation, on artifacts rather than source: an export removed from a bundle, a
predicate stubbed to a constant, a UMD whose dependency call throws, an extra name
escaping the curated entry, and a deleted artifact — 5/5 caught, green again on restore.
