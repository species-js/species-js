# type-detection / thenable

## Mental model

`type-detection / thenable` exists because the Promise resolution protocol has multiple
discrimination levels, none of which the TypeScript lib exposes precisely. JavaScript's
runtime "is this Promise-shaped?" question has at least three meaningful answers — has a
callable `then`, has the full `Promise.prototype` method contract, is identifiable as a
`Promise` instance — and the package's job is to give each level a predicate and a type
that share a single conceptual lattice:

```
Thenable<T>                  (isThenable)      — callable `then` only
  ├── PromiseLike<T>         (isPromiseLike)   — full Promise.prototype method contract
  │     └── Promise<T>       (isPromise)       — Promise identity via two-axis dispatch
  └── AbortableThenable<T>   (no predicate)    — `then` with optional `onaborted` callback
```

Each refinement adds _exactly one_ semantic level on a single axis. `isThenable` checks
for the single `then` method; `isPromiseLike` checks for `then` plus `catch` plus
`finally` (the full Promise-method contract); `isPromise` discriminates `Promise` identity
via two-axis dispatch — a local-realm fast path on `instanceof` + proto-identity, or a
cross-realm structural chain on the Promise-method contract plus the `[[Class]]` tag plus
the `'Promise'` constructor name. `PromiseLike` and `Promise` form a strict chain of
supersets — each tier's check-set extends the tier above.

`AbortableThenable<T>` is a _parallel_ refinement of `Thenable<T>`, independent from the
`PromiseLike` chain. It adds an optional third `onaborted` callback to `then`, typed
against `AbortError` from `@/error`. The two refinements are orthogonal axes: a value can
satisfy both (`PromiseLike & AbortableThenable`), one, or neither (just the `Thenable`
floor). No `isAbortableThenable` predicate exists — a `Thenable` with a two-argument
`then` and one with a three-argument `then` are runtime-indistinguishable. See decision
#037 for the full design.

The internal helper `doesMatchPromiseContract` sits structurally between `isThenable` and
`isPromiseLike`. It is the structural Promise-method-contract predicate without the
realm-fixed `instanceof` fast path. Both `isPromiseLike` and `isPromise` call it as the
structural fallback when the realm-fixed `instanceof` check fails (cross-realm Promises,
userland Promise-likes such as Bluebird or Q). `isPromise` calls it _directly_ on its
cross-realm arm rather than cascading through `isPromiseLike`, because the `instanceof`
check the latter would re-run has already been disproved by `isPromise`'s local-realm arm.

`thenable.js` and `evented.js` share the named-helper `isCurrentRealm{X}Instance`
extraction (`isCurrentRealmPromiseInstance` here, `isCurrentRealmEventTargetInstance` and
`isCurrentRealmAbortSignalInstance` in `evented.js`). Each helper does the bare
null-guarded `!!XConstructor && value instanceof XConstructor` and nothing more. The
proto-identity arm is added ON TOP via the ternary in the strict predicate — the helper
itself stays subclass-admitting so it can also feed the `Like` sibling.

The middle tier (`PromiseLike`) is novel relative to TypeScript's lib. The lib has nothing
between `PromiseLike` (just a callable `then`, hence structurally identical to our
`Thenable`) and `Promise` (the full instance type). Our `PromiseLike` fills that gap by
encoding the full chaining contract (`catch` + `finally`) the lib version cannot express.
See decision #022 for the rationale of defining this tier as strictly richer than the
lib's.

## Cross-realm safety

A `Promise` produced in one realm (iframe, worker, vm context) carries the same
`Promise.prototype` method contract as a Promise from the local realm, but a _different
intrinsic identity_. `instanceof Promise` against a foreign-realm Promise returns `false`
even when the value is unambiguously a Promise. The thenable predicates handle this by
composing identity and structure rather than choosing one:

- `isPromiseLike` tests `instanceof PromiseConstructor` first (inexpensive, realm-fixed,
  through the `isCurrentRealmPromiseInstance` helper) and falls back to
  `doesMatchPromiseContract` for the structural check. Cross-realm Promises pass via the
  fallback; userland Promise-likes pass via the fallback too.
- `isPromise` runs the same realm-fixed `instanceof` check, then DISPATCHES — local-realm
  arm commits to `getPrototypeOf(value) === promisePrototype` for direct-instance
  discrimination in O(1); cross-realm arm runs three realm-independent markers — the
  `Promise` `[[Class]]`-tag (read through the realm-fixed `Object.prototype.toString.call`
  capture), the `Promise` constructor-name (resolved through the package's four-source
  constructor walk), and the structural `doesMatchPromiseContract` check. The arms commit
  mutually exclusively via the ternary; see "Two-axis dispatch on `isPromise`" below.

The `const PromiseConstructor = Promise;` and
`const promisePrototype = PromiseConstructor && PromiseConstructor.prototype;` captures in
`thenable.js` are the module-load realm-fixed references for the `instanceof` fast path
and the proto-identity comparison respectively. The `&&` form on the prototype capture
propagates `null` as the absence sentinel uniformly across the paired bindings — the
project-wide `@typescript-eslint/prefer-optional-chain` disable preserves this idiom
against optional-chain rewrites that would split the absence vocabulary (`null` vs.
`undefined`) between paired captures. The captures are currently module-local; if a second
consumer (e.g. a future `@/error` Promise-aware predicate) needs them, the natural
promotion is to `@/config` alongside the other intrinsics.

## Predicate composition

Each of the four predicates is a clean composition over the layer below it. Reading from
the floor up:

| Predicate                  | Composition                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isThenable`               | `!!v && (isCurrentRealmPromiseInstance(v) \|\| hasInertMethod(v, 'then'))`                                                                                             |
| `doesMatchPromiseContract` | `hasInertMethod(v, 'then') && hasInertMethod(v, 'catch') && hasInertMethod(v, 'finally')`                                                                              |
| `isPromiseLike`            | `!!v && (isCurrentRealmPromiseInstance(v) \|\| doesMatchPromiseContract(v))`                                                                                           |
| `isPromise`                | `!!v && (isCurrentRealmPromiseInstance(v) ? getPrototypeOf(v) === promisePrototype : tag === '[object Promise]' && ctor === 'Promise' && doesMatchPromiseContract(v))` |

Each layer adds exactly one semantic level. No layer redoes work the layer below already
did. Short-circuit `&&` enforces a _"least expensive first"_ ordering at each layer: in
`doesMatchPromiseContract`, `then` (the spec-defined adoption hook) runs first; in the
`Like` predicates, the `instanceof` fast path runs before the structural fallback; in
`isPromise`, the local-realm arm settles inexpensively on `proto-identity` (two O(1)
operations) while the cross-realm arm runs tag → constructor-name → contract in
inexpensive-first order.

The factoring of `hasInertMethod` as a `@/utility` primitive — rather than inlining the
descriptor-walk inside `isThenable` — is what makes `doesMatchPromiseContract` and any
future method-contract predicate compose cleanly. See decision #024.

## Two-axis dispatch on `isPromise`

`isPromise` is a two-axis ternary that commits to the right arm based on the realm-fixed
`instanceof` check, rather than running a single linear chain. The shape was lifted from
the `Like`-cascade pattern in decision #050. Two arms, mutually exclusive:

- **Local-realm arm** (`isCurrentRealmPromiseInstance(v) === true`) — settles on
  `getPrototypeOf(v) === promisePrototype`. Two O(1) operations. Admits only direct
  `Promise` instances; subclasses pass `instanceof` but fail the proto-identity check.
- **Cross-realm arm** (`isCurrentRealmPromiseInstance(v) === false`) — runs three
  realm-independent markers: the `[[Class]]` tag `'[object Promise]'`, the
  constructor-name `'Promise'` (via `getDefinedConstructorName`'s four-source walk), and
  `doesMatchPromiseContract` for the structural method-contract check. Cheap-first order;
  cross-realm subclasses reject at constructor-name before paying for the contract.

The ternary shape is decided by **bottom-seal availability**. Boxed primitives have an
engine-attested bottom seal (the `[[XData]]` slot probe via `X.prototype.valueOf`); both
arms of `isBoxedString` legitimately feed into the slot probe because it is inexpensive
and spoof-proof even after the local-realm arm matches. Promise has no equivalent
engine-attested seal — `doesMatchPromiseContract` is a structural check, and on the
local-realm arm the contract is already implied by `proto-identity` (a value with
`Promise.prototype` necessarily inherits `then` / `catch` / `finally`). Pulling the
contract to a shared trailing position would pay for it redundantly on the local-realm hot
path; keeping it in an `||`'ed cross-realm arm would force local-realm subclass rejection
to pay for the entire cross-realm chain. The two arms have different bottom semantics, so
a ternary committing to the right arm is the structurally honest combination. See decision
#050.

## Conservative-narrowing in the Promise domain

The conservative-narrowing posture from the function module (see
[`./function.md`](./function.md#two-postures-minimal-floor-vs-conservative-narrowing) §
"Two postures: minimal-floor vs. conservative-narrowing") lands a second time here.
`isPromise` uses three cross-validating markers on its **cross-realm arm** —
`doesMatchPromiseContract`, the `[[Class]]` tag, and the constructor-name resolution —
even though any one of them is usually enough for a typical-case discrimination. The
local-realm arm uses `proto-identity` as its self-sealing single marker (the realm-fixed
`Promise.prototype` cannot be spoofed at the prototype-identity level from userland). The
reasoning matches [`./function.md`](./function.md): foundation-tier predicates that
downstream packages depend on benefit from multiple cross-validating markers as
bounded-cost insurance against single-marker spoofing on the surface where spoofing is
possible.

The marker independence on the cross-realm arm makes the layered check trustworthy. Each
marker rules out a distinct false-positive class:

- `doesMatchPromiseContract` rejects values that claim Promise identity (via tag or
  constructor name) without exposing the `Promise.prototype` method contract — e.g.
  `{ [Symbol.toStringTag]: 'Promise' }` with no `catch` or `finally`.
- The `[[Class]]` tag rejects values that satisfy the method contract but tag themselves
  as something other than `'Promise'`.
- The constructor-name marker closes the `Symbol.toStringTag` spoofing hole the tag check
  alone would leave open — a value declaring `[Symbol.toStringTag] = 'Promise'` on an
  unrelated object passes the tag check but fails the constructor-name walk because the
  walk reaches the value's actual constructor, not its self-reported tag.

`Promise` subclasses fall to the strict equality on TWO independent markers —
`proto-identity` on the local-realm arm, constructor-name on the cross-realm arm. A value
of `class MyPromise extends Promise {}` rejects at `proto-identity` (its prototype is
`MyPromise.prototype`, not `Promise.prototype`) in O(1) without any cross-realm work; a
foreign-realm `MyPromise` subclass rejects at constructor-name (resolves to `'MyPromise'`,
fails `=== 'Promise'`) before paying for the contract. This is _deliberate strictness_;
consumers needing subclass admission should compose with a constructor-chain walk on top
of `isPromise`. See decisions #023 and #050.

## The unsealed prototype-graft boundary

There is one spoofing surface `isPromise` does not close, by construction. A value built
as `Object.create(Promise.prototype)` inherits `then` / `catch` / `finally` and the
`Symbol.toStringTag` data property from `Promise.prototype`, and has `Promise.prototype`
as its `[[Prototype]]` — so it satisfies every marker the predicate reads (the local-realm
`instanceof` + proto-identity pair, and the cross-realm tag + constructor-name +
contract). Yet it carries no `[[PromiseState]]` internal slot: it is Promise-_shaped_ but
not a live `Promise`. `isPromise` admits it (vector `isPromise/B2` in the spec).

This graft cannot be sealed portably, and the reason is structural rather than incidental.
The boxed-primitive predicates seal their analogous graft
(`Object.create(String.prototype)`) with an engine-attested `[[XData]]` internal-slot
probe via the captured `X.prototype.valueOf`, which throws on any value lacking the slot
(see [`./primitive.md`](./primitive.md) and decision #042). `Promise` has no equivalent:
its only `[[PromiseState]]`-reading methods are `then` / `catch` / `finally`, and they are
**not inert** — the success path invokes `SpeciesConstructor` (arbitrary user code via
`constructor` / `@@species`), allocates a derived promise, and may schedule a microtask.
`Promise.prototype` exposes no accessor at all. A probe built on `then` would violate the
inspect-without-invoke contract the module upholds (decision #021, `hasInertMethod`) — a
worse failure than the graft it would close.

The boundary is honest, not leaky: structural detection verifies _shape, not liveness_.
The graft throws the instant it is `await`ed or `.then`-ed, so admitting it as
Promise-shaped tells the truth about what was inspected. This is the **structural
sealability** principle (decision #052; see [`./README.md`](./README.md) cross-cutting
patterns): a type is sealable iff it exposes an inert internal-slot accessor, and
`Promise` is the rare built-in that does not. A host-backed hardening tier is tracked as
Q.005.

## The "contract" vocabulary for spec-defined method sets

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

## The `hasInertMethod` primitive

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

## The AbortableThenable refinement

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

## Open architectural questions

- **Q.005 — host-backed hardening tier for `isPromise`.** The
  `Object.create(Promise.prototype)` graft is structurally unsealable in portable JS
  (decision #052). A host primitive that reads `[[PromiseState]]` directly (e.g. Node's
  `util.types.isPromise`) could seal it, but makes behavior environment-divergent — so it
  is deferred to an opt-in downstream adapter, not the portable foundation. See
  [`../decisions/open-questions.md`](../decisions/open-questions.md).

_Q.004 (`AbortableThenable<T>` placement) was resolved 2026-06-06 by decision #037: return
preserved-abortable, refine `Thenable<T>` independently from `PromiseLike<T>`, ship in
`thenable.d.ts` type-only with no predicate._
