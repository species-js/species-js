# 022 — `PromiseLike<T>` defined as richer than TypeScript's lib `PromiseLike`

**Date:** 2026-06-04

**Context.** The thenable migration needed a type for "anything Promise-shaped without
being a Promise instance" — the structural fallback that `isPromiseLike` narrows to.
TypeScript's lib has `PromiseLike<T>` already (in `lib.es5.d.ts`) but it is structurally
identical to our `Thenable<T>` (a single `then` method, nothing more).

**Decision.** Define a local `PromiseLike<T>` interface in `thenable.d.ts` that surpasses
the lib version on four dimensions:

1. Extends `Thenable<T>` with `catch` and `finally` to capture the full
   `Promise.prototype` method contract (ECMA-262 §27.2).
2. `out T` variance annotation, making the producer-only role explicit to TypeScript's
   variance checking.
3. `unknown` typing on rejection-channel reasons (the lib uses `any`, which leaks through
   every consumer).
4. No redundant `| undefined` on optional callbacks (the `?` already widens to
   `undefined`).

**Rationale.** The lib's `PromiseLike` is structurally identical to our `Thenable`. We
need a richer type for the middle tier of the lattice (something between `Thenable` and
`Promise`). Re-using the lib name with a richer structure is acceptable because the lib
version cannot express the chaining contract anyway — consumers reaching for "PromiseLike"
want the chaining surface; our definition gives them what they actually need. The variance
/ `unknown` / no-redundant-undefined precision wins follow the species-js precision
posture independently.

**Consequences.** Consumers of `@species-js/type-detection/thenable` get the richer
`PromiseLike`. The lib's `PromiseLike` still exists as a TypeScript global; the local
export shadows it within this module's imports. The lattice (`Thenable` → `PromiseLike` →
`Promise`) is captured in [`../architecture/thenable.md`](../architecture/thenable.md);
the type's own JSDoc captures the lib-surpass dimensions. Codified in [[design-rulings]]
via the contract-vocabulary ruling.
