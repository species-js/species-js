# 003 — Three-species newable lattice

**Date:** 2026-06-01

**Context.** TypeScript types a plain `function` as call-only, so the runtime
`[[Construct]]` slot has to be asserted by the handwritten `.d.ts`. The question was how
to model the newable surface: as the union `ES3Function | ClassConstructor`, or as a
lenient base interface with strict refinements layered above.

**Decision.** `NewableFunction` is a lenient base interface, not the union. `ES3Function`
(writable own `prototype`) and `ClassConstructor` (read-only own `prototype`) are strict
refinements that reject bound variants. Bound newables remain in scope of
`NewableFunction` because `[[Construct]]` survives `bind`, but lose their own `prototype`
slot and therefore both strict refinements.

**Rationale.** The union would overpromise. Both branches carry an own `prototype` that
bound variants do not, so the union would be a stricter narrow target than the runtime
gate. A lenient base + strict refinements correctly models the actual lattice: three
runtime species (`ES3Function`, `ClassConstructor`, bound-newable) under one supertype,
with the package naming the two strict species and leaving "bound-newable" as the unnamed
third.

**Consequences.** The lattice asymmetry between newable and non-newable sides is then
forced by spec mechanics, not by design choice — see decision #005. `isNewableFunction` is
the lenient gate; `isES3Function` and `isClass` are the strict refinements.
`isCustomClass` and `isBuiltInClass` are further refinements of `isClass`.
