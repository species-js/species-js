# @species-js/type-identity

[![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=type-identity)](https://app.codecov.io/gh/species-js/species-js/flags)

Type branding and tamper-resistant type identity for JavaScript types.

Part of the [species-js](https://github.com/species-js/species-js) monorepo — foundation
runtime type infrastructure.

## Install

```sh
pnpm add @species-js/type-identity
```

## Runtime support

Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+ — see the `browserslist` field in
`package.json`. `engines.node` is `>=18`, the consumer floor (ADR #078); Node 22+ is the
contributor floor.

Its behavior is pinned by a frozen specification —
[`docs/spec/TYPE-IDENTITY.spec.md`](./docs/spec/TYPE-IDENTITY.spec.md) — and by the
contract suite derived from it, which asserts all 116 of its vectors: the runtime ones
under `vitest`, and the ten type-level ones under `tsc`, which fails the package's
typecheck if any of them stops holding. A further suite holds the two to each other, so a
vector added to the spec without a test — or cited by a test without a vector — turns the
run red.

No npm release has been cut yet; the release chain of ADR #093 is decided and not
executed.

## License

MIT — see [LICENSE](./LICENSE).
