# 101 — `@@throw-safe` parity is over the declared set (amends #076)

**Date:** 2026-09-10

**Enforced by:** `docs:sweep`

**Context.** #076 clause 2 states both-files parity as an **enumeration**: the `.js`
marked set may exceed the `.d.ts` one _"only by factory-internal runtime-branch methods"_,
and anything else is _"an incomplete state, not a variant"_.

`type-identity/src/index.js` marks five module-private helpers — `toReportableError`,
`getOwnPropertyDescriptorAsSafeResult`, `canOwnNameBeShaped`, `isES3Function` and
`isCustomClass` — none of which appears in `src/index.d.ts` in any form. Measured across
every marked pair in the workspace, that is the **only** divergence besides #073's
sanctioned `isValidWeakKey` one; every other pair is at exact parity. Under #076's wording
those five read as a defect.

They are not one. The marker is a promise about a **function**, and a function does not
stop making it by staying module-local. `TYPE-IDENTITY.spec.md` already rules the five
stay unexported and requires their branches to be reachable through the public entries, so
buying a `.d.ts` line by promoting them would contradict a settled decision in order to
satisfy a wording. The enumeration is what is wrong, not the source.

**Decision.**

1. **Parity is required over the DECLARED set, not over the marker count.** The `.d.ts`
   carries the marker on every declaration it has; the `.js` carries it on every function
   that makes the promise. The two must agree **exactly** on the marked exports.
2. **The `.js` may exceed the `.d.ts` by exactly those marked functions that have no
   declaration of their own.** Two shapes qualify, and they are the same case: a factory's
   runtime branches sharing one declaration (#073's `isValidWeakKey`, two branch methods
   against one declared export), and a module-private helper having none at all
   (type-identity's five). The rule now states the principle once instead of listing the
   instances, so a third shape needs no further ADR.
3. **A `.js`-only application of the marker to an EXPORTED function remains an incomplete
   state**, exactly as #076 said. That half is unchanged and is the half worth catching.
4. **The rule is checked, not stated.** `docs:sweep`'s `.js`/`.d.ts` parity check compares
   the two marked sets over every source pair in the workspace: the `.d.ts` marked set
   must equal the `.js` marked **export** set, marked non-exports are admitted unchecked,
   and a column-0 marker that binds to no declaration is an error rather than a silently
   shorter list.

**Rationale.**

- **An enumeration of exceptions ages badly; a principle does not.** #076's clause was
  written when exactly one exception existed, and it named that exception rather than the
  reason for it. The reason — a marker needs a declaration to sit on, and not every marked
  function has one — covers both known shapes and any future one.
- **The rule was held by nobody, which is why the drift was invisible.** `type-detection`
  hand-lists its marked set per module and parses no source at all;
  `function-introspection` parses exports only; `type-identity` parses both halves but
  compares them against its own declared lists, so it asserted its divergence rather than
  questioning it. Nothing compared the two dialects **across** packages, and the
  divergence surfaced only when someone ran a survey by hand.
- **Mechanizing beats restating.** The alternative — a paragraph in each package's
  architecture map — is three homes for one rule, all of which can rot independently. One
  check in a gate that already walks every source pair costs no per-package prose and
  cannot go stale without going red.

**Consequences.**

- #073 keeps the marker's **form and rationale**; #076 keeps its **scope**; this ADR
  refines #076's **parity clause**. The three-way split is unchanged otherwise.
- `type-identity/docs/architecture/README.md` documents the local application and cites
  this ADR. No other package gains prose — the check covers them.
- `scripts/sweep-docs.mjs` gains the comparison inside its existing `.js`/`.d.ts` parity
  check, deliberately **not** as a new numbered check: marker parity is declaration
  parity, and a sixth number would have to be carried in six homes.
- No source behavior changes. The five markers in `type-identity/src/index.js` stay
  exactly as they are; what changes is that they are now sanctioned and checked rather
  than tolerated and unexamined.
