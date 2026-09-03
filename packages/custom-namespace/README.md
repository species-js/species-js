# @species-js/custom-namespace

Frozen, prototype-less namespace objects for grouping a module's exports behind one named
value.

Part of the [species-js](https://github.com/species-js/species-js) monorepo — foundation
runtime type infrastructure.

## Install

```sh
pnpm add @species-js/custom-namespace
```

## Runtime support

Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+ — see the `browserslist` field in
`package.json`. `engines.node` is `>=18`, the consumer floor (ADR #078); Node 22+ is the
contributor floor.

This package is **not published yet**, and its implementation carries no test suite beyond
an importability check, so none of the runtime claims the released packages make are
verified for it.

## License

MIT — see [LICENSE](./LICENSE).
