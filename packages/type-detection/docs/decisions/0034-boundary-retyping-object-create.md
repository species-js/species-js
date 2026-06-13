# 034 — Boundary-retyping at `@/config` for `objectCreate`

**Date:** 2026-06-05

**Context.** `Object.create` is typed by `lib.es5.d.ts` as `any`-returning on both
overloads — `(o: object | null) => any` for the no-properties form and
`(o: object | null, properties: PropertyDescriptorMap & ThisType<any>) => any` for the
property-bearing form. The `any` return propagates
`@typescript-eslint/no-unsafe-assignment` cascades at every consumer that captures the
result for a sentinel or lookup-table object. During the error-migration debugging round,
the original equip-js implementation used `objectCreate(null)` to construct a
blank-descriptor sentinel; the `any` return propagated through several intermediate casts
and lit up the cascade across `error.js`.

**Decision.** Retype the cached primitive at `@/config` to overload-precise return types,
mirroring the precedents from #008 (`toFunctionString`), #017 (`getPrototypeOf`), and #026
(the three `Number.isXxx` predicates). `objectCreate(null)` yields
`Record<PropertyKey, never>` — the prototype-less floor that `BlankType` in `@/utility`
carries. `objectCreate(prototype)` yields `object`. The two-argument form
`objectCreate(prototype | null, properties)` yields `object`, with `ThisType<unknown>`
replacing lib's `ThisType<any>` per the package's typing discipline. The runtime `.js`
export is unchanged — only the type narrows.

**Rationale.** Same lib-gap pattern as the prior boundary retypings. Call-site casts
launder the same `any` through the same shape over and over; retyping at the boundary
fixes it once. The three-overload form preserves spec semantics: `Object.create(null)`
produces an object with no prototype (structural floor = no keys), and the other forms
produce objects whose `[[Prototype]]` is the supplied prototype. The
`Record<PropertyKey, never>` choice for the no-prototype case is the strictest honest type
— TypeScript cannot express "no prototype chain" at the type level, but it can express "no
statically-known keys," which is the closest structural proxy and mirrors `BlankType` in
`@/utility` (used precisely as a blank-descriptor sentinel). The `ThisType<unknown>` swap
is independent and pedantic — `ThisType` only affects the inferred `this` context inside
descriptor methods, and the package's typing discipline prefers `unknown` over `any`
everywhere it can.

**Consequences.** Fourth instance of the boundary-retyping pattern, after #008
(`toFunctionString`), #017 (`getPrototypeOf`), and #026 (the three `Number.isXxx`
predicates). The pattern is now consistently applied to every cached `@/config` primitive
whose lib type would otherwise propagate `any` downstream. Discovered during the
error-migration debugging round — not during the function, thenable, or evented rounds —
which suggests there may be other cached primitives whose lib types deserve scrutiny. A
future sweep through `@/config` for remaining `any`-leaks is worth a pass. Codified in
[[design-rulings]] alongside the meta-observation about TS lib types being _conservative
simplifications_ that benefit from boundary closure.
