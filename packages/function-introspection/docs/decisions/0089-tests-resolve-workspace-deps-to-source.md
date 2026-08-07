# 089 — Tests resolve workspace dependencies to source, through the public entry

**Date:** 2026-08-07

**Context.** `bound.js` imports `@species-js/type-detection` by package name — the first
cross-package import in the workspace. The dependency is `workspace:*`, so pnpm symlinks
it and both Node and vite resolve through type-detection's own `exports` map, whose
runtime entries point into `dist/`. CI runs Test before Build, so every test file in this
package failed on a fresh checkout with `Failed to resolve entry for package`. It had
passed locally throughout, on a `dist/` left over from an earlier build.

type-detection's own suites never exposed this: they import via `#index`, which resolves
to source.

**Decision.** A consuming package aliases the specifier to source in `test.alias`,
targeting the other package's curated public entry (`src/public.js`), matched by an exact
regex. Build configuration is untouched — `test.alias` is vitest-only, and the build
continues to treat the dependency as external.

**Rationale.**

- **Unit tests test source.** Coupling them to build output makes a broken build block all
  test feedback and leaves `pnpm clean && pnpm test` broken. Artifact correctness already
  has gates that run after the build: `pack:check` and `check:publish`.
- **`public.js` rather than `index.js` buys enforcement.** #085 curated the public
  surface, but nothing verified across a package boundary that consumers stay inside it.
  Aliasing to the public entry makes every cross-package import prove exactly that — an
  import of an `@internal` symbol now fails to resolve in tests.
- **The regex must be exact.** A bare string alias also rewrites subpath specifiers
  (`@species-js/type-detection/foo`), silently redirecting imports the package does not
  make.

**Alternatives.** Reordering CI to Build-before-Test fixes the failure in one line and
tests the real artifact, but it is slower, makes a broken build block all test feedback,
and fixes only CI — the local `pnpm clean` footgun remains.

**Consequences.** Every future consuming package needs the same alias; at the second one
it belongs in the shared vite factory (SCAFFOLD, "Per-package vite configs are
self-contained"). Tests no longer exercise the published resolution path, which stays with
`pack:check` and `check:publish`. Verified A/B with `dist/` moved aside: 233/233 with the
alias, total resolution failure without it (CI run 31165271378).
