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

**Addendum (2026-07-01) — the `EventTarget` method contract is scoped to the three
canonical WHATWG methods; `when()` deliberately excluded.** The Observable proposal (WICG
/ WHATWG DOM, ~2024) adds `EventTarget.prototype.when(type)`, returning an `Observable`
event stream. Both EventTarget contract checks — the Like-tier
`doesImplementEventTargetContract` (prototype-chain walk) and the strict-tier
`doesImplementEventTargetPrototypeContract` (own-descriptor read) — are deliberately
scoped to exactly `dispatchEvent`, `addEventListener`, and `removeEventListener`, and do
NOT require `when`.

Rationale: requiring `when` would falsely reject genuine `EventTarget`s from
pre-Observable runtimes, and from foreign realms produced by such runtimes — the contract
must track the stable WHATWG minimum, not the evolving frontier. And nothing is lost: both
checks verify _presence_ of the three, not an exact member set, so a `when`-bearing
`EventTarget.prototype` already passes (the modern-browser case). Same "minimum contract,
not exhaustive match" posture that keeps the checks forward- and backward-compatible.

Recorded in the JSDoc of both helpers (`.js` + `.d.ts`) and in `EVENTED.spec.md` (the
`dIETC` / `dIETPC` sections + vectors `dIETC/A4`, `dIETPC/A2`). No code change — the
checks already look at only the three.
