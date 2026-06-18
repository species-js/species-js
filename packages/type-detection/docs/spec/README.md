# type-detection — behavioral specifications

This directory holds one **behavioral specification** per module. A spec is the
externalized, enumerable, vector-bearing form of the behavioral claims that already live
as prose inside the module's doc-comments. It is the bridge between the documentation
round (which verified that `.d.ts` ↔ `.js` ↔ runtime behavior all agree) and the test
round (which encodes that behavior as executable assertions).

The circle: **good docs → trustworthy spec → derived tests.** A spec is only trustworthy
because the documentation it distills was verified against the real implementation; the
documentation is only trustworthy because it was checked against the code. The spec
inherits that trust and makes it testable.

## What a spec is — and is not

- **IS** a per-module description of _observable behavior_: for each public predicate,
  what it **admits**, what it **rejects**, and what it deliberately **refuses to claim** —
  expressed as concrete value vectors, each with a spec reference and a one-line
  rationale.
- **IS** black-box and implementation-independent. It describes the contract, not the code
  that delivers it. Per CLAUDE.md: _tests derive from specification, not implementation._
- **IS NOT** a transcription of the `.js`, a restatement of the `.d.ts` types, or the test
  file itself.

## The multi-axis test model

A module's spec is the source of truth for **one** test axis. Full coverage of an
implemented module comes from several accompanying axes, each answering a different
question and drawing from a different source:

| Axis | Suite                         | Question it answers                                                    | Source of truth                                                                                   |
| ---- | ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | **Spec / contract**           | Does the public predicate honor its documented contract?               | `spec/<MODULE>.spec.md` (this directory)                                                          |
| 2    | **Cross-realm**               | Do the same claims hold for foreign-realm values (`vm`/iframe/worker)? | the spec's per-predicate _cross-realm expectation_, re-verified through the realm-fixture harness |
| 3    | **Adversarial / smart-alien** | Does it hold its _refuses-to-claim_ boundaries against spoofs?         | the spec's _boundary_ + _spoof-resistance_ vectors, exercised via alien-mock values               |
| 4    | **Helper-unit**               | Does each `@internal` helper do its isolated job?                      | the implementation's helper inventory (white-box)                                                 |
| 5    | **Coverage-completeness**     | Does every branch actually execute?                                    | the V8 coverage report, ratcheted                                                                 |

The load-bearing point: **axes 2 and 3 are still spec claims** — cross-realm independence
and spoof-resistance are behavioral guarantees, so the spec carries the _expectations_;
the harnesses are merely the _mechanism_ for exercising them. **Axis 4 is the one
genuinely implementation-derived suite** — it tests the orchestrator / helper / sub-helper
decomposition, and it is where the cross-realm code path gets unit coverage without an
iframe (the shape/contract helpers _are_ the cross-realm path). **Axis 5 is a gate, not an
authored suite.**

Each spec section is therefore tagged with the axis (or axes) its vectors feed, so the
test round knows which suite consumes it.

## Spec sources, in priority order

1. `src/<module>.d.ts` — canonical consumer contract (the claims).
2. `docs/architecture/<module>.md` — the discrimination model, the boundaries, the
   postures.
3. relevant ADRs in `docs/decisions/` — the rationale behind contested choices.
4. `src/<module>.js` — the **re-confirmation gate**, not a discovery source: the doc round
   aligned these, so any residual `doc ↔ impl` drift surfacing while writing the spec is a
   _bug to flag_, not a spec note.
5. the per-module false-positive inventory in the project memory (`state-snapshot` thread
   #2) — the known adversarial vectors.

## Vector notation

Every vector has a **stable ID** so tests can cite it: `<predicate>/<class><n>`, where the
class is `A` (admits), `R` (rejects), or `B` (boundary / refuses-to-claim). Example:
`isThenable/A1`, `isPromise/R3`, `isThenable/B1`. IDs are append-only — never renumber a
shipped vector; add a higher number or mark one withdrawn. A test asserting a vector
should reference the ID in its description so spec ↔ test traceability survives refactors.

Each vector reads as `input → expected — rationale`. Inputs are written as runnable
JavaScript expressions wherever possible; values that need construction (cross-realm,
alien) name the fixture instead.

## Per-module spec template

Each `<MODULE>.spec.md` follows this shape:

1. **Module contract** — one-paragraph purpose + the discrimination lattice (copied from
   the architecture doc's mental model so the spec stands alone).
2. **Surface inventory** — every public predicate, every exported `@internal` helper, and
   every exported type-without-predicate. Mechanical-completeness first (per the audit
   discipline): the list must be exhaustive before any vectors are written. Confirm each
   exported helper carries a parallel `.d.ts` declaration — exporting an `@internal`
   helper for the helper-unit axis obligates its type-declaration pair (CLAUDE.md's
   `@internal`-present-in-both-files rule). A helper exported from `.js` but undeclared in
   `.d.ts` is a `doc↔impl` gap to fix at the source, not to record as a spec note.
3. **Cross-cutting vectors** — inputs every predicate in the module must handle the same
   way (nullish, falsy primitives, the omitted argument). Stated once, referenced per
   predicate.
4. **Per-predicate specification** — for each public predicate: signature, spec basis,
   **Admits** / **Rejects** / **Refuses to claim** vector lists, **Cross-realm
   expectation** (axis 2), **Spoof-resistance expectation** (axis 3), **Composition note**
   (which helpers it drives → axis 4), and any **Policy flags** (open questions whose
   resolution would change a vector).
5. **Helper specification** — for each exported `@internal` helper: its isolated
   contract + vectors (axis 4).
6. **Open / resolved items** — spec-level questions surfaced while writing, with their
   resolutions once decided, for the design owner.

## Writing process (the repeatable loop)

For each module:

1. Re-read the canon sources (1–3 above); skim the `.js` as the re-confirmation gate.
2. Enumerate the full surface (§2 of the template) before writing any vectors.
3. Draft the spec from the template.
4. Decidability check — confirm each vector is actually decidable by the _current_
   implementation (scratch-run against the real function). The spec describes what **is**,
   with policy-flags for what is contested.
5. Design review with the spec owner — vectors and boundaries.
6. Freeze → the spec becomes the base for the axis-1 suite; axes 2–4 derive alongside.

One predicate's specification is one increment; the design review is the close for the
spec-writing phase (the test-green close comes later, at axis-1 generation).

## Naming

- Spec files: `<MODULE>.spec.md` (uppercase module name), e.g. `THENABLE.spec.md`.
- Test files (test round): TBD with the spec owner — expected `test/<module>.test.js` per
  module, mirroring the source layout, so the axis suites can fan out per module.
- Axis suites import predicates through the `@/index.js` barrel, not the module file
  directly — the barrel orders its re-exports so the `config ↔ function` load-order cycle
  resolves. A direct `@/<module>.js` import throws
  `getOwnPropertyDescriptor is not a function` at module init. Confirmed during the
  thenable decidability check.

## Status

| Module    | Spec               | Axis-1 suite | Notes                                                              |
| --------- | ------------------ | ------------ | ------------------------------------------------------------------ |
| thenable  | frozen 2026-06-18  | —            | template-validation module; decidability check passed              |
| primitive | drafted (strawman) | —            | 19 predicates (5 families × value/boxed/composite + 4 floor)       |
| evented   | —                  | —            |                                                                    |
| error     | —                  | —            |                                                                    |
| object    | —                  | —            |                                                                    |
| function  | —                  | —            | largest surface; last                                              |
| utility   | —                  | —            | public readers; lighter spec                                       |
| config    | —                  | —            | `@internal` realm-fixed; boundary-retyped signature contracts only |
