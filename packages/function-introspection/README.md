# @species-js/function-introspection

[![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=function-introspection)](https://app.codecov.io/gh/species-js/species-js/flags)

Classification of JavaScript callables — arrows, concise methods and bound functions —
each answered at the strength its evidence supports.

Part of the [species-js](https://github.com/species-js/species-js) monorepo — foundation
runtime type infrastructure.

## Install

```sh
pnpm add @species-js/function-introspection
```

## Runtime support

Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+ — see the `browserslist` field in
`package.json`.

`engines.node` is `>=18`, the **consumer** floor (ADR #078). Precisely what that rests on:

- The published **UMD bundle is executed on Node 18 in CI**, with every behavioral probe
  run against it. That is a test, not an assertion.
- The **ESM and CJS builds are not executed there.** They resolve their dependency through
  a consumer’s own `node_modules`, which this repository cannot model on Node 18. What
  guards them is a scan of every emitted file for syntax past the ES2020 floor — a
  regression guard over known markers, not a proof.
- **Node 22+ is the contributor floor**, not the consumer one. It is what you need to work
  on the monorepo.

## License

MIT — see [LICENSE](./LICENSE).
