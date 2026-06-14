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

## Cross-realm safety

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

## Predicate composition

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

## Conservative-narrowing in the Promise domain

The conservative-narrowing posture from the function module (see
[`./function.md`](./function.md#two-postures-minimal-floor-vs-conservative-narrowing) §
"Two postures: minimal-floor vs. conservative-narrowing") lands a second time here.
`isPromise` uses three cross-validating markers — `isPromiseLike`, the `[[Class]]` tag,
and the constructor-name resolution — even though any one of them is usually enough for a
typical-case discrimination. The reasoning is the same as in
[`./function.md`](./function.md): foundation-tier predicates that downstream packages
depend on benefit from multiple cross-validating markers as bounded-cost insurance against
single-marker spoofing.

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

_Section currently empty — Q.004 (`AbortableThenable<T>` placement) was resolved
2026-06-06 by decision #037. See `../decisions/` for the answered choices: return
preserved-abortable, refine `Thenable<T>` independently from `PromiseLike<T>`, ship in
`thenable.d.ts` type-only with no predicate._
