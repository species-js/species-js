# 063 — Own-level contract-shadow rejection in the strict identity predicates

**Date:** 2026-07-01

**Context.** #050 gave the strict identity predicates a two-axis dispatch; #054 / #061
lifted the cross-realm arm to structural prototype-equivalence; #028 rejects subclasses.
The local-realm fast-path decided a genuine direct instance by pure prototype-identity:
`prototype === eventTargetPrototype`. This admits `Object.create(EventTarget.prototype)` —
a value carrying the real base prototype but never constructed. The bare graft is benign
(it faithfully inherits an untampered contract), but a **tampered** graft is not:
`Object.create(EventTarget.prototype, { dispatchEvent: evil })` was admitted by
`isEventTarget` as `true` while its own `dispatchEvent` overrides the inherited method —
the object's OWN behavior is not `EventTarget` behavior. The object-round
"realm-asymmetry" ruling (#054-era, EVENTED Resolved #3) had accepted a related divergence
(local admits a tag-tampered graft, cross-realm rejects it) as "not reconciled." The
surfacing of the own-method-shadow case reopened whether the fast-path should stay purely
identity-based.

The decisive framing (user-led): own-level shadowing of the inherited contract is
**structurally the same** as subclassing — a subclass interposes `Sub.prototype` between
consumer and base contract, an own-property set interposes the same behavior-intercepting
layer, first in the lookup chain. It is an anonymous, instance-level subclass body. So if
#028 rejects a subclass as `is` → `Like`, the own-shadowed graft is equally not a
base-type reference.

**Decision.** The strict local fast-path ANDs an own-surface integrity gate onto its
prototype-identity check: `prototype === Xprototype && doesNotShadowXContract(value)`.
`doesNotShadowXContract` rejects a value that owns any name in a reserved denylist — the
members a genuine direct instance inherits and never owns:

- **EventTarget** — `constructor`, `dispatchEvent`, `addEventListener`,
  `removeEventListener`, `when`.
- **AbortSignal** — a **superset** (is-an EventTarget) ∪ `aborted`, `reason`, `onabort`,
  `throwIfAborted`.

Mechanism: `!getOwnPropertyNames(value).some(isValueOfBoundSet, denylist)` — a
string-keyed own-name enumeration against the denylist `Set` (via the new allocation-free
`@/utility` `this`-bound membership callback `isValueOfBoundSet`), wrapped
`try/catch → false` (throw-safe, fail-closed). `Symbol.toStringTag` is **deliberately
excluded**: it is a symbol-key (absent from `getOwnPropertyNames`) and cosmetic once
prototype-identity holds. `when` is included though NOT required by the presence-contract
(#028) — the shadow set is chosen by "what an own-override intercepts", which diverges
from the minimum "must-be-present" set.

**Scope constraint (load-bearing).** This applies ONLY to types whose ECMA-262 / WHATWG
spec pins the exact object-chain hierarchy — behavior bolted to described
prototype-levels, instance-state in internal slots — so a genuine direct instance **owns
none of its contract**. `EventTarget` / `AbortSignal` / `Promise` qualify; arbitrary user
classes do NOT (their instances own methods/fields by design, so "owns a contract member =
tamper" is false there). The invariant "inherit your whole contract, own none of it" is a
property of spec-pinned architectures, not of objects in general.

**Rationale.** This is not integrity-checking bolted onto an identity-predicate — it is
the #028 `Like`/`is` distinction applied consistently to a lower layer of the
lookup-chain. The scalpel: it rejects own-shadowing of a **contract-member** (method /
accessor) or the `constructor` back-reference, NOT any own property — orthogonal own state
(`et.id = 5`) stays admitted, because the `[[Prototype]]` slot is the type-anchor and own
state is not; only overriding an inherited member intercepts behavior. Shadowing is
defined by KEY presence, not value-difference: a genuine instance owns none of these keys,
so presence itself is the anomaly (no need to compare an own method to the inherited one).
The check is inexpensive (O(own-property-count), genuine instances near-empty), throw-safe
by construction (existence-only `getOwnPropertyNames` + `Set.has`, never invokes a getter
— a hostile throwing own `aborted` getter is rejected on presence without triggering it),
and fail-closed. Verified: a genuine `new EventTarget()` / `AbortController().signal` /
`AbortSignal.timeout()` / `AbortSignal.any([])` owns ZERO keys → no false-negatives.

Relation to #052 (structural sealability): complementary, and the option for types #052
cannot seal. #052 seals a graft by INVOKING an inert slot-reader (proves liveness, catches
even the bare graft) but needs such an accessor — `Promise` and `EventTarget` lack a
usable one. The own-shadow gate needs no accessor (pure `hasOwn`-class read), so it
applies to `EventTarget` / `AbortSignal` / `Promise` — but is WEAKER: it catches own-level
disguise/override, NOT the bare graft (no liveness proof without invoking). The predicate
therefore guarantees identity + own-surface non-tampering, NOT functional viability.

**Consequences.** Refines the object-round realm-asymmetry ruling (EVENTED Resolved #3)
from "accept, don't reconcile" to a **split**: behavioral (method / constructor) tampering
is now rejected in BOTH realms (reconciled — the local arm agrees with the cross-realm
structural arm), while cosmetic **tag** tampering stays local-admit / cross-realm-reject
(retained by design — the gate reads string-keyed own names only). The surviving,
now-justified boundary: the bare graft is admitted (it interposes nothing — a faithful, if
hollow, base reference) and prototype-level tampering is trusted ("must trust something").

Two new `@internal` helpers per module surface: `doesNotShadowEventTargetContract`,
`doesNotShadowAbortSignalContract` (evented gate 16 → 18). One new `@internal` `@/utility`
export: `isValueOfBoundSet`. `EVENTED.spec.md` amended in place (surface, both composition
strings + Composition notes, the "Realm asymmetry" subsection) with new reject vectors
`isEventTarget/R5`,`R6` / `isAbortSignal/R5`,`R6` and helper specs `dNSET/*`, `dNSAS/*`
appended; frozen behavioral admits unchanged (the tag-spoof `A3` vector stays admit). The
pattern generalizes forward to `isPromise` and any future strict predicate over a
spec-pinned architecture (evaluate the denylist per type; `isPlainObject` is a different
case — objects own data by design, only the tag is shadowable there).

Builds on #028 (subclass rejection), #050 (two-axis dispatch), #052 (structural
sealability — the complementary slot-seal), #054 / #061 (cross-realm structural arm the
local gate now agrees with). Uses the new `@/utility` `isValueOfBoundSet`.

Commit: _pending_.
