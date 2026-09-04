# @species-js/custom-namespace

[![codecov](https://codecov.io/gh/species-js/species-js/branch/main/graph/badge.svg?flag=custom-namespace)](https://app.codecov.io/gh/species-js/species-js/flags)

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

Its behavior is pinned by a frozen specification —
[`docs/spec/CUSTOM-NAMESPACE.spec.md`](./docs/spec/CUSTOM-NAMESPACE.spec.md) — and by the
contract suite derived from it, which asserts 53 of its 54 vectors. The one exclusion is a
type-level claim that cannot be reproduced without a real `interface` declaration, and the
spec records it as unverified rather than implying otherwise.

No npm release has been cut yet; the release chain of ADR #093 is decided and not
executed.

## License

MIT — see [LICENSE](./LICENSE).
