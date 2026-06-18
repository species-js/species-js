# 053 — Export the boxed-primitive realm-resolution helpers for single-realm testability

**Date:** 2026-06-18

**Context.** `primitive.js`'s boxed-primitive resolution machinery was split across two
visibility tiers. The five `[[XData]]` slot-probe equality helpers
(`doesHaveStrictUnboxedXValueEquality`) were exported `@internal` with parallel `.d.ts`
declarations (decision #042). But the helpers _above_ the slot probe were module-local
(unexported):

- `isCurrentRealmNativeString` / `isCurrentRealmNativeNumber` /
  `isCurrentRealmNativeBoolean` — the per-family current-realm identity discriminators
  (`value instanceof X && getPrototypeOf(value) === X.prototype`), shared by the
  per-family `isBoxedX` predicates and the umbrella hot-path.
- `resolvedViaES3NativePrimitiveTypesHotPaths` — the current-realm path of
  `isBoxedPrimitive`.
- `resolvedViaAlienRealmPrimitiveTypesEvaluation` — the alien-realm structural path of
  `isBoxedPrimitive`.

The `PRIMITIVE.spec.md` round (open item #2) surfaced that these resolution helpers are
crucial, carry distinct failure modes, and are only transitively covered. Most
importantly, the **alien-realm resolver's markers are realm-independent** — the
`[[Class]]` tag, the constructor-name walk, and the slot probe do not depend on the
value's realm of origin — so the cross-realm code path can be exercised with **local-realm
boxed values**, with no iframe / worker / `vm` realm. ADR #015 already set the precedent
(function sub-helpers exported with `.d.ts` so the cross-realm path is unit-testable in a
single realm), and the thenable module exported `isCurrentRealmPromiseInstance` for the
same reason.

**Decision.** Export the five realm-resolution helpers `@internal`, each with a parallel
`.d.ts` declaration under a new "Boxed-Primitive Realm-Resolution Helpers" section:
`isCurrentRealmNativeString`, `isCurrentRealmNativeNumber`, `isCurrentRealmNativeBoolean`,
`resolvedViaES3NativePrimitiveTypesHotPaths`,
`resolvedViaAlienRealmPrimitiveTypesEvaluation`.

Keep the two internal **data** structures module-local: the
`unboxedPrimitiveValueEvaluations` dispatch `Map` (exercised through
`resolvedViaAlienRealmPrimitiveTypesEvaluation`) and the `nonBoxableTypeSignatures` `Set`
(exercised through the public `isBoxablePrimitive`). Export logic with distinct failure
modes, not lookup tables.

**Rationale.**

- **Single-realm cross-realm coverage.** The alien-realm resolver _is_ the cross-realm
  path. Because its markers are realm-independent, feeding it local-realm boxed values
  (`new String('x')`, `Object(Symbol('y'))`, …) proves the cross-realm logic end-to-end
  without a foreign-realm harness. This is the same testability rationale as the
  orchestrator + helper pattern (decisions #006, #014, #015): the structural helper is the
  realm-independent path, so direct invocation tests it.
- **Distinct failure modes warrant isolated tests.** The current-realm trio carries the
  subclass-rejection-via-`proto-identity` logic — and notably _admits_ the
  `Object.create(X.prototype)` graft, leaving the slot probe to reject it downstream. Unit
  tests pin that division of labor precisely (the trio rejects subclasses; the slot probe
  rejects grafts), which the transitive-only coverage conflates. The two aggregators carry
  the two-path dispatch and the `Symbol` / `BigInt` factory-function carve-out (decision
  #049).
- **Consistency.** Aligns the primitive module with ADR #015 and the thenable precedent.
  Export-for-testability is the package norm for resolution sub-helpers; `@internal` keeps
  them out of the published typedoc surface while shipping them in the build, exactly like
  the existing equality helpers.

**Consequences.**

- Five new `@internal` exports + parallel `.d.ts` declarations. The re-confirmation gate
  is now 29 `.js` exports = 29 `.d.ts` declarations (19 public predicates + 5 equality
  helpers
  - 5 realm-resolution helpers).
- `PRIMITIVE.spec.md` open item #2 is resolved; axis-4 helper-spec vectors are added for
  all five (including the marquee `resolvedViaAlienRealmPrimitiveTypesEvaluation` vectors
  that run against local-realm boxed values).
- No runtime behavior change — the functions are unchanged; only their visibility.
- **Forward consistency:** `evented.js` keeps its `isCurrentRealmEventTargetInstance` /
  `isCurrentRealmAbortSignalInstance` helpers module-local. When the evented spec is
  written, the same decision should apply for parity (export the realm-resolution helpers
  for single-realm testability). Flagged here, not acted on.

Docs + visibility change; no runtime change. Typecheck and lint green.
