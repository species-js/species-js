# @species-js/type-detection

[![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=type-detection)](https://app.codecov.io/gh/species-js/species-js/flags)

Runtime type detection with cross-realm safety for JavaScript values.

Part of the [species-js](https://github.com/species-js/species-js) monorepo — foundation
runtime type infrastructure.

## Install

```sh
pnpm add @species-js/type-detection
```

## Runtime support

Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+ — see the `browserslist` field in
`package.json`.

`engines.node` is `>=18`, the **consumer** floor (ADR #078). Precisely what that rests on:

- The published **UMD bundle is executed on Node 18 in CI**, with every behavioral probe
  run against it. That is a test, not an assertion.
- The **ESM and CJS builds are executed too, but not on Node 18.** Every push loads them
  and runs the same probes — on Node 22 across Ubuntu, macOS and Windows, and on
  **JavaScriptCore** through Bun. What is untested is Node 18 specifically: those builds
  resolve their dependency through a consumer’s own `node_modules`, which this repository
  cannot model there. For that one floor they rest on a scan of every emitted file for
  syntax past ES2020 — a regression guard over known markers, not a proof.
- **Node 22+ is the contributor floor**, not the consumer one. It is what you need to work
  on the monorepo.

## License

MIT — see [LICENSE](./LICENSE).
