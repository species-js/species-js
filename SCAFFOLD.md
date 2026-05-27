# Monorepo Scaffold — Configuration Rationale

This document records the design decisions behind the species-js monorepo configuration.
It serves as reference for contributors working in this project and as a blueprint when
stamping out future monorepos (`cadence-js`, `equip-js`, `cambium-js`, `talented-js`,
`modulate-js`, `inflect-js`).

## Contents

- [TypeScript configuration](#typescript-configuration)
- [Module system & runtime floor](#module-system--runtime-floor)
- [Build pipeline](#build-pipeline)
- [Per-package subdomain layout](#per-package-subdomain-layout)
- [Testing & coverage](#testing--coverage)
- [Linting & code quality](#linting--code-quality)
- [Documentation generation](#documentation-generation)
- [Cross-platform scripts](#cross-platform-scripts)
- [Git hooks](#git-hooks)
- [CI / CD pipeline](#ci--cd-pipeline)
- [Release management](#release-management)
- [Per-package publishing conventions](#per-package-publishing-conventions)
- [Governance & community files](#governance--community-files)

---

## TypeScript configuration

### No composite, no project references

Each package runs `tsc -p tsconfig.json` independently. There are no composite builds
(`tsc -b`) and no cross-package `references` in tsconfig files.

**Why:** this is a project of manually crafted `.js` and `.d.ts` pairs. Composite mode
requires tsc to emit declarations, which conflicts with `noEmit: true`. Since we already
author `.d.ts` files by hand, tsc has nothing useful to emit. Inter-package type
resolution works through pnpm workspace linking — TypeScript follows the `"types"` field
in each package's `package.json` to find the declarations via
`moduleResolution: "bundler"`.

### `strict: true` without redundant flags

The base tsconfig sets `strict: true` and nothing else that `strict` already enables.
Flags like `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
`strictPropertyInitialization`, `noImplicitAny`, and `noImplicitThis` are all implied by
`strict` and are not listed individually. Only flags that go _beyond_ `strict` appear
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, etc.).

`declaration` and `declarationMap` are not set — both are implied by `noEmit: true` and
would be vestigial.

### `baseUrl` deprecation (TS 6 → TS 7)

TS 6 deprecates `baseUrl` (removal in TS 7). The `@/*` path alias requires `baseUrl` +
`paths`. We suppress the deprecation via `ignoreDeprecations: "6.0"` in the base tsconfig.
This buys time until TS 7, at which point the migration path is Node subpath imports
(`"imports"` in `package.json` with `#` prefix) or dropping the alias in favour of
relative paths.

### Per-package tsconfig `files` array — load-bearing

Each package's `tsconfig.json` declares an explicit `files` array:

```json
"files": ["./src/index.js", "./src/index.d.ts"],
"include": ["src/**/*.js", "src/**/*.d.ts", "test/**/*.js", "vite.config.js"]
```

**Why this is required:** when `src/index.js` and `src/index.d.ts` share a basename and
both are matched by `include`, TypeScript treats the `.d.ts` as the authoritative type
source and **silently drops the `.js` from the program**. Verified via
`tsc -p tsconfig.json --listFiles --noEmit`. Consequences when this happens:

1. `// @ts-check` on `src/index.js` is inert — tsc never loads the file.
2. typescript-eslint's `parserOptions.project` rejects the file as "not found in any
   project", breaking type-aware lint on the entire implementation surface.

Listing the pair explicitly under `files` forces tsc to keep both as program roots. This
mirrors the pattern in the sibling `es-async-types` project. The `include` block still
matches everything else (extra modules under `src/`, tests, the vite config).

### No `tsconfig.source.json`

Earlier iterations had a separate tsconfig per package for source-only checking (excluding
test files). This was removed — it adds 4 files and 4 script entries for a benefit that
only materialises in very large single-package projects (e.g. es-async-types with 1340+
tests). In a monorepo with smaller, focused packages, `tsc -p tsconfig.json` checking
source + tests together is the right granularity.

### No empty root `tsconfig.json`

The repo intentionally has no `tsconfig.json` at the workspace root — only
`tsconfig.base.json` (shared compiler options, extended by every other config) and
`tsconfig.docs.json` (typedoc bootstrap, see below). An empty root file would do no useful
work: each package owns its own `tsconfig.json`, the typecheck pipeline iterates those
explicitly, and tools that ascend the filesystem looking for a tsconfig find the correct
per-package one. The earlier empty wrapper actively caused tooling friction (typedoc
bootstrap, ESLint project resolution) and has been removed.

### `tsconfig.docs.json` for typedoc bootstrap

typedoc loads a TypeScript program at startup _before_ it descends into per-package
processing. Without explicit configuration it picks up the closest `tsconfig.json` — which
used to be the intentionally empty root one — and tsc errored with
`TS18003: No inputs were found`.

The fix is a dedicated docs tsconfig:

```json
// tsconfig.docs.json
{
  "extends": "./tsconfig.base.json",
  "include": ["packages/*/src/**/*.d.ts"]
}
```

…and one field in the root `typedoc.json`:

```json
"tsconfig": "./tsconfig.docs.json",
```

The docs pipeline gets its own narrow program covering exactly the `.d.ts` contract
surface of every package.

**Alternative left on the table:** per-package `typedoc.json` files are the canonical
typedoc-monorepo pattern. The current single-file setup was chosen for simplicity (one
file instead of four) and is additive — per-package configs can be layered on later if
per-package customization is wanted.

---

## Module system & runtime floor

### Runtime floor: ES2020

All public build targets sit at ES2020: `tsconfig.base.json` declares `lib: ["ES2020", …]`
with `target: "ES2020"`, and the per-package vite configs target `es2020` for both the
browser ESM and UMD builds. The Node build uses `node22` since the project's own
`engines.node` is `>=22`.

**Why ES2020 and not higher:** species-js is the foundation of six downstream projects.
Every browser version the floor reaches compounds across the whole stack. ES2020 captures
`Symbol.toStringTag` (in ES2015 already), object spread/rest, optional chaining, and
nullish coalescing — everything a type-detection library actually needs — while reaching
back to Chrome 80 / Firefox 74 / Safari 13.1 / Edge 80 (all early 2020).

**Why not ES2022 (the `Object.hasOwn` floor):** `Object.hasOwn` is the only ES2022 API
worth wanting in this code, and it is pure sugar over
`Object.prototype.hasOwnProperty.call`. The older idiom —
`const hasOwn = Object.prototype.hasOwnProperty;` cached at module top, then
`hasOwn.call(o, k)` — is also the cross-realm-safer pattern (a foreign realm's
`Object.hasOwn` is a different function reference, same as its `hasOwnProperty`; caching
the reference fixes the realm at module init).

**Why the floor lives in `tsconfig.lib`, not just the bundler target:** esbuild lowers
**syntax** (rest/spread, classes, optional chaining, async/await) to the target level, but
it does **not** polyfill **APIs**. Setting only `build.target` would let `Object.hasOwn`
calls compile cleanly and then fail at runtime on browsers without it. Constraining
`tsconfig.lib` to ES2020 surfaces those API calls at typecheck time instead.

### `moduleDetection: "force"`

The base tsconfig sets `moduleDetection: "force"`, so every `.js` and `.ts` file is
unconditionally a module — no ambient-script fallback. This pairs cleanly with
`verbatimModuleSyntax: true` and eliminates the "did I forget an export?" class of
silent-script-mode bug.

**Caveat — does not apply to `.d.ts`:** TypeScript treats `.d.ts` files specially. A
declaration file with no imports/exports is interpreted as an _ambient_ declaration
(extending the global scope), and `moduleDetection: "force"` does not override that.
Therefore each `src/index.d.ts` placeholder still needs an explicit `export {};` to mark
it as a module. This is load-bearing — without it, consumers see
`TS2306: File is not a module` when importing the package.

### Browserslist per package

Each package declares its support matrix in its own `package.json` `browserslist` field,
making the floor visible at npm publish time. Root has no browserslist — no tooling at
root consumes it.

---

## Build pipeline

### Per-package vite configs are self-contained

Each package's `vite.config.js` contains the full build configuration (3 targets) and the
full test configuration (coverage thresholds, includes, environment). The root
`vitest.config.js` carries no coverage settings — it only orchestrates project discovery.

**Why — portability:** a package directory should be transplantable. If a package moves to
a different monorepo or becomes standalone, its vite config works without modification.

**Inflection point:** at four packages the duplication (~55 lines × 4) is acceptable. At
~6 packages a shared `vite.config.base.js` factory becomes worth the loss of
single-directory portability. Tracked in the scaffold-followups memory.

### Build targets per package

Three build targets per package, driven by `SPECIES_BUILD_TARGET`:

| Target    | Format(s) | Vite target | Minified      |
| --------- | --------- | ----------- | ------------- |
| `node`    | ESM + CJS | `node22`    | No            |
| `browser` | ESM       | `es2020`    | No            |
| `umd`     | UMD       | `es2020`    | Yes (esbuild) |

UMD is the only minified output. CDN consumers (`unpkg`, `jsdelivr`) want a small bundle;
downstream bundlers handling ESM will run their own minification.

### `cross-env` for env vars

Build scripts use `cross-env SPECIES_BUILD_TARGET=node vite build`. While macOS/Linux
handle inline env vars natively, Windows contributors would not. `cross-env` is a
zero-config, zero-risk dependency that removes the platform assumption.

---

## Per-package subdomain layout

Each package supports a multi-subdomain layout that scales from a single domain to many.
The shape:

```
packages/<package>/src/
├── index.{js,d.ts}              ← package barrel; curated re-exports
├── <simple-domain>.{js,d.ts}    ← subdomain as a file pair
└── <complex-domain>/            ← subdomain as a folder
    ├── index.{js,d.ts}          ← subdomain barrel
    ├── <sub-sub-a>.{js,d.ts}
    └── <sub-sub-b>.{js,d.ts}
```

Two structural choices per subdomain:

- **File pair** — `src/<name>.{js,d.ts}` — for subdomains whose surface fits naturally in
  one file.
- **Folder** — `src/<name>/index.{js,d.ts}` — for subdomains complex enough to warrant
  their own internal subdivisions.

A subdomain that starts as a file pair becomes a folder by moving the pair to
`<name>/index.*` and adding siblings. Only the `tsconfig.json` `files` array entries and
the `exports` map subpath target need updating; the public import path stays identical for
consumers.

### Three configs participate in the layout

1. **`tsconfig.json` `files` array** — every `.js`/`.d.ts` pair must be listed explicitly
   because of the basename-shadow behavior documented above under _TypeScript
   configuration_. Adding a subdomain costs two lines:

   ```json
   "files": [
     "./src/index.js",   "./src/index.d.ts",
     "./src/utility.js", "./src/utility.d.ts"
   ]
   ```

2. **`package.json` `exports` map** — each subdomain that should be reachable by external
   consumers gets its own subpath entry, mirroring the shape of `.`:

   ```json
   "exports": {
     ".":         { "types": "./src/index.d.ts",   "node": { … }, "browser": { … } },
     "./utility": { "types": "./src/utility.d.ts", "node": { … }, "browser": { … } }
   }
   ```

   Subdomains used only internally within the package can be omitted from `exports`; they
   remain importable via relative paths from sibling modules.

3. **`vite.config.js` multi-entry build** — `build.lib.entry` becomes an object keyed by
   output name. UMD stays single-entry (CDN consumers want one global, not many); ESM/CJS
   targets get every entry:

   ```js
   entry: isUmd
     ? { index: resolve(import.meta.dirname, 'src/index.js') }
     : {
         index:   resolve(import.meta.dirname, 'src/index.js'),
         utility: resolve(import.meta.dirname, 'src/utility.js'),
       },
   ```

   Each entry produces its own bundle in `dist/<target>/<name>.{js,cjs}`.

### Barrel content

The package-level `src/index.{js,d.ts}` is the curated public surface. It re-exports
whatever subset of subdomain exports should be reachable from the main package import:

```js
// packages/<package>/src/index.js — when subdomains have public surface
export { isError, isAbortError } from './error';
export { isFunction } from './function';
```

Subdomain barrels (`src/<name>/index.{js,d.ts}`) follow the same pattern for their own
internal sub-sub-modules. Consumers reach individual subdomains via the subpath export
rather than always going through the package barrel:

```js
import { isError } from '@species-js/type-detection'; // via barrel
import { getPrototypeOf } from '@species-js/type-detection/utility'; // via subpath
```

### Current adoption

Of the four packages, only `type-detection` currently uses the multi-subdomain layout —
with `utility` as the demonstration subdomain. The placeholder `utility.{js,d.ts}` pair
carries no implementation yet but exercises the full pipeline (tsconfig `files`, `exports`
map, vite multi-entry) end to end.

The other three packages (`function-introspection`, `type-identity`, `custom-domain`)
remain on the single-module shell and will adopt this layout when their domain surface
grows.

---

## Testing & coverage

### Per-package test scripts

Each package defines `test`, `test:coverage`, and `test:watch` even though the root
`vitest run` discovers all packages. The per-package scripts exist for the
`cd packages/x && pnpm test` developer workflow. They are ergonomic, not structural.

### Coverage owned per-package

Every coverage setting — `provider`, `include`, `reporter`, `thresholds` — lives in each
package's `vite.config.js`. The root `vitest.config.js` carries nothing about coverage; it
only declares `projects: ['packages/*/vite.config.js']` and lets vitest aggregate
per-project output.

This is a single source of truth: when running `pnpm run test:coverage` from root, vitest
applies each package's own configuration. If two packages ever need different thresholds
(mature vs. new), the divergence lives in exactly one place.

### `/// <reference types="vitest" />` removed

The triple-slash directive is unnecessary when `defineConfig` is imported from
`vitest/config` (not `vite`). The `vitest/config` export already carries the type
augmentations.

---

## Linting & code quality

### ESLint: type-aware strict config

The flat config layers `@eslint/js` recommended → typescript-eslint `strictTypeChecked` +
`stylisticTypeChecked` → `eslint-plugin-jsdoc` `recommended-typescript-flavor` →
`eslint-config-prettier`. Type-aware rules require
`parserOptions.project: ['./packages/*/tsconfig.json']` to load each per-package program;
the projectService-based auto-discovery was tried first but had brittle interactions with
the workspace layout.

`@typescript-eslint/no-explicit-any` lands at `error` automatically via
`strictTypeChecked` (the project's "`unknown` over `any`" rule).

### ESLint: TypeScript-flavored JSDoc

`eslint-plugin-jsdoc` is loaded via `flat/recommended-typescript-flavor`. The project
writes vanilla JS with TypeScript-style JSDoc (`@typedef` imports from `.d.ts`), and this
preset matches that dialect. Two side effects:

- `jsdoc/require-param-type` and `jsdoc/require-returns-type` are automatically off —
  types come from TypeScript declarations, not JSDoc strings.
- TS intrinsic types (`unknown`, `void`, `never`, etc.) are recognized without a manual
  `definedTypes` whitelist.

### ESLint: `.d.ts` coverage

A dedicated block targets `**/*.ts` and `**/*.d.ts` so project rules (consistent type
imports, no-explicit-any, etc.) apply to the contract surface. JSDoc-presence rules are
turned off for declaration files — `.d.ts` is the contract; JSDoc requirements belong on
the implementation.

### ESLint: test file overrides

Test files only relax JSDoc rules. Vitest globals (`describe`, `it`, `expect`, `vi`) are
not declared as ESLint globals because tests use explicit imports
(`import { describe, it, expect } from 'vitest'`).

### ESLint: root config files exempted from type-aware rules

`*.config.js`, `*.config.cjs`, `*.config.mjs` at the repo root use
`tseslint.configs.disableTypeChecked` — those files are not in any per-package tsconfig
and would otherwise trip the project parser.

### Commitlint scopes

`commitlint.config.cjs` extends `@commitlint/config-conventional` and adds a `scope-enum`
of eight allowed values:

```
type-detection | function-introspection | type-identity | custom-domain
ci | deps | scaffold | docs
```

Dropped during trimming: `release` (the changesets-generated "chore: version packages"
commit is scopeless and never needs a manual scope) and `deps-dev` (consolidated into
`deps` for both prod and dev dependency updates).

---

## Documentation generation

### typedoc + strict validation

`typedoc.json` uses `entryPointStrategy: "packages"` to walk each package independently,
with `tsconfig.docs.json` providing the TypeScript program bootstrap.

Validation flags are tightened:

```json
"validation": {
  "invalidLink": true,
  "notDocumented": true,
  "notExported": true,
  "rewrittenLink": true
},
"treatWarningsAsErrors": true
```

This means typedoc will fail rather than warn if a `{@link X}` target is broken, an
exported declaration lacks a JSDoc comment, or a type is referenced but not exported.

**Two scripts so the validation is actually gated:**

- `pnpm run docs` — generates HTML to `docs/api/`. Used for publishing or local preview.
- `pnpm run docs:check` — runs typedoc with `--emit none`, so the validation rules fire
  without producing files. This is the script wired into `pnpm run check` and the CI "Docs
  check" step.

Without the `docs:check` variant, the strict validation flags would be configured but
dormant — typedoc would only run when someone manually invoked the docs build, and drift
would slip through CI silently. The two-script split is what makes the strict flags
actually load-bearing.

---

## Cross-platform scripts

### `clean` uses `node -e`

```json
"clean": "node -e \"import('node:fs').then(fs => { for (const d of ['dist', 'coverage']) fs.rmSync(d, { recursive: true, force: true }); })\""
```

Cleans both `dist/` and `coverage/`. Verbose but correct for cross-platform ESM packages
(`"type": "module"` prevents `require`). The alternative — `rm -rf dist coverage` — is
Unix-only, and adding a cross-platform `rm` package (e.g. `rimraf`) for a single line is
not justified.

The root `clean` script invokes the per-package cleans (`pnpm -r --sort run clean`) and
then removes the aggregate `coverage/` directory at repo root for the same reason.

---

## Git hooks

Three Husky hooks; each does one thing:

| Hook         | Command                       | Purpose                                        |
| ------------ | ----------------------------- | ---------------------------------------------- |
| `pre-commit` | `pnpm lint-staged`            | Format + lint staged files only                |
| `commit-msg` | `pnpm commitlint --edit "$1"` | Enforce conventional commits                   |
| `pre-push`   | `pnpm run check`              | Full safety net before code leaves the machine |

`pre-push` runs the canonical gate (`typecheck` + `lint` + `test`) so the local state
matches what CI will run remotely. Earlier the hook ran only `typecheck && test`; lint was
added during the trim pass when it was noted that `lint-staged` only sees staged files —
anything that escaped staging (e.g. via `--no-verify` once, or pre-existing bad state)
would never lint until CI failed.

---

## CI / CD pipeline

### Two workflows

- **`ci.yml`** — runs on push to `main` and on every PR targeting `main`. Cross-OS matrix
  (Ubuntu, macOS, Windows), full pipeline per OS.
- **`release.yml`** — runs on push to `main` only. Uses `changesets/action` to either open
  a "Version Packages" PR or publish queued versions to npm with provenance attestation.
  `concurrency.cancel-in-progress: false` — release jobs must not be cancelled
  mid-publish.

### OS matrix (Ubuntu / macOS / Windows)

CI runs the full pipeline on all three OSes with `fail-fast: false`. This earns its keep
specifically because the project uses `cross-env` and `node -e` cross-platform helpers —
running on Windows in CI is what proves those abstractions actually work.

Steps gated to `ubuntu-latest` for cost: the supply-chain audit, coverage upload, and the
`npm pack --dry-run` verification. Their results don't vary by OS.

### Supply-chain audit

A `pnpm audit --prod --audit-level high` step runs on Ubuntu. The `--audit-level high`
threshold is enterprise-appropriate — CI doesn't fail on every low/moderate finding, but a
high or critical advisory blocks the PR.

### Coverage upload

`actions/upload-artifact@v4` (SHA-pinned) collects `coverage/` from root and each package,
retains for 14 days, on Ubuntu only. This avoids a third-party signup (Codecov, Coveralls)
while still providing trend visibility on demand.

### `npm pack --dry-run` verification

After the build, a `pnpm -r exec npm pack --dry-run` step on Ubuntu verifies the exact
tarball contents of every package (LICENSE, README, dist, src files). Catches "I forgot to
add this to `files`" and similar publish-time surprises _before_ a real publish.

### Actions pinned to SHA + Dependabot

All third-party actions are pinned to commit SHAs with version annotations:

```yaml
uses: actions/checkout@eef61447b9ff4aafe5dcd4e0bbf5d482be7e7871 # v4.2.1
```

This is the enterprise security posture (immutable references, cannot be hijacked by a
force-pushed tag). Dependabot keeps the SHAs current via grouped weekly PRs in
`.github/dependabot.yml` (`github-actions` ecosystem).

The same dependabot config also handles `npm` updates, grouped by prod-deps / dev-deps,
weekly.

### Single command name: `check`

The root provides `check`
(`typecheck + lint + format:check + docs:check + audit + test:coverage`) as the single
validation command. It runs the exact same gating steps CI runs, in the same order, so
"passes locally" implies "passes CI" for every gating step. There is no `validate` alias.
One name, one purpose.

The composition is deliberately maintained as a strict superset of CI's gating sequence:

| Step            | What it catches                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `typecheck`     | Type errors across every package                                                                |
| `lint`          | Style/correctness rules (type-aware via typescript-eslint)                                      |
| `format:check`  | Prettier drift (files committed with `--no-verify` or written outside Git)                      |
| `docs:check`    | typedoc strict validation — broken `{@link}`, undocumented exports, unexported referenced types |
| `audit`         | Supply-chain vulnerabilities (prod deps, high+ severity)                                        |
| `test:coverage` | Test failures **and** per-package coverage threshold violations                                 |

CI invokes the same underlying scripts individually for clearer step-level reporting;
locally, `pnpm run check` is the daily driver. The pre-push Husky hook also calls
`pnpm run check`, so anything that escaped earlier hooks (e.g. `--no-verify` commits,
files written outside the normal Git workflow) is caught before code leaves the machine.

### `check:full` — the "really sure" command

Two CI-gating steps are deliberately left out of `check` to keep the inner loop fast:

- `build` — three targets per package; cumulative cost grows with package count.
- `pack:check` — runs `npm pack --dry-run` on every package; depends on `build` having
  produced `dist/` first.

For those moments when you want a complete local mirror of CI (e.g. before opening a PR
that touches build configuration, the `files` field of any package, or any
`vite.config.js`), there's `pnpm run check:full`:

```
check:full = check + build + pack:check
```

Same scripts CI runs, same order, locally. The cost is meaningfully higher (the twelve
sub-builds dominate) which is why it's not the default — but for the rare "please don't be
a CI surprise" moment, it's the one command. The regular `check` stays the fast inner-loop
default.

---

## Release management

### Changesets

Packages are versioned and published via `@changesets/cli`:

1. Developer runs `pnpm changeset` to declare version intent per package.
2. A `.changeset/*.md` file is committed with the PR.
3. On merge to main, the release workflow opens a "Version Packages" PR that bumps
   versions and generates per-package changelogs.
4. When the version PR is merged, packages are published to npm with provenance
   attestation.

**Why Changesets over release-please:** inter-package dependencies require granular
control. When `@species-js/type-detection` ships a breaking change, changesets
automatically bumps the dependency ranges in `function-introspection`, `type-identity`,
and `custom-domain`. The `updateInternalDependencies: "patch"` setting in
`.changeset/config.json` controls the cascade granularity.

**Why not fixed versioning:** packages version independently. A patch to `type-detection`
should not force a version bump on `custom-domain` if `custom-domain` is unaffected.

### `prepublishOnly` per package

Each package's `package.json` declares `"prepublishOnly": "pnpm run build"`. This runs
_only_ on `npm publish` / `pnpm publish`, not on install or pack. It's a publish-time
safety net:

- Defends against accidental local publishes (`cd packages/X && pnpm publish` without
  prior build still rebuilds).
- Defends against `dist/` corruption between the workflow's build step and its publish
  step.

The cost (~30–60s per release for redundant rebuilds in CI) is worth the defensive
posture.

### npm publish with provenance

The release workflow publishes with **automatic Sigstore provenance attestation** — no
explicit `--provenance` flag is passed to `changeset publish`. `@changesets/cli` does not
accept that flag (its surface is `[--tag <name>] [--otp <code>] [--no-git-tag]`);
attempting to pass it breaks the publish step. Provenance auto-enables when three
conditions hold simultaneously in the workflow environment:

1. `id-token: write` is granted in the workflow's `permissions` block (it is).
2. `"access": "public"` is set in `.changeset/config.json` (it is).
3. npm ≥9.5 is the publishing client (the `changesets/action` runner uses a recent npm).

When all three line up, npm emits the Sigstore attestation proving the package was built
in GitHub Actions, not on a local machine. Consumers verify via `npm audit signatures`.

---

## Per-package publishing conventions

### LICENSE per package

Each package ships its own copy of the project's MIT `LICENSE`. `npm pack` only includes
files at the _package_ root — the repo-root LICENSE would not make it into the tarball.

### README per package

Each package has its own `README.md` covering install, runtime support, and license. This
is what npm.com displays on the package landing page.

### `sideEffects: false`

Every package's `package.json` declares `"sideEffects": false`. Combined with the
ESM-first export map, this lets downstream bundlers (consumers') tree-shake unused
exports. species-js is a pure type-detection library — no module-init side effects — so
this is the textbook case.

### Exports map shape

Each package's `exports` field defines `node` (ESM + CJS), `browser` (ESM only), and
`default` (ESM) conditions, with a `types` pointer to the `.d.ts`. The `unpkg` and
`jsdelivr` fields point at the minified UMD for CDN-style consumers.

### Engine + package-manager pinning

The root `package.json` carries `engines.node: ">=22.0.0"` (matched by `.nvmrc`) and
`engines.pnpm: ">=10.0.0"`. The Corepack-managed `packageManager` field pins
`pnpm@10.11.0` exactly. Together these give clear feedback paths to consumers using plain
npm, plain pnpm, or Corepack.

---

## Governance & community files

### `SECURITY.md` → GitHub Security Advisories

Vulnerability reports route to the repo's Security Advisories form, not an email address.
This is the modern best practice — private disclosure, structured acknowledgement timeline
(72h), no shared inbox to maintain.

### `CONTRIBUTING.md`

Covers prerequisites, dev loop (`pnpm run check`), commit conventions, the changeset
workflow, and the release process. References `CLAUDE.md` and `SCAFFOLD.md` for deeper
material rather than duplicating.

### `CODE_OF_CONDUCT.md` — reference-style

Adopts Contributor Covenant 2.1 by URL reference rather than inlining the full text. Two
reasons: (1) the file stays in sync with any clarifications the upstream publishes, (2)
some content filters and tooling pattern-match unfavourably on the verbatim Covenant text,
which is paradoxically a _condemnation_ of the behaviours it enumerates. Reporting
contact: `peter.seliger@googlemail.com`.

### `CODEOWNERS`

`.github/CODEOWNERS` routes all reviews to `@petsel` (npm scope + GitHub handle). Single
owner is correct for the current solo-maintainer state; team-based ownership patterns can
be added when contributors arrive.

### Issue and PR templates

- `.github/ISSUE_TEMPLATE/config.yml` — disables blank issues, routes security to the
  advisory form.
- `.github/ISSUE_TEMPLATE/bug_report.yml` — structured YAML form requiring affected
  package, version, expected vs. actual, reproduction, environment.
- `.github/ISSUE_TEMPLATE/feature_request.yml` — YAML form for target package, the
  user-visible problem, proposed API, alternatives considered.
- `.github/pull_request_template.md` — checklist for `pnpm run check`, changeset presence,
  tests, JSDoc/declaration updates.
