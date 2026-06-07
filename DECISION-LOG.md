# DECISION-LOG

A chronological record of architectural and design decisions in species-js. Each entry is
dated, with context, the decision itself, its rationale, and its consequences. Entries are
append-only — later decisions that supersede earlier ones add new entries with explicit
pointers back, rather than mutating the historical record.

The log is organized by package and module. New decisions go at the bottom of the relevant
section, numbered sequentially within that section. The numbering is local to each
section; cross-section references use `(package/module #NNN)`.

This is the first round, covering `type-detection / function` and a handful of
foundational rulings that pre-date the function work but bind it. Other packages and
modules will get their own sections as their work begins.

---

## type-detection / function

### 001 — Branding rejected for type-name string aliases (2026-05-29)

**Context.** `ConstructorName`, `TaggedType`, and `ResolvedType` carry runtime string
values. A brand-style declaration
(`type ConstructorName = string & { __brand: 'ConstructorName' }`) was considered to give
them nominal distinctness in TypeScript.

**Decision.** Reject branding. The three are plain `type X = string` aliases, with
provenance carried by producers' return types and `{@link}` cross-references in JSDoc.

**Rationale.** Brand the type only when same-shaped values must not be interchanged across
a directional flow (`UserId` vs `OrderId`). The three names here frequently coincide at
runtime — `'Array'` is both the constructor name and the tagged type for an array — and
`ResolvedType` is the union of the other two _because_ callers treat them as one
"type-name string." The brand would be a fiction asserted over plain `String#slice` and
`.name` output. Brands cannot carry runtime provenance anyway; if that ever becomes a
requirement, a discriminated union is the right shape, not a brand.

**Consequences.** The ruling applies recursively to function shapes. `ES3Function`,
`ClassConstructor`, `AsyncFunction`, and the generator-family interfaces are structural
types, not branded shapes. Nominal-identity machinery is the sibling
`@species-js/type-identity` package's concern; type-detection does not improvise brands.

---

### 002 — Tier-S documentation style established (2026-05-29) and codified package-wide (2026-05-30)

**Context.** Documentation across `Callable`, `isCallable`, and the primitive predicates
was diverging in opener form, tag form, and `@example` density. The sibling project
`equip-js` carried a similar style under stress and was hitting friction with stricter
`eslint-plugin-jsdoc` rules in this project.

**Decision.** Adopt a unified "Tier S" style across `type-detection`: definition-first
openers that name what the symbol _is_ or _does_; one-line `@param name - desc` and
`@returns desc` form; `@internal` always last and on its own line; member-role docs that
name the role rather than restating the type; `@example` earned (added only when narrowing
flow, edge cases, or typical returns are non-obvious); `## Subsection` markdown allowed
inside long doc blocks for enumerated lists. See CLAUDE.md "Code conventions" for the
binding form.

**Rationale.** A unified voice is cheaper to maintain and reads more uniformly under
TypeDoc. The style improves on the equip-js baseline (which the project draws from per the
sibling-baseline rule) rather than capping at it. `@example` discipline matters because
every export with a reflex `@example` produces TypeDoc noise that drowns out the ones that
genuinely help.

**Consequences.** Every doc block in the package was touched in the 2026-05-30 alignment
pass. The style binding is in CLAUDE.md (doc-voice bullet) so it survives memory rotation.
See decision #019 for the prose-voice refinement that landed 2026-06-03.

---

### 003 — Three-species newable lattice (2026-06-01)

**Context.** TypeScript types a plain `function` as call-only, so the runtime
`[[Construct]]` slot has to be asserted by the handwritten `.d.ts`. The question was how
to model the newable surface: as the union `ES3Function | ClassConstructor`, or as a
lenient base interface with strict refinements layered above.

**Decision.** `NewableFunction` is a lenient base interface, not the union. `ES3Function`
(writable own `prototype`) and `ClassConstructor` (read-only own `prototype`) are strict
refinements that reject bound variants. Bound newables remain in scope of
`NewableFunction` because `[[Construct]]` survives `bind`, but lose their own `prototype`
slot and therefore both strict refinements.

**Rationale.** The union would overpromise. Both branches carry an own `prototype` that
bound variants do not, so the union would be a stricter narrow target than the runtime
gate. A lenient base + strict refinements correctly models the actual lattice: three
runtime species (`ES3Function`, `ClassConstructor`, bound-newable) under one supertype,
with the package naming the two strict species and leaving "bound-newable" as the unnamed
third.

**Consequences.** The lattice asymmetry between newable and non-newable sides is then
forced by spec mechanics, not by design choice — see decision #005. `isNewableFunction` is
the lenient gate; `isES3Function` and `isClass` are the strict refinements.
`isCustomClass` and `isBuiltInClass` are further refinements of `isClass`.

---

### 004 — `AsyncFunction` is kin to `%AsyncFunction%`, not `%AsyncGeneratorFunction%` (2026-06-01)

**Context.** The shared "Async" prefix in `AsyncFunction` and `AsyncGeneratorFunction`
invites confusion. ECMA-262 names three distinct non-newable intrinsics:
`%AsyncFunction%`, `%GeneratorFunction%`, `%AsyncGeneratorFunction%`.

**Decision.** Codify the family map. `AsyncFunction` belongs to the async family
(intrinsic `%AsyncFunction%`, no own `prototype`, returns `Promise`). `GeneratorFunction`
and `AsyncGeneratorFunction` belong to the generator family (intrinsics
`%GeneratorFunction%` and `%AsyncGeneratorFunction%`, own writable `prototype`, return
`Generator` or `AsyncGenerator`). The "Async" in `AsyncGeneratorFunction` describes what
the iterator _yields_, not the function itself.

**Rationale.** The shared prefix is misleading inherited spec naming. Structurally
`AsyncGeneratorFunction` is far closer to `GeneratorFunction` than to `AsyncFunction`.
Conflating the two in docs would propagate confusion to every consumer.

**Consequences.** Doc voice never co-locates `AsyncFunction` with `AsyncGeneratorFunction`
as near-cousins; the family-map framing is repeated in their respective interface docs and
the orchestrator docs.

---

### 005 — Bound-admission asymmetry by spec mechanics, not by design choice (2026-06-01)

**Context.** The newable side has strict-vs-lenient predicate pairs that reject bound
variants (decision #003). The non-newable side does not — every non-newable predicate
admits bound variants. Was the asymmetry deliberate?

**Decision.** It is forced by spec mechanics, not chosen. The newable side's
discriminators are _own-instance descriptors_ (the `writable` flag on `prototype`, the
back-reference soundness). `bind` strips own slots, so bound variants fail strict checks
for free. The non-newable side's discriminators are _prototype-chain values_
(`Symbol.toStringTag` on `%X.prototype%`, the resolved constructor name walked via the
prototype chain). `BoundFunctionCreate` (ECMA-262 §10.4.1.3) sets the bound function's
`[[Prototype]]` to the target's `[[Prototype]]`, so tag and constructor-name resolution
survive `bind`. A bound async function inherits `%AsyncFunction.prototype%` and passes
every check the unbound version passes.

**Rationale.** Naming this honestly in docs avoids the false impression that the package
chose to admit bound async/generator functions. It admits them because there is no
structural way at the type-detection layer to tell a bound async function from a non-bound
one without source inspection — and source inspection is the introspection package's
concern.

**Consequences.** The honest doc voice names "lenient by spec mechanics" for non-newable
predicates. Source-regex predicates (`isBoundFunction`) go to `function-introspection`,
not type-detection. See decision #016 for the refined source-string ruling.

---

### 006 — Orchestrator + shape-helper pattern for non-newable predicates (2026-06-01)

**Context.** `isAsyncFunction` originally fused the `isFunction` gate, the same-realm
`instanceof` fast path, and the cross-realm structural check into one function. Testing
the cross-realm path required either an iframe harness or coverage of branches you could
not reach without one.

**Decision.** Split every non-newable predicate into two pieces. The **orchestrator** is
the public, narrowing predicate (e.g. `isAsyncFunction`): gate → fast-path → delegate to
shape helper. The **shape helper** is `hasXxxFunctionShape`, marked `@internal`, exported
for direct testability. The shape helper runs the realm-independent markers in isolation,
takes `value?: unknown`, returns plain `boolean` (no narrowing — that role belongs to the
orchestrator).

**Rationale.** Independent unit-testability for the two pieces. The shape helper _is_ the
cross-realm code path, so direct invocation tests it without an iframe harness. The shape
helper also becomes the introspection layer's narrowing primitive — when
`@species-js/function-introspection` lands its source-regex predicates, they will compose
the shape helper with a source check rather than re-implementing the marker chain.

**Consequences.** Applied across `isAsyncFunction` + `hasAsyncFunctionShape`,
`isGeneratorFunction` + `hasGeneratorFunctionShape`, `isAsyncGeneratorFunction` +
`hasAsyncGeneratorFunctionShape`, and `isAnyGeneratorFunction` (umbrella; no dedicated
`hasAnyGeneratorFunctionShape` because the union of two single-family helpers is the
umbrella's job). Later refined by decision #014 with sub-helper extraction
(`*IdentitySignal`, `*PrototypeSurface`).

---

### 007 — Intrinsic constructor capture cast type: `NewableFunction` (2026-06-01)

**Context.** The orchestrators capture each non-newable intrinsic at module-load via
`getDefinedConstructor(<sample-value>)` — e.g.
`const AsyncFunctionConstructor = /** @type {NewableFunction} */ (getDefinedConstructor(async () => Promise.resolve()))`.
The cast type was inconsistently `Function` or `unknown` in earlier drafts.

**Decision.** Cast every captured intrinsic to `NewableFunction`.

**Rationale.** `%AsyncFunction%`, `%GeneratorFunction%`, and `%AsyncGeneratorFunction%`
are themselves newable — `new AsyncFunction('async function body')` creates an async
function at runtime, and the same for the other two. `NewableFunction` is the lenient base
from decision #003 and accurately captures the constructor surface. The cast lets
`value instanceof AsyncFunctionConstructor` typecheck cleanly because `NewableFunction`
has the right call shape on its right-hand side.

**Consequences.** Applied uniformly across `AsyncFunctionConstructor`,
`GeneratorFunctionConstructor`, `AsyncGeneratorFunctionConstructor`.

---

### 008 — Boundary-retyping at `@/config` for `toFunctionString` (2026-06-01)

**Context.** `Function.prototype.toString` is typed by the TypeScript lib as
`(this: Function) => string`. Calling `toFunctionString.call(callable)` on a `Callable`
(the package's floor type) tripped `@typescript-eslint/no-unsafe-function-type` and forced
a cast at every consumer.

**Decision.** Retype the cached primitive at `@/config`:
`typeof Function.prototype.toString` → `(this: Callable) => string`. This encodes the
spec-required constraint (calling on a non-callable receiver throws `TypeError`).

**Rationale.** Call-site casts launder the same `any`/`Function` through the same shape
over and over and hide the actual lib gap. Retyping at the boundary fixes it once; every
consumer inherits the honest signature for free; and the `.d.ts` carries the rationale as
documentation. The runtime `.js` export stays the unwrapped native method — only the type
changes.

**Consequences.** First instance of the boundary-retyping pattern. Pattern recurs at
decision #017 for `getPrototypeOf`. Generalizes to: when a cached `@/config` primitive
forces a consumer-side cast cascade because of a lib `any`, retype at the boundary. Now
codified as a settled ruling.

---

### 009 — Empirical fingerprint matrix as the discrimination signal (2026-06-02)

**Context.** The non-newable shape predicates were reading six markers
(`!hasOwnPrototype`, `!hasConstructSlot`, tag, constructor-name, and two joined-string
signatures for the value's and proto's own keys). Was this redundant? Was it under-strict?
The question needed empirical answers, not just spec-level reasoning.

**Decision.** Run a structured cheat-sheet across every ES function source-form
(statement, expression, arrow, concise method, class) for every species (ES3, class,
async, generator, async-generator) in both unbound and bound variants, and tabulate the
discrimination columns. The result is a closed-form matrix over the tuple
`(newable, own_writable_prototype, [[Class]] tag, prototype-own-key-signature)` that
distinguishes every species except two genuine collision classes: arrow-vs-concise
(descriptor-identical; only `[[HomeObject]]` differs) and bound-vs-unbound within the
arrow/concise rows.

**Rationale.** Empirical validation closes the question that pure spec-reading cannot. The
matrix is a _design artifact_, not a production primitive — it proves that every species
is structurally separable. The implementation primitive that embodies the matrix is a
separate question, settled by decisions #011 and #013.

**Consequences.** The collision classes are named precisely. Arrow-vs-concise belongs in
`function-introspection` (it genuinely requires source parsing). Bound-vs-unbound within
arrow/concise rows resolves with a single descriptor _value_ read on `name`
(`.startsWith('bound ')`) — descriptor-land, not source-land. The matrix lives in the
project memory as a frozen artifact for future reference.

---

### 010 — Conservative-narrowing posture for shape predicates (2026-06-02)

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

---

### 011 — `Set<string>` primitive for shape-presence probes (2026-06-02 → 2026-06-03)

**Context.** Early implementation used a joined-string approach:
`getOwnPropertyDescriptorsKeysSignature` returned a sorted, `_`-joined string of own keys.
Shape predicates compared these strings against fixed expected values (e.g.
`'length_name'` for an async function). The approach was too strict (rejects extras, even
legitimate ones) and not strict enough (loses descriptor-flag precision).

**Decision.** Replace the joined-string helper with `getOwnPropertyDescriptorsKeySet`,
returning `Set<string>`. Shape predicates probe membership via `.has(key)` rather than
full-set equality. The joined string is removed; the joined form can still be computed
locally as `[...keySet].sort().join('_')` if a consumer ever wants it as a hash key.

**Rationale.** Set membership matches the spec's actual guarantees. The spec promises
certain own keys _exist_ on `%AsyncFunction.prototype%`, not that they are the only keys.
A prototype with an engine-added or framework-added own property is still semantically
async. Full-set equality rejects legitimate extras; per-key membership admits them. The
Set also sidesteps the `_`-collision boundary the joined string carries (`{a_b: 1}` and
`{a: 1, b: 1}` produce the same signature).

**Consequences.** All shape predicates now use `.has('constructor')` and
`!.has('prototype')` (for async) or `.has('constructor') && .has('prototype')` (for the
generator family) instead of full-string comparison. The Set primitive is the proto-side
discriminator for the rest of the package and downstream consumers.

---

### 012 — Family-level abstraction over per-species duplication when the invariant is codified (2026-06-02)

**Context.** When the generator-family shape predicates each got a `hasXxxPrototypeShape`
helper, I initially kept them as two per-species functions with identical bodies, citing
the CLAUDE.md "three similar lines is better than a premature abstraction" rule. The user
refactored them to a single shared `hasAnyGeneratorFunctionPrototypeShape`.

**Decision.** When similar code reflects a _structural invariant already codified at a
documented family level_ (the generator family in this case), the family-level helper is
the right level — regardless of how short the bodies are.

**Rationale.** Per-species duplicates lie about where the invariant lives. They tell a
reader the two species each have "their own" proto-side check, when in fact they share a
family-level rule (`%GeneratorPrototype%` and `%AsyncGeneratorPrototype%` carry the same
`'constructor' + 'prototype'` own-key set; the `[[Class]]` tag at the identity-signal
layer is the per-species discriminator). The family-level helper names the actual semantic
boundary; per-species copies fight the abstraction that the type hierarchy already
codifies. CLAUDE.md's "three similar lines" rule protects against _premature_ abstractions
(those not yet codified anywhere) — structural invariants already documented in design
memory are not premature.

**Consequences.** `hasAnyGeneratorFunctionPrototypeSurface` (renamed at decision #018) is
the shared family-level helper called by both `hasGeneratorFunctionShape` and
`hasAsyncGeneratorFunctionShape`. The `Any` prefix matches the umbrella type
`AnyGeneratorFunction`.

---

### 013 — Spec-defined source-string checks stay in type-detection; heuristic ones go to introspection (2026-06-02)

**Context.** An earlier framing held that any `Function.prototype.toString.call` source
parsing belonged in `function-introspection`, since most syntactic recognition through
stringification is heuristic. But `isCustomClass` and `isBuiltInClass` rely on
`getFunctionSource(value).startsWith('class')` to distinguish authored-via-`class` from
built-in constructors. Were those predicates misplaced?

**Decision.** Refine the ruling. ECMA-262 §27.3 specifies that class-syntax constructors
stringify with `class` as the leading keyword — a spec-guaranteed invariant.
`isCustomClass` and `isBuiltInClass` stay in type-detection. Heuristic syntactic
recognition (arrow vs. concise method, async source forms, the bound-source-form) goes to
`function-introspection`.

**Rationale.** There is no descriptor-only escape for the custom-vs-built-in distinction.
Both report `[object Function]`, both have `writable: false` on own `prototype`, both look
structurally identical. The source-string prefix is the _only_ spec-defined discriminator.
Forcing this distinction out of type-detection would fragment the package surface for a
question that has a reliable spec answer right here.

**Consequences.** The principle that drives placement decisions for any future predicate:
ask whether ECMA-262 _guarantees_ the stringification form. If yes, the predicate is
foundation-tier; if no, it is introspection-tier. `isBoundFunction` stays in introspection
per the prior ruling — `name`-prefix `'bound '` and the bound-source-form are both
heuristic-quality.

---

### 014 — Helper-grouped shape predicates with sub-helper extraction (2026-06-02 → 2026-06-03)

**Context.** The 6-marker `hasAsyncFunctionShape` body had grown to a long flat `&&`
chain. The semantic groups (descriptor-presence floor, identity labels, proto-side
membership) were visible to a careful reader but not structurally named. Cross-realm
safety (the `getPrototypeOf` read must not run on nullish input) was implicit in the chain
order.

**Decision.** Split each shape predicate into named sub-helpers grouped by semantic role.
`hasAsyncFunctionShape` now reads as four `&&` links: descriptor-presence floor (two
checks), identity-signal helper, prototype-surface helper. Generator-family shape
predicates use the same shape with three `&&` links (descriptor floor + identity-signal +
family-shared prototype-surface).

**Rationale.** The sub-helpers name the semantic groups explicitly. Runtime safety becomes
structural: the prototype-surface helper is called as the _last_ link of the `&&` chain,
so by the time `getPrototypeOf` runs the upstream identity-signal check has already
rejected nullish input. Sub-helpers are exported (`@internal`) so each link can be tested
in isolation — see decision #015.

**Consequences.** Five new sub-helpers exported across the package:
`hasAsyncFunctionIdentitySignal`, `hasAsyncFunctionPrototypeSurface`,
`hasGeneratorFunctionIdentitySignal`, `hasAsyncGeneratorFunctionIdentitySignal`, and the
family-shared `hasAnyGeneratorFunctionPrototypeSurface`. Parallel `.d.ts` declarations
carry the same prose.

---

### 015 — All sub-helpers exported with parallel `.d.ts` declarations (2026-06-03)

**Context.** The sub-helpers from decision #014 were initially module-local. Test-side
access required reaching into the implementation file directly.

**Decision.** Export all five sub-helpers, mark them `@internal`, and add matching
declarations to `function.d.ts`. The `@internal` tag keeps them out of published TypeDoc
output but makes them importable for tests.

**Rationale.** Sub-helpers exist for isolated testability. A module-local helper that
nothing can import is testable only through its orchestrator, which couples
shape-correctness tests to orchestration correctness. Exporting makes the unit boundary
match the test boundary. The `@internal` marker keeps the published surface honest.

**Consequences.** Future test code can import each sub-helper from `@/function` and
exercise each marker group independently. The package's external API surface (everything
not `@internal`) is unchanged.

---

### 016 — Singular composite naming: `*IdentitySignal` and `*PrototypeSurface` (2026-06-03)

**Context.** Early sub-helper names were plural: `hasAsyncFunctionIdentityLabels` and
`hasAsyncFunctionPrototypeShape`. Both names had problems. _Labels_ (plural) conflated the
helper with its constituents — the function tests one thing (an identity signal), composed
of two checks. _Shape_ was already overloaded at the orchestrator level
(`hasAsyncFunctionShape`); subordinating the same word to a sub-helper invited reader
confusion.

**Decision.** Use singular composite naming. `*IdentitySignal` (singular) names the
abstract composite that the helper tests; the two underlying tag-label and name-label are
constituents named in prose ("the two identity-signal labels"). `*PrototypeSurface`
(singular) names the proto-side own-key surface precisely, leaving "Shape" reserved for
the orchestrator's top-level structural claim.

**Rationale.** The function tests _one_ identity signal, _one_ prototype surface — both
composite concepts. Plural naming misframed them as collections of independent checks; the
user's reframing as composite-with-constituents reads more accurately. Naming convention
is now structural, not enumerative.

**Consequences.** Five renames across `function.{d.ts,js}` and four memory files. The doc
prose accompanying these helpers uses "labels" descriptively to refer to the two
underlying checks, while the function name names the composite. Parallel `.d.ts`
declarations updated.

---

### 017 — Boundary-retyping at `@/config` for `getPrototypeOf` (2026-06-03)

**Context.** `getPrototypeOf` is typed by lib.es5.d.ts as `(o: any) => any`. The `any`
return forced a `@typescript-eslint/no-unsafe-assignment` cascade at every consumer;
multiple call sites in `function.js` and `utility/index.js` were laundering the value
through `/** @type {unknown} */` and re-asserting.

**Decision.** Retype at the `@/config` boundary, mirroring the `toFunctionString`
precedent from decision #008. `typeof Object.getPrototypeOf` →
`(o: unknown) => object | null`.

**Rationale.** The spec-precise return is `object | null` (the `[[Prototype]]` slot of any
non-nullish object). The `unknown` parameter accepts what callers actually pass; the
runtime throw for `null` / `undefined` is a precondition not modeled in the type
(consistent with TypeScript's not modeling thrown errors elsewhere). The runtime `.js`
export stays the unwrapped native method.

**Consequences.** Two laundering casts eliminated in `function.js`
(`hasAsyncFunctionPrototypeSurface`) and `utility/index.js`
(`getNextAvailablePropertyDescriptor`, `getDefinedConstructor`). The pattern is now
codified as a settled ruling — any future cached primitive whose lib `any` propagates
downstream gets retyped at the boundary, not at the call sites. See also decision #008.

---

### 018 — Prose-voice refinement of the documentation style (2026-06-03)

**Context.** The Tier-S style from decision #002 had drifted into telegraphic
fragment-chains, em-dash-joined compounds, and parenthetical-heavy asides. The published
TypeDoc consumer experienced the `.d.ts` blocks as concept stacks separated by dashes
rather than as sentences that flow.

**Decision.** Refine the style. Complete sentences over telegraphic fragments. Periods as
default connector; em-dashes reserved for genuine asides. Lead-positive contrast on dual
predicates ("X does Z, whereas Y does W") rather than negation-first ("X does not Y, but
does Z"). Subject precision (source-strings render; classes themselves do not). Numbered
or bulleted lists where structure helps. Underscore italics for emphasis
(`_"tells-what-it-is"_`) to satisfy `jsdoc/no-multi-asterisks` on both `.js` and `.d.ts`
sides without per-file workarounds.

**Rationale.** Each shift fixes a specific failure mode the earlier voice carried. The
shift was demonstrated on one block (`hasAsyncFunctionShape`), confirmed by the user, then
applied package-wide.

**Consequences.** All eight file pairs in `type-detection` were rewritten in the refined
voice in a single pass (2026-06-03 commit `f622188`). The refinement supersedes the
earlier "em-dash-as-connector" tolerance but preserves every other Tier-S principle
(bidirectional `{@link}`, earned `@example`, `@internal` last, list headings, no
commented-out code, member-role docs without type restatement).

---

### 019 — `CallableOrNewable` kept as speculative third-party-consumable surface (2026-06-03)

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

---

### 020 — Spec-shape determines the access path: descriptor-first for own-data, direct access for inherited (2026-06-03)

**Context.** `getDefinedConstructorName` was reading `constructor.name` via direct
property access. The earlier `.d.ts` doc had claimed descriptor-based protection that the
impl never carried (`Q.001`). The candidate fix was to switch to a descriptor-based read.
While contemplating extending the same defense to `getDefinedConstructor`'s
meta-constructor steps (`constructor.constructor` at steps 2 and 4), the user observed
that `GeneratorFunction` and `Generator` reference each other through prototype-chain
inheritance, and that for unknown reciprocal-reference types the descriptor hierarchy is
not knowable in advance.

**Decision.** The right defensive pattern depends on the spec shape of the property being
read, not on a generic "always descriptor-first" rule:

- **Own-data properties** (e.g. `name` on a function, per ECMA-262 §10.2.9
  `SetFunctionName`) → descriptor-first read with no direct-access fallback. The
  descriptor's `value` is the canonical access path; an accessor leaves `value` as
  `undefined`, which the downstream narrow correctly rejects.
- **Inherited properties** (e.g. `constructor` on an instance, the meta-constructor
  `constructor.constructor`, `Symbol.toStringTag` via the prototype chain) → direct
  property access. The engine's prototype-chain walk is the spec-correct resolution;
  descriptor-first returns `undefined` for the inherited case anyway, and the `??`
  fallback to direct access does the actual work every time.

Applied: `getDefinedConstructorName` switched to descriptor-only read on `name`.
`getDefinedConstructor`'s meta-constructor reads at steps 2 and 4 kept as direct
`constructor?.constructor` access, with code comments naming the intent so a future
defensive-tightening instinct does not undo the choice.

**Rationale.** Trying to be defensive at the descriptor level for inherited properties
fights inheritance: the descriptor read returns `undefined`, the fallback kicks in, the
path that produces the answer is the fallback every time, and the descriptor read adds a
function call for nothing. Worse, the "defense" doesn't actually catch the spoof it
targets — if the own descriptor is an accessor, `descriptor.value` is `undefined` and the
`??` fallback invokes the accessor anyway. The `name`-vs-`constructor` asymmetry is
structural: `name` is own data per spec; `constructor` is inherited per spec. The
defensive pattern follows the spec shape.

**Consequences.** Resolves `Q.001`. `getDefinedConstructorName` now reads `name` via the
property descriptor and rejects accessor-based spoofing without invoking the getter.
`getDefinedConstructor`'s meta-constructor steps preserve the prototype-chain walk that
spec-correct reciprocal references depend on (e.g. `%GeneratorFunction%`'s `constructor`
inheriting from `%Function.prototype%`). The rule generalizes for any future property read
in this package: ask whether the spec defines the property as own-data or inherited, then
pick the access path accordingly. Codified in [[design-rulings]] as "spec-shape determines
the access path."

---

### 021 — Spec-shape rule extended: predicate over inherited gets descriptor-walk for inspection without invocation (2026-06-04)

**Context.** `hasInertMethod(value, key)` was introduced in the thenable migration as the
inspect-without-invoke primitive. Its callers (`isThenable`, `doesMatchPromiseContract`)
read inherited `Promise.prototype` methods (`then`, `catch`, `finally`). Decision #020
says "inherited → direct access (let the engine resolve)" but direct access would invoke
any accessor at the key — wrong for a predicate that must inspect without invocation.

**Decision.** Extend the spec-shape rule with a third pattern. The full rule now reads:

- **Own-data → descriptor-first** (no fallback). The descriptor's `value` is the canonical
  path; an accessor leaves `value` undefined and the downstream narrow rejects it.
- **Inherited → direct access.** The engine's prototype-chain walk is the spec-correct
  resolution; descriptor-first would return `undefined` for every inherited case.
- **Predicate over inherited → descriptor-walk for safety.** A predicate's contract is to
  inspect without consuming the value, so it cannot invoke accessors. The descriptor-walk
  pattern reads the chain via `getOwnPropertyDescriptor` at each level (the
  `getNextAvailablePropertyDescriptor` helper from `@/utility`) and rejects accessor
  descriptors via `objectHasOwn(descriptor, 'value')`.

**Rationale.** Patterns 1 and 2 govern reads that consume the value — production code
wants the property's value. Pattern 3 governs reads that inspect the structure to make a
boolean discrimination — predicate code wants to know "could this be safely consumed?"
without doing the consumption. The predicate's inspect-without-invoke contract overrides
the spec-shape access path because the contract requires non-invocation. An accessor at
the key is exactly the spoof case the predicate must reject; if direct access fires the
getter, the predicate's defense is gone.

**Consequences.** `hasInertMethod` is the canonical implementation of pattern 3 in this
package, factored as a `@/utility` primitive (see decision #024). The rule generalizes to
any future predicate that inspects inherited properties without firing accessors —
Iterator protocol predicates, EventTarget interface predicates, Error-invariants
predicates. Codified in [[design-rulings]] as a third pattern alongside the existing two;
the design-rulings entry carries the forward-applicable framing, this entry carries the
chronological capture.

---

### 025 — Parameter-default-to-`null` for strict-equality nullish unification (2026-06-04)

**Context.** During the `hasInertMethod` refactor (post-thenable round, commit `71dff73`),
chasing the lint friction on a clean nullish guard surfaced the pattern. `value == null`
is the canonical idiom for catching both `null` and `undefined` in one comparison, but it
trips `@typescript-eslint/eqeqeq`, which enforces strict equality. Two strict checks
(`value !== null && value !== undefined`) work but cost a line and read as bookkeeping;
configuring `eqeqeq` with `null: 'ignore'` would also work but touches eslint config.

**Decision.** When a function accepts an optional or `unknown`-typed value and the body
benefits from a single nullish check, declare the parameter with a default of `null`
(`param = null`). An omitted call or an explicit `undefined` argument coerces to `null` at
the parameter-binding step, so only one nullish value reaches the body. Downstream
`param !== null` is strict-equality clean and covers both nullish cases via the
binding-time normalization.

**Rationale.** The trick pushes the normalization to the parameter binding — JS coerces an
omitted or `undefined` argument to the default — so only `null` reaches the body. The
resulting strict check covers both nullish cases without lint friction. Bonus: parameters
typed `unknown` with a `= null` default narrow cleanly through `!== null` to `unknown`
minus null. Falsy primitives (`0`, `''`, `false`, `NaN`, `0n`) flow through unaffected,
which is the right behavior for predicates that should treat each value type-correctly.
The naive alternatives (`!!value`, `(value ?? void 0) && …`) short-circuit on every falsy
input and silently reject primitives that have legitimate methods (`(0).toString` is
callable and inherited from `Number.prototype`).

**Consequences.** Applied to `hasInertMethod(type = null, key)` and to
`getNextAvailablePropertyDescriptor(value = null, key)` — the latter widened from `object`
to `unknown` to make the cast at the only `hasInertMethod` call site vanish. The pattern
composes — apply at each helper signature so the normalization happens once at the
outermost binding, and inner helpers can assume non-null without rechecking. Codified in
[[design-rulings]] as a forward-applicable rule. The bug fix it carries is real: the
previous `(value || null) && ...` form rejected `(0).toString` because `0` short-circuited
the falsy guard despite being a legitimate auto-boxed receiver of the inherited method.

---

### 026 — `isValidPropertyKey` tightened to safe-integer + three new `Number` type-guards in `@/config` (2026-06-04)

**Context.** The previous `isValidPropertyKey` accepted `isStringValue`, `isSymbolValue`,
and `isNumberValue && Number.isFinite` — any finite number, including non-integer floats
like `1.5` and integers beyond `Number.MAX_SAFE_INTEGER`. Floats coerce to strings
(`"1.5"`) at runtime with lookup surprises; integers past `MAX_SAFE_INTEGER` lose
precision in the round-trip. Both were admissible by the previous predicate; both
introduce real lookup hazards. The predicate's name connotes "safely usable as a key" —
the connotation was looser than the implementation.

**Decision.** Tighten `isValidPropertyKey` to accept only safe integers as numeric keys:
the range `[-(2^53 - 1), 2^53 - 1]` where numeric values round-trip losslessly. To support
this, add three new cached `Number` type-guards to `@/config`: `isFiniteNumberValue`
(`Number.isFinite` with `typeof` polyfill fallback), `isIntegerValue` (`Number.isInteger`
composed over `isFiniteNumberValue`), and `isSafeIntegerValue` (`Number.isSafeInteger`
composed over `isIntegerValue` with `Math.abs ≤ MAX_SAFE_INTEGER` bound). Each carries a
polyfill fallback for runtimes lacking the native method.

**Rationale.** Property-key validity is a load-bearing structural claim — the predicate
gates `getNextAvailablePropertyDescriptor`, which gates `hasInertMethod`, which gates
every contract predicate that walks the prototype chain. Admitting numbers with hazardous
runtime semantics propagates the hazard downstream. Restricting to safe integers makes the
predicate's name honest. The three new primitives form a clean composition hierarchy
(finite → integer → safe-integer), and each is boundary-retyped in the `.d.ts` per #008 to
a type-guard `(value: unknown) => value is number` — the lib types `Number.isXxx` as
`(number: unknown) => boolean` (non-narrowing), which forced casts at consumer sites.

**Consequences.** Contract change visible to downstream consumers:
`isValidPropertyKey(1.5)` now returns `false`; same for `isValidPropertyKey(2 ** 60)`. The
`@/utility` callers of `isValidPropertyKey` see the same tightening
(`getNextAvailablePropertyDescriptor` rejects hazardous keys), which propagates into every
contract predicate. The three new `@/config` primitives are public exports, available for
any downstream package that needs the same realm-fixed `Number` type-guards. The
boundary-retyping pattern from #008 / #017 now has a third instance, reinforcing it as the
canonical solution for closing lib `any`-/`boolean`-gaps.

---

### 031 — Generic-typed predicates: `<T = unknown>(value?: T): value is T & X` family-wide (2026-06-05)

**Context.** During the error-migration debugging round (commit `667e12b`), the recurring
_"my narrow flattens to `VerifiedFunction`"_ pain surfaced repeatedly. A consumer with
`value: ((this: O) => R) | undefined` from an earlier cast would lose that information the
moment `isFunction(value)` returned `true` — TS's `value is VerifiedFunction` narrow
_replaces_ the value's type with bare `VerifiedFunction`, discarding the more specific
caller-side narrowing. The workaround at consumer sites was an outer cast to recover the
function shape post-narrow — the same cascading-boilerplate pathology the
boundary-retyping ruling (#008, #017, #026) addresses on the call-side.

**Decision.** All 11 function-family predicates take the generic form
`<T = unknown>(value?: T): value is T & X`, where `X` is the predicate's previous narrow
target. Applied: `isCallable`, `isFunction`, `isNewableFunction`, `isES3Function`,
`isClass`, `isCustomClass`, `isBuiltInClass`, `isAsyncFunction`, `isGeneratorFunction`,
`isAsyncGeneratorFunction`, `isAnyGeneratorFunction`. The `.d.ts` carries the TS
signature; the `.js` JSDoc mirrors via `@template [T=unknown]` + `@param {T} [value]` +
`@returns {value is T & X}`. Each predicate carries a short doc paragraph naming the
family pattern with backticks for the form and a cross-reference to the family anchor
({@link isCallable} / {@link isFunction}).

**Rationale.** The intersection `T & X` distributes through `T`'s union:
`(A | B) & X = (A & X) | (B & X)`. Non-callable arms collapse to `never` —
`string & Callable = never`, `undefined & VerifiedFunction = never` — while callable arms
retain `T`'s call signature, augmented with `X`'s structural guarantees. For the common
case `T = unknown`, the intersection reduces to `X`, matching pre-generic behavior — every
existing call site is preserved with zero churn. Callers whose `value` already carries a
more specific function shape keep that shape post-narrow. The pattern is the sibling of
boundary-retyping on the narrow-side: that closes the call-side `any`-cascade at
`@/config`; this closes the narrow-side flatten at the predicate's declaration. Both
rulings address the same pathology — TS's default types are too lossy at a boundary, and
the cleanup work piles up at every consumer site instead of being absorbed once at the
boundary.

**Consequences.** All 11 family predicates ship the generic form (commit `9434960`, with
`isCallable` / `isFunction` precursors landing during the error-migration round's reserved
working tree). Downstream audit within species-js confirmed safe: all internal call sites
are `unknown`-typed inputs (in `utility/index.js`, `error.js`, `function.js`, `index.js`)
except for three `typeof Constructor` checks in `evented.js` / `thenable.js` where the
narrow yields `typeof Constructor & Callable`, which remains assignable to the outer
`typeof Constructor | null` cast — no consumer changes needed. The pattern generalizes
beyond the function family — see decision #036 for the follow-up sweep across `thenable`,
`evented`, and `error`. Primitive predicates (`isStringValue`, `isNumberValue`, etc.)
don't benefit — primitives have no richer shape to preserve — and stay as-is. Codified in
[[generic-predicate-pattern]] memory.

---

### 036 — Generic-predicate pattern extended to `thenable` / `evented` / `error` (2026-06-05)

**Context.** Decision #031 named the generic-typed predicate pattern
(`<T = unknown>(value?: T): value is T & X`) and applied it family-wide across the 11
function-family predicates. The same pattern generalizes mechanically to any type-guard
predicate; the non-function families were reserved for a follow-up sweep so the family
audit could be done in one focused round per module.

**Decision.** Sweep the pattern across the three remaining type-guard families. 10
predicates updated:

- **thenable** — `isThenable`, `isPromiseLike`, `isPromise` (narrow targets:
  `T & Thenable<unknown>`, `T & PromiseLike<unknown>`, `T & Promise<unknown>`).
- **evented** — `isEventTargetLike`, `isEventTarget`, `isAbortSignalLike`, `isAbortSignal`
  (narrow targets: `T & EventTargetLike`, `T & EventTarget`, `T & AbortSignalLike`,
  `T & AbortSignal`).
- **error** — `isGenericError`, `isError`, `isAbortError` (narrow targets:
  `T & GenericError`, `T & GenericError`, `T & AbortError`).

The `.d.ts` form is the TS signature shown; the `.js` JSDoc mirrors via
`@template [T=unknown]` + `@param {T} [value]` + `@returns {value is T & X}`. Each
predicate carries the short family-pattern doc paragraph. Primitive predicates are
deliberately not swept — primitives carry no richer shape to preserve.

`isError` is a `const`-binding pattern, not a function declaration; the type-system
surface still widens via the JSDoc cast `import('@/error').isError` on the const
declaration. The cast continues to coerce the native-or-polyfill ternary result through
the new generic form. The native `Error.isError` is non-generic per its ES2025
declaration, but the cast at the binding site is what determines the public type — runtime
semantics are unchanged.

**Rationale.** Same as #031: the intersection `T & X` distributes through `T`'s union,
non-matching arms collapse to `never`, matching arms retain `T`'s shape augmented with
`X`'s guarantees, and `T = unknown` reduces to `X`. Backward-compatible at every existing
call site by construction. The sweep completes the package-wide consistency: every
type-guard predicate in `type-detection` now follows the same form.

**Consequences.** 21 generic-typed predicates across the four type-guard families. All
internal call sites within species-js continue to pass `unknown`-typed inputs (and
therefore see no behavioral change), except for the recursive `isError(prototype)` call
inside `hasErrorPrototypeContract` where `prototype: object` produces
`object & GenericError` — the boolean return is used at that call site, so no consumer
change is needed.

**Subtle finding — `(value = null)` parameter defaults are incompatible with the generic-T
signature.** Three predicates (`isEventTargetLike`, `isAbortSignalLike`, `isGenericError`)
had previously used the parameter-default-to-`null` pattern (decision #025) for nullish
unification. Under `<T = unknown>(value?: T)`, the parameter type widens to
`T | undefined` — and `null` is not assignable to `T | undefined` when `T` is generic. The
fix is to drop the default: the `!!value` body guard handles both null and undefined
identically at runtime, so the runtime semantics are preserved. The
parameter-default-to-`null` ruling still applies to non-generic predicates that use it for
strict-equality nullish unification — it just doesn't compose with the generic-T pattern
when both are wanted in the same signature. Watch for this interaction when refactoring
any future predicate that combines both patterns. Codified in
[[generic-predicate-pattern]] memory.

Commit `92784f8`. ARCHITECTURE.md § type-detection / function "Generic-typed predicates"
subsection updated with the same generalization-status and the `(value = null)` note.

---

## type-detection / thenable

### 022 — `PromiseLike<T>` defined as richer than TypeScript's lib `PromiseLike` (2026-06-04)

**Context.** The thenable migration needed a type for "anything Promise-shaped without
being a Promise instance" — the structural fallback that `isPromiseLike` narrows to.
TypeScript's lib has `PromiseLike<T>` already (in `lib.es5.d.ts`) but it is structurally
identical to our `Thenable<T>` (a single `then` method, nothing more).

**Decision.** Define a local `PromiseLike<T>` interface in `thenable.d.ts` that surpasses
the lib version on four dimensions:

1. Extends `Thenable<T>` with `catch` and `finally` to capture the full
   `Promise.prototype` method contract (ECMA-262 §27.2).
2. `out T` variance annotation, making the producer-only role explicit to TypeScript's
   variance checking.
3. `unknown` typing on rejection-channel reasons (the lib uses `any`, which leaks through
   every consumer).
4. No redundant `| undefined` on optional callbacks (the `?` already widens to
   `undefined`).

**Rationale.** The lib's `PromiseLike` is structurally identical to our `Thenable`. We
need a richer type for the middle tier of the lattice (something between `Thenable` and
`Promise`). Re-using the lib name with a richer structure is acceptable because the lib
version cannot express the chaining contract anyway — consumers reaching for "PromiseLike"
want the chaining surface; our definition gives them what they actually need. The variance
/ `unknown` / no-redundant-undefined precision wins follow the species-js precision
posture independently.

**Consequences.** Consumers of `@species-js/type-detection/thenable` get the richer
`PromiseLike`. The lib's `PromiseLike` still exists as a TypeScript global; the local
export shadows it within this module's imports. The lattice (`Thenable` → `PromiseLike` →
`Promise`) is captured in ARCHITECTURE.md § type-detection / thenable; the type's own
JSDoc captures the lib-surpass dimensions. Codified in [[design-rulings]] via the
contract-vocabulary ruling.

---

### 023 — `isPromise` rejects subclasses by strict constructor-name equality (2026-06-04)

**Context.** `isPromise(v)` uses `getDefinedConstructorName(v) === 'Promise'` as its third
marker. For a value `new (class MyPromise extends Promise {})((res) => res(1))`, the
constructor name resolves to `'MyPromise'`, which fails the strict equality.

**Decision.** `isPromise` rejects `Promise` subclasses. The constructor-name check stays
strict equality, not a constructor-chain walk that would admit subclasses.

**Rationale.** Foundation-tier predicates that downstream packages depend on benefit from
conservative narrowing — multiple cross-validating markers as bounded-cost insurance
against single-marker spoofing. Admitting subclasses would broaden the predicate's
contract without a clear benefit; consumers who specifically want subclass admission can
compose `isPromise` with `instanceof Promise` or a constructor-chain walk at their level.
The asymmetry is documented: `isPromiseLike` accepts subclasses (via `instanceof`);
`isPromise` does not. Each tier has its own discrimination boundary; subclass rejection
lands at the strictest tier where it makes sense.

**Consequences.** Native `Promise` instances pass; subclasses of `Promise` fail
`isPromise`. Documented as "deliberate strictness" in the predicate's JSDoc. Consumers
needing subclass admission compose accordingly. See ARCHITECTURE.md § type-detection /
thenable conservative-narrowing subsection for the broader posture.

---

### 024 — `hasInertMethod` factored as `@/utility` primitive (2026-06-04)

**Context.** The equip-js source's `isThenable` inlined the descriptor-walk +
accessor-rejection + callability-check logic. The thenable migration needed the same logic
for `doesMatchPromiseContract` (three times, for `then`/`catch`/`finally`). Inlining three
times would duplicate the inspect-without-invoke contract — and any future
Promise-adjacent or method-contract predicate would duplicate it again.

**Decision.** Factor `hasInertMethod(value, key)` as an `@/utility` primitive. Tests
whether the value carries a callable data property at `key`, reachable through its
prototype chain. Composes `getNextAvailablePropertyDescriptor` with
`objectHasOwn(descriptor, 'value')` rejection of accessor descriptors and
`isCallable(descriptor.value)` for the callability verification.

**Rationale.** The inspect-without-invoke contract is a reusable primitive, not a local
choice for one predicate. Extracting it to `@/utility` makes it composable for any future
method-contract predicate; the thenable module composes it four times (once in
`isThenable`, three times in `doesMatchPromiseContract`). The name `hasInertMethod` was
chosen over candidates like `hasTrustedMethod` (overloaded — "trusted against what?") and
`hasDataMethod` (spec-precise but obscures the safety frame) because "inert" is
metaphorical-but-universal (chemistry, physics, HTML all share the meaning) and conveys
the load-bearing safety guarantee without requiring the reader to internalize ECMA-262
descriptor terminology.

**Consequences.** `hasInertMethod` ships in `@/utility` as a public export. Used by
`isThenable` and `doesMatchPromiseContract` in the thenable module. Composes naturally for
any future method-contract predicate. The descriptor-walk pattern it embodies is captured
in decision #021 (the spec-shape rule's third pattern); the contract vocabulary it enables
is captured in [[design-rulings]] via the contract-vocabulary ruling.

---

### 037 — `AbortableThenable<T>` placement and design (2026-06-06)

**Context.** The equip-js source defined `AbortableThenable<T> extends Thenable<T>` with a
three-channel `then` (fulfillment, rejection, abort) typed against `AbortError`. The
species-js round had deferred this migration via Q.004 until the `@/error` migration
landed (decisions #032–#035 shipped `AbortError` on 2026-06-05). Three sub-questions
remained:

1. **Return-type from chained `then`** — should the chain stay typed as
   `AbortableThenable<...>`, or degrade to `Thenable<...>` after the first abort-aware
   `then`?
2. **Refinement axis** — should `AbortableThenable<T>` refine `Thenable<T>` (the
   structural floor) or `PromiseLike<T>` (the chaining-method contract)?
3. **Placement** — should the interface ship in `thenable.d.ts` (extending the existing
   lattice with a fourth tier) or as its own `abortable-thenable.{js,d.ts}` module?

**Decision.** Three concrete choices:

- **Return preserved-abortable.** `then<TResult1, TResult2, TResult3>` returns
  `AbortableThenable<TResult1 | TResult2 | TResult3>`. The chain stays abortable so
  consumers can keep using `.then(_, _, onAborted)` further down without re-narrowing.
  Matches the equip-js precedent and parallels how `PromiseLike.then` returns
  `PromiseLike<...>` (refinement preserved through chaining).
- **Refine `Thenable<T>`, independent from `PromiseLike<T>`.** The abort channel and the
  chaining-method contract are orthogonal axes of refinement; a value can satisfy both,
  neither implies the other. The lattice gains a parallel branch: `Thenable<T>` is the
  structural floor, `PromiseLike<T>` adds chaining sugar, `AbortableThenable<T>` adds the
  abort channel, and `Promise<T>` is the realm-fixed intrinsic combining the chaining
  refinement.
- **Ship in `thenable.d.ts`, type-only, no predicate.** The interface lives in the
  existing `thenable.d.ts` rather than its own module — the lattice belongs together, and
  there is no `.js` runtime side. No `isAbortableThenable` predicate exists because a
  `Thenable` with a two-argument `then` and one with a three-argument `then` are
  runtime-indistinguishable (the third callback is optional, and a two-argument `then`
  gracefully ignores extras). The `.length` heuristic is spoof-trivial and not
  spec-required. Type-only documentation contract.

Refinements over the equip-js source landed alongside the migration: `out T` covariance
annotation matching `Thenable<T>` and `PromiseLike<T>` (decision #022); dropping the
redundant `| undefined` on optional callbacks (the `?` already widens, matching the
existing precision).

**Rationale.** Each choice has its own framing:

- **Return-preservation** matches the way `PromiseLike` already refines `Thenable.then`'s
  return to `PromiseLike` — refinement persistence through chaining is the established
  pattern in the lattice. Degrading to bare `Thenable<...>` after the first call would
  force consumers to re-narrow at every chain link, which loses the contract's value at
  the type-system level.
- **`Thenable<T>` refinement axis** keeps the abort channel orthogonal to the chaining
  surface. A consumer can model an abortable producer that returns a raw thenable without
  forcing `catch`/`finally` on the producer; conversely, a consumer can model a
  PromiseLike producer without forcing the abort channel.
- **Placement in `thenable.d.ts`** keeps the lattice together as a single conceptual unit.
  The interface is type-only — there is no runtime predicate to extract — so the "sibling
  pair vs subfolder" question of [[package-structure]] is moot; the file pair stays as-is.
- **No predicate** matches the realistic ceiling on runtime discrimination. The equip-js
  source also shipped no predicate for the same reason; that choice is preserved.

**Consequences.** Public surface: `AbortableThenable<T>` interface in
`@/type-detection/thenable`. Cross-module abort-channel surface is now complete across
three modules: `@/error` for the rejected-value side (`AbortError`, `AbortErrorName`,
`isAbortError`), `@/evented` for the producer side (`AbortSignalLike` /
`isAbortSignalLike` / `AbortSignal` / `isAbortSignal`), and `@/thenable` for the consumer
side (`AbortableThenable<T>`). The previously-deferred Q.004 is resolved. `evented.d.ts`'s
`AbortSignalLike` JSDoc's "Future use" forward-reference is updated to the current-state
cross-module description, replacing the deferred-to-error-migration framing. The thenable
module's `@module` doc is updated to mention the two independent refinements
(`PromiseLike` and `AbortableThenable`) of the `Thenable<T>` floor.

Commit `b234589`. See ARCHITECTURE.md § type-detection / thenable for the lattice's
positioning and the conceptual map.

---

## type-detection / evented

### 027 — `EventTargetLike` / `AbortSignalLike` defined locally rather than re-exporting the DOM globals (2026-06-04)

**Context.** TypeScript's `lib.dom.d.ts` declares global `EventTarget` and `AbortSignal`
interfaces with the structural shapes the evented module needs. Unlike the thenable
round's #022 — where the lib's `PromiseLike` was strictly poorer than what we needed — the
lib's `EventTarget` is structurally compatible with the duck-typed contract: a value
satisfying our `EventTargetLike` also satisfies the lib's `EventTarget` and vice versa.
`AbortSignal` is partially compatible — the lib carries more members than the structural
contract requires (see #030).

**Decision.** Define local `EventTargetLike` and `AbortSignalLike` interfaces in
`evented.d.ts` rather than re-exporting the DOM globals. `EventTargetLike` mirrors the
lib's `EventTarget` shape precisely (including `EventListenerOrEventListenerObject`,
`AddEventListenerOptions`, `EventListenerOptions`). `AbortSignalLike` extends
`EventTargetLike` with the minimum spec-required testable surface —
`readonly aborted: boolean` and `throwIfAborted(): void`.

**Rationale.** Three reasons converge:

- **Duck-typing intent at the type-name level.** `isEventTargetLike` narrows to a "Like"
  name, signaling the structural-contract reading. Re-exporting `EventTarget` would lose
  the distinction at the predicate site between "is a member of the EventTarget set
  structurally" and "is the EventTarget intrinsic."
- **Package-owned predicate target.** The package controls evolution of its type. If
  `lib.dom.d.ts` adds a method to `EventTarget` in a future TS release, the predicate's
  contract doesn't automatically change.
- **Runtime-without-DOM usability.** Environments lacking the DOM lib still get a usable
  contract type from this package alone.

**Consequences.** Consumers of `@species-js/type-detection/evented` get the local types.
The lib's globals still exist; the local exports live in their own namespace. The
`AbortSignalLike` minimum-surface choice — which members are deliberately omitted — is
captured separately in #030.

---

### 028 — `isEventTarget` / `isAbortSignal` reject subclasses by strict constructor-name equality (2026-06-04)

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
pattern visible at the architectural layer (`ARCHITECTURE.md` § type-detection / thenable
"Conservative-narrowing in the Promise domain" subsection, and the analogous evented
section's subsection).

---

### 029 — `aborted` accessor direct-read exception to the spec-shape rule's third pattern (2026-06-04)

**Context.** Decision #021 codified a third pattern for the spec-shape access rule:
predicates over inherited properties use descriptor-walk for inspection without
invocation, via `hasInertMethod` and its `objectHasOwn(descriptor, 'value')` rejection of
accessor descriptors. The pattern's load-bearing claim is "no getter fires during the
check." `AbortSignalLike` requires verifying that `aborted` is a boolean — but the spec
defines `aborted` as `[GetterAttribute] readonly attribute boolean`. Native `AbortSignal`
instances return an accessor descriptor for `aborted`. Using `hasInertMethod` here would
reject every native `AbortSignal`.

**Decision.** `doesMatchAbortSignalContract` uses a direct `(value).aborted` read for the
`aborted` boolean check, accepting the spec-defined accessor. The `throwIfAborted` check
still goes through `hasInertMethod` because `throwIfAborted` is a data-property method on
`AbortSignal.prototype` and matches the third pattern cleanly.

**Rationale.** This is a documented deviation from #021, not a violation. The third
pattern's load-bearing contract is "no getter fires that shouldn't fire by spec." For
`aborted`, the spec REQUIRES the getter — the property IS an accessor by spec definition.
Rejecting accessor descriptors here would block the spec contract. The `&&` chain in
`doesMatchAbortSignalContract` ensures the direct read fires only after
`hasInertMethod(value, 'throwIfAborted')` passes — which guarantees `value` is non-nullish
via the parameter-default-to-`null` pattern (#025), so the access can't crash on
null/undefined input.

**Consequences.** Native `AbortSignal` instances correctly pass
`doesMatchAbortSignalContract`. The `aborted` access still triggers any getter the value
carries — but a value whose `aborted` getter throws is, by spec, malformed (the spec
getter just returns the internal state and is side-effect-free). The rule generalizes:
descriptor-walk when invocation is unsafe per the predicate's contract; direct-read when
the spec defines the property as an accessor and invocation IS the spec-required path. The
`&&` chain ordering becomes load-bearing in such cases — the nullish-safe gate must come
first. Future spec-defined accessor properties on other contracts (e.g., `Iterator`'s
`done` flag, ReadableStream's `locked` flag) may need similar exception handling.

---

### 030 — `AbortSignalLike` minimum-surface choice — omit `reason`, `onabort`, and typed-event-map overloads (2026-06-04)

**Context.** The lib's `AbortSignal` interface carries `readonly reason: any`,
`onabort: ((this: AbortSignal, ev: Event) => any) | null`, and the `AbortSignalEventMap`
overloads for `addEventListener` / `removeEventListener`. Each represents a real spec
member. The question was which to include in `AbortSignalLike`.

**Decision.** Include only the two members that are spec-required AND structurally
testable without invoking accessors the spec doesn't require: `readonly aborted: boolean`
and `throwIfAborted(): void`. Omit `reason`, `onabort`, and the typed-event-map overloads.

**Rationale.** Each omission has its own reason:

- **`reason: any`** — no structural constraint to verify. `any` accepts anything; the
  predicate has nothing to test beyond presence, and presence alone is uninformative (an
  absent `reason` is still spec-conformant — its presence depends on whether the signal
  has been aborted).
- **`onabort`** — sugar over the EventTarget contract that is already validated.
  Registering a single-property event listener is convenience over `addEventListener`; the
  underlying capability is the `addEventListener` already required by `EventTargetLike`.
- **Typed-event-map overloads** — TypeScript convenience for IDE autocomplete on
  `addEventListener('abort', …)`; not part of the runtime contract. Including them in the
  structural interface would not affect runtime detection but would couple the interface
  to the lib's `AbortSignalEventMap` evolution.

**Consequences.** `AbortSignalLike` is intentionally smaller than the lib's `AbortSignal`.
Any value satisfying our `AbortSignalLike` satisfies a subset of the lib's `AbortSignal`
contract — sufficient for the abort-channel scenarios this module supports. Consumers
needing the full lib interface should narrow further from `AbortSignalLike` to
`AbortSignal` via `isAbortSignal`. The line is drawn at "what's structurally testable
without invoking accessors the spec doesn't require." Applicable forward to any future
interface migrations (Iterator protocol, EventEmitter, etc.) — the same principle of
"include only the spec-required + structurally-testable surface" applies.

---

## type-detection / error

### 032 — Error predicates: layered composition with native-or-polyfill capture (2026-06-05)

**Context.** The equip-js source had five public exports for error discrimination —
`isCurrentRealmError`, `isAlienRealmError`, `isGenericError`, `isError`, `isAbortError` —
plus an internal `hasMatchingErrorPrototype` helper. The first three were the
realm-fast-path / structural-fallback / composing-polyfill triple. `isError` captured
native `Error.isError` when available; otherwise it delegated to the polyfill.
`isAbortError` was a suffix-match refinement. The migration question was whether to port
all six surfaces verbatim or to consolidate them per the established lattice patterns from
`thenable` and `evented`.

**Decision.** Collapse the realm-fast-path / structural-fallback split into a single
polyfill body, mirroring the way `isEventTargetLike` (#027) and `isPromiseLike` (thenable
round, #022) compose their `instanceof <Constructor>` fast path with
`doesMatch<X>Contract` structural fallback inside one predicate without exposing the two
halves separately. The resulting composition stack:

1. `hasErrorPrototypeContract` (`@internal`) — descriptor-walk sub-helper that verifies
   the four `Error.prototype` own descriptors (`constructor`, `message`, `name`,
   `toString`) plus a trailing-`'Error'` `name` marker, with a recursive `isError`
   fallback for the prototype-itself-is-an-Error case (`Object.create(new Error())`).
2. `doesMatchErrorContract` (`@internal`) — structural fallback dispatcher; admits
   `[[Class]]` tag `'[object Error]'` (every `[[ErrorData]]`-bearing value per ECMA-262
   §20.1.3.6 step 17), `'[object DOMException]'` (WebIDL's separate tag), or
   `'[object Object]'` with prototype passing `hasErrorPrototypeContract` (the legacy
   `Object.create(Error.prototype)` and ES3-style cases). Parallel to
   `doesMatchPromiseContract` (thenable), `doesMatchEventTargetContract`,
   `doesMatchAbortSignalContract` (evented).
3. `isGenericError` (`@internal`) — polyfill body that composes `value instanceof Error`
   (realm-fast-path) with `doesMatchErrorContract` (structural fallback) inside a single
   predicate. Inlines what equip-js had exposed as separate `isCurrentRealmError` and
   `isAlienRealmError` exports.
4. `isError` (public) — captures native `Error.isError` at module-load when the runtime
   provides it (ES2025+); falls back to `isGenericError` otherwise. Bound as
   `const isError = isFunction(nativeIsError) ? nativeIsError : isGenericError`. The
   capture is realm-fixed — later tampering with `globalThis.Error.isError` does not reach
   this binding, mirroring the realm-fixed pattern used for cached `@/config` primitives.
5. `isAbortError` (public) — refines `isError` via name-suffix match against
   `AbortErrorName`; see #035.

**Rationale.** Three forces converge on the consolidated shape:

- **Lattice symmetry with thenable / evented.** Each higher-level subdomain has the same
  shape: `@internal` structural sub-helper(s), `@internal` contract dispatcher, public
  umbrella predicate, optional refined predicate. Maintaining that symmetry across
  subdomains keeps the docs and the mental model uniform — a contributor reading one
  module's structure can navigate any other module's by the same shape.
- **Surface minimalism.** Equip-js exposed five public predicates where two suffice. The
  realm-fast-path / structural-fallback split is implementation, not interface; collapsing
  them into `isGenericError` removes two exports without losing capability (the polyfill
  body remains exported `@internal` for testing and for callers wanting polyfill semantics
  irrespective of native).
- **Native-or-polyfill capture at module-load.** `Error.isError` only exists in ES2025+
  runtimes (Node 23+, modern browsers). Capturing once at module-load — as opposed to
  re-reading `globalThis.Error.isError` at each call — makes the binding realm-fixed and
  immune to later tampering, matching the realm-fixed posture used for cached `@/config`
  primitives.

**Consequences.** Public surface: `GenericError`, `AbortErrorName`, `AbortError`,
`isError`, `isAbortError`. `@internal` surface: `ErrorConstructorES2025`,
`ErrorConstructorWithIsError`, `hasErrorPrototypeContract`, `doesMatchErrorContract`,
`isGenericError`. Five fewer top-level public surfaces than the equip-js source. The
polyfill widening semantic — what `isGenericError` admits beyond the spec-precise
`[[ErrorData]]` check — is captured separately in #033. The `objectCreate` boundary
retyping that the descriptor walk depends on for clean typing is captured in #034.
`AbortError` as a name-suffix refinement is captured in #035. See ARCHITECTURE.md §
type-detection / error for the conceptual map.

---

### 033 — Polyfill widening semantics over the unobservable `[[ErrorData]]` slot (2026-06-05)

**Context.** ECMA-262 §20.5.2.2 `Error.isError(v)` returns `true` if `v` carries the
internal `[[ErrorData]]` slot. The slot is set by `OrdinaryCreateFromConstructor` inside
the `Error` constructor (and inherited by every built-in subclass — `TypeError`,
`SyntaxError`, etc. — plus user-defined `class X extends Error` instances) and by the
WebIDL `DOMException` spec. The slot is _unobservable_ from userland code; the spec
predicate cannot be implemented in pure JS without engine support. The polyfill body
`isGenericError` therefore has to approximate `[[ErrorData]]` with a structural heuristic.
The migration question was where to draw the polyfill's acceptance line.

**Decision.** The polyfill widens to admit values that lack `[[ErrorData]]` but match the
structural Error contract. `isGenericError(v)` accepts:

1. `v instanceof Error` (local realm — covers every `[[ErrorData]]`-bearing value in this
   realm).
2. `getTypeSignature(v) === '[object Error]'` (every realm's Error-tagged value;
   `Object.prototype.toString` returns `'[object Error]'` for any value carrying
   `[[ErrorData]]` per ECMA-262 §20.1.3.6 step 17, so this catches cross-realm Errors).
3. `getTypeSignature(v) === '[object DOMException]'` (WebIDL's separate tag).
4. `getTypeSignature(v) === '[object Object]'` AND `hasErrorPrototypeContract(v)` (the
   legacy widening — `Object.create(Error.prototype)` and ES3-style classical- inheritance
   Errors whose `[[Prototype]]` walks like an Error prototype but never went through the
   `Error` constructor and so lack `[[ErrorData]]`).

The first three cases align with the spec; the fourth widens beyond it.

**Rationale.** Two postures are defensible. _Spec-precise_ would reject the legacy cases
on the grounds that they lack the formal `[[ErrorData]]` invariant, accepting that
existing JS code relying on `Object.create(Error.prototype)` would silently lose
recognition. _Polyfill widening_ admits them on the grounds that the heuristic is the best
userland can do, and the equip-js source has shipped this acceptance set for years in
production downstream code. The species-js round preserves the equip-js admission set
because:

- The package is foundation-tier infrastructure. Six downstream packages (`cadence-js`,
  `equip-js`, `cambium-js`, `talented-js`, `modulate-js`, `inflect-js`) and their
  consumers may have code that constructs errors via `Object.create(Error.prototype)` or
  the ES3-classical pattern. Tightening to spec-precise would break recognition silently.
- The native path is spec-precise. When `Error.isError` is available, `isError` delegates
  to it — the polyfill widening only affects runtimes where the native method is missing.
  Modern production runtimes converge on the spec; legacy runtimes get the widened
  heuristic for backward compatibility.
- `isGenericError` is exported `@internal` _and_ documented as the polyfill body. A
  consumer who wants strict spec semantics reaches for the public `isError` (which
  delegates to native when available); a consumer who wants the widened polyfill semantics
  irrespective of runtime reaches for `isGenericError` explicitly.

**Consequences.** Values like `Object.create(Error.prototype)` and ES3-style
classical-inheritance Errors are admitted by `isGenericError` (and by `isError` in
runtimes lacking native `Error.isError`). The polyfill/native divergence is documented in
`isError`'s JSDoc: _"The two forms agree on well-behaved code and diverge only on the
legacy edge cases the polyfill admits."_ The `hasErrorPrototypeContract` sub-helper (see
#032) carries the descriptor-walk heuristic that implements the widening — its five checks
(four `Error.prototype` member presence/type assertions plus a trailing- `'Error'` `name`
marker) are the structural-shape proxy for the unobservable `[[ErrorData]]`. The
trailing-`'Error'` `name` check reads through the descriptor chain rather than invoking
`prototype.toString()`, both for the `no-base-to-string` ESLint workaround (see
[[quality-discipline]]) and because the descriptor read aligns with the spec-shape rule
(#020, #021) for own-data properties.

---

### 034 — Boundary-retyping at `@/config` for `objectCreate` (2026-06-05)

**Context.** `Object.create` is typed by `lib.es5.d.ts` as `any`-returning on both
overloads — `(o: object | null) => any` for the no-properties form and
`(o: object | null, properties: PropertyDescriptorMap & ThisType<any>) => any` for the
property-bearing form. The `any` return propagates
`@typescript-eslint/no-unsafe-assignment` cascades at every consumer that captures the
result for a sentinel or lookup-table object. During the error-migration debugging round,
the original equip-js implementation used `objectCreate(null)` to construct a
blank-descriptor sentinel; the `any` return propagated through several intermediate casts
and lit up the cascade across `error.js`.

**Decision.** Retype the cached primitive at `@/config` to overload-precise return types,
mirroring the precedents from #008 (`toFunctionString`), #017 (`getPrototypeOf`), and #026
(the three `Number.isXxx` predicates). `objectCreate(null)` yields
`Record<PropertyKey, never>` — the prototype-less floor that `BlankType` in `@/utility`
carries. `objectCreate(prototype)` yields `object`. The two-argument form
`objectCreate(prototype | null, properties)` yields `object`, with `ThisType<unknown>`
replacing lib's `ThisType<any>` per the package's typing discipline. The runtime `.js`
export is unchanged — only the type narrows.

**Rationale.** Same lib-gap pattern as the prior boundary retypings. Call-site casts
launder the same `any` through the same shape over and over; retyping at the boundary
fixes it once. The three-overload form preserves spec semantics: `Object.create(null)`
produces an object with no prototype (structural floor = no keys), and the other forms
produce objects whose `[[Prototype]]` is the supplied prototype. The
`Record<PropertyKey, never>` choice for the no-prototype case is the strictest honest type
— TypeScript cannot express "no prototype chain" at the type level, but it can express "no
statically-known keys," which is the closest structural proxy and mirrors `BlankType` in
`@/utility` (used precisely as a blank-descriptor sentinel). The `ThisType<unknown>` swap
is independent and pedantic — `ThisType` only affects the inferred `this` context inside
descriptor methods, and the package's typing discipline prefers `unknown` over `any`
everywhere it can.

**Consequences.** Fourth instance of the boundary-retyping pattern, after #008
(`toFunctionString`), #017 (`getPrototypeOf`), and #026 (the three `Number.isXxx`
predicates). The pattern is now consistently applied to every cached `@/config` primitive
whose lib type would otherwise propagate `any` downstream. Discovered during the
error-migration debugging round — not during the function, thenable, or evented rounds —
which suggests there may be other cached primitives whose lib types deserve scrutiny. A
future sweep through `@/config` for remaining `any`-leaks is worth a pass. Codified in
[[design-rulings]] alongside the meta-observation about TS lib types being _conservative
simplifications_ that benefit from boundary closure.

---

### 035 — `AbortError` as a name-suffix refinement via template-literal type (2026-06-05)

**Context.** The DOM WHATWG `AbortSignal.abort()` rejects with a `DOMException` whose
`name` is `'AbortError'`. `AbortController.abort()` propagates the same convention.
Userland abortable operations frequently prefix their own qualifier
(`'TimeoutAbortError'`, `'UserAbortError'`, `'NavigationAbortError'`) to disambiguate the
cause without losing the convention. The migration question was how to model "the
abort-channel error naming convention" at both the type and predicate levels.

**Decision.** Model the convention via a template-literal type plus a suffix-match
predicate.
`AbortErrorName = `${string}AbortError`` is the public template-literal type carrying the naming convention; it admits the empty-prefix case (`'AbortError'`itself) and arbitrary qualifier prefixes uniformly.`AbortError
= GenericError & { name: AbortErrorName
}`is the public structural intersection layering the suffix-typed`name`field over the base error union.`isAbortError(v):
v is
AbortError`is the public refined predicate; it composes`isError(v)`with`v.name.endsWith('AbortError')`suffix-match. Short-circuit`&&`runs`isError`first as the cheaper gate; the suffix check fires only after the value is confirmed an Error (which also guarantees`name`
is a string per the Error contract).

**Rationale.** Three forces converge:

- **Suffix-match over exact equality.** Exact equality (`v.name === 'AbortError'`) would
  reject the legitimate qualified variants that the convention explicitly permits. The
  empty-prefix case is included by the template-literal pattern, so the suffix form covers
  both qualified and unqualified instances uniformly.
- **Template-literal type over plain `string`.** `${string}AbortError` carries _real_
  structural information (every assignable string ends with the suffix). It is more
  informative than `string` at the type level, and it documents the convention at the type
  signature where consumers see it. Template-literal types collapse to `string` at the
  runtime level, so the type is structural documentation rather than a runtime guarantee —
  the runtime guarantee is `isAbortError`'s `endsWith` check.
- **Separation from abort-channel mechanics.** `isAbortError` checks _error names only_.
  It does not inspect `AbortSignal.aborted`, link to an `AbortController`, or verify
  abort-channel mechanics. Producer-side inspection of the abort channel belongs to
  predicates in the `evented` module (`isAbortSignal`, `isAbortSignalLike` — see #027,
  #028, #029). The error module discriminates the error _value_; the evented module
  discriminates the channel _producer_. Keeping that separation clean means consumers
  doing error-handling reach for `isAbortError`, consumers doing channel inspection reach
  for `isAbortSignal`, and the two modules don't conflate concerns.

**Consequences.** `isAbortError(new DOMException('aborted', 'AbortError'))` returns
`true`; same for any custom Error class with a name ending in `'AbortError'`.
`isAbortError({ name: 'AbortError' })` returns `false` (not an Error — fails the `isError`
gate). The predicate is the refined narrow target for any consumer discriminating
abort-channel errors from other errors. The future `AbortableThenable<T>` (Q.004) will
type its abort-channel reason against `AbortError`, completing the cross-module
abort-channel surface the thenable round forward-referenced (`AbortSignalLike` in evented;
`AbortError` here; `AbortableThenable<T>` deferred to its own round). See ARCHITECTURE.md
§ type-detection / error for the lattice's positioning within the package.

---

## type-detection / primitive

### 038 — Primitive module migration: full surface across five families (2026-06-07)

**Context.** The `@species-js/type-detection/primitive` module had shipped as a stub
during the early-scaffolding rounds: 5 `typeof`-based value predicates (`isStringValue`,
`isNumberValue`, `isBooleanValue`, `isSymbolValue`, `isBigIntValue`) and zero types. Boxed
coverage and composite predicates were intentionally deferred — the stub was sized for
what other migrated modules immediately needed (descriptor reads, `typeof` checks for
value-narrowing) rather than for the full primitive-discrimination surface. The equip-js
source had a richer surface: 5 boxed types, 5 composite types, 5 boxed predicates, and 5
composite predicates, in addition to the value-only set. The migration question was
whether to port the full surface and, if so, how to reshape the boxed-predicate marker
chain for species-js conventions.

**Decision.** Ship the full surface — 15 types and 15 predicates across the five primitive
families (`string`, `number`, `boolean`, `symbol`, `bigint`). Per family:

- `XValue` — type alias for the built-in primitive (e.g. `StringValue = string`).
- `BoxedX` — boxed wrapper-object type (e.g. `BoxedString = String & object`); the
  `& object` intersection is the load-bearing distinction from the primitive form.
- `XType` — composite union (`XValue | BoxedX`).
- `isXValue` — primitive form via `typeof`.
- `isBoxedX` — boxed form via three cross-validating structural markers (see #039 for the
  marker-chain design).
- `isX` — composite predicate via `isXValue || isBoxedX`, short-circuit with the cheaper
  primitive check first.

**Boxed-predicate marker chain.** Three markers compose, ordered performance-first:
`typeof value === 'object'` (O(1) primitive-rejection gate), then the `[[Class]]` tag read
(e.g. `getTypeSignature(value) === '[object String]'`, cross-realm-safe via the
realm-fixed `toObjectString.call` capture), then the constructor-name walk (e.g.
`getDefinedConstructorName(value) === 'String'`, cross-realm-safe via the four-source
fallback). The chain mirrors the structural-gate-then-identity-markers pattern from
`isPromise` (#023) and `isEventTarget` / `isAbortSignal` (#028): a fast structural gate,
then two realm-independent identity refinements. The three markers form the
conservative-narrowing posture (#010) — bounded-cost insurance against single-marker
`Symbol.toStringTag` spoofing.

The `typeof === 'object'` gate runs first because it's the cheapest and the most
discriminating against typical inputs (primitives, `undefined`, functions all reject in
O(1)). `null` is admitted by the `typeof` gate but rejected by the tag check via
`'[object Null]'`. The constructor walk is the most expensive step but provides the final
cross-validator against spoofed tags.

**Wrapper-object types.** The boxed types (`BoxedString = String & object`,
`BoxedNumber = Number & object`, etc.) intentionally use the TypeScript wrapper-object
types as the load-bearing distinction from the primitive form. The
`@typescript-eslint/no-wrapper-object-types` rule's default advice ("prefer the primitive
`string` over `String`") is correct for typical code but wrong here: this is precisely the
case where the wrapper-object type is the structural model. Added a per-file ESLint
override scoped to `**/src/primitive.d.ts`, with rationale, matching the existing
override-with-rationale style in `eslint.config.js`. Per the zero-`eslint-disable` policy
([[quality-discipline]]), the fix is configuration at the right level, not inline
suppression.

**File-level structure.** Per-family sectioning (types and predicates for one family
grouped together) over types-then-predicates. The five families are independent
(string-discrimination doesn't compose with number-discrimination), so reader-locality
wins over cross-family grouping. The family order follows the ECMA-262 `typeof`
return-value order (`string`, `number`, `boolean`, `symbol`, `bigint`) which has
structural meaning, not the stub's roughly-alphabetical order.

**Rationale.** Foundation-tier completeness for the primitive module: now that the
function / thenable / evented / error modules have all migrated, the primitive module is
the last incomplete corner of `type-detection`. The boxed coverage is the structurally
honest extension — every JavaScript primitive has a boxed wrapper form reachable via
`Object(...)` or `new String(...)` etc., and discriminating them is a real need for any
code that handles user input or cross-realm values. The composite predicates (`isString`,
`isNumber`, etc.) admit both forms transparently for the common case where the distinction
doesn't matter.

**Consequences.** Public surface: 5 value types, 5 boxed types, 5 composite types, 5 value
predicates, 5 boxed predicates, 5 composite predicates — 30 exports total. Cross-module:
the value-only predicates (already used by `@/utility`, `@/error`, etc.) keep their
signatures (now generic, see #039). The boxed and composite predicates are new public
surface for downstream consumers. ESLint config gains one per-file override. The full
type-detection package's primitive-discrimination ceiling is now reached; further
extensions would belong in a different module (e.g. nominal branding in
`@species-js/type-identity`).

Commit `5c5dbe7`. See ARCHITECTURE.md § type-detection / primitive for the conceptual map.

---

### 039 — Generic-predicate pattern extended to the primitive family (supersedes #036's exclusion) (2026-06-07)

**Context.** Decision #036 swept the generic predicate pattern
(`<T = unknown>(value?: T): value is T & X`) across `thenable`, `evented`, and `error`
families. The decision's closing exclusion read: _"Primitive predicates (`isStringValue`,
`isNumberValue`, etc.) don't benefit — primitives have no richer shape to preserve — and
stay as-is."_ That reading was correct for the value-only predicates as a narrow matter
(their narrow targets are bare primitive types) but missed two facts that surfaced during
the primitive module migration (#038):

1. **Literal-union callers benefit.** A caller with `value: 'on' | 'off' | number` narrows
   to `'on' | 'off'` after `isStringValue(value)` under the generic form, versus
   collapsing to bare `string` under the non-generic form. Real, if niche, value.
2. **The boxed and composite predicates clearly need it.** The new `isBoxedString`,
   `isBoxedNumber`, etc. narrow to wrapper-object types (`String & object` etc.) which
   carry richer shape. The composite `isString`, `isNumber`, etc. narrow to
   `XValue | BoxedX` unions; the generic intersection distributes through the union and
   preserves caller-side narrowing on both arms. If the boxed/composite predicates get the
   generic pattern but the value-only ones don't, the family becomes internally
   inconsistent — three sibling predicates in each family with two different signature
   shapes for no principled reason.

**Decision.** Apply the generic pattern to all 15 predicates in the primitive module
uniformly — value-only, boxed-only, and composite. Supersedes #036's value-only exclusion.
The package-wide form is now: every type-guard predicate (`isCallable` through
`isBigIntValue`) follows `<T = unknown>(value?: T): value is T & X`.

**Rationale.** Three forces converge:

- **Consistency within the family.** Three predicates per family with two signature shapes
  (value-only non-generic, boxed/composite generic) would be confusing for consumers and
  require explanation. One uniform shape across the family is the honest choice.
- **Real benefit for literal-union narrowing.** The case may be niche but is real —
  consumers writing `if (isStringValue(action))` on a `'play' | 'pause' | 0 | 1` union get
  the precise `'play' | 'pause'` narrow under the generic form. Under the non-generic form
  they get bare `string`, losing the literal-union information.
- **Same closure logic as #031.** The boundary-retyping pattern (decisions #008, #017,
  #026, #034) closes call-side `any`-cascades at `@/config`; the generic-predicate pattern
  closes narrow-side narrowing-loss at the predicate declaration. The pattern doesn't care
  whether the narrow target is a function type, an object interface, or a primitive type —
  it preserves caller-side T through the guard in all three cases.

**Consequences.** Five primitive value predicates get the generic upgrade alongside the
ten new boxed/composite predicates. Package-wide tally: 36 generic-typed predicates across
`@/function` (11) + `@/thenable` (3) + `@/evented` (4) + `@/error` (3) + `@/primitive`
(15). The exclusion text in #036's Consequences section ("don't benefit — stay as-is") is
now historical context, not an active ruling; this decision supersedes it explicitly. The
codified [[generic-predicate-pattern]] memory carries the updated full-coverage status.

Commit `5c5dbe7`. See ARCHITECTURE.md § type-detection / primitive for the
family-pattern's expression on primitives.

---

## Open questions

These are not decisions but acknowledged open questions, kept here so they don't dissolve
into folklore.

### Q.001 — `getDefinedConstructorName` direct-access vs. descriptor read (RESOLVED 2026-06-03 by decision #020)

Resolved by adopting the spec-shape access-path rule. `getDefinedConstructorName` now
reads `name` via the property descriptor without a direct-access fallback (`name` is own
data per ECMA-262 §10.2.9, so the descriptor read is canonical). `getDefinedConstructor`'s
meta-constructor steps stay on direct access (inherited per spec; the engine's
prototype-chain walk is the spec-correct resolution). See decision #020 for the framing
and the broader rule.

### Q.002 — Public-predicate bound-admission policy now that bound detection is cheap

The fingerprint matrix from decision #009 shows that bound detection is closed-form via
`own_proto: false` plus `name.value.startsWith('bound ')`. The strict/lenient asymmetry
that motivated decision #005's bound-admission rule is no longer load-bearing — every
species now has cheap bound and unbound discrimination from the same primitives. What
remains is the _policy_ question: which public predicates should be strict-bound (reject
bound) versus lenient-bound (admit bound) now that both flavors cost roughly the same? The
current shipped behavior is preserved (newable strict, non-newable lenient). Revisiting is
the user's call.

### Q.003 — `@species-js/function-introspection` scope

Per decisions #005, #013, and #016, `function-introspection` is the host for
source-parsing predicates that genuinely require `Function.prototype.toString.call`. Two
predicates currently belong there: the arrow-vs-concise distinguisher (the one true
collision the fingerprint schema cannot resolve), and `isBoundFunction` (the
spec-unreliable bound tell). The package has not yet been scaffolded. Whether it lives as
a standalone package or as a subpath of type-detection is open.

### Q.004 — `AbortableThenable<T>` deferred to the `@/error` migration (RESOLVED 2026-06-06 by decision #037)

The equip-js source defined `AbortableThenable<T> extends Thenable<T>` with an `onaborted`
callback typed against `AbortError`. The species-js `Thenable<T>` doc references this as a
strict refinement reserved for a separate type, but `AbortError` lives in `@/error`, which
is the next equip-js migration. Once `@/error` lands and `AbortError` is available,
`AbortableThenable<T>` can extend naturally from the existing `Thenable<T>` — the
type-system shape and the abort-channel predicate are both deferrable as one round when
the dependency is in place. Whether `AbortableThenable` ships in `thenable.d.ts`
(extending the lattice with a fourth tier) or as a separate `abortable-thenable.{js,d.ts}`
module is open; the question opens once the dependency is in scope.

**Update 2026-06-05** — the `@/error` migration shipped (decisions #032–#035, commit
`667e12b`). `AbortError`, `AbortErrorName`, and the broader `GenericError` union are now
available. The dependency that gated this question is in place. The remaining decision —
whether `AbortableThenable<T>` ships as a fourth tier extending `Thenable<T>` inside
`thenable.d.ts`, or as a separate `abortable-thenable.{js,d.ts}` module — is now ready to
be answered in its own round. Reserved for a follow-up session.

**Resolved 2026-06-06 by decision #037** — `AbortableThenable<T>` ships in `thenable.d.ts`
(placement question answered) as an independent refinement of `Thenable<T>`
(refinement-axis question answered), with chained `then` returning
`AbortableThenable<TResult1 | TResult2 | TResult3>` (return-type question answered). No
predicate (runtime indistinguishability of two-arg vs three-arg `then`). Commit `b234589`.
See decision #037 for the full design rationale.

---

_End of the decision log. Future package/module decision sections are appended above this
note (above the `## Open questions` section); open questions for any section live in the
global `## Open questions` section above._
