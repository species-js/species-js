# 097 — The published root is `src/index.js`; the barrel/public split earns itself per MODULE, not per export

**Date:** 2026-09-04

**Context.** Both already published packages `type-detection` and `function-introspection`
carry each a two-file root. `src/index.js` is a WIDE barrel that stars every module, keeps
the `@internal` machinery reachable for the test suites, and is deliberately never built.
`src/public.js` names the documented surface one export at a time, and `exports["."]`, the
legacy fields and the vite entry all resolve to it. #085 drew that shape and built
`surface:check` to keep the curation and the `@internal` tagging from drifting apart.

`custom-namespace` has neither half of the structure that shape exists to manage. Its
`src/index.js` is not a barrel — it is the implementation module. It exports exactly one
value, `createCustomNamespace`, plus the `CustomNamespace` type. The three helpers
(`toPrimitive`, `resolveNamespaceMember`, `aggregateNamespaceTarget`) and the
`reservedNamespaceKeys` set are module-local and unexported. `#config` is neither
re-exported nor a published subpath, and the `exports` map has a single `"."` entry, so
Node's own resolution blocks any deep import of it.

The question became live while preparing to un-private the package: `exports["."]` and the
vite entry are **what ships**, and changing either after a first publish is a breaking
change for consumers. Left undecided, flipping `private: false` would ratify `index.js` as
the permanent published root by default rather than by decision.

**Decision.** No `public.{js,d.ts}` for this package. `exports["."]`, the legacy fields
and the vite entry keep resolving to `src/index.js`.

**The threshold, stated package-independently: the barrel/public split earns itself when a
package has multiple MODULES, not when it has multiple exports.** The wide barrel exists
in order to star several modules; with one module there is nothing to star, and therefore
nothing for a curated entry to filter.

**Rationale.**

- **The split solves a problem this package does not have.** #085's mechanism separates
  two roles that had collapsed onto one file: a wide surface the tests need and a narrow
  one, consumers get. Here they are not in tension — the single export is public, and no
  `@internal` value is exported from the entry at all. Splitting would separate a set from
  itself.
- **A `public.js` here would be `export { createCustomNamespace } from '#index';`.** One
  re-exported name, and a second home for the module's doc block. A second home is where
  drift begins, which this package has already paid for twice: a stale claim survived in
  `src/config/` because it had a twin, and the freeze date needed sweeping out of a second
  file. Adding a home to satisfy symmetry buys a maintenance liability and no enforcement.
- **This is application of #085, not an exception to it.** That ADR scopes its own gate to
  "every package carrying a `src/public.d.ts`" — it already anticipates packages that do
  not. Its barrel rule likewise governs what a barrel may star, and says nothing about a
  package that has no barrel.
- **Uniformity for its own sake was considered and rejected.** Four packages with an
  identical shape reads well until a reader asks what the fourth file is filtering and
  finds the answer is "nothing". A shape that is uniform but unjustified teaches the wrong
  lesson about when to reach for it.

**Consequences.**

- **`surface:check` does not cover this package.** It skips any package without a
  `src/public.d.ts`, so the skip is silent. Accepted, because there is nothing to check:
  one export, public, with no `@internal` value on the entry. This is the load-bearing
  condition of the whole decision, and it is exactly what makes it reversible — see the
  trigger below.
- **Trip condition — adopt the split in the SAME commit if either becomes true.** (1) The
  package gains a second module, at which point `index.js` becomes a real barrel; the
  likeliest candidate is the owed `isCustomNamespace` recognizer, if it lands as its own
  module rather than inside the entry. (2) The entry ever exports an `@internal` value, at
  which point the silent `surface:check` skip stops being harmless and becomes a hole.
- **The built artifact stays `dist/<target>/index.js`.** No change to the `exports` map,
  the legacy fields, `entries:check`, or `vite.config.js`.
- **The decision must precede un-privating, and now does.** Flipping `private: false` no
  longer silently settles the published root by omission.
- **`type-identity` faces the identical question** — four exports in one module, no
  `public.js` — and the threshold above answers it the same way. That package's own arc
  should confirm it against its own surface rather than inherit the conclusion, since its
  entry may yet prove to export something `@internal`.
