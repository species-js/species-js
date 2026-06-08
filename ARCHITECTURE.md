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
Thenable<T>                  (isThenable)      — callable `then` only
  ├── PromiseLike<T>         (isPromiseLike)   — full Promise.prototype method contract
  │     └── Promise<T>       (isPromise)       — Promise identity via three markers
  └── AbortableThenable<T>   (no predicate)    — `then` with optional `onaborted` callback
```

Each refinement adds _exactly one_ semantic level on a single axis. `isThenable` checks
for the single `then` method; `isPromiseLike` checks for `then` plus `catch` plus
`finally` (the full Promise-method contract); `isPromise` checks for the Promise-method
contract plus the `[[Class]]` tag plus the `'Promise'` constructor name. `PromiseLike` and
`Promise` form a strict chain of supersets — each tier's check-set extends the tier above.

`AbortableThenable<T>` is a _parallel_ refinement of `Thenable<T>`, independent from the
`PromiseLike` chain. It adds an optional third `onaborted` callback to `then`, typed
against `AbortError` from `@/error`. The two refinements are orthogonal axes: a value can
satisfy both (`PromiseLike & AbortableThenable`), one, or neither (just the `Thenable`
floor). No `isAbortableThenable` predicate exists — a `Thenable` with a two-argument
`then` and one with a three-argument `then` are runtime-indistinguishable. See decision
#037 for the full design.

The internal helper `doesMatchPromiseContract` sits structurally between `isThenable` and
`isPromiseLike`. It is the structural Promise-method-contract predicate without the
realm-fixed `instanceof` fast path. `isPromiseLike` calls it as the fallback when
`instanceof PromiseConstructor` fails (cross-realm Promises, userland Promise-likes such
as Bluebird or Q).

The middle tier (`PromiseLike`) is novel relative to TypeScript's lib. The lib has nothing
between `PromiseLike` (just a callable `then`, hence structurally identical to our
`Thenable`) and `Promise` (the full instance type). Our `PromiseLike` fills that gap by
encoding the full chaining contract (`catch` + `finally`) the lib version cannot express.
See decision #022 for the rationale of defining this tier as strictly richer than the
lib's.

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

### The AbortableThenable refinement

`AbortableThenable<T>` refines `Thenable<T>` on an axis orthogonal to `PromiseLike<T>`.
Where `PromiseLike<T>` adds the chaining-method contract (`catch` + `finally`),
`AbortableThenable<T>` adds the abort-channel contract — an optional third `onaborted`
callback to `then`, typed against `AbortError` from `@/error`. The two refinements are
independent: a value can satisfy both, one, or neither (just the `Thenable` floor).

The refinement is type-only. There is no `isAbortableThenable` predicate by design: a
`Thenable` with a two-argument `then` and one with a three-argument `then` are
runtime-indistinguishable — the third callback is optional, and a two-argument `then`
gracefully ignores extra arguments. The `then.length` heuristic could be inspected but is
spoof-trivial and not spec-required. Consumers receive `AbortableThenable<T>` because
their producer declares it structurally, not because a predicate verified it. See decision
#037 for the full rationale.

Chained `then` calls preserve the refinement: `AbortableThenable<T>.then(...)` returns
`AbortableThenable<TResult1 | TResult2 | TResult3>` rather than degrading to bare
`Thenable<...>`. The pattern parallels how `PromiseLike.then` returns `PromiseLike<...>` —
the refinement persists through chaining, so consumers can keep calling
`.then(_, _, onAborted)` further down without re-narrowing.

The abort-channel feature is structurally distributed across three modules:

- `@/error` ships `AbortError`, `AbortErrorName`, and `isAbortError` for the
  rejected-value side — the error type the `onaborted` callback receives.
- `@/evented` ships `AbortSignalLike` / `isAbortSignalLike` / `AbortSignal` /
  `isAbortSignal` for the producer side — the structural contract of values that emit
  abort signals.
- `@/thenable` ships `AbortableThenable<T>` for the consumer side — the structural
  contract of consumer-side abortable thenables that receive abort signals through their
  `then.onaborted` callback.

Consumers building an abortable operation depend on all three; consumers handling only one
side depend on only the relevant module.

### Open architectural questions

_Section currently empty — Q.004 (`AbortableThenable<T>` placement) was resolved
2026-06-06 by decision #037. See `DECISION-LOG.md` for the answered choices: return
preserved-abortable, refine `Thenable<T>` independently from `PromiseLike<T>`, ship in
`thenable.d.ts` type-only with no predicate._

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

### Producer-side role in the cross-module abort-channel surface

This module's `AbortSignalLike` / `isAbortSignalLike` / `AbortSignal` / `isAbortSignal`
are the producer-side contract of the cross-module abort-channel surface — the structural
shape of values that emit abort signals (native `AbortSignal`, `AbortController.signal`,
userland abortable producers, cross-realm instances). The thenable module's
`AbortableThenable<T>` (shipped 2026-06-06 in decision #037) is the consumer-side contract
— the structural shape of thenables that receive abort signals through their
`then.onaborted` callback. `@/error` ships `AbortError` for the rejected-value side that
the `onaborted` callback receives.

Consumers building an abortable operation depend on all three modules; consumers handling
only one side depend on only the relevant module.

### Open architectural questions

_Section currently empty — Q.004 (`AbortableThenable<T>` placement) was resolved
2026-06-06 by decision #037._

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

Three modules together compose the full abort-channel surface:

- `evented` ships `AbortSignalLike` / `isAbortSignalLike` / `AbortSignal` /
  `isAbortSignal` — the structural contract for the producer side ("values that look like
  an abort signal").
- `error` (this module) ships `AbortError`, `AbortErrorName`, and `isAbortError` — the
  structural contract for the rejected-value side ("errors that look like abort-channel
  errors").
- `thenable` ships `AbortableThenable<T>` (shipped 2026-06-06 in decision #037) — the
  consumer-side contract that extends `Thenable<T>` with an `onaborted` callback typed
  against `AbortError`. Chained `then` returns `AbortableThenable<...>` so the abort
  channel survives the chain at the type level.

The three-module split keeps the concerns clean: signal producers, error values, and the
abort-channel-aware Thenable refinement each live in the module whose vocabulary they
belong to. Consumers building an abortable operation depend on all three; consumers
discriminating only one concern depend on only the relevant module.

### Open architectural questions

_Section currently empty — Q.004 (`AbortableThenable<T>` placement) was resolved
2026-06-06 by decision #037._

---

_End of `type-detection / error` section._

---

## type-detection / primitive

### Mental model

`type-detection / primitive` discriminates JavaScript's five primitive families (`string`,
`number`, `boolean`, `symbol`, `bigint`) and their boxed wrapper-object forms
(`new String('x')`, `Object(42)`, `Object(Symbol('y'))`, etc.). Each primitive type in
JavaScript has two runtime forms — the primitive value and the boxed wrapper — that differ
on `typeof` (`'string'` vs `'object'`), on identity (`===`), and on prototype-method
invocation (boxed forms expose `String.prototype` methods directly; primitives auto-box
transparently for method access). Most JavaScript code treats the two interchangeably via
implicit coercion, but type-system discrimination needs to name the distinction.

The module ships three predicates and three types per family:

```
XValue        (isXValue)   — primitive form via `typeof`
BoxedX        (isBoxedX)   — boxed wrapper-object form via three structural markers
XType         (isX)        — composite admitting either form
```

The three forms compose: `XType = XValue | BoxedX`, and
`isX(v) = isXValue(v) || isBoxedX(v)`. Five families × six exports = 30 exports total (5
value types + 5 boxed types + 5 composite types + 5 value predicates + 5 boxed
predicates + 5 composite predicates).

### Cross-realm safety

Primitive predicates carry no cross-realm hazard: `typeof` reads identically in every
realm, so `isStringValue` etc. work uniformly across iframe / worker / vm-context
boundaries. The value-only predicates are the simplest and cheapest in the package —
single `typeof` comparisons, O(1).

Boxed predicates do carry the cross-realm concern. A `new String('x')` produced in a
foreign realm has a different `String` constructor identity than the local-realm `String`;
`instanceof String` against it returns `false`. The package handles this with the same
machinery used by `isPromise` / `isEventTarget`: the `[[Class]]` tag read through the
realm-fixed `toObjectString.call` capture, and the constructor name walked through the
four-source `getDefinedConstructor` fallback in `@/utility`. Both work
realm-independently. The `typeof === 'object'` gate is the cheapest first marker that
rejects primitives and `undefined` in O(1).

### Predicate composition

Three predicates per family, with the boxed predicate driving the marker chain. The
following table shows the structural shape; replace `X` with `String` / `Number` /
`Boolean` / `Symbol` / `BigInt` and `x` with the lowercase form for the family instance.

| Predicate  | Composition                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `isXValue` | `typeof v === 'x'`                                                                                      |
| `isBoxedX` | `typeof v === 'object' && getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X'` |
| `isX`      | `isXValue(v) \|\| isBoxedX(v)`                                                                          |

The marker order for `isBoxedX` is performance-first:

- **`typeof === 'object'`** is the O(1) primitive-rejection gate. Rejects primitive
  strings (which share the `'[object String]'` tag), all other primitives, `undefined`,
  and functions in one comparison. Admits `null` momentarily — but the tag check then
  rejects via `'[object Null]'`.
- **`getTypeSignature(v) === '[object X]'`** is the type discriminator. Reads through the
  realm-fixed `toObjectString.call` capture, so cross-realm boxed values are admitted on
  contract. Rejects plain objects, arrays, `Date`, `Map`, etc.
- **`getDefinedConstructorName(v) === 'X'`** is the constructor-identity cross-validator.
  Closes the `Symbol.toStringTag`-spoofing hole the tag check alone would leave open — a
  `class Spoof { get [Symbol.toStringTag]() { return 'String'; } }` instance passes the
  tag check but its constructor name resolves to `'Spoof'`, rejecting it here.

The order also mirrors the structural-gate-then-identity-markers pattern from `isPromise`
(decision #023) and `isEventTarget` / `isAbortSignal` (decision #028): a fast structural
gate, then two realm-independent identity refinements.

### Conservative-narrowing in the primitive domain

The boxed predicates' three-marker chain is an instance of the conservative-narrowing
posture established in decision #010 and applied at `isPromise` (#023), `isEventTarget` /
`isAbortSignal` (#028), and now the boxed primitives. The marker chain provides
bounded-cost insurance against single-marker spoofing:

- Tag-spoofing alone (`Symbol.toStringTag === 'String'` on an arbitrary object) is
  rejected by the constructor-name walk.
- Constructor-name-spoofing alone (a class named `String` that's not the built-in
  `String`) is rejected by the tag check, since the instance carries a different
  `[[Class]]` tag.
- Both spoofs together would pass the predicate but would also pass any other reasonable
  boxed-string test — at that point the value is structurally indistinguishable from a
  real boxed string.

The posture is the same as on the function side and the thenable / evented sides:
foundation-tier predicates that downstream packages depend on benefit from multiple
cross-validating markers as bounded-cost insurance, not just for the typical case but for
the spoofing surface.

### Generic-typed predicates

All 15 predicates follow the generic-typed family pattern
(`<T = unknown>(value?: T): value is T & X`) shipped in commit `5c5dbe7` (decision #039).
This includes the value-only predicates, which decision #036 had originally excluded —
that exclusion is superseded here. The rationale for revisiting: literal-union callers
benefit (`'on' | 'off' | number` narrows to `'on' | 'off'` after `isStringValue`), the
boxed and composite predicates clearly benefit (they narrow to object-shape types), and
internal consistency across the family matters. The package-wide tally is now 36
generic-typed predicates across `@/function`, `@/thenable`, `@/evented`, `@/error`, and
`@/primitive`. See decision #039 for the full framing.

### Wrapper-object types

The `BoxedX = X & object` types (`BoxedString = String & object`, etc.) intentionally use
TypeScript's wrapper-object types — the `String`, `Number`, `Boolean`, `Symbol`, `BigInt`
interfaces from `lib.es5.d.ts` — as the load-bearing distinction from the primitive forms.
The `& object` intersection excludes the primitive arms.

The `@typescript-eslint/no-wrapper-object-types` rule's default advice ("prefer the
primitive `string` over `String`") is correct for typical TypeScript code but wrong here:
this is precisely the case where the wrapper-object type is the structural model. A
per-file override scoped to `**/src/primitive.d.ts` in `eslint.config.js` disables the
rule for the boxed-type declarations, with an inline rationale matching the existing
override-with-rationale style in the config. Per the zero-`eslint-disable` policy
([[quality-discipline]]), the fix is configuration at the right level, not inline
suppression. See decision #038 for the full framing.

### The four-marker boxed-primitive discrimination chain

The boxed-primitive predicates use a four-marker chain that adds a spec-precise
`[[XData]]` internal-slot probe to the three structural markers shipped originally
(decision #038). The slot probe — a captured `X.prototype.valueOf.call(value)` that throws
on any value lacking the slot — is the load-bearing spoof-proof discriminator, because the
`[[XData]]` slot is engine-internal and cannot be installed from userland.

Markers in performance order:

1. `!!value` — O(1) null-rejection gate.
2. `typeof value === 'object'` — O(1) primitive-rejection gate.
3. `getTypeSignature(value) === '[object X]'` — `[[Class]]` tag from the realm-fixed
   `toObjectString.call` capture.
4. `getDefinedConstructorName(value) === 'X'` — constructor name from the four-source
   walk.
5. `doesHaveStrictUnboxed{X}ValueEquality(value)` — slot probe via the captured
   `prototype.valueOf` reference.

The chain extends the structural-gate-then-identity-markers pattern from `isPromise`
(decision #023) and `isEventTarget` / `isAbortSignal` (decision #028) with one more tier
underneath. The conservative-narrowing posture (decision #010) is preserved: the four
upstream gates are cheap fail-fast rejections; the slot probe is the bottom guarantee. A
value reaches the slot probe only after the cheaper markers all pass, so the `try`/`catch`
cost is paid only when the value plausibly _looks_ like a boxed primitive structurally.

The slot probe forecloses the `Symbol.toStringTag`-spoofing surface that the three-marker
version left open: a value with `[Symbol.toStringTag]: 'String'` on a class named `String`
would pass markers 1–4 while having no `[[StringData]]`. Marker 5 catches it via the
`valueOf` throw. See decision #042.

### Per-family equality strategies

Implementing marker 5 surfaced that the equality check between unboxed value and boxed
value has **four different correct shapes across the five families**, driven by the spec
mechanics of each constructor's coercion path:

| Family    | Equality form                                   | Spec trap avoided                                                               |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `String`  | `valueOf.call(v) === String(v)`                 | None — both sides unwrap via `ToPrimitive`                                      |
| `Number`  | `Object.is(valueOf.call(v), Number(v))`         | `NaN !== NaN` for `new Number(NaN)`; `Object.is` is `SameValue`                 |
| `Boolean` | `String(valueOf.call(v)) === String(v)`         | `ToBoolean(Object) → true` for any object; `String()` unwraps via `ToPrimitive` |
| `Symbol`  | `valueOf.call(v).description === v.description` | `Symbol(boxedSym)` throws; description equality catches own-property shadowing  |
| `BigInt`  | `valueOf.call(v) === BigInt(v)`                 | None — `BigInt()` unwraps via `ToPrimitive`                                     |

Five families, four different strategies. The variation is _spec-inherent_, not an
implementation artifact: the constructor coercion paths genuinely differ across the five
wrapper types, and attempting unification by parameterizing one helper would either lose
precision (silently re-introducing the Boolean / NaN regressions) or special-case its way
back to per-family logic via runtime branches. The species-js form ships five focused
helpers, each named for its family, each documented with the spec-mechanic rationale. See
decision #043 and the `[[boxed-primitive-discrimination]]` memory for the per-family
walkthrough.

Notable in the Symbol case: the description equality is _not_ redundant with the slot
probe. The valueOf throws on any value lacking `[[SymbolData]]`, but a real boxed Symbol
whose `description` property has been shadowed by an own data property
(`Object.defineProperty(boxed, 'description', { value: 'tampered' })`) still passes the
valueOf. The description cross-check catches that one residual tampering surface —
`unboxedValue.description` reads from the slot, `value.description` reads through the
(shadowed) accessor chain, mismatch → reject. Conservative-narrowing posture applied to
the tampering surface that survives the slot probe.

### Realm-fixed captures: boundary-retyping vs pure capture

`objectIs = Object.is` was added to `@/config` to support the Number-family equality
strategy. It is a _pure_ realm-fix capture — the lib type for `Object.is` is already
precise (`(value1: any, value2: any) => boolean`), so no boundary-retyping is needed. This
is distinct from the boundary-retyping pattern of decisions #008, #017, #026, #034, which
retype `any` returns to spec-precise types at the `@/config` boundary specifically to
close consumer-side `any`-cascades.

Both patterns share the realm-fix benefit (pinning the captured reference to this realm's
identity, immune to later tampering with the global). They differ on the type-system side:
boundary-retyping changes the captured primitive's declared type at the `@/config`
boundary; pure capture leaves the type as-is. `objectIs` is the second realm-fix-only
capture, alongside `toObjectString`'s pure-capture nature in the
captures-for-cross-realm-tag-reading set. The two patterns coexist within the same
`@/config` family.

The minor implication: not every `@/config` cached primitive needs a `.d.ts` retyping. The
boundary-retyping ruling in `[[design-rulings]]` should be read as _"when the lib type
forces an `any`-cascade, retype at the boundary,"_ not as _"every captured primitive must
be retyped."_ `objectIs` is the canonical example of the realm-fix-only form: type is
already precise; only the realm capture matters.

### Module-local capture vs `@/config` promotion

The five `prototype.valueOf` references for the boxed-equality helpers
(`String.prototype.valueOf`, `Number.prototype.valueOf`, etc.) live at the top of
`primitive.js` rather than at `@/config`. They share the same realm-fix semantics as
`@/config`'s captures but stay scoped to where they're used. The rule of thumb: a captured
primitive earns promotion to `@/config` when a second module needs it. Module-local is the
default for first-use; promotion is the response to second-use. Today the
prototype-valueOf captures are first-use; if `@species-js/type-identity` or a future
module needs them, promotion is mechanical.

### Open architectural questions

_Section currently empty — the primitive module's surface is complete. Further
nominal-branding or string-tag refinements (e.g. distinguishing `UserId` from `OrderId`
when both are `string`) belong in `@species-js/type-identity`, not here (decision #001)._

---

_End of `type-detection / primitive` section._

---

## type-detection / object

### Mental model

`type-detection / object` discriminates non-null, non-function objects into three
type-system shapes that match three runtime characteristics, plus a fourth named union
that captures the lodash-equivalent permissive form:

```
AnyObject                 (isObject)                    — non-null, non-function object
  ├── PlainObject         (isPlainObject)               — constructor === Object
  └── DictionaryObject    (isDictionaryObject)          — no prototype chain
PlainOrDictionaryObject   (isPlainOrDictionaryObject)   — PlainObject | DictionaryObject
```

The first three are a real subtype relationship: every `PlainObject` is an `AnyObject`;
every `DictionaryObject` is an `AnyObject`. `PlainObject` and `DictionaryObject` are
mutually exclusive at runtime (an object cannot simultaneously have `Object.prototype` as
its prototype and have no prototype) and at the type level (their `constructor` property
constraints are disjoint). `PlainOrDictionaryObject` is the named union of the two strict
forms — disjointness is preserved (each member retains its own discriminator); the name
captures the union without losing the distinction.

The four shapes correspond to four common consumer needs:

- **`AnyObject`** — the structural floor. "I know this isn't `null`, isn't `undefined`,
  isn't a primitive, isn't a function. I want to index into it."
- **`PlainObject`** — the lookup-table / record / DTO case. "I want a plain
  `Object`-constructed value, not a class instance, not an array, not a built-in
  container."
- **`DictionaryObject`** — the hashmap case. "I want a prototype-less object so my
  user-supplied keys can't collide with `Object.prototype` members."
- **`PlainOrDictionaryObject`** — the lodash-equivalent case. "I want any 'real' object
  (no class machinery), whether prototype-bearing or prototype-less."

### The structural discriminator: `constructor` property

The type-level discrimination matches the runtime discrimination:

- `PlainObject extends AnyObject` adds `constructor: ObjectConstructor` — required
  property of the specific built-in `Object` constructor type. Runtime characteristic:
  `getPrototypeOf(value) === Object.prototype` (local-realm fast path) or the cross-realm
  structural anchor — two cheap string-shape signal markers
  (`[[Class]] === '[object Object]'` + constructor name `'Object'`) plus a five-marker
  prototype contract on the constructor reached from `value`'s prototype (see "Structural
  anchor for `isPlainObject`" below).

- `DictionaryObject extends AnyObject` adds `constructor?: never` — optional property
  typed as `never`, meaning "either absent or, if present, of type `never`." Runtime
  characteristic: `getPrototypeOf(value) === null`,
  `getDefinedConstructor(value) === undefined`, AND
  `getTypeSignature(value) === '[object Object]'` (the tag cross-validator closes the rare
  own-`Symbol.toStringTag` tampering surface).

- `PlainOrDictionaryObject = PlainObject | DictionaryObject` — named union of the two
  strict forms. Disjointness preserved per-member. Runtime characteristic: the union of
  the two characteristics above; the predicate fuses them to share a gate and a prototype
  read.

The two strict types are type-disjoint at the TypeScript level because `ObjectConstructor`
is not assignable to `never`. No brand, no fiction — the discrimination IS the runtime
characteristic, modeled at the type level via the constructor property.

This contrasts with the equip-js source's `__objectBrand__: unique symbol` approach, which
forced the three types into _sibling_ positions (not subtypes), required brand property on
the values (nothing carries it at runtime), and was unverifiable by any predicate. The
species-js form rejects branding here for the same reason decision #001 rejected branding
for type-name string aliases: brands are appropriate only when same-shaped values must not
be interchanged across a directional flow, and they cannot carry runtime provenance. The
object-family distinction is structurally real via constructor and the type-level
discrimination should match that. See decision #040.

### Cross-realm safety

`isObject` is realm-independent — `!!value && typeof value === 'object'` reads the same in
every realm.

`isPlainObject` composes a local-realm fast path with a cross-realm-safe structural
anchor:

```js
isObject(value) &&
  (getPrototypeOf(value) === Object.prototype ||
    (hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value)));
```

The fast path (`getPrototypeOf === Object.prototype`) catches the common case in a single
reference comparison. The structural anchor catches cross-realm Plain Objects whose
prototype is the _other_ realm's `Object.prototype` (different reference, same structural
shape). The signal half is two cheap string-shape markers; the contract half is the
five-marker spec-mechanic-anchored chain detailed below.

`isDictionaryObject` is realm-orthogonal because prototype-less is prototype-less
regardless of realm:

```js
isObject(value) &&
  getPrototypeOf(value) === null &&
  getDefinedConstructor(value) === undefined &&
  getTypeSignature(value) === '[object Object]';
```

The fourth marker (`getTypeSignature === '[object Object]'`) closes the rare surface where
a prototype-less object has been hand-decorated with an own `Symbol.toStringTag` property
to lie about its `[[Class]]` — for the hashmap semantic the type targets, a tag would
never be set legitimately.

`isPlainOrDictionaryObject` is a _fused_ implementation rather than a naive
`isPlainObject(v) || isDictionaryObject(v)` composition: one shared `isObject` gate, one
shared `getPrototypeOf` read, then dispatch by prototype value (`=== Object.prototype` →
accept; `=== null` → verify the two non-prototype cross-validators; else → the cross-realm
contract walk). The fusion eliminates a redundant constructor walk and a redundant tag
computation that would otherwise fire on `DictionaryObject` inputs.

### Structural anchor for `isPlainObject`

The cross-realm fallback in `isPlainObject` pairs two cheap string-shape signal markers
with a five-marker spec-mechanic-anchored prototype contract. The shape:

```js
function hasPlainObjectIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object Object]' &&
    getDefinedConstructorName(value) === 'Object'
  );
}

function hasPlainObjectPrototypeContract(value) {
  const prototype = getPrototypeOf(value);
  const constructor = isObject(prototype) && getDefinedConstructor(prototype);

  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object Object]' &&
    getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object' &&
    getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype &&
    getPrototypeOf(prototype) === null
  );
}
```

The contract markers in cost order:

1. **`isClass(constructor)`** — the constructor reached via
   `getDefinedConstructor(prototype)` is a built-in or `class`-syntax newable. Rejects
   fake-`constructor`-pointer spoofs where the value's `constructor` is tampered to
   reference a non-function value.
2. **Prototype's own `[[Class]]` tag** —
   `getTypeSignature(prototype) === '[object Object]'`. Real `Object.prototype`s tag
   uniformly across realms.
3. **Constructor's own `name` via own descriptor** —
   `getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object'`. The
   descriptor-via-`.value` read skips accessors: an accessor-form definition (`get`/`set`)
   yields `undefined` and fails the check.
4. **Round-trip identity via own descriptor** —
   `getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype`. Verifies the
   constructor's own `prototype` data property points back to the prototype walked from
   `value`. Closes the tampered-`constructor`-pointer spoof at its root: even if
   `value.constructor` is the global `Object`, the constructor's `Object.prototype` must
   equal the prototype the value actually carries.
5. **Chain-depth invariant** — `getPrototypeOf(prototype) === null`. Every realm's
   `Object.prototype` has a `[[Prototype]]` of `null`; class instances and built-in
   container instances have at least two prototype-chain levels.

The descriptor-via-`.value` discipline (markers 3, 4) is uniform with `isClass`'s own use
of `getOwnPropertyDescriptor(value, 'prototype')?.writable === false`. Reading own data
via descriptors — never via direct property access — is the rule across the prototype
contract: it skips inherited properties (closing inheritance-based spoofs) and skips
accessor-form definitions (closing the lying-getter spoof). See decision #044.

The residual spoof surface is an attacker who constructs `FakeCtor` with a writable:false
own `prototype` data property pointing to a hand-crafted `fakeProto` (`[[Prototype]]`
null) and `FakeCtor.name === 'Object'`. At that point they have reconstructed the spec
mechanics of `Object` from scratch — structurally indistinguishable from a foreign realm's
`Object`. Not a spoof; a parallel implementation.

### Cross-module: `BlankType` ↔ `DictionaryObject`

`BlankType` in `@/utility` is `Record<PropertyKey, never>` — the _sentinel_ form of a
prototype-less object: no keys statically reachable. Used as a blank-descriptor sentinel
in `@/error`'s `hasErrorPrototypeContract` heuristic via the `objectCreate(null)` retyped
return in `@/config` (decisions #017, #034).

`DictionaryObject` is the _populated_ form: `Record<PropertyKey, unknown>` extended with
the `constructor?: never` discriminator. Used as a typed hashmap with arbitrary
user-supplied keys.

Per TypeScript variance, `BlankType` is a structural subtype of `DictionaryObject`
(`Record<PropertyKey, never>` is a subtype of `Record<PropertyKey, unknown>` because
`never` is the bottom type and a subtype of `unknown`). The two are not interchangeable in
API contracts because the consumer intent differs (sentinel vs hashmap), but they coexist
cleanly in the type system. Both are cross-referenced in their respective modules' JSDoc.

### `isPlainObject` strictness vs lodash `_.isPlainObject`

Lodash's `_.isPlainObject` is _permissive_ — it admits both prototype-bearing objects
(constructor === Object) AND prototype-less objects (`Object.create(null)`). The
species-js form is _strict_ — `isPlainObject` admits only the prototype-bearing form; the
prototype-less form has its own dedicated predicate, `isDictionaryObject`.

The lodash semantic is recovered through the dedicated permissive predicate:

```ts
const matchesLodashSet = isPlainOrDictionaryObject(v);
// equivalent to: isPlainObject(v) || isDictionaryObject(v)
```

`isPlainOrDictionaryObject` is a _fused_ implementation that shares the gate and the
prototype read across both branches rather than running the two strict predicates
back-to-back; see "Cross-realm safety" for the dispatch. The named permissive form
captures the lodash compatibility under one symbol without losing the strict-form
distinction the underlying types still carry.

The strict-by-default, compose-for-lenient posture is consistent with `isPromise`
rejecting subclasses (decision #023), `isEventTarget` / `isAbortSignal` rejecting
subclasses (#028), and `AbortError` requiring the suffix-match (#035). See decisions #041
and #046.

### Open architectural questions

_Section currently empty — the object module's surface is complete. The `identity`
migration that the equip-js source carried alongside `object` belongs to
`@species-js/type-identity`, not here._

---

_End of `type-detection / object` section. Future packages and modules append their
sections below._
