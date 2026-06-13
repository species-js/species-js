# 023 — `isPromise` rejects subclasses by strict constructor-name equality

**Date:** 2026-06-04

**Context.** `isPromise(v)` uses `getDefinedConstructorName(v) === 'Promise'` as its third
marker. For a value `new (class MyPromise extends Promise {})((res) => res(1))`, the
constructor name resolves to `'MyPromise'`, which fails the strict equality.

**Decision.** `isPromise` rejects `Promise` subclasses. The constructor-name check stays
strict equality, not a constructor-chain walk that would admit subclasses.

**Rationale.** Foundation-tier predicates that downstream packages depend on benefit from
conservative narrowing — multiple cross-validating markers as bounded-cost insurance
against single-marker spoofing. Admitting subclasses would broaden the predicate's
contract without a clear benefit; consumers who specifically want subclass admission can
compose `isPromise` with `instanceof Promise` or a constructor-chain walk at their level.
The asymmetry is documented: `isPromiseLike` accepts subclasses (via `instanceof`);
`isPromise` does not. Each tier has its own discrimination boundary; subclass rejection
lands at the strictest tier where it makes sense.

**Consequences.** Native `Promise` instances pass; subclasses of `Promise` fail
`isPromise`. Documented as "deliberate strictness" in the predicate's JSDoc. Consumers
needing subclass admission compose accordingly. See ARCHITECTURE.md § type-detection /
thenable conservative-narrowing subsection for the broader posture.
