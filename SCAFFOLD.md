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

### Internal module resolution — `#`-subpath imports (no `baseUrl`)

Internal cross-module references use Node subpath imports — `#<module>` specifiers
declared in each package's `package.json` `imports` map, resolving to `src/` — rather than
a tsconfig `@/*` path alias (ADR #071). This needs neither `baseUrl` nor `paths`, so it
sidesteps the TS 6 `baseUrl` deprecation / TS 7 removal outright (the base tsconfig no
longer carries `ignoreDeprecations`). It also fixes delivery: the `imports` map ships
inside `package.json`, so the `#…` specifiers in the shipped `src/*.d.ts` resolve at a
consumer's compiler — whereas a `@/` alias, which lives only in this workspace's
tsconfig + vite, produced `TS2307` at every consumer. `moduleResolution: "bundler"` (base
tsconfig) reads the `imports` map; the scheme mirrors the public `exports` subpaths
(`#foo` internal ↔ `/foo` external).

### Per-package tsconfig — `.js`-only include, no `files` array

Each package's `tsconfig.json` includes `.js` files only and declares no `files` array:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "." },
  "include": ["src/**/*.js", "test/**/*.js", "vite.config.js"]
}
```

**Why exclude `.d.ts` from `include`:** when `src/foo.js` and `src/foo.d.ts` share a
basename and **both** are matched by `include`, TypeScript treats the `.d.ts` as the
authoritative type source and **silently drops the `.js` from the program**. The trap is
symmetric — by removing `.d.ts` from `include`, the dedup pass that would drop the `.js`
never runs. Consequences if you don't sidestep this:

1. `// @ts-check` on `src/foo.js` becomes inert — tsc never loads the file.
2. typescript-eslint's `parserOptions.project` rejects the file as "not found in any
   project", breaking type-aware lint on the entire implementation surface.

**How `.d.ts` files reach the program anyway:** TypeScript module resolution. When a `.js`
file imports `./foo`, tsc resolves to `src/foo.js`, then automatically looks for a sibling
`src/foo.d.ts` (or `src/foo/index.d.ts`) to use as that module's type declaration. The
`.d.ts` arrives as a referenced file (not a program root), and tsc cross-validates the
`.js` implementation against it. This works identically for sibling-pair (`foo.{js,d.ts}`)
and folder-barrel (`foo/index.{js,d.ts}`) forms.

**Why no `files` array:** the `.js`-only `include` glob already picks up every `.js` file
at any nesting depth — sibling pairs, folder barrels, sub-subdomains — without hitting the
basename-shadow trap. Adding a new subdomain requires **zero** tsconfig edits.

**Verified 2026-05-27** on `packages/type-detection` via `tsc --listFiles` (confirmed
`.js` files at all three nesting forms loaded), `pnpm run typecheck` (clean), and a
deliberate type-error injection in a brand-new `.js` file (tsc caught it at exact
line/column with `TS2322`). The same verification confirmed typescript-eslint's
`parserOptions.project` resolves correctly — previously-broken `config/index.js` lints
cleanly under the new rule.

**Edge case — orphan `.d.ts` files:** a `.d.ts` with no `.js` sibling and nothing
importing it is _not_ in the per-package program (it isn't matched by `include` and no
`.js` triggers sibling resolution). For documentation purposes this is fine — typedoc
still sees orphan `.d.ts` via `tsconfig.docs.json`'s separate include. But type-aware
ESLint _will_ fail to parse an orphan `.d.ts` with "file not found in any project". The
remedy: every `.d.ts` should have a matching `.js` sibling in the steady state.
Mid-migration stub `.d.ts` files awaiting deletion are the only routine exception.

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
`engines.node` is `>=22.11`.

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

**Inflection point:** at four packages the duplication (~85-100 lines × 4, up from ~55
before the manifest-derived threshold gate) is acceptable. At ~6 packages a shared
`vite.config.base.js` factory becomes worth the loss of single-directory portability.
Tracked in the scaffold-followups memory.

### Build targets per package

Three build targets per package, driven by `SPECIES_BUILD_TARGET`:

| Target    | Format(s) | Vite target | Minified      |
| --------- | --------- | ----------- | ------------- |
| `node`    | ESM + CJS | `node22`    | No            |
| `browser` | ESM       | `es2020`    | No            |
| `umd`     | UMD       | `es2020`    | Yes (esbuild) |

UMD is the only minified output. CDN consumers (`unpkg`, `jsdelivr`) want a small bundle;
downstream bundlers handling ESM will run their own minification.

### `emptyOutDir: true` — each target owns its own `dist/<target>`

Each target writes to `outDir: dist/${buildTarget}`, so the three directories are disjoint
and emptying one **cannot** reach its siblings. That was verified rather than assumed:
building only the `node` target with the flag on left `dist/browser` (24 files) and
`dist/umd` (2 files) byte-for-byte untouched, while `dist/node` shed 8 stale files and
kept all 18 entries.

The scaffold originally set `emptyOutDir: false` in all four packages — never revisited,
carrying no rationale, and overriding Vite's own default for an in-root `outDir`. Because
chunks are content-hashed, every build wrote a new hash and left the previous one behind:
`type-detection` had accumulated **six orphaned chunks, 157 kB**, some dating from three
weeks earlier and still exporting an API name that had since been renamed. Since
`package.json` declares `files: ["dist", "src"]`, all of it would have shipped in the
tarball.

Neither delivery-seam gate can see this. `entries:check` verifies `exports`-map parity and
`smoke:check` loads the artifacts that **are** referenced — an unreferenced file is
invisible to both. The flag is the fix; a gate would only mechanize a problem the default
removes.

Applied to all four packages at once, including the three where it cannot yet bite:
`function-introspection`, `type-identity` and `custom-namespace` emit no shared chunks
today, so they had zero orphans — which is exactly the shape a half-applied rule hides
behind.

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
`<name>/index.*` and adding siblings. Only the `exports` map subpath target needs
updating; tsconfig and vite pick up the new path automatically via their respective globs.
The public import path stays identical for consumers.

### Three configs participate in the layout

1. **`tsconfig.json` — automatic.** The `.js`-only `include` glob picks up every new `.js`
   file at any nesting depth (sibling pair, folder barrel, sub-subdomain) and TypeScript
   loads the matching `.d.ts` siblings through module resolution. No `files` array, no
   per-subdomain edits. See _TypeScript configuration_ → "Per-package tsconfig —
   `.js`-only include, no `files` array" for the full rationale.

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

Two of the four packages use the multi-subdomain layout. `type-detection` publishes eight
subpaths — `config`, `utility`, `function`, `primitive`, `error`, `object`, `evented`,
`thenable` — and `function-introspection` four: `utility`, `bound`, `arrow`, `concise`.
Both mix the two structural choices above, taking file pairs for the flat subdomains and
folders for `utility`; `type-detection` also folders `config` and `foundation`.

`custom-namespace` and `type-identity` remain single-module, each with one `.` export.
They will adopt the layout if their surface grows, and neither is waiting on anything to
do so.

**A subdomain is not automatically a published subpath.** `type-detection`'s `foundation`
is reachable internally as `#foundation` and stays out of its `exports` map, as does
`#config` in the three packages that are not `type-detection`. Publication is a separate
decision from layout — ADR #085 governs what the curated root exposes, and #097 the point
at which a package earns a barrel/`public` split at all.

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

This is a single source of truth: if two packages ever need different thresholds (mature
vs. new), the divergence lives in exactly one place.

**Thresholds are enforced only on PUBLISHED packages (2026-08-20).** Each config derives
`isPublished` from its own manifest and spreads the `thresholds` block in only when the
package is not `private` — the same `private`-gated rule `smoke:check` and `entries:check`
already apply to the delivery seam. A scaffold has no consumer to protect, and before it
has a surface there is nothing to measure: v8 scores 0/0 as 100%, so a threshold there
asserts nothing anyway. Coverage still runs and reports for private packages, so the
numbers stay visible while a package grows.

The rule was introduced because `type-identity` stopped being a scaffold in practice
before it stopped being one on paper — it gained ~53 statements of real implementation
against an eleven-line placeholder test, and the gate that had passed vacuously at 0/0
began failing the whole `check` chain at 7.54%.

**Trip condition — dropping `private` from a manifest.** That single edit restores the
workspace thresholds in full, and an untested surface fails the build from that commit on.
Verified by probe on 2026-08-20: removing `private` from `type-identity` flipped its
config from no-enforcement to the full 90/85/90/90 bar and its coverage run from exit 0 to
exit 1. The gate lifts itself rather than waiting to be remembered — which matters,
because the alternative (a hand-maintained exclusion list) is the shape that silently
dies.

**Why the root `test:coverage` fans out (`pnpm -r run test:coverage`) instead of running
vitest once.** Per-package coverage settings only take effect when vitest is invoked _from
the package directory_, with that package's `vite.config.js` as its own config root. Under
the root config's `projects:` discovery, vitest propagates `provider` / `include` /
`reporter` from each project — but **silently drops `thresholds`**, and widens the
measured file set beyond each project's `include`. A single root `vitest run --coverage`
therefore reports numbers polluted by test fixtures and never evaluates a threshold,
exiting 0 no matter how low coverage falls.

That is not a theoretical hazard — it was the live state until 2026-08-04. The thresholds
had been declared since the initial scaffold and had never once been evaluated, while the
inflated aggregate (test `__config.js` fixtures counted as product code) made real
coverage look far worse than it was. Measured properly, `type-detection` was already
**96.19 / 92.62 / 93.75 / 96.62** against a 90 / 85 / 90 / 90 bar.

Verified A/B, same single test file: from the package directory the run emits four
threshold ERRORs and fails; from the root under `projects:` it emits none and exits 0.
Fanning out with `pnpm -r` keeps the per-package ownership this section describes AND
makes the gate real — the two are not in tension, but only via the fan-out. Do not
"simplify" this back to a single root vitest invocation; doing so silently disables every
threshold in the monorepo.

Thresholds are **global (aggregate) per package**, not per file, which is what lets a few
deliberately-unreachable paths sit below the bar without special-casing. `config/index.js`
reads 50% branches/functions because its only function is the `hasOwn` polyfill behind
`objectHasOwn = typeof nativeHasOwn === 'function' ? nativeHasOwn : hasOwn` — dead on any
engine with the native. That is an env-unreachable fallback, not a coverage gap.

### Cross-package imports resolve to source in tests

A package that imports another workspace package **by name** cannot resolve it before a
build. The dependency is `workspace:*`, so pnpm symlinks it and resolution goes through
that package's `exports` map, whose runtime entries point into `dist/`. CI runs Test
before Build, so on a fresh checkout every test file fails with
`Failed to resolve entry for package`. It passes locally only while a stale `dist/`
happens to exist.

Each consuming package therefore aliases the specifier in its `vite.config.js`, under
`test.alias` — not top-level `resolve.alias`, which would also affect the build:

```js
alias: [
  {
    find: /^@species-js\/type-detection$/,
    replacement: resolve(import.meta.dirname, '../type-detection/src/public.js'),
  },
],
```

Two details are load-bearing. The **exact-match regex** prevents a bare string alias from
also rewriting subpath specifiers. The target is **`src/public.js`, not `src/index.js`**,
which makes every cross-package import prove it consumes only the curated public surface —
an import of an `@internal` symbol fails to resolve in tests. Rationale and the rejected
alternative (Build-before-Test): ADR #089.

**Trip condition — the second consuming package.** This alias is per-package duplication.
When a second package needs it, fold it into the shared vite factory described under
"Per-package vite configs are self-contained" instead of copying it a third time.

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

`@typescript-eslint/unbound-method` is turned **off** project-wide. Its premise — that
referencing a method without immediately calling it may lose `this` — is precisely the
codebase's intentional pattern: cross-realm-sensitive prototype methods are captured at
module load (`const toString = Object.prototype.toString`) and invoked via `.call(value)`
(see _Module system & runtime floor_ → cached prototype references, and CLAUDE.md). The
rule fights that load-bearing convention rather than catching real bugs here, so it is
disabled rather than worked around per call site.

### ESLint: TypeScript-flavored JSDoc

`eslint-plugin-jsdoc` is loaded via `flat/recommended-typescript-flavor`. The project
writes vanilla JS with TypeScript-style JSDoc (`@typedef` imports from `.d.ts`), and this
preset matches that dialect. Two side effects:

- `jsdoc/require-param-type` and `jsdoc/require-returns-type` stay **on** under this
  preset. Unlike the plain `typescript` preset, the _flavor_ preset assumes types live in
  JSDoc strings — correct for `.js`, where there is no TS signature to carry them. They
  are explicitly turned **off** for `.d.ts` in the declaration-file block below, where the
  native TS signature carries the type and JSDoc is description-only. Net effect: `.js`
  requires `@param {…}` / `@returns {…}` types; `.d.ts` uses description-only
  `@param name - …` / `@returns …`. This is the lint expression of the parallel-JSDoc
  convention (CLAUDE.md → "Types live where the file's syntax expects them").
- TS intrinsic types (`unknown`, `void`, `never`, etc.) are recognized without a manual
  `definedTypes` whitelist.
- `jsdoc/tag-lines` is relaxed project-wide to `['warn', 'any', { startLines: null }]`.
  The preset's default (no blank line after the block description, none between tags) is
  too tight for the readable JSDoc spacing used here and in es-async-types.
  `startLines: null` permits — but does not force — a blank line after the description,
  and `'any'` permits blank lines between tags, so both compact and spaced JSDoc blocks
  pass.

### ESLint: `.d.ts` coverage

A dedicated block targets `**/*.ts` and `**/*.d.ts` so project rules (consistent type
imports, no-explicit-any, etc.) apply to the contract surface. Several rule categories are
turned off there:

- **JSDoc-presence** (`require-jsdoc`, `require-param`, `require-returns`) — the
  parallel-JSDoc convention (CLAUDE.md → "Parallel JSDoc in `.js` and `.d.ts`") requires
  descriptions in both files, but that's enforced by audit discipline and typedoc's strict
  validation, not by ESLint flagging every declaration.
- **Inline JSDoc types** (`require-param-type`, `require-returns-type`) — in `.d.ts` the
  native TS signature carries the type; JSDoc is description-only. These belong on `.js`,
  not here (see the JSDoc section above).
- **`@typescript-eslint/prefer-function-type`** — the function-type hierarchy (`Callable`,
  `CallableOrNewable`, `VerifiedFunction`, …) uses call-signature interfaces for
  declaration-merging extensibility. A pure-call-signature interface is intentional, not a
  candidate for the function-type shorthand.
- **`no-undefined-types`, `check-tag-names`** — avoid false positives against the
  TS-native declaration surface.

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
type-detection | function-introspection | type-identity | custom-namespace
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

| Hook         | Command                                            | Purpose                                                    |
| ------------ | -------------------------------------------------- | ---------------------------------------------------------- |
| `pre-commit` | `pnpm run toolchain:check` then `pnpm lint-staged` | Fail on a stale toolchain, then format + lint staged files |
| `commit-msg` | `pnpm commitlint --edit "$1"`                      | Enforce conventional commits                               |
| `pre-push`   | `pnpm run check`                                   | Full safety net before code leaves the machine             |

`pre-push` runs the canonical gate — the full `check` chain tabulated under "The `check`
command" below, not merely typecheck and tests — so the local state matches what CI runs
remotely. Lint was added during the trim pass when it was noted that `lint-staged` only
sees staged files: anything that escaped staging (a `--no-verify` commit, or pre-existing
bad state) would never lint until CI failed.

`toolchain:check` runs at **pre-commit**, ahead of `lint-staged`, and not only inside the
pre-push `check`. Its purpose is to catch that local lint and format ran a different tool
version than the lockfile pins — and `lint-staged` IS that local run. Discovering the
drift at pre-push means a whole batch of commits has already been reformatted by the wrong
prettier, which is exactly the near-miss that motivated the script. It reads two files and
costs well under a second, so it earns a place on every commit.

---

## CI / CD pipeline

### Two workflows

- **`ci.yml`** — runs on push to `main` and on every PR targeting `main`. Cross-OS matrix
  (Ubuntu, macOS, Windows), full pipeline per OS.
- **`release.yml`** — runs on push to `main` only. Uses `changesets/action` to open
  "Version Packages" PRs from pending changesets. The `publish` input is **currently
  disabled** (see _Publish bootstrap_ below); when re-enabled, the same workflow publishes
  queued versions to npm with provenance attestation.
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
threshold is enterprise-appropriate — CI doesn't fail on every low or moderate finding.

**What this step can and cannot catch — read before trusting it.** An earlier version of
this section claimed "a high or critical advisory blocks the PR". That is **false**, and
the reason is structural rather than a misconfiguration: `--prod` scopes the audit to
production dependencies, and this monorepo has **none**. `type-detection` has no
dependencies at all; the other three depend only on `@species-js/type-detection` via
`workspace:*`; the root has none. So the audit walks an effectively empty tree and
**cannot go red for any advisory**. It is a near-vacuous gate, and it will stay that way
for as long as the packages ship with no runtime dependencies — which is a deliberate
property of this project, not an accident.

**This is an accepted standing inversion, not an oversight.** Keeping `--prod` is right
for a library whose consumers install zero transitive runtime code: a devDependency
advisory is a build-supply-chain concern, not something that reaches a consumer, and
failing every push on it would block work that cannot ship the vulnerability anyway. The
tripwire therefore **moves** rather than vanishing — it does not simply disappear, which
would make the inversion illegitimate.

Where it moves to, stated precisely, because the strength of this net is the whole
justification:

- **GitHub Dependabot alerts — enabled and verified firing.** A high-severity `fast-uri`
  advisory (scope: development) was reported on the default branch on 2026-08-04; the
  `--prod` audit was green at the same moment. Both were correct.
- **Weekly Dependabot version-update PRs — verified landing** (`.github/dependabot.yml`,
  npm ecosystem, separate `prod-deps` and `dev-deps` groups; PRs #18, #19, #21, #22
  merged). These carry dev dependencies forward on a schedule.
- **Dependabot automated security fixes — currently DISABLED**
  (`automated-security-fixes: {"enabled": false}`). This is the weak seam. A dev-dep
  advisory raises an alert but opens no fix PR, so remediation waits on a human reading
  the alert or on the weekly bump moving the parent incidentally.

**Trip conditions.** Revisit this inversion when either holds: (1) any package gains a
real external runtime dependency — `--prod` stops being vacuous and the gate becomes
load-bearing overnight; or (2) the reliance on human alert-reading proves unreliable, in
which case enable automated security fixes, or drop `--prod` and let the full tree gate.
Verify (1) by checking every package's `dependencies` for a non-`workspace:` entry.

### Coverage upload

`actions/upload-artifact@v4` (SHA-pinned) collects `coverage/` from root and each package,
retains for 14 days, on Ubuntu only. Since the root `test:coverage` fans out with
`pnpm -r` (see "Coverage owned per-package"), the reports are written per package and no
root `coverage/` is produced — the step keeps both paths with `if-no-files-found: warn`,
so the absent root directory is a no-op rather than a failure. This avoids a third-party
signup (Codecov, Coveralls) while still providing trend visibility on demand.

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
(`toolchain:check + gates:check + typecheck + lint + format:check + docs:sweep + docs:check + decisions:check + surface:check + entries:check + audit + test:coverage`)
as the single validation command. It is a **superset** of CI's gating sequence rather than
an exact match — `toolchain:check` is deliberately local-only (see its row below) — so
"passes locally" implies "passes CI" for every gating step, but not the reverse. There is
no `validate` alias. One name, one purpose.

That superset relation is no longer maintained by hand: `gates:check` enforces it, after a
gate once went unrun in CI for weeks (see its row).

| Step              | What it catches                                                                                                                                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toolchain:check` | Installed tool versions drifting from the lockfile CI installs. **Local-only** — a guaranteed no-op under CI's `--frozen-lockfile`. Also runs at pre-commit, where it can still prevent the drift rather than report it                                                                                           |
| `gates:check`     | A gate in `check` / `check:full` that nothing in CI invokes — so it passes locally while CI never runs it. Also a chain step naming a script that does not exist, which used to shrink the gate population while still passing (2026-09-04). One-directional by design; see the script header before extending it |
| `typecheck`       | Type errors across every package                                                                                                                                                                                                                                                                                  |
| `lint`            | Style/correctness rules (type-aware via typescript-eslint)                                                                                                                                                                                                                                                        |
| `format:check`    | Prettier drift (files written outside the normal Git workflow)                                                                                                                                                                                                                                                    |
| `docs:sweep`      | JSDoc hygiene (duplicate `@param`, dead `@typedef {import(…)}`) and `.js` exports missing from the sibling `.d.ts`. **Structural half only** — the claim sweep takes the round's old wording as arguments and is run by hand                                                                                      |
| `docs:check`      | typedoc strict validation — broken `{@link}`, undocumented exports, unexported referenced types                                                                                                                                                                                                                   |
| `decisions:check` | An ADR supersession with no reciprocal annotation at its target, leaving the target reading as current when it is not                                                                                                                                                                                             |
| `surface:check`   | A curated `src/public.{js,d.ts}` disagreeing with the `@internal` tagging it re-exports — a published internal, or a documented-public export no consumer can reach (#085)                                                                                                                                        |
| `entries:check`   | A published subpath resolving to a file the build never emits — `exports` ↔ legacy fields ↔ vite `lib.entry` drift, and #089's workspace-dependency pair. Static parity; artifact existence stays in `check:publish` (#091)                                                                                       |
| `audit`           | Advisories in **production** dependencies at high+ severity. Near-vacuous by construction here — read "Supply-chain audit" above before relying on it                                                                                                                                                             |
| `test:coverage`   | Test failures **and** per-package coverage threshold violations                                                                                                                                                                                                                                                   |

CI invokes the same underlying scripts individually for clearer step-level reporting;
locally, `pnpm run check` is the daily driver. The pre-push Husky hook also calls
`pnpm run check`, so anything that escaped earlier hooks (e.g. `--no-verify` commits,
files written outside the normal Git workflow) is caught before code leaves the machine.

#### The retired-wording ratchet — deferred work

`docs:sweep`'s claim sweep (check 4) cannot be automated: the phrases are the round's
changed wording, known only to whoever changed it. CI therefore runs the script bare, and
a green build asserts checks 1-3 and nothing about any claim. That leaves one standing gap
— **a wording retired in one round can creep back in a later one with nobody sweeping for
it**, because the only sweep that would catch it happened months earlier.

The fix is a checked-in list of retired wordings, mined from the commit history, swept on
every run. It is deferred, not declined. Two constraints it has to respect, both learned
already:

- **It is a ratchet, not a replacement.** Every entry is a wording deliberately taken out
  of service, so a reappearance is unambiguously wrong and the check can be a hard gate
  with no false positives. But it only guards claims already retired; the current round's
  wording is still swept by hand, per round, per claim.
- **The list file must be excluded from the sweep's own corpus** (`GENERATED_PATHS` in
  `scripts/sweep-docs.mjs`). A file of retired phrases is the purest form of the hazard
  the script header already records — a sweep tool that contains the strings it hunts
  reports itself forever.

A diff-derived variant was considered and rejected as a GATE: a removed prose line is an
old claim by definition, but the `.js`/`.d.ts` pair convention means the siblings
legitimately share phrasing, so a deliberate one-sided rewording would fire every time. It
could only ever be a non-blocking advisory, and a noisy advisory is ignored within a week.

### `check:full` — the "really sure" command

Four CI-gating steps are deliberately left out of `check` to keep the inner loop fast:

- `build` — three targets per package; cumulative cost grows with package count.
- `pack:check` — runs `npm pack --dry-run` on every package; depends on `build` having
  produced `dist/` first.
- `smoke:check` — loads and EXECUTES every artifact each publishable package promises,
  asserting its exports are present, correctly shaped and callable (#092). The only gate
  that runs built code; a missing `dist/` is an error, never a skip.
- `check:publish` — `attw` + `publint` on every package's packed output (the
  consumer-resolution / publish gate); likewise depends on `build`.

For those moments when you want a complete local mirror of CI (e.g. before opening a PR
that touches build configuration, the `files` field of any package, or any
`vite.config.js`), there's `pnpm run check:full`:

```
check:full = check + build + smoke:check + pack:check + check:publish
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
and `custom-namespace`. The `updateInternalDependencies: "patch"` setting in
`.changeset/config.json` controls the cascade granularity.

**Why not fixed versioning:** packages version independently. A patch to `type-detection`
should not force a version bump on `custom-namespace` if `custom-namespace` is unaffected.

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

### Publish bootstrap — why the publish script is currently disabled

`changesets/action` has a documented fallback behavior: when the publish script is set
**and** no pending changesets exist, it attempts to publish "any unpublished packages to
npm." On a fresh monorepo where no `@species-js/*` package has ever been pushed to the
registry, every such attempt fails with `E404 Not Found` (anonymous PUT against a missing
package name), and every release-workflow run goes red.

To keep the workflow's red/green signal meaningful before any real publish has happened,
the `publish-script:` input is commented out in `.github/workflows/release.yml`. The
workflow still runs `version-script:` on every push to `main` — opening a "Version
Packages" PR whenever pending changesets exist — but it never tries to publish.

**When to re-enable:**

1. The first real package version is ready (i.e. not the `0.0.0` placeholder).
2. The `NPM_TOKEN` repo secret is configured (Settings → Secrets and variables → Actions).
3. The first publish has been bootstrapped manually so at least one version of each
   `@species-js/*` package exists on the registry.

Then uncomment the `publish-script: pnpm changeset publish` line in `release.yml` and the
workflow takes over fully.

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

The root `package.json` carries `engines.node: ">=22.11"` (`.nvmrc` pins the 22 line,
whose current release satisfies it) and `engines.pnpm: ">=10.0.0"`. The Corepack-managed
`packageManager` field pins `pnpm@10.11.0` exactly. Together these give clear feedback
paths to consumers using plain npm, plain pnpm, or Corepack.

**Two floors, deliberately different (ADR #078).** The root value is the CONTRIBUTOR floor
— what you need to work on this repo, and enforced rather than advised, since `.npmrc`
sets `engine-strict=true`. Each package's own `engines.node: ">=18"` is the CONSUMER
floor, which the ES2020 API-floor design keeps genuinely runnable. Reading the root value
as the consumer contract is a mistake the split invites, so it is spelled out here: they
are not a drift to be reconciled.

The consumer floor is guarded rather than assumed. The node build target is `node22`, so
esbuild is permitted to emit syntax older runtimes cannot parse; `smoke:check` scans the
built output for post-ES2020 syntax so the floor cannot rot silently. That scan is a
REGRESSION guard over known markers, not a proof of compatibility — only running on the
target runtime proves that, which CI now does: a final ubuntu step re-runs the smoke gate
on **Node 18** against the UMD bundles (`SPECIES_SMOKE_ONLY=umd`). The UMD inlines every
dependency, so it needs no install — which is what makes the job possible at all, since
`engine-strict` plus the `>=22.11` contributor floor would refuse to install this
workspace there.

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
