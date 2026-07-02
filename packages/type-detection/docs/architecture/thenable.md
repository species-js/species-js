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
cross-realm structural-equivalence check (the Promise-method contract, the `[[Class]]`
tag, the `'Promise'` constructor name, and a prototype/constructor reciprocal-identity
marker; decision #054). `PromiseLike` and `Promise` form a strict chain of supersets —
each tier's check-set extends the tier above.

`AbortableThenable<T>` is a _parallel_ refinement of `Thenable<T>`, independent from the
`PromiseLike` chain. It adds an optional third `onaborted` callback to `then`, typed
against `AbortError` from `@/error`. The two refinements are orthogonal axes: a value can
satisfy both (`PromiseLike & AbortableThenable`), one, or neither (just the `Thenable`
floor). No `isAbortableThenable` predicate exists — a `Thenable` with a two-argument
`then` and one with a three-argument `then` are runtime-indistinguishable. See decision
#037 for the full design.

The internal helper `doesImplementPromiseContract` sits structurally between `isThenable`
and `isPromiseLike`. It is the structural Promise-method-contract predicate without the
realm-fixed `instanceof` fast path. Both `isPromiseLike` and `isPromise` call it as the
structural fallback when the realm-fixed `instanceof` check fails (cross-realm Promises,
userland Promise-likes such as Bluebird or Q). `isPromise` calls it _directly_ on its
cross-realm arm rather than cascading through `isPromiseLike`, because the `instanceof`
check the latter would re-run has already been disproved by `isPromise`'s local-realm arm.

Since decision #054, `isPromise`'s cross-realm arm is itself factored into named
structural-equivalence helpers: `isStructuralPromiseEquivalent` orchestrates the
value-side identity signal (`hasPromiseIdentitySignal` — the `[[Class]]` tag plus the
constructor name), the method contract (`doesImplementPromiseContract`), and a
prototype-side validation (`isStructuralPromisePrototypeEquivalent`). The last anchors on
a reciprocal own-constructor identity, reading the prototype's OWN `constructor` (ECMA-262
§10.2.6) via `getDefinedConstructor` under `{ assumePrototype: true }` — the option
generalized from `@/object`'s sole call site by decision #054.

Since decision #059 these helpers THREAD the once-resolved constructor instead of
re-resolving it (the former `constructorRegistry` / `constructorNameRegistry` were removed
on benchmark numbers). Each structural helper resolves its object's constructor once via
`getDefinedConstructor` and reuses it for both the reciprocal-identity compare and the
name marker — `hasPromiseIdentitySignal(value, name)` now takes the already-derived name
(via the generic `getVerifiedOwnName`) and does no constructor resolution of its own.

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
  `doesImplementPromiseContract` for the structural check. Cross-realm Promises pass via
  the fallback; userland Promise-likes pass via the fallback too.
- `isPromise` runs the same realm-fixed `instanceof` check, then DISPATCHES — local-realm
  arm commits to `prototype === promisePrototype && doesNotShadowPromiseContract(value)`
  (the once-resolved, throw-safe `getInertPrototypeOf(value)` read threaded into both
  arms, decision #059, plus the #063 own-surface integrity gate that demotes an own-level
  contract override `is`→`Like`) for direct-instance discrimination in O(1); cross-realm
  arm runs `isStructuralPromiseEquivalent`, four realm-independent markers — the `Promise`
  `[[Class]]`-tag (read through the realm-fixed `Object.prototype.toString.call` capture),
  the `Promise` constructor-name (resolved through the package's pivot-and-walk
  constructor resolution), the structural `doesImplementPromiseContract` check, and a
  prototype/constructor reciprocal-identity marker
  (`isStructuralPromisePrototypeEquivalent`, decision #054). The arms commit mutually
  exclusively via the ternary; see "Two-axis dispatch on `isPromise`" below.

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

Each predicate is a clean composition over the layer below it, and `isPromise`'s
cross-realm arm decomposes further into structural-equivalence helpers (decision #054).
Reading from the floor up (`aP` = `{ assumePrototype: true }`, `dc` = the once-resolved
defined constructor threaded through the helper, decision #059):

| Predicate / helper                       | Composition                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isThenable`                             | `!!v && (isCurrentRealmPromiseInstance(v) \|\| hasInertMethod(v, 'then'))`                                                                                                   |
| `doesImplementPromiseContract`           | `hasInertMethod(v, 'then') && hasInertMethod(v, 'catch') && hasInertMethod(v, 'finally')`                                                                                    |
| `isPromiseLike`                          | `!!v && (isCurrentRealmPromiseInstance(v) \|\| doesImplementPromiseContract(v))`                                                                                             |
| `hasPromiseIdentitySignal`               | `name === 'Promise' && getTypeSignature(v) === '[object Promise]'` (caller threads `name`)                                                                                   |
| `isStructuralPromisePrototypeEquivalent` | `dc = ctor && getDefinedConstructor(proto, aP); !!ctor && ctor === dc && hasPromiseIdentitySignal(proto, getVerifiedOwnName(dc)) && doesImplementPromiseContract(proto)`     |
| `isStructuralPromiseEquivalent`          | `dc = getDefinedConstructor(v); hasPromiseIdentitySignal(v, getVerifiedOwnName(dc)) && doesImplementPromiseContract(v) && isStructuralPromisePrototypeEquivalent(proto, dc)` |
| `isPromise`                              | `!!v && (p = getInertPrototypeOf(v), isCurrentRealmPromiseInstance(v) ? p === promisePrototype : isStructuralPromiseEquivalent(v, p))`                                       |

Each layer adds exactly one semantic level. No layer redoes work the layer below already
did. Short-circuit `&&` enforces a _"least expensive first"_ ordering at each layer: in
`doesImplementPromiseContract`, `then` (the spec-defined adoption hook) runs first; in the
`Like` predicates, the `instanceof` fast path runs before the structural fallback; in
`isPromise`, the local-realm arm settles inexpensively on `proto-identity` (two O(1)
operations) while the cross-realm arm runs tag → constructor-name → contract →
prototype-equivalence in inexpensive-first order.

The factoring of `hasInertMethod` as a `@/utility` primitive — rather than inlining the
descriptor-walk inside `isThenable` — is what makes `doesImplementPromiseContract` and any
future method-contract predicate compose cleanly. See decision #024.

## Two-axis dispatch on `isPromise`

`isPromise` is a two-axis ternary that commits to the right arm based on the realm-fixed
`instanceof` check, rather than running a single linear chain. The shape was lifted from
the `Like`-cascade pattern in decision #050. Two arms, mutually exclusive:

- **Local-realm arm** (`isCurrentRealmPromiseInstance(v) === true`) — settles on
  `prototype === promisePrototype && doesNotShadowPromiseContract(v)` (the once-resolved
  throw-safe `getInertPrototypeOf(v)`, then the own-surface integrity gate). Admits only
  direct `Promise` instances; subclasses pass `instanceof` but fail the proto-identity
  check, and a value that overrides an inherited contract member (or the `constructor`) at
  its OWN level is demoted `is`→`Like` by the gate — the #028 subclass rejection applied
  to the own layer (decision #063). The bare graft, owning nothing, stays admitted (#052).
- **Cross-realm arm** (`isCurrentRealmPromiseInstance(v) === false`) — runs
  `isStructuralPromiseEquivalent`, four realm-independent markers: the `[[Class]]` tag
  `'[object Promise]'`, the constructor-name `'Promise'` (resolved once via
  `getDefinedConstructor` + `getVerifiedOwnName`, the pivot-and-walk under
  `{ assumePrototype: true }` for the prototype leg), `doesImplementPromiseContract` for
  the structural method-contract check, and the prototype/constructor reciprocal-identity
  marker (`isStructuralPromisePrototypeEquivalent`, decision #054). Cheap-first order;
  cross-realm subclasses reject at constructor-name before paying for the contract or the
  prototype-equivalence check.

The ternary shape is decided by **bottom-seal availability**. Boxed primitives have an
engine-attested bottom seal (the `[[XData]]` slot probe via `X.prototype.valueOf`); both
arms of `isBoxedString` legitimately feed into the slot probe because it is inexpensive
and spoof-proof even after the local-realm arm matches. Promise has no equivalent
engine-attested seal — `doesImplementPromiseContract` is a structural check, and on the
local-realm arm the contract is already implied by `proto-identity` (a value with
`Promise.prototype` necessarily inherits `then` / `catch` / `finally`). Pulling the
contract to a shared trailing position would pay for it redundantly on the local-realm hot
path; keeping it in an `||`'ed cross-realm arm would force local-realm subclass rejection
to pay for the entire cross-realm chain. The two arms have different bottom semantics, so
a ternary committing to the right arm is the structurally honest combination. See decision
#050.

### Realm asymmetry on tampered inputs (deliberate)

The two arms weigh evidence differently, so for a TAMPERED input they can disagree by
realm. The local-realm arm is identity-based (`instanceof` + proto-identity + the
string-keyed own-shadow gate) and blind to a cosmetic `Symbol.toStringTag`: a LOCAL
`Object.create(Promise.prototype)` graft carrying only a spoofed tag is still admitted,
because it genuinely carries `Promise.prototype` and the tag is a symbol key the gate does
not read. The cross-realm arm, lacking a local prototype to match, reads the tag via
`getTypeSignature`, so the SAME shape from a foreign realm rejects. The same tampered
value therefore reads `true` locally and `false` cross-realm.

Decision #063 reconciled the BEHAVIORAL half of this asymmetry — own-level method or
`constructor` shadowing is now rejected in both realms (locally by
`doesNotShadowPromiseContract`, cross-realm by the structural contract) — while the
COSMETIC tag half stays local-admit / cross-realm-reject by design, the residual it leaves
standing. This is the same split `object.md` and `evented.md` document for their modules;
the bare graft, interposing nothing, is admitted in both (#052).

## Conservative-narrowing in the Promise domain

The conservative-narrowing posture from the function module (see
[`./function.md`](./function.md#two-postures-minimal-floor-vs-conservative-narrowing) §
"Two postures: minimal-floor vs. conservative-narrowing") lands a second time here.
`isPromise` uses four cross-validating markers on its **cross-realm arm** —
`doesImplementPromiseContract`, the `[[Class]]` tag, the constructor-name resolution, and
the prototype/constructor reciprocal-identity check (decision #054) — even though any one
of them is usually enough for a typical-case discrimination. The local-realm arm uses
`proto-identity` as its self-sealing single marker (the realm-fixed `Promise.prototype`
cannot be spoofed at the prototype-identity level from userland). The reasoning matches
[`./function.md`](./function.md): foundation-tier predicates that downstream packages
depend on benefit from multiple cross-validating markers as bounded-cost insurance against
single-marker spoofing on the surface where spoofing is possible.

The marker independence on the cross-realm arm makes the layered check trustworthy. Each
marker rules out a distinct false-positive class:

- `doesImplementPromiseContract` rejects values that claim Promise identity (via tag or
  constructor name) without exposing the `Promise.prototype` method contract — e.g.
  `{ [Symbol.toStringTag]: 'Promise' }` with no `catch` or `finally`.
- The `[[Class]]` tag rejects values that satisfy the method contract but tag themselves
  as something other than `'Promise'`.
- The constructor-name marker closes the `Symbol.toStringTag` spoofing hole the tag check
  alone would leave open — a value declaring `[Symbol.toStringTag] = 'Promise'` on an
  unrelated object passes the tag check but fails the constructor-name walk because the
  walk reaches the value's actual constructor, not its self-reported tag.
- The prototype/constructor reciprocal-identity marker
  (`isStructuralPromisePrototypeEquivalent`, decision #054) rejects a value whose own tag,
  name, and contract are all forged but whose `[[Prototype]]` is not structurally
  `Promise.prototype` — the prototype's OWN constructor (read via
  `{ assumePrototype: true }`, ECMA-262 §10.2.6) must reciprocally equal the value's
  resolved constructor.

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
contract + prototype-equivalence). Yet it carries no `[[PromiseState]]` internal slot: it
is Promise-_shaped_ but not a live `Promise`. `isPromise` admits it (vector `isPromise/B2`
in the spec).

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
predicate `doesImplementPromiseContract(v)` reads as a question — "does this match the
Promise contract?" — whose answer is bounded by a spec citation. The same naming pattern
(`doesImplementXContract`) applies forward to any spec-defined method set the package may
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
`isThenable`, three times in `doesImplementPromiseContract`). Any future method-contract
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
