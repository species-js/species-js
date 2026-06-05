# ARCHITECTURE

A current-state conceptual map of species-js. The decision log (`DECISION-LOG.md`) answers
_why_ the code looks the way it does, in chronological order. This document answers _how_
it works, in conceptual order. The two are designed to be read together.

This document is organized by package and module. Each section starts with the mental
model a contributor needs to read the code, then describes the cross-cutting patterns the
code embodies, and ends with the open architectural questions that the code has not yet
answered.

This is the first round, covering `type-detection / function`. Other packages and modules
will get their own sections as their architectures stabilize.

---

## type-detection / function

### Mental model

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

### Cross-realm safety

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

### The discrimination matrix

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

### Predicate composition: orchestrator + helper + sub-helpers

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

### Two postures: minimal-floor vs. conservative-narrowing

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

### Boundary-retyping for lib `any`-gaps

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

### Generic-typed predicates: caller-side narrowing preserved

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

The pattern generalizes beyond the function family. Predicates in `thenable`, `evented`,
and `error` modules are reserved for a follow-up sweep applying the same form. Primitive
predicates don't benefit (primitives carry no richer shape to preserve) and stay as-is.

### Property-access discipline: own-data vs. inherited

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

### Realm intrinsics: the `%X%` notation

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

### Open architectural questions

These are not unresolved bugs; they are architectural choices that have not yet been made.
Each one is the subject of an open question in `DECISION-LOG.md`.

- **Q.002 — Bound-admission policy for public predicates.** The fingerprint matrix made
  bound detection cheap for every species, eliminating the spec-mechanics-forced asymmetry
  from decision #005. The current shipped behavior preserves the asymmetry. Whether public
  predicates should now be re-balanced is a policy question, not a structural one.

- **Q.003 — `@species-js/function-introspection` scope and shape.** Two predicates
  currently belong to introspection: the arrow-vs-concise distinguisher and
  `isBoundFunction`. The package has not yet been scaffolded. Whether it lives standalone
  or as a subpath of type-detection is open.

---

_End of `type-detection / function` section. Future packages and modules append their
sections below._

---

## type-detection / thenable

### Mental model

`type-detection / thenable` exists because the Promise resolution protocol has multiple
discrimination levels, none of which the TypeScript lib exposes precisely. JavaScript's
runtime "is this Promise-shaped?" question has at least three meaningful answers — has a
callable `then`, has the full `Promise.prototype` method contract, is identifiable as a
`Promise` instance — and the package's job is to give each level a predicate and a type
that share a single conceptual lattice:

```
Thenable<T>             (isThenable)      — callable `then` only
  └── PromiseLike<T>    (isPromiseLike)   — full Promise.prototype method contract
        └── Promise<T>  (isPromise)       — Promise identity via three markers
```

Each tier adds _exactly one_ semantic level. `isThenable` checks for the single `then`
method; `isPromiseLike` checks for `then` plus `catch` plus `finally` (the full
Promise-method contract); `isPromise` checks for the Promise-method contract plus the
`[[Class]]` tag plus the `'Promise'` constructor name. Each tier's check-set is a strict
superset of the tier above. The internal helper `doesMatchPromiseContract` sits
structurally between `isThenable` and `isPromiseLike`. It is the structural
Promise-method-contract predicate without the realm-fixed `instanceof` fast path.
`isPromiseLike` calls it as the fallback when `instanceof PromiseConstructor` fails
(cross-realm Promises, userland Promise-likes such as Bluebird or Q).

The middle tier is novel relative to TypeScript's lib. The lib has nothing between
`PromiseLike` (just a callable `then`, hence structurally identical to our `Thenable`) and
`Promise` (the full instance type). Our `PromiseLike` fills that gap by encoding the full
chaining contract (`catch` + `finally`) the lib version cannot express. See decision #022
for the rationale of defining this tier as strictly richer than the lib's.

### Cross-realm safety

A `Promise` produced in one realm (iframe, worker, vm context) carries the same
`Promise.prototype` method contract as a Promise from the local realm, but a _different
intrinsic identity_. `instanceof Promise` against a foreign-realm Promise returns `false`
even when the value is unambiguously a Promise. The thenable predicates handle this by
composing identity and structure rather than choosing one:

- `isPromiseLike` tests `instanceof PromiseConstructor` first (inexpensive, realm-fixed)
  and falls back to `doesMatchPromiseContract` for the structural check. Cross-realm
  Promises pass via the fallback; userland Promise-likes pass via the fallback too.
- `isPromise` runs `isPromiseLike` (which already handles cross-realm via fallback), then
  layers two realm-independent markers — the `Promise` `[[Class]]`-tag (read through the
  realm-fixed `Object.prototype.toString.call` capture) and the `Promise` constructor-name
  (resolved through the package's four-source constructor walk).

The `const PromiseConstructor = Promise;` capture in `thenable.js` is the module-load
realm-fixed reference for the `instanceof` fast path. It is currently module-local. If a
second consumer (e.g. a future `@/error` Promise-aware predicate) needs the same capture,
the natural promotion is to `@/config` alongside the other intrinsics.

### Predicate composition

Each of the four predicates is a clean composition over the layer below it. Reading from
the floor up:

| Predicate                  | Composition                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `isThenable`               | `hasInertMethod(v, 'then')`                                                                                    |
| `doesMatchPromiseContract` | `hasInertMethod(v, 'then') && hasInertMethod(v, 'catch') && hasInertMethod(v, 'finally')`                      |
| `isPromiseLike`            | `!!v && (v instanceof PromiseConstructor \|\| doesMatchPromiseContract(v))`                                    |
| `isPromise`                | `isPromiseLike(v) && getTypeSignature(v) === '[object Promise]' && getDefinedConstructorName(v) === 'Promise'` |

Each layer adds exactly one semantic level. No layer redoes work the layer below already
did. Short-circuit `&&` enforces a _"least expensive first"_ ordering at each layer: in
`doesMatchPromiseContract`, `then` (the spec-defined adoption hook) runs first; in
`isPromiseLike`, the `instanceof` fast path runs before the structural fallback; in
`isPromise`, `isPromiseLike` (which settles inexpensive on `instanceof` for the common
case) gates the tag read, which gates the constructor-name walk.

The factoring of `hasInertMethod` as a `@/utility` primitive — rather than inlining the
descriptor-walk inside `isThenable` — is what makes `doesMatchPromiseContract` and any
future method-contract predicate compose cleanly. See decision #024.

### Conservative-narrowing in the Promise domain

The conservative-narrowing posture from the function side (see "Two postures" above) lands
a second time here. `isPromise` uses three cross-validating markers — `isPromiseLike`, the
`[[Class]]` tag, and the constructor-name resolution — even though any one of them is
usually enough for a typical-case discrimination. The reasoning is the same as on the
function side: foundation-tier predicates that downstream packages depend on benefit from
multiple cross-validating markers as bounded-cost insurance against single-marker
spoofing.

The marker independence makes the layered check trustworthy. Each marker rules out a
distinct false-positive class:

- The `isPromiseLike` gate rejects values that claim Promise identity (via tag or
  constructor name) without exposing the `Promise.prototype` method contract — e.g.
  `{ [Symbol.toStringTag]: 'Promise' }` with no `catch` or `finally`.
- The `[[Class]]` tag rejects values that satisfy the method contract but tag themselves
  as something other than `'Promise'`.
- The constructor-name marker closes the `Symbol.toStringTag` spoofing hole the tag check
  alone would leave open — a value declaring `[Symbol.toStringTag] = 'Promise'` on an
  unrelated object passes the tag check but fails the constructor-name walk because the
  walk reaches the value's actual constructor, not its self-reported tag.

`Promise` subclasses fall to the strict equality on the constructor-name marker — a value
of `class MyPromise extends Promise {}` resolves its constructor name to `'MyPromise'`,
which fails `=== 'Promise'`. This is _deliberate strictness_. Consumers who are in need of
subclass admission should compose with a constructor-chain walk on top of `isPromise`. See
decision #023.

### The "contract" vocabulary for spec-defined method sets

Predicates that verify a value against a method set defined by an ECMA-262 spec section,
name the set as a **contract** rather than as a shape or surface. The `Promise.prototype`
method contract is upheld by the methods specified by §27.2: `then`, `catch`, `finally`.
"Contract" implies obligations defined by a spec — the discrimination boundary is the
spec, not just any structural similarity. "Shape" and "surface" are structurally loose
terms that could describe any object's API. Using them obscures whether the discrimination
is spec-grounded or ad-hoc.

The contract framing makes the precision boundary explicit at the symbol-name level. The
predicate `doesMatchPromiseContract(v)` reads as a question — "does this match the Promise
contract?" — whose answer is bounded by a spec citation. The same naming pattern
(`doesMatchXContract`) applies forward to any spec-defined method set the package may
encounter: Iterator protocol (§7.4.1), EventTarget interface (DOM WHATWG), Error
invariants (§20.5.2), Map/Set protocols.

### The `hasInertMethod` primitive

`hasInertMethod(value, key)` from `@/utility` is the general-purpose method-contract
primitive that the thenable predicates compose. It tests whether `value` carries a
callable data property at `key`, reachable through its prototype chain.

"Inert" refers to the _inspect-without-invoke_ guarantee: accessor `get key()` descriptors
are rejected even when the getter would return a callable, because invoking the getter
would not be inert. The implementation walks the prototype chain via
`getNextAvailablePropertyDescriptor` (the chain-walking descriptor reader from
`@/utility`), then narrows the descriptor in two steps —
`objectHasOwn(descriptor, 'value')` rejects accessor descriptors, and
`isCallable(descriptor.value)` verifies that the resolved data value is invocable.

The descriptor-walk pattern matches ECMA-262 `Get(value, key)` resolution semantics,
modified by the accessor rejection that the predicate's contract requires. This is the
**third pattern** in the spec-shape access discipline (see decision #021): own-data takes
descriptor-first, inherited takes direct access, and predicate over inherited takes a
descriptor-walk for safety.

The primitive is general-purpose. The thenable module composes it four times (once in
`isThenable`, three times in `doesMatchPromiseContract`). Any future method-contract
predicate that needs the inspect-without-invoke guarantee should reach for it rather than
reinventing the descriptor-walk and accessor-rejection composition.

### Open architectural questions

These are not unresolved bugs; they are architectural choices that have not yet been made.
Each one is the subject of an open question in `DECISION-LOG.md`.

- **Q.004 — `AbortableThenable<T>` deferred to the `@/error` migration.** The equip-js
  source defined `AbortableThenable<T> extends Thenable<T>` with an `onaborted` callback
  typed against `AbortError`. The species-js `Thenable<T>` doc references this as a strict
  refinement reserved for a separate type, but `AbortError` lives in `@/error`, which is
  the next equip-js migration. Once `@/error` lands and `AbortError` is available,
  `AbortableThenable<T>` can extend naturally from the existing `Thenable<T>` — the
  type-system shape and the abort-channel predicate are both deferrable as one round when
  the dependency is in place.

---

_End of `type-detection / thenable` section. Future packages and modules append their
sections below._

---

## type-detection / evented

### Mental model

`type-detection / evented` exists because the Web Platform's event-handling primitives
(`EventTarget` and `AbortSignal`) carry the same dual concern as the Promise lattice from
the thenable section: a structural method contract anyone can implement, and a realm-fixed
intrinsic identity that only DOM-aware runtimes provide. The module's job is to give each
of these two contracts both a structural predicate (admits anything matching the spec
method set) and an identity predicate (admits only the realm-fixed intrinsic), with the
discrimination organized as two parallel two-tier lattices:

```
EventTargetLike     (isEventTargetLike)   — three EventTarget methods
  └── EventTarget   (isEventTarget)       — EventTarget identity via three markers

AbortSignalLike     (isAbortSignalLike)   — EventTargetLike + aborted + throwIfAborted
  └── AbortSignal   (isAbortSignal)       — AbortSignal identity via three markers
```

`AbortSignalLike` extends `EventTargetLike`, mirroring the spec relationship: every
abort-signal is an event-target. The two lattices are structurally parallel: each tier
follows the same compositional shape — a Like-tier structural predicate composed of
multiple `hasInertMethod` checks (with an `@internal` `doesMatchXContract` helper),
narrowing-tier predicates that combine an `instanceof` fast path with the structural
fallback, identity-tier predicates that layer two realm-independent markers on top.

The patterns mirror the thenable section's lattice. The Promise-method contract from the
thenable round was one instance of a general rule: _spec-defined method sets admit
duck-typing alongside instance discrimination_. `EventTarget` and `AbortSignal` are two
more instances, applied here.

### Cross-realm safety

`EventTarget` and `AbortSignal` produced in one realm (iframe, worker, vm context) have
the same structural shapes as their local-realm counterparts but a _different intrinsic
identity_. `instanceof EventTarget` against a foreign-realm `EventTarget` returns `false`
even when the value carries the full method contract. The pattern from thenable applies
unchanged:

- `isEventTargetLike` tests `instanceof EventTargetConstructor` first (realm-fixed via
  module-load capture); if that fails, falls back to `doesMatchEventTargetContract` for
  the structural check. The same pattern in `isAbortSignalLike`.
- `isEventTarget` and `isAbortSignal` each layer two realm-independent markers — the
  `[[Class]]` tag and the constructor-name walk — on top of the Like-tier predicate.

The `EventTargetConstructor` and `AbortSignalConstructor` captures use the
`isCallable(X) ? X : null` pattern with type-system narrowing through the
`typeof X | null` cast. Each Like-tier predicate gates only the `instanceof` branch on
`!!XConstructor`, consistent with `isPromiseLike` after the same refactor, so the
structural fallback still fires when the capture is `null`. Runtime environments lacking
the DOM globals would crash at module-load on the bareword access — the type-system
structure documents the defensive shape even though the runtime requires the globals.

### Predicate composition

Eight predicates — four public, four `@internal` — distributed across two two-tier
lattices. The composition shapes:

| Predicate                      | Composition                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `doesMatchEventTargetContract` | `hasInertMethod(v, 'dispatchEvent') && hasInertMethod(v, 'addEventListener') && hasInertMethod(v, 'removeEventListener')` |
| `isEventTargetLike`            | `!!v && ((!!ETC && v instanceof ETC) \|\| doesMatchEventTargetContract(v))`                                               |
| `isEventTarget`                | `isEventTargetLike(v) && tag === '[object EventTarget]' && ctor === 'EventTarget'`                                        |
| `doesMatchAbortSignalContract` | `hasInertMethod(v, 'throwIfAborted') && isBooleanValue(v.aborted) && doesMatchEventTargetContract(v)`                     |
| `isAbortSignalLike`            | `!!v && ((!!ASC && v instanceof ASC) \|\| doesMatchAbortSignalContract(v))`                                               |
| `isAbortSignal`                | `isAbortSignalLike(v) && tag === '[object AbortSignal]' && ctor === 'AbortSignal'`                                        |

Each Like-tier predicate composes the corresponding `@internal` helper as the structural
fallback. The strict-tier predicates layer two realm-independent markers on top of the
Like-tier (tag + constructor name) — the same shape as `isPromise` from the thenable
section.

Two ordering choices worth naming:

- **`doesMatchAbortSignalContract` runs `hasInertMethod(throwIfAborted)` first**, not the
  EventTarget contract. The reason is nullish-safety: `hasInertMethod` uses
  parameter-default-to-`null` (decision #025) as its leading gate, which rejects
  null/undefined inputs without touching the property surface. The direct `aborted` read
  fires only after that gate passes, guaranteeing `value` is non-nullish. The heavier
  EventTarget contract runs last as the heaviest discriminator and the structural
  baseline. See decision #029 for why `aborted` is read directly rather than via
  `hasInertMethod`.
- **`isEventTarget` and `isAbortSignal` reject subclasses** via strict constructor-name
  equality, consistent with `isPromise` (decision #023). DOM types extending `EventTarget`
  (`Element`, `Document`, etc.) resolve their constructor name to their own class, which
  fails the equality. Consumers needing subclass admission should compose with the
  Like-tier predicates, which accept subclasses via the `instanceof` fast path.

### Conservative-narrowing in the EventTarget / AbortSignal domain

The conservative-narrowing posture from the function section's "Two postures" subsection
lands a third time here, after the thenable round. `isEventTarget` and `isAbortSignal`
each use three cross-validating markers — the Like-tier method contract, the `[[Class]]`
tag, the constructor-name walk — even though any one is usually enough for typical-case
discrimination. The reasoning is the same as on the function side and the thenable side:
foundation-tier predicates that downstream packages depend on benefit from multiple
cross-validating markers as bounded-cost insurance against single-marker spoofing. The
marker independence makes the layered check trustworthy.

### The `aborted` accessor exception

`doesMatchAbortSignalContract` deviates from decision #021's third pattern (predicate over
inherited → descriptor-walk for safety) for the `aborted` check. The reason is
spec-grounded: `AbortSignal.aborted` is defined as
`[GetterAttribute] readonly attribute boolean`. Native `AbortSignal` returns an accessor
descriptor for `aborted`. Using `hasInertMethod` would reject every native `AbortSignal`.
The third pattern's contract is "no getter fires that shouldn't fire by spec" — for
spec-defined accessor properties, the direct read IS the spec-required path. The `&&`
chain ordering becomes load-bearing: the direct read only fires after the nullish-safe
`hasInertMethod(throwIfAborted)` gate.

The rule generalizes: descriptor-walk when invocation is unsafe per the predicate's
contract; direct-read when the spec defines the property as an accessor and invocation IS
the spec-required path. See decision #029 for the chronological capture and the
forward-applicable framing. The same exception will likely apply to other contracts with
spec-defined accessor attributes (`Iterator`'s `done`, `ReadableStream`'s `locked`, etc.)
when they enter the migration pipeline.

### The `AbortSignalLike` minimum-surface choice

`AbortSignalLike` is intentionally smaller than the lib's `AbortSignal`. Three members are
deliberately omitted:

- **`reason: any`** — no structural constraint to verify (`any` accepts anything);
  presence alone is uninformative.
- **`onabort`** — sugar over the EventTarget contract that is already validated.
- **Typed-event-map overloads** — TypeScript convenience for IDE autocomplete; not part of
  the runtime contract.

Consumers needing the full lib interface narrow further from `AbortSignalLike` to
`AbortSignal` via `isAbortSignal`. The line is drawn at "what's structurally testable
without invoking accessors the spec doesn't require." See decision #030 for the full
rationale and the forward-applicable framing.

### Forward integration: `AbortableThenable<T>` cross-module surface

The thenable module's `AbortableThenable<T>` interface (deferred to the `@/error`
migration; see DECISION-LOG Q.004) will eventually extend `Thenable<T>` with an abort
channel typed against `AbortError`. When `@/error` lands and `AbortableThenable<T>` ships,
the evented module's `AbortSignalLike` and `isAbortSignalLike` become the cross-module
surface for validating the abort channel structurally — independent of `AbortError` (which
lives on the error/rejection side, not the signal side). The contracts are designed to
stay compatible across the future merge: the `AbortableThenable<T>` interface accepts the
abort `AbortSignal`-shaped channel; the evented predicates discriminate it.

### Open architectural questions

- **Q.004 — `AbortableThenable<T>` deferred to the `@/error` migration.** See DECISION-LOG
  Q.004. The dependency landed with the error migration (decisions #032–#035);
  `AbortError` is now available. The remaining question — whether `AbortableThenable<T>`
  ships as a fourth tier of the thenable lattice or as its own module — is now ready to be
  answered in a follow-up round.

---

## type-detection / error

### Mental model

`type-detection / error` exists because the ECMA-262 `Error.isError` check is _spec-
precise but not polyfillable in pure JS_. The check returns `true` iff the value carries
the internal `[[ErrorData]]` slot, set by the `Error` constructor and inherited by every
built-in subclass (`TypeError`, `SyntaxError`, etc.) plus user-defined
`class X extends Error` instances. WebIDL's `DOMException` defines the same slot via a
separate path. The slot is _unobservable from userland code_: there is no operator,
descriptor, or reflection method that exposes it. A polyfill therefore has to approximate
`[[ErrorData]]` with a structural heuristic — admitting values whose `[[Class]]` tag
matches or whose prototype walks like an Error prototype.

The module's job is to discriminate the spec-defined error set across two runtime
conditions: a native `Error.isError` is present (ES2025+ runtimes — Node 23+, modern
browsers), and a native `Error.isError` is absent (legacy runtimes, where the polyfill
fires). Plus the abort-channel refinement layered on top — `AbortError` — for the
DOM-conventional naming pattern that `AbortSignal.abort()` and downstream consumers use.

The discrimination is organized as a five-tier composition stack:

```
hasErrorPrototypeContract         (@internal) — descriptor-walk sub-helper
  └── doesMatchErrorContract      (@internal) — structural fallback dispatcher
       └── isGenericError         (@internal) — polyfill body (instanceof + structural)
            └── isError           (public)    — native-or-polyfill, captured at module-load
                 └── isAbortError (public)    — refined predicate (name-suffix match)
```

Unlike the thenable / evented lattices — which are _type-narrowing_ ladders (`Thenable` →
`PromiseLike` → `Promise`; `EventTargetLike` → `EventTarget`) — the error module's stack
is a _composition_ ladder. Each tier composes the one above; the public narrowing happens
at `isError` (to `GenericError`) and at `isAbortError` (to `AbortError`). The lower tiers
exist to factor reusable structural sub-checks, mirror the contract vocabulary established
in thenable / evented, and provide an `@internal` polyfill body exported for testing.

### Cross-realm safety

The realm-safety pattern combines the strategies seen in the prior sections. The
local-realm fast path uses `value instanceof Error`; the cross-realm fallback uses
`Object.prototype.toString`-based `[[Class]]` tag inspection. Both are inlined inside
`isGenericError` rather than exposed as separate `isCurrentRealmError` /
`isAlienRealmError` predicates (equip-js had exposed both; the species-js round
consolidates them — decision #032).

Three structural tag branches cover the spec-defined error families:

- `'[object Error]'` — every value carrying `[[ErrorData]]` resolves to this tag per
  ECMA-262 §20.1.3.6 step 17. Subclasses (`TypeError`, custom `class X extends Error`)
  inherit the tag from `Error.prototype`'s `[[ErrorData]]` slot — unless they override
  `Symbol.toStringTag`. Cross-realm Error instances tag the same way because the spec step
  is realm-independent.
- `'[object DOMException]'` — WebIDL defines `DOMException` with its own
  `Symbol.toStringTag`, so DOMException instances tag differently despite also carrying
  `[[ErrorData]]`.
- `'[object Object]'` with matching prototype — the legacy widening branch (decision
  #033). Catches `Object.create(Error.prototype)` and ES3-style classical-inheritance
  Errors whose `[[Prototype]]` walks like an Error prototype but never went through the
  `Error` constructor (and so lack `[[ErrorData]]`).

The native `Error.isError` is captured at module-load via
`const nativeIsError = (Error as ErrorConstructorES2025).isError`, then bound through
`isFunction(nativeIsError) ? nativeIsError : isGenericError`. The capture is realm-fixed —
later tampering with `globalThis.Error.isError` does not reach this binding, mirroring the
realm-fixed pattern used for cached `@/config` primitives.

### Predicate composition

Five predicates — two public, three `@internal` — composing the polyfill stack. Two
supporting types and two interface declarations round out the surface:

| Symbol                        | Kind        | Composition / shape                                                                                     |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `GenericError`                | type        | `DOMException \| Error` — TypeScript approximation of `[[ErrorData]]`-bearing values                    |
| `AbortErrorName`              | type        | `` `${string}AbortError` `` — template-literal type for the abort-channel naming convention             |
| `AbortError`                  | type        | `GenericError & { name: AbortErrorName }` — refined intersection                                        |
| `ErrorConstructorES2025`      | interface   | `ErrorConstructor` extended with optional `isError?(v): v is GenericError` (`@internal`)                |
| `ErrorConstructorWithIsError` | interface   | `ErrorConstructor` extended with required `isError(v): v is GenericError` (`@internal`)                 |
| `hasErrorPrototypeContract`   | `@internal` | descriptor walk: 4 own descriptors of `prototype` + trailing-`'Error'` name marker; recursive `isError` |
| `doesMatchErrorContract`      | `@internal` | `sig === '[object Error]' \|\| sig === '[object DOMException]' \|\| (sig === '[object Object]' && ...)` |
| `isGenericError`              | `@internal` | `!!v && (v instanceof Error \|\| doesMatchErrorContract(v))`                                            |
| `isError`                     | `public`    | `const isError = isFunction(nativeIsError) ? nativeIsError : isGenericError` (captured at module-load)  |
| `isAbortError`                | `public`    | `isError(v) && v.name.endsWith('AbortError')`                                                           |

The composition mirrors the established `doesMatch<X>Contract` pattern from thenable
(`doesMatchPromiseContract`) and evented (`doesMatchEventTargetContract`,
`doesMatchAbortSignalContract`) — same "structural fallback dispatcher" role at the
internal layer. The realm-fast-path inlining inside `isGenericError` matches the
`isPromiseLike` / `isEventTargetLike` shape, where the `instanceof <Constructor>` fast
path composes with the structural fallback inside one umbrella predicate without exposing
the two halves separately.

### Polyfill widening over `[[ErrorData]]`

`isGenericError` admits a deliberate superset of the spec-precise `Error.isError` check.
The fourth structural branch — `'[object Object]'` with matching prototype — catches
values that lack `[[ErrorData]]` but walk like Errors: `Object.create(Error.prototype)`
and ES3-style classical-inheritance errors. The widening preserves equip-js's historical
acceptance set, which downstream production code may rely on.

The widening is implementation-level only. When native `Error.isError` is available, the
public `isError` delegates to it — the polyfill widening only affects runtimes where the
native method is missing. The two forms agree on well-behaved code and diverge only on the
legacy edge cases the polyfill admits. Documented at the `isError` JSDoc level so
consumers can see the divergence without reading the implementation. Consumers who want
strict spec semantics reach for the public `isError` (which delegates to native when
present); consumers who want the widened polyfill semantics irrespective of runtime reach
for `isGenericError` explicitly (exported `@internal` for testing and for this exact use
case). See decision #033.

The `hasErrorPrototypeContract` helper carries the prototype-shape heuristic that
implements the widening — four `Error.prototype` member presence/type assertions plus a
trailing-`'Error'` `name` marker. The trailing-`'Error'` check reads through the
descriptor chain rather than invoking `prototype.toString()`, both because the descriptor
read aligns with the spec-shape rule (decisions #020, #021) for own-data properties and
because `prototype.toString()` triggers the `@typescript-eslint/no-base-to-string` rule
when `prototype: object` — the workaround is to invoke the toString descriptor's value
directly via `.call(prototype)`, sidestepping the rule's symbol-identity heuristic.

### Native-or-polyfill capture at module-load

The public `isError` uses a `const`-binding pattern that captures native `Error.isError`
once at module-load:

```js
const nativeIsError = /** @type {ErrorConstructorES2025} */ (Error).isError;

export const isError = /** @type {import('@/error').isError} */ (
  isFunction(nativeIsError) ? nativeIsError : isGenericError
);
```

The cast through `ErrorConstructorES2025` (the interface declaring `isError?` as
_optional_) reads the native method honestly — its type is
`((v: unknown) => v is GenericError) | undefined` after the cast. The `isFunction` gate
runs at module-load; the ternary picks native or polyfill based on the gate's outcome. The
result is bound as `const isError`, then re-cast via `import('@/error').isError` to
recover the predicate type through the `isFunction` narrow (which would otherwise flatten
to `VerifiedFunction`).

The capture is realm-fixed by construction: the binding does not re-read
`globalThis.Error.isError` at each call, so later tampering with the global `Error`
constructor's `isError` does not affect this predicate. The pattern mirrors the
realm-fixed capture used for cached `@/config` primitives. The capture also documents the
runtime feature-detection pattern at the type level: `ErrorConstructorES2025` declares the
optional method; `ErrorConstructorWithIsError` declares the required form (the
asserted-presence variant useful for downstream code that's already verified the runtime
supports the native method). See decision #032.

### `AbortError` as a name-suffix refinement

`AbortError` refines `GenericError` via the DOM-conventional `'AbortError'` name suffix
pattern. `AbortErrorName` is a template-literal type `` `${string}AbortError` `` that
admits the empty-prefix case (`'AbortError'` itself) and arbitrary qualifier prefixes
(`'TimeoutAbortError'`, `'UserAbortError'`, `'NavigationAbortError'`) uniformly.
`AbortError` is the structural intersection `GenericError & { name: AbortErrorName }`.

`isAbortError(v)` composes `isError(v)` with `v.name.endsWith('AbortError')`.
Short-circuit `&&` runs `isError` first as the cheaper gate; the suffix check fires only
after `v` is confirmed to be an Error (which also guarantees `name` is a string per the
Error contract). Suffix-match is by design — exact equality would reject the legitimate
qualified variants the convention permits. The template-literal type is structural
documentation rather than a runtime guarantee — template-literal types collapse to
`string` at the runtime level — so the runtime guarantee is the `endsWith` check.

The error-module discrimination is _value-side only_: `isAbortError` inspects the error
value's `name`, not the abort-channel mechanics. Producer-side inspection of the abort
channel (`AbortSignal.aborted`, `AbortController` linkage) belongs to the evented module
(`isAbortSignal`, `isAbortSignalLike`). The two modules don't conflate concerns:
error-handling consumers reach for `isAbortError`; channel-inspection consumers reach for
`isAbortSignal`. See decision #035.

### Cross-module abort-channel surface

Three modules will eventually compose the full abort-channel surface:

- `evented` ships `AbortSignalLike` and `isAbortSignalLike` — the structural contract for
  "values that look like an abort signal" (the producer side).
- `error` (this module) ships `AbortError` and `isAbortError` — the structural contract
  for "errors that look like abort-channel errors" (the rejected-value side).
- `thenable` will eventually ship `AbortableThenable<T>` extending `Thenable<T>` with an
  abort-channel — its abort callback typed against `AbortError`, its abort signal typed
  against `AbortSignalLike`. The dependency that gated this future tier landed with the
  current error migration; see Q.004.

The three-module split keeps the concerns clean: signal producers, error values, and the
abort-channel-aware Promise composition each live in the module whose vocabulary they
belong to. Consumers building an abortable operation depend on all three; consumers
discriminating only one concern depend on only the relevant module.

### Open architectural questions

- **Q.004 — `AbortableThenable<T>` deferred to the `@/error` migration.** Now unblocked
  per the error migration shipping (decisions #032–#035). The remaining decision is
  whether `AbortableThenable<T>` ships as a fourth tier of the thenable lattice (inside
  `thenable.d.ts`) or as a separate `abortable-thenable.{js,d.ts}` module. See
  DECISION-LOG Q.004 for the framing.

---

_End of `type-detection / error` section. Future packages and modules append their
sections below._
