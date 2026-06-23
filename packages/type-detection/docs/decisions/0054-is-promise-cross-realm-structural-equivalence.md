# 054 — `isPromise` cross-realm arm factored into structural-Promise-equivalence; `assumePrototype` generalized

**Date:** 2026-06-23

**Context.** THENABLE.spec.md froze with `isPromise`'s cross-realm arm written as a flat,
value-only marker chain:

```js
getTypeSignature(value) === '[object Promise]' &&
  getDefinedConstructorName(value) === 'Promise' &&
  doesImplementPromiseContract(value);
```

A later refactor — the `getValidatedStandardConstructorAndPrototypeTuple` realm-fixed
capture plus a structural-equivalence factoring — pulled this inline chain into named
helpers. Factoring it surfaced two latent issues the flat chain had hidden.

1. **The prototype's own constructor needs `assumePrototype`.** A faithful
   structural-equivalence check validates not only the value but its prototype: that the
   value's `[[Prototype]]` IS structurally `Promise.prototype`. Reading a prototype
   object's constructor requires the prototype's OWN `constructor` data descriptor
   (ECMA-262 §10.2.6), which is exactly what `{ assumePrototype: true }` selects. Decision
   #047 added that option to `getDefinedConstructor` but not to
   `getDefinedConstructorName` — and the factored identity-signal leg reads the
   constructor _name_, so the option had to be generalized to the name accessor too.

2. **The constructor registries are keyed by value alone.** `constructorRegistry` and
   `constructorNameRegistry` (the memoization behind `getDefinedConstructor` /
   `getDefinedConstructorName`) cache by the input object. But a single prototype object
   legitimately resolves to two different constructors depending on `assumePrototype`:
   `getDefinedConstructorName(Promise.prototype)` walks up to `Object.prototype` and
   yields `'Object'`, while
   `getDefinedConstructor(Promise.prototype, { assumePrototype: true })` reads the own
   descriptor and yields `Promise`. A value-keyed cache can hold only one of these, so a
   no-option resolution and an assume-option resolution of the _same_ object poison each
   other — whichever runs first wins the cache. Verified empirically on a shared
   cross-realm `Promise.prototype`: option-less name → `'Object'`, clean assume-path
   constructor → `Promise`; interleaving the two returned the stale answer.

Without the factoring these issues never fired, because the flat chain only ever read the
_value's_ markers, never the prototype's. The structural-equivalence step is what made
prototype-side resolution — and therefore the dual-interpretation hazard — real.

**Decision.** Four moves.

1. **Factor the cross-realm arm into three exported `@internal` helpers** (parallel
   `.d.ts` per decision #015):
   - `hasPromiseIdentitySignal(value, options?)` — the two string-shape markers: the
     `[[Class]]` tag `'[object Promise]'` and the resolved constructor-name `'Promise'`.
     The optional `options` forwards `assumePrototype` to the name resolution.
   - `isStructuralPromisePrototypeEquivalent(prototype, constructor)` — validates that
     `prototype` is structurally `Promise.prototype`: it carries the identity signal and
     the method contract, and its OWN constructor reciprocally back-references the
     instance's resolved `constructor`
     (`getDefinedConstructor(prototype, { assumePrototype: true }) === constructor`).
   - `isStructuralPromiseEquivalent(value, prototype?)` — the cross-realm orchestrator:
     value-side identity signal, method contract, and prototype-equivalence.

   `isPromise`'s cross-realm arm becomes
   `isStructuralPromiseEquivalent(value, prototype)`.

2. **Add a fourth cross-realm marker — prototype/constructor reciprocal identity.** The
   arm no longer trusts the value's self-claim alone (tag + name + contract); it now
   anchors on
   `getDefinedConstructor(prototype, { assumePrototype: true }) === constructor` — the
   prototype's own constructor must BE the instance's resolved constructor.

3. **Generalize `assumePrototype` and name the options type.** `getDefinedConstructorName`
   gains the `options` parameter, mirroring `getDefinedConstructor` (#047). The inline
   `{ assumePrototype?: boolean }` is extracted into a named
   `DefinedConstructorAccessorOptions` interface in `@/utility`, documented once and
   reused across both accessors and both call sites; `.js` brings it into JSDoc scope via
   a single top-of-file `@typedef` import.

4. **Thread the option through both prototype-resolving legs rather than harden the
   registry.** `isStructuralPromisePrototypeEquivalent` passes `{ assumePrototype: true }`
   to BOTH `hasPromiseIdentitySignal(prototype, options)` AND
   `getDefinedConstructor(prototype, options)`. The registry stays value-keyed.

**Rationale.** Five forces converge.

- **Spec-grounded over inline.** The cross-realm arm now reads as a named
  structural-equivalence claim with a spec-citable shape, not an opaque boolean chain.
  Symbol-level naming makes the precision boundary explicit, consistent with the thenable
  module's `doesImplementPromiseContract` naming discipline.

- **Stronger spoof-resistance, no behavior change.** The reciprocal-identity marker
  extends the conservative-narrowing posture (#010) and the marker-independence story of
  the two-axis dispatch (#050). It flips no spec'd vector — every behavioral admit/reject
  is unchanged — and only rejects exotic spoofs where tag, name, and contract are forged
  but the prototype's own constructor disagrees.

- **§10.2.6 applies to the name accessor too.** Function-created prototypes carry an own
  `constructor`; that source-of-truth is identical whether the caller wants the
  constructor or its name. Generalizing the option is the consistent move, and the named
  type keeps the `.js`/`.d.ts` documentation parallel.

- **Thread-the-option is precise, not lossy.** Within the module's own flow a given object
  is only ever resolved _one_ way: `isStructuralPromiseEquivalent` resolves the INSTANCE
  option-less (correct — an instance walks to its prototype's constructor) and the
  PROTOTYPE assume-only (correct — §10.2.6 own constructor). Instance and prototype are
  distinct objects, so the two interpretations never collide on a registry key. The fix is
  exactly as strong as the problem requires.

- **Registry-hardening rejected as out of proportion.** Keying the cache by
  `(value, assumePrototype)` (or skipping the assume-path cache) would close the
  dual-interpretation hazard in full, but pays composite-key complexity for a collision
  the module flow cannot produce. The cheaper, sufficient fix wins; the residual is
  recorded below rather than engineered away.

**Consequences.**

- **Three new exported `@internal` helpers**, each with a parallel `.d.ts` declaration and
  each owing helper-unit (axis-4) vectors in the thenable test round — the surface
  inventory grows from two helpers (`doesImplementPromiseContract`,
  `isCurrentRealmPromiseInstance`) to five.

- **Behavior unchanged on every spec'd vector**; the cross-realm arm is strictly more
  spoof-resistant via the prototype-reciprocal marker.

- **Second `assumePrototype` call site.** The first (#047) is
  `hasPlainObjectPrototypeContract` in `@/object`; the second is
  `isStructuralPromisePrototypeEquivalent` in `@/thenable`.

- **Spec and architecture amended in place.** THENABLE.spec.md's white-box composition
  annotations and axis-4 helper inventory, and architecture/thenable.md's composition
  table and two-axis-dispatch section, are corrected to the factored shape and the
  four-marker cross-realm arm. The behavioral vector tables — the part of the frozen spec
  the freeze exists to protect — are untouched. Provenance for the amendment lives in this
  ADR and git history, not an in-body changelog (one dated breadcrumb in the spec's
  resolved-items section points here).

- **Latent caveat, deferred by decision.** The constructor registries remain value-keyed.
  The module flow never triggers cross-interpretation poisoning, but a FUTURE external
  caller that resolves a bare prototype object option-less (e.g.,
  `getTypeName(SomeProto)`) before an assume-path resolution of the same object would read
  a stale entry. Closing it requires `(value, assumePrototype)` keying or not caching the
  assume-path. Recorded here so the next caller of these accessors on a prototype object
  knows the sharp edge exists.

Builds directly on #047 (`assumePrototype` origin, pivot-and-walk inertness); refines the
cross-realm arm of #050 (two-axis dispatch) and #023 (`isPromise` subclass rejection);
follows #015 (sub-helpers exported with `.d.ts`) and #010 (conservative-narrowing
posture).

**Update (2026-06-23):** the value-keyed-registry caveat recorded above was subsequently
**overturned and closed** — both registries are now keyed by `(value, assumePrototype)`.
The deferral reasoning here is preserved as the record of phase one; see **#055** for the
hardening decision.

Commit: _pending_ (batched with the thenable structural-equivalence refactor).
