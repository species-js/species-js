# species-js

Foundation runtime type infrastructure for JavaScript. A monorepo of four small, focused
packages providing cross-realm type detection, function introspection, type identity, and
prototype-less namespaces.

## Packages

| Package                                                                   | Purpose                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`@species-js/type-detection`](./packages/type-detection)                 | Runtime type checking with cross-realm safety                                    |
| [`@species-js/function-introspection`](./packages/function-introspection) | Classification of JavaScript callables (class, generator, async, arrow, concise) |
| [`@species-js/type-identity`](./packages/type-identity)                   | Type branding, identity sealing, multi-layer validation pipelines                |
| [`@species-js/custom-domain`](./packages/custom-domain)                   | Prototype-less namespace objects for sealed method grouping                      |

All packages share the same runtime floor: Chrome 80+, Firefox 74+, Safari 13.1+, Edge
80+, Node 22+. See the `browserslist` field in each package's `package.json`.

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
pnpm run check:full     # everything above + build + pack:check (full CI mirror; slower)
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
