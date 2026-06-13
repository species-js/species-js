# 019 — `CallableOrNewable` kept as speculative third-party-consumable surface

**Date:** 2026-06-03

**Context.** The `CallableOrNewable` interface in `function.d.ts` has no internal
consumer. It models a callable whose `[[Construct]]` may or may not be present (the `new`
signature is optional). The "don't design for hypothetical future requirements" discipline
argues for dropping it.

**Decision.** Keep it. The interface is exported as a documented type for third-party
consumers who genuinely need to model the call-only-or-also-constructor uncertainty as a
structural type.

**Rationale.** Type-detection is foundation-tier infrastructure. Downstream packages may
type APIs against `CallableOrNewable` even when type-detection itself does not narrow to
it. The interface costs nothing to ship; the conceptual space it covers (the union of pure
callability and optional constructibility) is honest. Removing it would force downstream
consumers to model the same shape ad-hoc.

**Consequences.** The IDE inspector's "Unused" flag on this interface is a known phantom —
not a signal to drop the symbol. The interface stays. If a future audit finds zero
adoption after extended downstream use, the decision can be revisited.
