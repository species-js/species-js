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

`type-identity` and `custom-namespace` are marked `private: true`. Both are one-line
scaffolds exporting nothing, and the gate refused to pass them — correctly, since a
publishable package whose entry exports nothing makes every comparison vacuous. `private`
is the honest state until they have content, and it also removes them from the release.
Reverse it in the same commit that gives either one a real surface.

> **Context updated 2026-09-03 — the decision itself is untouched.** Both packages have
> since grown real surfaces: `type-identity` defines three identity entries on one result
> contract, and `custom-namespace` (named `custom-domain` when this was written — #096)
> builds, resolves and freezes namespace objects. Neither is a one-line scaffold any more.
>
> `private: true` still stands for both, and the gating rule above is unchanged. What the
> paragraph got wrong is its **trigger**: "a real surface" was written as a proxy for
> "ready to publish", and the two have come apart. Both packages now have surfaces and
> neither is publishable — each carries a one-line importability test, no spec, and
> coverage thresholds that stay inert precisely because they are `private`.
>
> The honest trigger is therefore **the first commit that makes a package publishable**,
> not the first that gives it a surface: a spec, a suite written to it, and coverage under
> the workspace thresholds. Flipping `private` on surface alone would have published two
> untested packages and, worse, would have switched their thresholds on in the same commit
> that removed the reason they were exempt.

> **Context updated 2026-09-04 — the decision itself is untouched.** The trigger above has
> now fired once. `custom-namespace` met it — a spec frozen 2026-09-04, the contract suite
> derived from it, and 100% coverage against thresholds of 85/90/90 — and its
> `private: true` was removed in the same commit that added its Codecov flag, its CI
> upload step, its own README badge and the root README's Coverage cell.
>
> The paragraph above says `private: true` stands for **both** packages. That now holds
> for `type-identity` alone, which still has no `docs/` tree, no spec, and a single
> importability test. Nothing about the gating rule changed; one of its two subjects
> graduated.
>
> Un-privating activated three gates for that package: the coverage thresholds
> (`vite.config.js` derives `isPublished` from the `private` key), `entries:check` and
> `smoke:check` — both of which skip `private === true`. `pack:check` and `check:publish`
> were already covering it, since `pnpm -r exec` runs in every workspace package
> regardless of `private`.

> **Context updated 2026-09-10 — the decision itself is untouched.** The trigger has now
> fired for the second and last time. `type-identity` met it — a spec frozen 2026-09-09
> and amended 2026-09-10 to 116 vectors, the axis-1 suite derived from it (340 tests), and
> coverage of 100% statements / functions / lines with 98.76% branches against thresholds
> of 85/90/90. Its `private: true` was removed in the same commit that added its Codecov
> flag, its CI upload step, its own README badge and the root README's Coverage cell.
>
> **No package in this workspace is `private` any more**, so the paragraph above and the
> two annotations before it now describe a state with no remaining subject. The gating
> rule is unchanged and stays here for the next package; what has ended is its
> application.
>
> One thing the 2026-09-04 annotation did not name, found on 2026-09-10 because the gate
> it concerns is not in either `check` chain: **`browser:check` does NOT skip a `private`
> package.** It selects on the presence of a `browser.probes.mjs`, so un-privating enrolls
> a package in `entries:check` and `smoke:check` automatically and in the browser matrix
> not at all. `type-identity` was the only package without that file and would have become
> the only published one with no browser-engine verification — silently, since no run goes
> red for its absence. The graduation commit adds it (four probes: the three slots under a
> non-V8 engine, a HOST constructor refused by the shape gate, and a frozen identity
> crossing a real `iframe` realm in both directions).

Verified by mutation, on artifacts rather than source: an export removed from a bundle, a
predicate stubbed to a constant, a UMD whose dependency call throws, an extra name
escaping the curated entry, and a deleted artifact — 5/5 caught, green again on restore.
