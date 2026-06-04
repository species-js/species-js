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

### Q.004 — `AbortableThenable<T>` deferred to the `@/error` migration

The equip-js source defined `AbortableThenable<T> extends Thenable<T>` with an `onaborted`
callback typed against `AbortError`. The species-js `Thenable<T>` doc references this as a
strict refinement reserved for a separate type, but `AbortError` lives in `@/error`, which
is the next equip-js migration. Once `@/error` lands and `AbortError` is available,
`AbortableThenable<T>` can extend naturally from the existing `Thenable<T>` — the
type-system shape and the abort-channel predicate are both deferrable as one round when
the dependency is in place. Whether `AbortableThenable` ships in `thenable.d.ts`
(extending the lattice with a fourth tier) or as a separate `abortable-thenable.{js,d.ts}`
module is open; the question opens once the dependency is in scope.

---

_End of the decision log. Future package/module decision sections are appended above this
note (above the `## Open questions` section); open questions for any section live in the
global `## Open questions` section above._
