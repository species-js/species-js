# 008 — Boundary-retyping at `@/config` for `toFunctionString`

**Date:** 2026-06-01

**Context.** `Function.prototype.toString` is typed by the TypeScript lib as
`(this: Function) => string`. Calling `toFunctionString.call(callable)` on a `Callable`
(the package's floor type) tripped `@typescript-eslint/no-unsafe-function-type` and forced
a cast at every consumer.

**Decision.** Retype the cached primitive at `@/config`:
`typeof Function.prototype.toString` → `(this: Callable) => string`. This encodes the
spec-required constraint (calling on a non-callable receiver throws `TypeError`).

**Rationale.** Call-site casts launder the same `any`/`Function` through the same shape
over and over and hide the actual lib gap. Retyping at the boundary fixes it once; every
consumer inherits the honest signature for free; and the `.d.ts` carries the rationale as
documentation. The runtime `.js` export stays the unwrapped native method — only the type
changes.

**Consequences.** First instance of the boundary-retyping pattern. Pattern recurs at
decision #017 for `getPrototypeOf`. Generalizes to: when a cached `@/config` primitive
forces a consumer-side cast cascade because of a lib `any`, retype at the boundary. Now
codified as a settled ruling.
