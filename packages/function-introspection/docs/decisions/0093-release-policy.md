# 093 — Release policy: what is published, at which version, by whom

**Date:** 2026-08-12

**Context.** Two packages are ready to publish and nothing about the release has ever been
decided. Several settings that will shape the published contract were inherited from
defaults rather than chosen — most consequentially the dependency range, which nobody had
looked at. This ADR settles the policy before the first publish, because npm will not let
a version number be reused and a dependency range is expensive to tighten once consumers
exist.

**Decision.**

## 1. Dependency ranges publish as CARET, not exact

`workspace:^`, not `workspace:*`. Verified by packing both forms: `workspace:*` emits
`"@species-js/type-detection": "0.1.0"` — an exact pin — while `workspace:^` emits
`"^0.1.0"`.

An exact pin means a consumer of `function-introspection` cannot receive ANY
`type-detection` release, including a security patch, until a new `function-introspection`
version ships. It also invites two copies of `type-detection` in one install tree, which
for a cross-realm type library is not cosmetic: two copies mean two sets of realm-fixed
captures and two identity registries, and values would fail checks across the boundary.

On `0.x` the caret is already restrictive — `^0.1.0` admits `0.1.x` only — so this buys
patch propagation without the latitude a caret carries at `1.x`.

## 2. The first version is `0.1.0`

Not `1.0.0`. Q.005 and the `isCustomClass` / `isBuiltInClass` placement question are open
and could still move surface. `0.x` says "stable enough to build on, not frozen"; `1.0.0`
would commit us to major-version discipline for changes we may want within the month.

## 3. Packages version INDEPENDENTLY

`fixed: []` and `linked: []` stay empty. `fixed` would publish no-op versions of one
package whenever the other changed. Compatibility is carried by the dependency range plus
`updateInternalDependencies: "patch"`, which is where it belongs.

## 4. No prerelease channel

Straight to `latest`. Changesets' `pre enter` mode earns its ceremony when shielding
external consumers from an unstable surface; here the consumers are this project's own six
downstream repositories, and `0.x` already carries that signal.

## 5. The npm token is granular, scoped, and expiring

A granular access token scoped to `@species-js` with read+write and an expiry — not a
classic automation token, which is account-wide and immortal. The cost is that CI will
fail on the day it lapses, for a reason nobody will remember; see Consequences.

## 6. Each published version gets a GitHub Release

`createGithubReleases: true`, stated explicitly rather than left to the action's default.
The changelog is being generated anyway.

## 7. Releases stay CHANGESETS-AUTOMATED, and that is not the same as unattended

The recurring question is manual versus automated. It is a false split here — both
judgement calls remain human, and only the arithmetic is machine work:

| step                                             | who     |
| ------------------------------------------------ | ------- |
| decide a change warrants a release, and its bump | HUMAN   |
| compute bumps across interdependent packages     | machine |
| write changelog entries                          | machine |
| **decide to release** (merge the Version PR)     | HUMAN   |
| run `npm publish`                                | machine |

What is automated is exactly what rots by hand: with four packages and
`updateInternalDependencies: "patch"`, tracking which dependent needs bumping when
`type-detection` moves is bookkeeping that fails quietly. The "Version Packages" PR is a
real review gate — the exact versions and changelog are visible before anything ships.

## 8. NO missing-changeset gate — deliberately

`changeset status --since=<ref>` exits 1 when packages changed with no changeset pending
(verified). It is the shape of gate this repo likes, and it is refused anyway.

It counts a package as changed when ANY file beneath it changes, so a README or `docs/`
edit inside `packages/*` would demand a `changeset add --empty`. A single day of
documentation work produced a dozen such commits. That is recurring friction against a
risk already covered: a forgotten changeset shows up as the change missing from the
Version Packages PR, before publishing rather than after.

`scripts/check-ci-gate-coverage.mjs` states the test this fails — a guard that spends more
vigilance than it saves. Recorded here so the idea is not rediscovered as an oversight.

**Consequences.**

- **`src/` ships, and must.** `exports["."].types` points at `./src/public.d.ts`, so the
  hand-authored declarations travel in the tarball (62 `dist` files, 22 `src` files, ~432
  KB for type-detection). This looks like dead weight and is not: dropping `src` from
  `files` silently breaks types for every consumer.
- **`bootstrap-publish.yml` must be deleted after the first release**, and `publish:`
  re-enabled in `release.yml`. Leaving the bootstrap in place is a way to publish out of
  band, past the changesets version history.
- **The token expiry has no self-defence.** Nothing in the repository can warn about it;
  it needs a reminder held outside. This is the only part of the release chain that will
  fail for a reason the repository cannot explain.
- The `@changesets/changelog-github` generator now carries its required `repo` option.
  Without it `changeset version` throws — a latent failure that would have fired at the
  first real version bump and never before it.
