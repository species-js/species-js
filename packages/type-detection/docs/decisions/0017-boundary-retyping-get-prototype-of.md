# 017 — Boundary-retyping at `@/config` for `getPrototypeOf`

**Date:** 2026-06-03

**Context.** `getPrototypeOf` is typed by lib.es5.d.ts as `(o: any) => any`. The `any`
return forced a `@typescript-eslint/no-unsafe-assignment` cascade at every consumer;
multiple call sites in `function.js` and `utility/index.js` were laundering the value
through `/** @type {unknown} */` and re-asserting.

**Decision.** Retype at the `@/config` boundary, mirroring the `toFunctionString`
precedent from decision #008. `typeof Object.getPrototypeOf` →
`(o: unknown) => object | null`.

**Rationale.** The spec-precise return is `object | null` (the `[[Prototype]]` slot of any
non-nullish object). The `unknown` parameter accepts what callers actually pass; the
runtime throw for `null` / `undefined` is a precondition not modeled in the type
(consistent with TypeScript's not modeling thrown errors elsewhere). The runtime `.js`
export stays the unwrapped native method.

**Consequences.** Two laundering casts eliminated in `function.js`
(`hasAsyncFunctionPrototypeSurface`) and `utility/index.js`
(`getNextAvailablePropertyDescriptor`, `getDefinedConstructor`). The pattern is now
codified as a settled ruling — any future cached primitive whose lib `any` propagates
downstream gets retyped at the boundary, not at the call sites. See also decision #008.
