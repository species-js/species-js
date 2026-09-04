# 096 — The artifact is a namespace; `domain` names the role, not the thing

**Date:** 2026-09-03

**Context.** The package shipped as `custom-domain` while everything inside it said
namespace: 107 occurrences of "namespace" against 2 of "domain" in its own source, a
public entry called `createCustomNamespace`, a type called `CustomNamespace`, and an
observable artifact that answers `[object CustomNamespace]` and `[namespace '<name>']`.

The mismatch surfaced during a documentation-hardening round that had just corrected this
same package's one-line description — "Customizable prototype-less namespace objects for
sealed method grouping" — for describing an intent rather than the artifact: the result is
frozen, not customizable, and its members were never restricted to methods. The identical
question applied to the package name and had not been asked.

**Decision.** Rename the package to `@species-js/custom-namespace`.

The artifact vocabulary does not change: `createCustomNamespace`, the `CustomNamespace`
type, the `Symbol.toStringTag` value, and the `[namespace '<name>']` string form all stay
exactly as they are. They were never the drifting half.

`custom-domain` becomes a free name, deliberately.

**Rationale.**

- **The two words are not synonyms, and the difference is the whole question.** A
  _namespace_ is a naming scope — a name-to-value mapping whose purpose is grouping and
  collision avoidance. The word is about lookup. A _domain_ is a bounded region of meaning
  or authority. The word is about jurisdiction.
- **The artifact is the first thing.** It is a frozen, prototype-less name-to-value map
  modeled on an ES module namespace, and its entire behavior is grouping and lookup.
- **"Domain" correctly describes the ROLE it plays in a consumer's protocol**, which is
  why the usage site in the `es-async-types` quarry names its binding
  `abortablePromiseDomain` and its slot key `ABORTABLE_PROMISE_DOMAIN_KEY`. There, a
  namespace is stored at a per-realm symbol slot on every instance and asked
  `domain.isAbortablePromise(candidate)` — a jurisdictional question, answered by the
  value's own origin realm. That is genuinely a domain.
- **But none of the domain-ness lives here.** The slot convention, the delegation, the
  behavioral dry-run and the per-realm registry are all the consumer's. This package
  delivers one builder. **A package is named for what it delivers, not for the role its
  output plays downstream.**
- **Spending "domain" on the namespace builder would leave no word for the thing that
  actually is a domain.** If that protocol is ever packaged — a slot key, a membership
  predicate, cross-realm delegation — it is a package that _consumes_ this one, and
  `custom-domain` is its name. Keeping both words for their proper referents is a better
  outcome than trading one for the other.
- **The cost asymmetry is decisive and concrete.** The artifact vocabulary is load-bearing
  in a working detection signature: `getTaggedType(value) === 'CustomNamespace'` and an
  exact `String(value)` match are literal checks in the abortable-promise introspection
  that `cadence-js` will migrate. Renaming the package costs a directory, a manifest field
  and a handful of doc lines. Renaming the tag or the string form would break a signature
  that already works.
- **Timing.** Done while the package is `private` at `0.0.0` with zero dependents. This is
  the cheapest the change will ever be; the moment it publishes, the name is a permanent
  contract under Hyrum's law across six planned dependents.

**Consequences.**

- Package identity moves: directory (via `git mv`, so history follows), manifest `name`
  and `repository.directory`, both `@module` blocks, the test's `describe`, the UMD global
  (`SpeciesJS.CustomNamespace`), the package README, and the `scope-enum` entry in
  `commitlint.config.cjs` — which would otherwise reject the very commit that lands this.
- Workspace surfaces follow: the package tables in `CLAUDE.md` and the root `README.md`,
  five references in `SCAFFOLD.md`, the commit-scope example in `CONTRIBUTING.md`, and a
  current-state sentence in type-detection's `architecture/utility.md`.
- **Referents in #086, #092, #093 and #094 were repointed at the new name.** Those four
  are pointers, not decision content — each names the package while stating something
  about the workspace, and nothing in them turns on the identifier. A referent that no
  longer resolves is worse than stale prose, because it silently breaks `grep` across a
  log of 96 records. Decision content, measured numbers and superseded claims stay
  untouched; where a decision's factual context has moved, this log uses a dated in-place
  banner instead, as #086 and #092 both do.
- `@species-js/custom-domain` remains unused and available for the protocol package
  described above, should it ever exist.
- This is the first ADR written from inside this package. The decisions that shaped it
  before it had a corpus of its own live in
  [type-detection's log](../../../type-detection/docs/decisions/README.md) — #085 drew the
  curated-surface rule it follows, and #086 the capture rule its `#config` applies.
