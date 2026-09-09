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
- The **ESM and CJS builds are executed too, but not on Node 18.** Every push loads them
  and runs the same probes — on Node 22 across Ubuntu, macOS and Windows, and on
  **JavaScriptCore** through Bun. What is untested is Node 18 specifically: those builds
  resolve their dependency through a consumer’s own `node_modules`, which this repository
  cannot model there. For that one floor they rest on a scan of every emitted file for
  syntax past ES2020 — a regression guard over known markers, not a proof.
- **Node 22+ is the contributor floor**, not the consumer one. It is what you need to work
  on the monorepo.

## Engine behavior

`Function.prototype.toString` is implementation-defined for a bound function or a `Proxy`,
and this package reads it. Most of the surface is unaffected: the arrow and concise-method
predicates do not depend on that string, and `doesIndicateBoundFunction` reads only the
two marks ECMA-262 mandates, so it answers identically on every conforming engine.

One predicate deliberately does not. `doesStronglyIndicateBoundFunction` trades
portability for precision, and JavaScriptCore — Safari, and every browser on iOS — renders
a bound function's target name where V8 and SpiderMonkey render nothing. It is therefore
implemented twice and dispatched per realm, which leaves a consumer two things worth
knowing:

- **`hasJavaScriptCoreBindBehavior()` is exported** so you can tell which reading you are
  getting.
- On that engine the predicate additionally admits a **non-constructable built-in renamed
  to impersonate its own bound form**. There, such a value and a genuinely bound built-in
  agree on every readable channel, so no reading separates them. If that is inside your
  threat model, read `doesIndicateBoundFunction` and add your own check — its answer does
  not vary by engine.

None of this is inferred. The behavior is asserted by probes executed against the
published bundles in Chromium, Firefox and WebKit, and against the module builds on
JavaScriptCore.

## License

MIT — see [LICENSE](./LICENSE).
