# 095 — No host-backed hardening tier: portability outranks sealing one graft (resolves Q.005)

**Date:** 2026-08-21

**Context.** Decision #052 established that `isPromise` cannot portably seal the
`Object.create(Promise.prototype)` graft: `Promise` exposes no inert internal-slot
accessor, so there is no side-effect-free `[[PromiseState]]` probe to mirror the boxed
primitives' `valueOf` seal. Q.005 has since asked whether an optional tier could use a
host primitive where one exists — Node's `util.types.isPromise` reads the slot directly —
and fall back to the structural predicate elsewhere.

The question sat open, "not scheduled", on premises none of which had been tested. All
three are now measured.

**1. The defect is real, and symmetric across realms.** `isPromise` admits the bare graft:

| value                              | `isPromise` | `isPromiseLike` |
| ---------------------------------- | ----------- | --------------- |
| local real promise                 | `true`      | `true`          |
| **local graft**                    | **`true`**  | `true`          |
| **foreign-realm graft** (`vm`)     | **`true`**  | `true`          |
| foreign `Promise.prototype` itself | `false`     | `true`          |
| foreign plain thenable             | `false`     | `false`         |

The local-realm arm and the structural arm carry the identical hole, so a Node-only fix
would repair one of two paths on one of N environments. A caller who trusts the verdict
gets `TypeError: Method Promise.prototype.then called on incompatible receiver` at
`.then()` or `await` — at the point of use, never at detection. `isPromise` itself invokes
zero user getters reaching that verdict, and a graft carrying accessor `then` /
`constructor` is already rejected (#063), so the exposure is the bare hollow value only.

**2. The host primitive would work.** `util.types.isPromise` rejects the graft, admits a
real promise, and does not touch a hostile `then` getter — spec-precise and side-effect
free, the same quality bar as native `Error.isError`.

**3. There is no portable substitute.** `Promise.resolve(x) === x` does discriminate
(`true` for a real promise, `false` for the graft) and was tested rather than assumed. It
is disqualified: it reads the `then` getter on a graft and the `constructor` getter on a
real promise, so it runs user code; it allocates on the reject path; and wrapping a graft
schedules a job that raised an **uncaught exception** in the probe. A predicate that can
crash the process on hostile input is not a candidate. #052's claim holds under
independent test.

**Decision. Decline the host-backed tier for `@species-js/type-detection`. Q.005 is
RESOLVED — decided, not deferred.**

**Rationale.**

- **The `isError` precedent does not transfer, and it is the strongest argument against
  this decision, so it is answered directly.** #082 binds native `Error.isError` as an
  internal accelerator, which looks like exactly what Q.005 proposes. The difference is
  the kind of native. `Error.isError` is **ECMA-262 (ES2025)**: every engine will ship it,
  so #082's branching accommodates uneven rollout and converges on uniform behaviour.
  `util.types.isPromise` is a **Node API with no standards track** — adopting it installs
  divergence permanently, with no version at which it resolves.
- **Portability is the package's contract, not a preference.** A predicate answering
  differently per environment produces defects that reproduce in half of them, inherited
  by six downstream packages that never chose the trade. `thenable.js` today contains zero
  environment probes; this decision keeps it that way.
- **The boundary is a contract, not a hole.** #052's principle — structural detection
  verifies _shape, not liveness_ — earns its keep by predicting which predicates can gain
  a slot-seal (`isMap`, `isSet`, `isDate`, `isWeakRef`, via inert accessors) and which
  cannot. Patching `isPromise` alone with a host escape hatch would break the principle to
  fix one instance of it.

**Consequences.**

- **Q.005 → RESOLVED.** With it, the last entry in `open-questions.md` closes.
- **The home is named, and declining forecloses nothing.** Anyone wanting the seal can
  layer the host check over this package in an opt-in downstream adapter, documented as
  deliberately divergent. The composition is unaffected by this decision.
- **Re-open trigger, with a precedent.** If a slot-reading promise predicate reaches the
  _language_ standards track, #082's pattern applies verbatim — capture, load-time probe,
  branch, structural fallback — and Q.005 returns as an implementation task, not a policy
  question.
- **The consequence is now documented where consumers read it.** `isPromise`'s `@example`
  already named the admission in both `.js` and `.d.ts`; what neither said is what a
  `true` costs. Both now state that the failure lands at `.then()` / `await` rather than
  at detection, and that the admission is realm-symmetric. `THENABLE.spec.md` needs no
  change: `isPromise/B2` already carries the verdict, the reasoning and the deferral
  pointer.
- **No code change.** No vector moves, no marked-set change, no surface change. The FROZEN
  spec stands as written.

**References.** Upholds #052 (structural sealability) and #063 (own-shadow gate);
contrasts with #082 (native as accelerator, where the native is a language standard).
`architecture/thenable.md`, `docs/decisions/open-questions.md` Q.005.
