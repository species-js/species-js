# @species-js/type-identity

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

This package is **not published yet**. Its four built artifacts — node ESM, node CJS,
browser ESM and UMD — load and execute, but the gates that would keep that true skip a
`private` package: `smoke:check` and `browser:check` both do. So the floors above are
declared for this package rather than continuously verified, which the released packages
cannot say.

## License

MIT — see [LICENSE](./LICENSE).
