# 101 — `@@throw-safe` parity is over the declared set (amends #076)

**Date:** 2026-09-10

**Enforced by:** `docs:sweep`

**Context.** #076 clause 2 lets the `.js` marked set exceed the `.d.ts` one _"only by
factory-internal runtime-branch methods"_ and calls anything else an incomplete state.
`type-identity/src/index.js` marks five module-private helpers with no `.d.ts` declaration
at all — the only divergence in the workspace besides #073's `isValidWeakKey` one. The
enumeration is what is wrong, not the source: a marker is a promise about a function, and
a function keeps making it while staying local. `TYPE-IDENTITY.spec.md` already rules the
five unexported, so promoting them to buy a declaration would trade a settled decision for
a wording.

**Decision.**

1. **Parity is owed over the DECLARED set.** The `.d.ts` marks every declaration it has;
   the `.js` marks every function that makes the promise. The two agree exactly on the
   marked exports.
2. **The `.js` may exceed the `.d.ts` by marked functions with no declaration of their
   own** — a factory's runtime branches sharing one declaration, or a module-private
   helper having none. One principle replaces the list of instances.
3. **A `.js`-only marker on an EXPORTED function stays an incomplete state**, as #076
   said.
4. **`docs:sweep` compares the two sets** on every source pair, inside its existing
   `.js`/`.d.ts` parity check rather than as a sixth numbered check.

**Rationale.** #076 named its one exception instead of the reason for it, so a second
shape read as a defect. The reason — a marker needs a declaration to sit on — covers both
known shapes and any future one. Mechanizing costs no per-package prose; restating would
need three architecture maps that rot independently.

**Consequences.**

- #073 keeps the marker's form, #076 its scope, this ADR its parity clause.
- `type-identity/docs/architecture/README.md` documents the local application. No other
  package gains prose.
- No source changes. The five markers stay, now sanctioned and checked.

**Trip condition.** Fold this back into plain parity if the `.d.ts` files ever become
generated — declarations would then exist for everything, and the admitted excess would
have no cause.
