# species-js

[![CI](https://github.com/species-js/species-js/actions/workflows/ci.yml/badge.svg)](https://github.com/species-js/species-js/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg)](https://codecov.io/gh/species-js/species-js)
[![License: MIT](https://img.shields.io/github/license/species-js/species-js)](./LICENSE)

Foundation runtime type infrastructure for JavaScript. A monorepo of four small, focused
packages providing cross-realm type detection, function introspection, type identity, and
prototype-less namespaces.

## Packages

| Package                                                                   | Purpose                                                                                               | Coverage                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@species-js/type-detection`](./packages/type-detection)                 | Runtime type checking with cross-realm safety                                                         | [![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=type-detection)](https://app.codecov.io/gh/species-js/species-js/flags)         |
| [`@species-js/function-introspection`](./packages/function-introspection) | Classification of JavaScript callables — bound functions, arrows, and concise methods in four flavors | [![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=function-introspection)](https://app.codecov.io/gh/species-js/species-js/flags) |
| [`@species-js/type-identity`](./packages/type-identity)                   | Type branding, identity sealing, multi-layer validation pipelines                                     | not yet published                                                                                                                                                        |
| [`@species-js/custom-namespace`](./packages/custom-namespace)             | Frozen prototype-less namespace objects grouping exports behind one named value                       | [![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=custom-namespace)](https://app.codecov.io/gh/species-js/species-js/flags)       |

All packages share the same browser floor: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+
— see the `browserslist` field in each package's `package.json`.

### Node support, stated precisely

Each published package declares `engines.node: ">=18"` — the **consumer** floor (ADR
#078). What actually stands behind it differs per artifact, so it is worth being exact
rather than reassuring:

| claim                                        | status                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The published **UMD bundles run on Node 18** | **Tested.** CI executes them on Node 18 and runs every behavioral probe against them. Because the dependency is inlined, that exercises both packages’ code.                                                                                                                        |
| The ESM and CJS builds run on Node 18        | **Guarded, not tested.** Every emitted file is scanned for syntax past the ES2020 floor. That is a regression guard over known markers, not a proof — those builds resolve their dependency through a consumer’s own `node_modules`, which this repository cannot model on Node 18. |
| Node 22+                                     | The **contributor** floor (root `engines.node`) — what you need to work on this repository. It is not what a consumer needs.                                                                                                                                                        |

## Status

Pre-release. APIs are being designed; no packages are published yet. The scaffold targets
enterprise-grade quality bars — cross-OS CI (Ubuntu, macOS, Windows), strict type-aware
lint, dependency audits, SHA-pinned actions, provenance-attested releases, and
Changesets-managed versioning.

## Install (when published)

```sh
pnpm add @species-js/<package>
```

## Development

```sh
pnpm install
pnpm run check          # typecheck + lint + format + docs + audit + test:coverage (the canonical gate)
pnpm run check:full     # everything above + build + pack:check + check:publish (full CI mirror; slower)
pnpm run docs           # generate typedoc HTML to docs/api
pnpm run build          # node + browser + umd targets for every package
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the development loop, commit conventions,
and release process. [`SCAFFOLD.md`](./SCAFFOLD.md) documents the configuration rationale
behind every tool in the repo. [`CLAUDE.md`](./CLAUDE.md) records the code conventions.

## Downstream

species-js is the foundation layer. Six downstream projects depend on it: `cadence-js`,
`equip-js`, `cambium-js`, `talented-js`, `modulate-js`, and `inflect-js`.

## License

MIT — see [`LICENSE`](./LICENSE).
