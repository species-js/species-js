# type-detection / function

## Mental model

`type-detection` exists because JavaScript's runtime type information is fragmented across
multiple slots, descriptors, and prototype-chain reads, and because the spec invariants
that hold for genuine values do not survive into TypeScript's type system. The package's
job is to bridge that gap with predicates and types that share a single conceptual
lattice:

```
Callable
  ├── (no narrower predicate — the `typeof === 'function'` floor)
  └── VerifiedFunction                      (isFunction)
        ├── NewableFunction                 (isNewableFunction)
        │     ├── ES3Function               (isES3Function)
        │     └── ClassConstructor          (isClass)
        │           ├── [class-syntax]      (isCustomClass)
        │           └── [native intrinsics] (isBuiltInClass)
        ├── AsyncFunction                   (isAsyncFunction)
        └── AnyGeneratorFunction            (isAnyGeneratorFunction)
              ├── GeneratorFunction         (isGeneratorFunction)
              └── AsyncGeneratorFunction    (isAsyncGeneratorFunction)
```

The lattice has two structural sides — the newable family and the non-newable family —
that the spec gives different discriminators for. The newable side discriminates on
_own-instance descriptors_ (the `writable` flag on `prototype`, the back-reference
soundness on `prototype.constructor`). The non-newable side discriminates on
_prototype-chain values_ (`Symbol.toStringTag` resolved through the chain, the resolved
constructor name). The implementation lets each side use the discriminators the spec
actually provides, rather than forcing one shape across both. See decisions #003 and #005
for the rationale.

Bound variants land asymmetrically across this split _because of the spec_, not by choice.
`bind` strips the function's own slots while preserving its `[[Prototype]]`. Newable-side
discriminators are stripped; non-newable-side discriminators survive. So the strict
newable predicates reject bound variants for free, and the non-newable predicates admit
bound variants for free. The honest doc voice names this as "lenient by spec mechanics"
rather than as a design choice. See decision #005.

## Cross-realm safety

A `Callable` produced in one realm (iframe, worker, vm context, `eval`-ed from a foreign
module) has the same structural surface as a `Callable` from the local realm, but a
_different intrinsic identity_. `instanceof Function` against a foreign-realm function
returns `false` even when the value is unambiguously a function. The package's contract is
to ignore intrinsic identity and read the structural surface: `typeof === 'function'` for
the floor; `Symbol.toStringTag` reads through the realm-fixed
`Object.prototype.toString.call`; constructor-name reads through a four-source fallback
(`getDefinedConstructor` in `utility/index.{d.ts,js}`) that defends against tampering.

Every "cached" reference at `@/config` is captured at module-load to pin its identity to
the current realm. The package uses these captured references — `toObjectString`,
`toFunctionString`, `getPrototypeOf`, `getOwnPropertyDescriptor`, and the rest — instead
of reaching for `Object.X` at each call site, so a runtime that later tampers with the
global `Object` does not affect the predicates. See decision #008 for the
boundary-retyping pattern these captures use to close lib `any`-gaps.

## The discrimination matrix

The newable side discriminates on a small fingerprint per row:

| Species            | newable | own_prototype      | own_writable_prototype | `[[Class]]` |
| ------------------ | ------- | ------------------ | ---------------------- | ----------- |
| `ES3Function`      | ✓       | ✓                  | ✓                      | `Function`  |
| `ClassConstructor` | ✓       | ✓                  | ✗                      | `Function`  |
| Bound newable      | ✓       | (no own prototype) | (no own prototype)     | `Function`  |

The non-newable side adds the proto-side own-key surface as a second discriminator:

| Species                  | `[[Class]]`              | proto-side own keys         |
| ------------------------ | ------------------------ | --------------------------- |
| `AsyncFunction`          | `AsyncFunction`          | `constructor`               |
| `GeneratorFunction`      | `GeneratorFunction`      | `constructor` + `prototype` |
| `AsyncGeneratorFunction` | `AsyncGeneratorFunction` | `constructor` + `prototype` |

The proto-side discriminator separates the async family (`constructor` only) from the
generator family (`constructor` + `prototype` both present), and the `[[Class]]` tag
separates the two species inside the generator family. Decision #009 captures the
empirical cheat-sheet that validated the matrix end-to-end. Decision #011 captures why the
implementation reads the proto-side keys as a `Set<string>` and probes membership, rather
than comparing a full joined-string signature.

The matrix has two collision classes the structural schema _cannot_ resolve, and the
package names them honestly:

- **Arrow vs. concise method.** Both `() => {}` and `{ m() {} }.m` have
  descriptor-identical shapes. The runtime distinction is the `[[HomeObject]]` internal
  slot, which surfaces in no descriptor. Resolution requires
  `Function.prototype.toString.call` source parsing → belongs in `function-introspection`,
  not here.
- **Bound vs. unbound within the arrow/concise rows.** Both forms have the same proto-side
  fingerprint and the same `[[Class]]` tag. The discriminator is a descriptor _value_
  read: `name.value.startsWith('bound ')`. Spoof-trivial, but bounded enough for an
  introspection-tier helper. See decision #013.

## Predicate composition: orchestrator + helper + sub-helpers

Every non-newable predicate is built from a layered composition. From outside in:

1. **Orchestrator** (e.g. `isAsyncFunction`) — the public narrowing predicate. Runs three
   phases: the `isFunction` gate (short-circuits non-callables); the same-realm
   `instanceof` fast path against the captured intrinsic (lands the common case in a
   single prototype walk); and the realm-independent fallback delegating to the shape
   helper.
2. **Shape helper** (e.g. `hasAsyncFunctionShape`) — `@internal`, exported for
   testability. Returns plain `boolean`; runs the structural-marker chain in isolation,
   with no narrowing.
3. **Sub-helpers** — also `@internal` and exported. Group the markers by semantic role:
   `hasXxxIdentitySignal` reads the two identity labels (tag + resolved constructor name)
   the value carries, and `hasXxxPrototypeSurface` reads the proto-side own-key surface
   via the `Set<string>` primitive. The generator family shares a single
   `hasAnyGeneratorFunctionPrototypeSurface` rather than per-species duplicates, because
   the proto-side rule is a family-level invariant. See decisions #006, #014, #015, and
   #016.

The chain of `&&` links is ordered so runtime safety becomes structural. The proto-side
helper is always the last link, because by then the upstream identity-signal check has
already rejected nullish input — the `getPrototypeOf` read inside the proto-side helper
can therefore run without nullish-guard ceremony.

## Two postures: minimal-floor vs. conservative-narrowing

The discrimination matrix above shows what is _necessary_ for discrimination. The
implementation chooses how thick a layer of cross-validating markers to wrap around the
necessary minimum, and the choice is principal-call, not technical:

- **Minimal-floor posture.** Trust spec invariants. For non-newable species, the
  `[[Class]]` tag alone is a spec invariant that subsumes `!hasConstructSlot`
  (non-constructable by spec) and `getDefinedConstructorName === '…'` (also
  spec-invariant). The minimal floor is a single `[[Class]]` check. Right for leaf-level
  consumers.
- **Conservative-narrowing posture.** Keep multiple cross-validating markers as
  bounded-cost insurance against tag-spoofing edge cases. The Proxy `[[Construct]]` probe
  and the constructor-name walk are bounded expense; a false admit from a tag-spoofed
  value propagates structurally to every downstream consumer. Right for foundation-tier
  code.

`@species-js/type-detection` is foundation-tier — six downstream packages depend on it —
so the conservative posture is the codified default. The current shape predicates
exemplify this posture. Do not lean them down without revisiting the cost/correctness
trade-off explicitly. See decision #010.

## Boundary-retyping for lib `any`-gaps

The TypeScript lib types some functions in `lib.es5.d.ts` with `any` in their signature —
most prominently `Object.getPrototypeOf: (o: any) => any` and
`Function.prototype.toString: () => string` (the second of which the package cares about
because `Function.prototype.toString.call(non-callable)` throws, but the lib does not
encode that constraint). Consumers that import these directly take the `any` cascade into
their code: every assignment of the return value trips
`@typescript-eslint/no-unsafe-assignment` and forces a cast.

The package closes these gaps at the `@/config` boundary, not at the call sites. The
cached primitives in `config/index.d.ts` are retyped to the spec-precise signature, and
every consumer inherits the honest signature for free. See decisions #008 and #017.

Five instances have landed so far:

- `toFunctionString: (this: Callable) => string` — encodes the spec-required
  non-callable-throws constraint (decision #008).
- `getPrototypeOf: (o: unknown) => object | null` — closes the `any` return cascade;
  runtime throw for nullish stays a precondition not modeled in the type, consistent with
  TypeScript's not modeling thrown errors elsewhere (decision #017).
- `isFiniteNumberValue`, `isIntegerValue`, `isSafeIntegerValue` — three `Number.isXxx`
  predicates retyped to value-narrowing type guards `(value: unknown) => value is number`,
  replacing lib's non-narrowing `boolean` return (decision #026).
- `objectCreate` — overload-precise return types replacing the `any` on both lib
  overloads; `objectCreate(null) → Record<PropertyKey, never>` (the prototype-less floor),
  prototyped forms yield `object`, with `ThisType<unknown>` over lib's `ThisType<any>`
  (decision #034).

The pattern generalizes. Any future cached `@/config` primitive whose lib signature
propagates `any` should be retyped at the boundary as a single edit, not laundered through
`/** @type {unknown} */` at every call site. The `.d.ts` JSDoc on each retyped primitive
documents the deviation from `typeof Object.X` so the choice is auditable.

The recurring nature of this pattern is itself the meta-observation: TS lib types are
_conservative simplifications_ of ECMA-262 / WebIDL behavior that lean on `any` as a "we
don't know" placeholder. Every consumer that touches a leaky lib API gets `any` baked into
its call site. The closure point is the cached primitive at `@/config`, where one retyping
eliminates the cascade for every downstream consumer. Reach for this discipline whenever a
new cached primitive is added and its lib type returns `any` or accepts overly-narrow
inputs — treat it as a steady-state cost of working inside vendor-shaped TS, not an
exception.

## Generic-typed predicates: caller-side narrowing preserved

A sibling closure to boundary-retyping, applied on the _narrow_ side instead of the _call_
side. All 11 function-family predicates take the generic form
`<T = unknown>(value?: T): value is T & X`, where `X` is the predicate's previous narrow
target (`Callable`, `VerifiedFunction`, `NewableFunction`, `ES3Function`,
`ClassConstructor`, `AsyncFunction`, `GeneratorFunction`, `AsyncGeneratorFunction`,
`AnyGeneratorFunction`).

The plain form `value is X` _replaces_ the value's type with bare `X`, discarding any
narrowing the caller had on `value` before the predicate ran. The generic form returns the
intersection `T & X` instead, distributing through `T`'s union: non-matching arms collapse
to `never` (`string & Callable = never`, `undefined & VerifiedFunction = never`), matching
arms retain `T`'s call signature, augmented with `X`'s structural guarantees. For the
common case `T = unknown`, the intersection reduces to `X`, matching the pre-generic
behavior at every existing call site.

The pattern addresses the same pathology as boundary-retyping: TS's default types are too
lossy at a boundary, and the cleanup work piles up at every consumer site instead of being
absorbed once at the boundary. Boundary-retyping closes the call-side `any`-cascade at
`@/config`; the generic-predicate pattern closes the narrow-side flatten at the
predicate's declaration. Both rulings codify "fix at the boundary, not at the call site"
as a steady-state response to TS's leaky defaults. See decision #031.

The pattern generalizes beyond the function family. The same form has been applied across
the `thenable` module (`isThenable`, `isPromiseLike`, `isPromise`), the `evented` module
(`isEventTargetLike`, `isEventTarget`, `isAbortSignalLike`, `isAbortSignal`), and the
`error` module (`isGenericError`, `isError`, `isAbortError`) — 21 generic-typed predicates
across the four type-guard families. See decision #036 for the sweep. Primitive predicates
(`isStringValue`, `isNumberValue`, etc.) are deliberately not swept because primitives
carry no richer shape to preserve.

One subtle interaction emerged from the sweep: the `(value = null)` parameter default
pattern (decision #025) does not compose with the generic-T form when both are wanted in
the same signature. `value: T | undefined` rejects `null` as a default when `T` is
generic. The workaround is to drop the default — the `!!value` body guard handles both
null and undefined identically at runtime, so the runtime semantics are preserved. Three
non-function predicates required this fix during the sweep: `isEventTargetLike`,
`isAbortSignalLike`, and `isGenericError`. The parameter-default-to-`null` ruling still
applies to non-generic predicates that use it for strict-equality nullish unification — it
just doesn't compose with the generic-T pattern.

## Property-access discipline: own-data vs. inherited

Reading a property from a value is two different operations depending on what the spec
says about that property. The package keeps the two operations separated so the defensive
pattern at each call site matches the spec shape of the property being read.

- **Own-data.** `name` on a function — spec-defined as an own data descriptor (ECMA-262
  §10.2.9 `SetFunctionName`) — is the canonical case in this package. The canonical read
  is `getOwnPropertyDescriptor(obj, key)?.value`, with no fallback to direct property
  access. An accessor getter installed at the same key leaves `descriptor.value`
  undefined, and the downstream narrow correctly rejects the read; falling back to
  `obj[key]` would invoke the accessor we are trying to refuse.
  `getDefinedConstructorName` reads `name` this way.
- **Inherited.** `constructor` on an instance and the meta-constructor
  `constructor.constructor` are not own data on the value being read. The canonical
  resolution is the engine's prototype-chain walk via direct property access. A
  descriptor-first defense here is misaligned with inheritance: the own descriptor returns
  `undefined` for every inherited case, the `??` fallback to direct access does the actual
  work every time, and the descriptor read is scaffolding that does not catch the spoof it
  targets. Reciprocal-reference types make this concrete — `%GeneratorFunction%`'s
  `constructor` is inherited from `%Function.prototype%`, and the prototype-chain walk is
  what resolves it to `%Function%`. `getDefinedConstructor`'s meta-constructor fallbacks
  at steps 2 and 4 use direct access for exactly this reason.

The asymmetry is structural, not stylistic. Picking the wrong access path does not just
add a function call — it changes which spoofs the predicate catches and which spec
invariants it honors. Before adding a new descriptor read or shifting an existing one to
direct access, name which side of this asymmetry the property is on. See decision #020.

_Related — nullish-guard discipline._ The companion pattern for predicates and helpers
whose body benefits from a single nullish check is parameter-default-to-`null` (decision
#025). By declaring an optional or `unknown`-typed parameter with a default of `null`,
both `null` and `undefined` are unified at the parameter-binding step, allowing strict-
equality `!== null` checks without lint friction and without rejecting falsy primitives
(which auto-box correctly and may have legitimate inherited methods). Canonical
implementations: `hasInertMethod` and `getNextAvailablePropertyDescriptor` in `@/utility`.
See `[[design-rulings]]` for the forward-applicable framing.

## Realm intrinsics: the `%X%` notation

The doc voice uses `%AsyncFunction%`, `%GeneratorFunction%`, `%AsyncFunction.prototype%`,
and similar names throughout. This is ECMA-262 notation for well-known _intrinsic_ objects
of a realm — canonical objects the engine creates when the realm spins up, identified by
spec name rather than by a JavaScript identifier.

Most intrinsics are not globally exposed. There is no `window.AsyncFunction` in standard
JavaScript; the async-function constructor is reachable only via
`(async function() {}).constructor`. The spec needs a way to refer to it anyway, and
`%AsyncFunction%` is that way.

The notation matters here because cross-realm work depends on knowing what each realm has
its own version of. `iframe.contentWindow`'s `%AsyncFunction%` is a distinct object from
the main window's `%AsyncFunction%`, but both share the same spec-required structure. The
shape predicates exist precisely to verify that structure without depending on intrinsic
_identity_.

## Open architectural questions

These are not unresolved bugs; they are architectural choices that have not yet been made.
Each one is tracked in [`../decisions/open-questions.md`](../decisions/open-questions.md).

- **Q.002 — Bound-admission policy for public predicates.** The fingerprint matrix made
  bound detection cheap for every species, eliminating the spec-mechanics-forced asymmetry
  from decision #005. The current shipped behavior preserves the asymmetry. Whether public
  predicates should now be re-balanced is a policy question, not a structural one.

- **Q.003 — `@species-js/function-introspection` scope and shape.** Two predicates
  currently belong to introspection: the arrow-vs-concise distinguisher and
  `isBoundFunction`. The package has not yet been scaffolded. Whether it lives standalone
  or as a subpath of type-detection is open.
