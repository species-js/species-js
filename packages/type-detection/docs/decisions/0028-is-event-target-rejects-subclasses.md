# 028 — `isEventTarget` / `isAbortSignal` reject subclasses by strict constructor-name equality

**Date:** 2026-06-04

**Context.** Native `EventTarget` has many DOM subclasses (`Element`, `Document`,
`Window`, `XMLHttpRequest`, `AudioNode`, etc.); `AbortSignal` is less commonly subclassed
but the language permits it. Both predicates' impls use
`getDefinedConstructorName(value) === '<name>'` as a marker. For a subclass instance, the
constructor name resolves to the subclass name (e.g. `'Element'`, `'Document'`), which
fails the strict equality.

**Decision.** `isEventTarget` and `isAbortSignal` reject subclasses, consistent with
`isPromise` (#023). The constructor-name check stays strict equality, not a
constructor-chain walk that would admit subclasses.

**Rationale.** Same posture as #023. Foundation-tier predicates benefit from conservative
narrowing — multiple cross-validating markers as bounded-cost insurance against
single-marker spoofing, and the strict identity marker rules out values that "look right"
structurally but carry a different class identity. The asymmetry is documented: the
Like-tier predicates (`isEventTargetLike`, `isAbortSignalLike`) accept subclasses via the
`instanceof` fast path; the strict-tier predicates do not.

**Consequences.** `isEventTarget(document)` returns `false`; subclass admission is the
caller's job via `isEventTargetLike`. The strict-vs-lenient asymmetry has been applied at
three lattice tips now (`isPromise`, `isEventTarget`, `isAbortSignal`), which makes the
pattern visible at the architectural layer
([`../architecture/thenable.md`](../architecture/thenable.md#conservative-narrowing-in-the-promise-domain)
"Conservative- narrowing in the Promise domain" subsection, and the analogous
[`../architecture/evented.md`](../architecture/evented.md#conservative-narrowing-in-the-eventtarget--abortsignal-domain)
section's subsection).
