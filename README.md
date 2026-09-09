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
| [`@species-js/type-identity`](./packages/type-identity)                   | Type branding and tamper-resistant type identity                                                      | not yet published                                                                                                                                                        |
| [`@species-js/custom-namespace`](./packages/custom-namespace)             | Frozen prototype-less namespace objects grouping exports behind one named value                       | [![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=custom-namespace)](https://app.codecov.io/gh/species-js/species-js/flags)       |

All packages share the same browser floor: Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+
— see the `browserslist` field in each package's `package.json`.

### Node support, stated precisely

Each published package declares `engines.node: ">=18"` — the **consumer** floor (ADR
#078). What actually stands behind it differs per artifact, so it is worth being exact
rather than reassuring:

| claim                                                  | status                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The published **UMD bundles run on Node 18**           | **Tested.** CI executes them on Node 18 and runs every behavioral probe against them. Because the dependency is inlined, that exercises both packages’ code.                                                                                                                                                                                                                                               |
| The ESM and CJS builds run on Node 18                  | **Executed, but not on 18.** Every push loads and probes them on Node 22 across all three operating systems, and on **JavaScriptCore** through Bun. Node 18 specifically is untested — those builds resolve their dependency through a consumer’s own `node_modules`, which this repository cannot model there — so for that floor alone they rest on a scan of every emitted file for syntax past ES2020. |
| The published code behaves the same **across engines** | **Tested on all three.** V8 and JavaScriptCore execute the module builds on every push (Node and Bun); Chromium, Firefox and WebKit execute the UMD bundles on a schedule, 120 probe runs in all. Where behavior is deliberately engine-relative, the probes assert that per engine rather than pretending it is uniform.                                                                                  |
| Node 22+                                               | The **contributor** floor (root `engines.node`) — what you need to work on this repository. It is not what a consumer needs.                                                                                                                                                                                                                                                                               |

## Status

Pre-release. APIs are being designed; no packages are published yet. The scaffold targets
enterprise-grade quality bars — cross-OS CI (Ubuntu, macOS, Windows), **execution on all
three JavaScript engines**, strict type-aware lint, dependency audits, SHA-pinned actions,
provenance-attested releases, and Changesets-managed versioning.

The engine coverage is worth one sentence more, because it is unusual and because these
packages read things the language leaves to the implementation. Every built artifact is
loaded and probed rather than merely scanned — V8, SpiderMonkey and JavaScriptCore, across
five runtimes: the module builds on Node and Bun on every push, the UMD bundles in
Chromium, Firefox and WebKit on a schedule. Where a predicate's answer is deliberately
engine-relative, the probes assert that per engine instead of pretending it is uniform.

## Install (when published)

```sh
pnpm add @species-js/<package>
```

## Development

```sh
pnpm install
pnpm run check          # the canonical gate: toolchain + CI-coverage + typecheck + lint +
                        # format + docs + ADR reciprocity + public surface + entry parity +
                        # audit + test:coverage
pnpm run check:full     # everything above + build + smoke + pack:check + check:publish
pnpm run docs           # generate typedoc HTML to docs/api
pnpm run build          # node + browser + umd targets for every package
```

Two gates sit in **neither** chain, because both need something a contributor's machine is
not required to have. CI runs them; `SCAFFOLD.md` explains why each is exempt.

```sh
pnpm run smoke:check:bun # the ESM/CJS builds on JavaScriptCore — needs build + bun
pnpm run browser:check   # the UMD bundles in Chromium/Firefox/WebKit — needs build + playwright
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the development loop, commit conventions,
and release process. [`SCAFFOLD.md`](./SCAFFOLD.md) documents the configuration rationale
behind every tool in the repo. [`CLAUDE.md`](./CLAUDE.md) records the code conventions.

## Downstream

species-js is the foundation layer. Six downstream projects depend on it: `cadence-js`,
`equip-js`, `cambium-js`, `talented-js`, `modulate-js`, and `inflect-js`.

## License

MIT — see [`LICENSE`](./LICENSE).
