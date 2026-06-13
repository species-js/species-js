# 010 — Conservative-narrowing posture for shape predicates

**Date:** 2026-06-02

**Context.** The fingerprint matrix from decision #009 collapsed the necessary
discrimination into a small floor: for the async family, `[[Class]]` tag + absence of own
`prototype` would suffice; for the generator families, the `[[Class]]` tag alone. The
temptation was to drop the redundant markers (Proxy `[[Construct]]` probe,
constructor-name walk, proto-side checks) as superfluous.

**Decision.** Keep the redundant markers. Foundation-tier code shared across six
downstream packages should not trust spec invariants to hold _under all conditions_ when
verifying-in-line costs a bounded constant. The Proxy `[[Construct]]` probe and the
constructor-name walk are bounded-expense cross-validators against tag-spoofing edge
cases. A false admitting from a tag-spoofed value propagates structurally to every
downstream consumer; precision traded against constant-factor cost is the right principal
call for shared infrastructure.

**Rationale.** Two postures are defensible. _Minimal-floor_ trusts spec invariants and
uses the least expensive sufficient check. _Conservative-narrowing_ keeps multiple
cross-validating markers as bounded-cost insurance. Foundation-tier code earns the
conservative posture; leaf-level consumers can take the minimal floor. This package is
foundation-tier (shared infrastructure across `cadence-js`, `equip-js`, `cambium-js`,
`talented-js`, `modulate-js`, `inflect-js`), so the choice is principal-call, not
technical.

**Consequences.** The current shape predicates keep their full marker chains. The choice
is now documented in the schema artifact and in CLAUDE.md, so it does not get "optimized
away" by a future minimal-floor pass without a deliberate posture reconsideration.
