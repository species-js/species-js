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

| Axis | Suite                         | Question it answers                                                    | Source of truth                                                                                              |
| ---- | ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | **Spec / contract**           | Does the public predicate honor its documented contract?               | `spec/<MODULE>.spec.md` (this directory)                                                                     |
| 2    | **Cross-realm**               | Do the same claims hold for foreign-realm values (`vm`/iframe/worker)? | the spec's per-predicate _cross-realm expectation_, re-verified through the realm-fixture harness            |
| 3    | **Adversarial / smart-alien** | Does it resist spoofs _and_ stay throw-safe on every path?             | the spec's _spoof-resistance_ vectors + the _throw-safety invariant_ (exhaustive hostile × predicate matrix) |
| 4    | **Helper-unit**               | Does each `@internal` helper do its isolated job?                      | the implementation's helper inventory (white-box)                                                            |
| 5    | **Coverage-completeness**     | Does every branch actually execute?                                    | the V8 coverage report, ratcheted                                                                            |

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
class is `A` (admits), `R` (rejects), or `B` (a **testable boundary** — a documented
known-admission or unclosable-spoof limit, _asserted_ to pin the boundary, e.g. the
`Object.create(Promise.prototype)` graft → `true`). Example: `isThenable/A1`,
`isPromise/R3`, `isPromise/B2`. IDs are append-only — never renumber a shipped vector; add
a higher number or mark one withdrawn. A test asserting a vector should reference the ID
in its description so spec ↔ test traceability survives refactoring.

Each vector reads as `input → expected — rationale`. Inputs are written as runnable
JavaScript expressions wherever possible; values that need construction (cross-realm,
alien) name the fixture instead.

Two things are deliberately **not** vectors — keeping them out of the ID space is what
lets a spec read seamlessly instead of as a thicket of annotations:

- **Refuses-to-claim** — the semantic scope a predicate declines to verify (`isThenable`
  does not check `then`'s arity; no predicate probes `[[PromiseState]]`). It asserts
  nothing, so it reads as **prose** in the predicate's _Refuses to claim_ subsection,
  never as a vector ID. (Specs that earlier gave these `B` IDs are demoted in place — the
  ID is marked withdrawn and the claim becomes prose.)
- **Throw-safety** — a universal invariant (next section), stated once and proven by an
  exhaustive matrix that lives in the **test suite**, not as per-input vectors.

## Throw-safety — the universal invariant

A type-detection predicate must answer a boolean on **every** input, including hostile
ones: a `Proxy` whose `getPrototypeOf` / `getOwnPropertyDescriptor` / `ownKeys` trap
throws, a throwing accessor getter (`get then() { throw }`), a throwing
`Symbol.toStringTag` getter. The contract is uniform and non-negotiable, and it is the
most honest thing a structural detector can do:

- **Every predicate returns `false`** on any throw, on any path.
- **Every `@internal` helper returns its sentinel** — `undefined` for resolver/reader
  helpers, `false` for boolean probes — on any throw, so the predicates that compose them
  collapse to `false`.

This is **one coherent invariant, not a family of per-input boundary vectors.** Each spec
states it **once** — a short _Throw-safety_ paragraph in the module contract — naming the
hostile-input classes the module's reads are exposed to (prototype-trap, descriptor-trap,
accessor-throw, tag-getter-throw) and the throw-safe reader each routes through
(`getInert*` from `@/utility`, the `try/catch`-wrapped `instanceof` inside an
`isCurrentRealm*Instance` helper, `getTypeSignature`, `getVerifiedOwnName`,
`getDefinedConstructor`).

The **exhaustive proof lives in the test suite, not the spec**: a config-driven
`hostile-input-class × predicate` matrix (the same shape as the axis-1 candidate matrix),
every cell asserting `false` / honest-by-contract verdict **and** not-thrown. The
invariant is met for a module **⟺ every cell of its matrix is filled.** Keeping the matrix
in the tests is what keeps the spec readable — the spec carries the contract, the suite
carries the enumeration.

**Code consequence.** A module is not throw-safe until every predicate fast-path that
reads a prototype or descriptor routes through a throw-safe reader — **no raw
`instanceof`, no raw `@/config` `getPrototypeOf` / `getOwnPropertyDescriptor` on the
value.** Auditing this (and filling the matrix) is a required step of every module's test
round; `object` and `thenable` satisfy it today, the remaining modules harden to it in
their rounds.

## Per-module spec template

Each `<MODULE>.spec.md` follows this shape:

1. **Module contract** — one-paragraph purpose + the discrimination lattice (copied from
   the architecture doc's mental model so the spec stands alone) + the one-paragraph
   **Throw-safety** invariant (predicates → `false`, helpers → sentinel, on every path;
   see the section above) naming the module's hostile-input classes and throw-safe
   readers.
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
   **Admits** / **Rejects** `A`/`R` vector lists, a **Refuses to claim** subsection
   (prose, not vectors), **Cross-realm expectation** (axis 2), **Spoof-resistance
   expectation** (axis 3, including the throw-safety classes it is exposed to),
   **Composition note** (which helpers it drives → axis 4), and any **Policy flags** (open
   questions whose resolution would change a vector).
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

| Module    | Spec              | Axis-1 suite | Notes                                                                        |
| --------- | ----------------- | ------------ | ---------------------------------------------------------------------------- |
| thenable  | frozen 2026-06-18 | —            | template-validation module; decidability check passed                        |
| primitive | frozen 2026-06-18 | —            | 19 predicates + 10 exported helpers; decidability check passed               |
| evented   | frozen 2026-06-18 | —            | 4 predicates (2 lattices) + 4 exported helpers; decidability passed          |
| error     | frozen 2026-06-18 | —            | isError (native-or-polyfill) + isAbortError + 3 helpers; decidability passed |
| object    | frozen 2026-06-18 | —            | 4 predicates + 2 helpers; decidability passed (fixed 1 stale doc claim)      |
| function  | frozen 2026-06-19 | —            | 11 predicates + hasConstructSlot + 9 helpers; Symbol/BigInt-as-class ruling  |
| utility   | frozen 2026-06-19 | —            | 15 public readers/probes (inert set promoted public); decidability clean     |
| config    | frozen 2026-06-19 | —            | 26 `@internal` captures; contract spec (realm-fixity + retypes + polyfills)  |
