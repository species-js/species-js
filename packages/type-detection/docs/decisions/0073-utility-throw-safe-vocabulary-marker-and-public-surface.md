# 073 — Utility throw-safety vocabulary: `Inert`/`Safe` disentanglement, the `@@throw-safe` marker, and the settled public surface

**Date:** 2026-07-23

**Context.** The utility module conflated two orthogonal safety properties under the
single word "inert":

1. **throw-safety** — a read wrapped in `try/catch` so a hostile `Proxy` trap yields a
   sentinel (`undefined` / `false` / `[]`) instead of propagating (decisions #029, #056).
2. **getter-inertness** — inspection that never invokes an accessor getter (the
   descriptor-`value`/`get`/`set` reads behind `hasInertMethod` and its siblings).

A helper may be one, both, or neither — a raw descriptor walk is getter-inert yet can
throw; `getSafeOwnPropertyNames` is throw-safe yet touches no accessor. But the vocabulary
(`getInert*`, "inert probes", "raw/inert pairing") named only "inert", so a name could not
tell a reader whether a helper swallows throws, avoids getter-invocation, or both. The
surface had drifted alongside: several throw-safe readers were tagged `@internal` "for
testability"; the cross-module descriptor wrapper was a _private_ `getInertDescriptor`;
`hasOwnPrototype` / `hasOwnWritablePrototype` used a `!!value` guard rather than
`try/catch`; there was no named class-vs-ES3 non-writable-`prototype` tell; and there was
no machine-checkable way to enumerate exactly which functions are throw-safe — which the
upcoming test round needs as its completeness oracle.

**Decision.**

1. **Disentangle the vocabulary.** "Inert" now names _only_ getter-inertness — kept on the
   `hasInert*` probes and in prose ("fully inert", "inert descriptor traversal").
   Throw-safety is named **"Safe"**:
   - `getInertPrototypeOf` → `getSafePrototypeOf`
   - `getInertOwnProperty{Names,Symbols,Keys}` → `getSafeOwnProperty{Names,Symbols,Keys}`
   - `getInertDescriptor` → `getNextAvailableSafeDescriptor`

   Section headers become "Throw-safe …"; the "raw/inert pairing" becomes the
   "raw/throw-safe pairing".

2. **Introduce the `@@throw-safe` marker.** A proprietary `/* @@throw-safe */` block
   comment on the line directly above each throw-safe export's doc block, in **both**
   `.js` and `.d.ts`. Single-asterisk `/* */` (not `/** */`) so typedoc /
   eslint-plugin-jsdoc ignore it. **Utility-module-only.** Dual purpose: (a) the
   completeness **oracle** for the throw-safety test suite — the flagged set must equal
   the set the `hostile × predicate` matrix scores; (b) a source-level throw-safety marker
   for readers. It supersedes name-based heuristics: throw-safety now spans `Safe`- /
   `Inert`- / `Defined`-named helpers _plus_ design-inert predicates that carry no naming
   hint (`isValidWeakKey`, `isValidPropertyKey`, the `hasOwn*` trio — throw-safe by a
   `typeof`/predicate chain or a `try/catch`), so a single explicit flag is the source of
   truth. Deliberately **absent** from the two raw forms (`getOwnPropertyKeys`,
   `getNextAvailablePropertyDescriptor`).

3. **Settle the public surface — `index.js` is the source of truth.** Only
   `isValueOfBoundSet` and `getValidatedStandardConstructorAndPrototypeTuple` remain
   `@internal`. The `getSafeOwn*` family, `getSafePrototypeOf`, `getVerifiedOwnName`, and
   `getNextAvailableSafeDescriptor` are **public** — a throw-safe reflection primitive is
   general-purpose, useful to any consumer doing introspection (the same rationale that
   promoted the `hasInert*` accessor/data siblings, `UTILITY.spec.md` Resolved #1).

4. **Add `hasOwnNonWritablePrototype`.** The named complement of
   `hasOwnWritablePrototype`: the class-vs-ES3 structural tell (a `ClassConstructor`'s own
   `prototype` is non-writable; an `ES3Function`'s is writable; a value with no own
   `prototype` answers `false` to both). `isClass` (`#function`) now delegates to it.
   `hasOwnPrototype` / `hasOwnWritablePrototype` move from a `!!value` guard to
   `try/catch`, making the whole `hasOwn*` trio throw-safe.

**Rationale.**

- **Two orthogonal properties deserve two words.** Getter-inertness guards against
  side-effects / accessor-firing; throw-safety guards against propagated exceptions.
  Naming both "inert" hid which guarantee a call site actually received.
- **A marker beats a naming convention for the oracle.** Once design-inert predicates
  (`typeof`-chains, no `try/catch`) are also throw-safe by construction, no naming scheme
  uniformly signals throw-safety. An explicit, grep-able flag makes the guarantee
  auditable and lets the suite assert completeness (flagged set ≡ tested set) — the
  "completeness-guard-vs-vacuous-loops" discipline anchored to a flag rather than to
  prose.
- **Placement above the doc block, single-asterisk.** It is the only position expressible
  _identically_ in `.js` and `.d.ts` (the `.d.ts` has no function body), so it maximizes
  cross-file symmetry and keeps a future lint rule trivial; `/* */` stays out of the
  typedoc/jsdoc parser. A function-body-first-line placement was considered and rejected —
  not mirror-able in a body-less `.d.ts`.
- **Public surface.** Throw-safety _is_ the consumer-relevant guarantee (introspection
  answers, never throws — #056), so the throw-safe readers are exactly what a downstream
  package doing cross-realm reflection wants; `@internal`-for-testability understated
  their value.

**Consequences.**

- Call-sites across `#function` / `#object` / `#thenable` / `#evented` / `#error` were
  updated to the `Safe` names; the test suites' `getInertPrototypeOf` references were
  renamed to `getSafePrototypeOf`. `dist/` build artifacts carry the old names until the
  next build.
- The `@@throw-safe` flagged set becomes the utility test-round completeness oracle. The
  `.js` count exceeds the `.d.ts` count by exactly two — the `isValidWeakKey` factory's
  two runtime-branch methods each carry the marker in `.js`, against a single `.d.ts`
  declaration.
- `UTILITY.spec.md` and `architecture/utility.md` are reconciled to the new vocabulary +
  surface as part of the utility-round spec sweep; this ADR is the "why", the spec is the
  test oracle.
- Sibling contract-honesty fixes landed in the same round (recorded here for completeness,
  not the core of this ADR): `getTaggedType` / `resolveType` `.d.ts` value-overloads
  widened to `| undefined` (a hostile `Symbol.toStringTag` getter makes both return
  `undefined` at runtime, matching `getTypeSignature`); and `getFunctionSource`
  (`#function`) widened `string` → `string | undefined` with its parameter kept `Callable`
  (throw-safety is intrinsic to `Function.prototype.toString`, which can throw even for a
  genuine callable — a revoked callable `Proxy`, a hostile subclass).
- The marker convention is **utility-only** by decision; sibling modules stay unmarked
  even where throw-safe. Revisit only if a second module independently needs the same
  oracle.
