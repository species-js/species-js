# type-detection / error

## Mental model

`type-detection / error` exists because the ECMA-262 `Error.isError` check is
_spec-precise but not polyfillable in pure JS_. The check returns `true` iff a value
carries the internal `[[ErrorData]]` slot — set by the `Error` constructor, inherited by
every built-in subclass (`TypeError`, `SyntaxError`, …) and every user-defined
`class X extends Error`, and set by a separate WebIDL path for `DOMException`. The slot is
_unobservable from userland_: no operator, descriptor, or reflection method exposes it. A
polyfill therefore has to approximate `[[ErrorData]]` structurally.

The module discriminates the error set across two runtime conditions — native
`Error.isError` present (ES2025+ runtimes: Node 23+, modern browsers) or absent (the
polyfill fires) — and splits it into an honest `Error` / `DOMException` distinction. It is
organized not as a `Like`→identity lattice (as thenable / evented are) but as a
**partition plus a refinement**:

```
                    isError  (public — native Error.isError, else the isAnyError polyfill)
                       │      narrows to AnyError = Error | DOMException
          ┌────────────┴────────────┐
   isGenericError              isDOMException          (public; DISJOINT arms)
   (an Error, NOT a            (any DOMException;
    DOMException)               sole generic predicate)
          │
   isAbortError  (public — refines isError by a name suffix match)
```

The load-bearing invariant is that the two arms form a **disjoint, engine-independent
cover**: `isError` ≡ `isGenericError` ⊎ `isDOMException`. Every error is exactly one of
the arms, never both, never (for a well-formed value) neither. This is a full redesign
(decision #065) of an earlier `[[Class]]`-tag classifier, which had one public predicate
and folded `DOMException` into the union; the redesign brings the module onto the same
identity-capture + realm-partition model the thenable / evented / object rounds converged
on, and makes the `Error` / `DOMException` split first-class. The name `isGenericError` is
deliberately repurposed in the process — it once named an `@internal` polyfill body that
_admitted_ `DOMException`; it now names the public predicate that _excludes_ it, an exact
inversion the `.d.ts` and spec call out so a reader carrying the old model is not misled.

## Cross-realm safety

An `Error` or `DOMException` produced in another realm (iframe, worker, `vm` context) has
the same structural shape as its local counterpart but a _different intrinsic identity_,
so `value instanceof Error` against a foreign error returns `false`. Each of the three
predicates is therefore realm-partitioned (decision #065): a current-realm value is
confirmed by a throw-safe `instanceof` fast-path plus a structural contract, and a
foreign-realm value by a throw-safe prototype walk that proves structural equivalence to
the captured shape. This is the same pattern [`./thenable.md`](./thenable.md) and
[`./evented.md`](./evented.md) use; the error module applies it twice, once per arm.

### Realm-fixed capture via the shared validated-tuple helper (decisions #060, #065)

Both intrinsics are captured at module-load through the shared
`getValidatedStandardConstructorAndPrototypeTuple(X, contract)` (`#utility`) — the same
helper `#thenable` uses for `Promise`. It confirms `X` is newable, reads its own
`prototype` descriptor inertly, and accepts the `[X, X.prototype]` pair only when the
prototype satisfies the injected `contract` AND back-references the constructor. On ANY
failure — no global `X`, a rejected contract, a broken back-reference, a throwing
descriptor — it returns the TOTAL inert surrogate
`[INSTANCE_LESS_CONSTRUCTOR, BLANK_DICTIONARY]` (decision #064), so every downstream
`instanceof` is uniformly `false` rather than throwing.

The two captures inject DIFFERENT contracts, and the difference is forced by the shape of
each surface — the same asymmetry evented has between `EventTarget` and `AbortSignal`:

- **`Error`** injects `isGenericErrorPrototypeEquivalent`, which delegates to
  `doesImplementGenericErrorPrototypeContract` — a pure own-descriptor read of
  `Error.prototype` (own callable `toString`, string `name` / `message`, and the pinned
  root values `toString.call(prototype) === 'Error'`, `name === 'Error'`,
  `message === ''`). Pinning the ROOT values identifies `Error.prototype` _itself_, not
  any error-named prototype, so the same predicate serves as both the capture gate and the
  walk target.
- **`DOMException`** cannot be validated off its bare prototype: its `name` / `message`
  are spec-defined getters backed by an internal slot that _throw_ on any receiver that is
  not a live `DOMException`. Its capture instead threads a manufactured live instance
  (`new DOMException('security error', 'SecurityError')`) as the receiver into
  `isDOMExceptionPrototypeEquivalent`, then confirms both values round-trip. So
  module-load validation actually invokes the spec getters against a real instance,
  confirming the captured prototype end to end — the sibling of evented's
  manufactured-`AbortSignal` receiver (decision #029 family). The prototype half of the
  DOMException tuple is discarded; the DOMException paths reach a prototype through each
  value's own chain, never through this capture.

The sentinel constructor slot has the same two consequences as in evented: the
realm-instance helpers reduce to a bare
`try { value instanceof XConstructor } catch { false }` (no presence guard — the total
tuple keeps the slot always present, and the sentinel is on no value's chain), and
`nativeIsError` is only read when `GenericErrorConstructor !== INSTANCE_LESS_CONSTRUCTOR`.

### The subclass-safe alien walk (decision #065)

Each alien walk (`isAlienRealmGenericError`, `isAlienRealmDOMException`) climbs the
prototype chain looking for a level equivalent to the genuine `Error.prototype` /
`DOMException.prototype`. At every level it reads the constructor from **that level's OWN
`constructor` back-reference, never from the walked child**. The authentic `Error` /
`Error.prototype` pairing only co-locates on the level whose own `constructor`
back-references it (`Error.prototype.constructor === Error`); reading the constructor from
the child node instead aligns only for a direct `new Error()` and silently misses every
subclass level (`TypeError`, `class X extends Error`) whose chain reaches the realm's
`Error.prototype`. The DOMException walk threads the ORIGINAL root `value` — never the
walked node — as the receiver for the spec getters, for the same throw-on-wrong-receiver
reason the capture does. Both walks are throw-safe throughout (`getSafePrototypeOf`,
`getInertDescriptor`).

## The stack-capability machinery — the polyfill's `[[ErrorData]]` proxy (decision #066)

The `Error` arm cannot read `[[ErrorData]]`, so it approximates it through the closest
_reachable_ side effect of construction: a `stack`. A genuine error ran a constructor and
(in a stack-capable engine) carries a `stack`; an `Object.create(Error.prototype)` shell
never ran the constructor and does not. Three pieces of module-load machinery turn that
observation into a gated filter:

- `ERROR_STACK_CAPABLE` — a `boolean`, probed once by throwing a captured-constructor
  `Error`, catching it, and testing whether the caught value carries a string `stack`. The
  throw is deliberate: some engines populate `stack` only on an actually-thrown error.
- `retrieveErrorStack` — a reader whose access strategy is fixed once at load from how the
  realm exposes `stack`: `gated-slot` (an accessor — invoke the captured getter with the
  value as receiver, reading the internal side effect through any chain) or `plain-data`
  (a data property — read directly and type-check). Both throw-safe → `undefined`; the
  chosen mode is surfaced as `errorStackMode`.
- `doesPassErrorGraftFilter(value)` =
  `!ERROR_STACK_CAPABLE || hasReachableErrorStack(value)` — the graft filter, GATED by the
  capability probe. Where the environment guarantees stacks a value passes only if it
  carries a reachable one; where it does not, the filter stands down (a missing `stack`
  proves nothing there). The `||` short-circuit means `retrieveErrorStack` fires _only_
  where its answer is meaningful — the machinery does not fire wildly.

The consequence is that the polyfill **converges** on the native verdict rather than
widening past it: `isError(Object.create(Error.prototype))` is `false` in a stack-capable
engine — native rejects on the absent slot, the polyfill on the absent `stack`. Only where
no stacks are populated does the filter stand down and the polyfill admit grafts native
would reject. This reverses the old widening posture (decision #033, superseded): the
retired classifier admitted `Object.create(Error.prototype)` and ES3-style errors
_unconditionally_ via a prototype-shape heuristic, diverging from native even in the
modern engines that dominate production. `errorStackMode` / `ERROR_STACK_CAPABLE` are
exported `@internal` so the behavior is inspectable and testable.

Crucially, the `DOMException` arm does NOT route through the stack filter (§ "The
DOMException descriptor-kind contract"). Its discriminator is engine-independent, which is
what keeps `isError(new DOMException())` `true` in a browser, where a `DOMException`
carries no `stack`.

## The `Error` / `DOMException` partition (decisions #067, #069)

`DOMException` is modeled as a distinct arm, never an `Error` subtype — neither at the
type level (`DOMException` is a package-owned interface that does not `extends Error` and
declares no `stack`) nor in the runtime partition. The reason is that engines disagree on
whether `new DOMException() instanceof Error` holds; pinning `DOMException` as its own
always-excluded arm keeps `isGenericError`'s membership _deterministic across engines_
rather than moving with the runtime's subclass decision. This is why
`AnyError = Error | DOMException` stays genuinely two-armed and must not collapse to
`Error` (decision #067). The "generic ≠ `DOMException`" exclusion is a runtime guarantee,
not a type — TypeScript has no negation type, so `value is T & Error` cannot spell "and
not a `DOMException`"; because `DOMException` is not an `Error` subtype, `T & Error`
already excludes it structurally in ordinary use.

`isGenericError` enforces that exclusion by **two different means, one per realm**
(decision #069):

- **Current realm — by identity, up front.** A leading
  `if (!value || isCurrentRealmDOMExceptionInstance(value)) return false` rejects any
  current-realm `DOMException` instance _before_ any contract or walk. Anchoring on
  identity (`instanceof`) rather than on the DOMException contract is load-bearing: where
  `DOMException` subclasses `Error` it also satisfies the generic-error (stack) contract,
  and a `DOMException` whose contract is broken — a flattened own-data `name` that
  `isDOMException` rejects — is still `instanceof DOMException`, so an identity guard
  keeps it out of the generic arm where a contract guard would let it leak. (An empirical
  partition probe found exactly that leak before the fix: a flattened-`name`
  `DOMException` subclass read `isGenericError === true` while `isError === false` — a
  "generic error" that is not an error. The identity anchor restores
  `isGenericError ⊆ isError`.)
- **Foreign realm — by contract.** `isAlienRealmGenericError` early-returns on
  `isAlienRealmDOMException(value)`. This is the "crown-jewel" guard: a Node
  `DOMException` is `instanceof Error` AND carries an own `stack` (from the internal
  `new Error()` its constructor runs), so it satisfies the generic-error contract on its
  own — without the explicit exclusion it would be readmitted on the alien path.

**One accepted realm asymmetry follows.** A _foreign_ flattened `DOMException` — a
subclass of the foreign `Error`, carrying a `stack` — is classified as a generic `Error`:
the current-realm identity guard has no cross-realm equivalent (`instanceof` cannot reach
a foreign constructor), and the structural arm reads the value as an `Error`. Excluding it
would mean reintroducing the `[[Class]]`-tag reliance the redesign abandoned. This is not
a partition-law violation — the verdict is self-consistent — but an intent asymmetry: the
exclusion is exact by provenance current-realm, structural cross-realm. Accepted and
documented, not reconciled — the same category as the `isPlainObject` realm-asymmetry
(object round) and the evented tampered-input asymmetry (decision #063).

## The `DOMException` descriptor-kind contract (decision #068)

`isDOMException` is the sole generic `DOMException` predicate — there is no
`DOMExceptionLike` tier and no `Strict` variant — so its contract must admit every
`DOMException`, including third-party subclasses, without becoming so loose that any
error-shaped object slips through. A genuine `DOMException` _owns none of its contract_:
`name` / `message` are inherited getters backed by an internal slot. The contract keys off
that getter shape: `doesImplementDOMExceptionContract(value)` =
`hasInertGetter(value, 'message') && hasInertGetter(value, 'name')`, where
`hasInertGetter` resolves the descriptor through the prototype chain _own-first,
first-match-wins_. So `name` and `message` are accepted only as ACCESSORS, reachable
anywhere from the value's own slot down to the first-matching prototype; a plain DATA
`value` descriptor is rejected wherever it sits, symmetrically on both members. The
contract reads PRESENCE, never invoking the getter in the current realm (the cross-realm
prototype-equivalence path invokes, threading a live receiver).

The own-shadow rejection of decision #063 is deliberately NOT applied here. #063 rejects a
contract member on own-KEY presence regardless of descriptor kind — the wrong tool for a
getter-backed contract, since it would reject a legitimate own-getter `name`. The
getter-vs-data test is the finer discriminator, and it maps onto real idioms: a subclass
that names itself through `super(message, name)` keeps the inherited getter and is
admitted; one that flattens `name` to a data field via a class field (the `Error` idiom,
redundant on `DOMException`, which already takes a name argument) is the "dumb data name"
and is rejected — landing, since it is still `instanceof DOMException`, as _neither_ arm.
`isGenericError`'s own-shadow question is separately N/A: `Error` is a data-carrier that
owns its contract by design, so "owns a contract member = tamper" is false there, the same
reason `isPlainObject` is exempt in #063. This answers #063's forward FAMILY question for
`DOMException`: not applicable.

## Predicate composition

Twenty-one runtime exports — four public predicates, seventeen `@internal` helpers. The
public compositions:

| Predicate        | Composition                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isGenericError` | `if (!v \|\| isCurrentRealmDOMExceptionInstance(v)) return false; if (isCurrentRealmGenericErrorInstance(v)) return doesImplementGenericErrorContract(v); return isAlienRealmGenericError(v)` |
| `isDOMException` | `!!v && isCurrentRealmDOMExceptionInstance(v) ? doesImplementDOMExceptionContract(v) : isAlienRealmDOMException(v)`                                                                           |
| `isError`        | `const isError = isFunction(nativeIsError) ? nativeIsError : isAnyError` (bound once at module-load)                                                                                          |
| `isAbortError`   | `isError(v) && isStringValue(v.name) && v.name.endsWith('AbortError')`                                                                                                                        |

The `@internal` helper compositions:

| Helper                                              | Composition                                                                                                                                                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isAnyError`                                        | `!!v && isCurrentRealmDOMExceptionInstance(v) ? doesImplementDOMExceptionContract(v) : isCurrentRealmGenericErrorInstance(v) ? doesImplementGenericErrorContract(v) : isAlienRealmDOMException(v) \|\| isAlienRealmGenericError(v)` |
| `isCurrentRealm{GenericError,DOMException}Instance` | `try { v instanceof XConstructor } catch { false }`                                                                                                                                                                                 |
| `doesImplementMinimumErrorContract`                 | `try { isStringValue(v.message) && isStringValue(v.name) } catch { false }`                                                                                                                                                         |
| `doesImplementGenericErrorContract`                 | `doesPassErrorGraftFilter(v) && doesImplementMinimumErrorContract(v)` (graft filter first)                                                                                                                                          |
| `doesImplementDOMExceptionContract`                 | `hasInertGetter(v, 'message') && hasInertGetter(v, 'name')`                                                                                                                                                                         |
| `doesImplementGenericErrorPrototypeContract`        | `try { own callable toString && string own name/message && toString.call(proto) === 'Error' && name === 'Error' && message === '' } catch { false }`                                                                                |
| `doesImplementDOMExceptionPrototypeContract`        | `try { name & message each a getter (no setter) yielding a string when invoked as get.call(value) } catch { false }`                                                                                                                |
| `isGenericErrorPrototypeEquivalent`                 | `getTypeSignature(proto) === '[object Object]' && getVerifiedOwnName(ctor) === 'Error' && isClass(ctor) && ctor.prototype === proto && doesImplementGenericErrorPrototypeContract(proto)`                                           |
| `isDOMExceptionPrototypeEquivalent`                 | `getTypeSignature(proto) === '[object DOMException]' && getVerifiedOwnName(ctor) === 'DOMException' && isClass(ctor) && ctor.prototype === proto && doesImplementDOMExceptionPrototypeContract(proto, value)`                       |
| `isAlienRealm{GenericError,DOMException}`           | contract gate + a chain walk matching `isXPrototypeEquivalent(proto, own-back-ref ctor[, value])`; the generic walk additionally early-returns on `isAlienRealmDOMException(v)`                                                     |
| `doesPassErrorGraftFilter`                          | `!ERROR_STACK_CAPABLE \|\| hasReachableErrorStack(v)`                                                                                                                                                                               |
| `hasReachableErrorStack`                            | `isStringValue(retrieveErrorStack(v))`                                                                                                                                                                                              |

Two ordering choices worth naming:

- **`doesImplementGenericErrorContract` runs the graft filter FIRST**, ahead of the `name`
  / `message` read, so a grafted shell is rejected before its coincidental string members
  are ever considered. The ordering optimizes the graft-rejection path: on a graft the
  filter short-circuits cheaply (no reachable `stack`); on a genuine error it is the
  costlier half — reading a reachable `stack` can force stack materialization — but the
  ordering costs nothing there and buys the early-out on the graft.
- **`isAnyError` checks the `DOMException` arm FIRST.** Where an engine makes
  `DOMException` subclass `Error`, a `DOMException` is also `instanceof Error`, so the
  more specific arm must win; and the DOMException arm uses the getter contract, not the
  stack contract, so a valid but stackless (browser) `DOMException` is admitted. Routing
  `DOMException`s through the stack contract instead would reject them in a browser — a
  rejected design (decision #069).

## Native-or-polyfill capture at module-load (decisions #065, #032 retained)

The public `isError` captures native `Error.isError` once at module-load and binds native
or polyfill by a runtime feature-detection gate:

```js
const nativeIsError = /** @type {import('#error').isError | undefined} */ (
  GenericErrorConstructor !== INSTANCE_LESS_CONSTRUCTOR
    ? /** @type {ErrorConstructorES2025} */ (GenericErrorConstructor).isError
    : void 0
);

export const isError = /** @type {import('#error').isError} */ (
  isFunction(nativeIsError) ? nativeIsError : isAnyError
);
```

The cast through `ErrorConstructorES2025` (the interface declaring `isError?` as
_optional_) reads the native method honestly — its type is
`((v: unknown) => v is AnyError) | undefined`. The `isFunction` gate runs at module-load;
the ternary picks native or the `isAnyError` polyfill. The capture is realm-fixed by
construction: the binding does not re-read `globalThis.Error.isError` at each call, so
later tampering with the global does not reach it. This native-or-polyfill _capture
posture_ is retained from the retired #032; only the polyfill _body_ changed — from the
tag-classifier to the realm-partitioned `isAnyError` (decision #065). When native is
present it is the spec-precise `[[ErrorData]]` check; the polyfill approximates it
structurally and converges on its verdict wherever stacks are guaranteed (§ "The
stack-capability machinery").

## `AbortError` as a name-suffix refinement (decision #035)

`AbortError` refines `AnyError` via the DOM-conventional `'AbortError'` name-suffix
pattern. `AbortErrorName` is a template-literal type `` `${string}AbortError` `` that
admits the empty-prefix case (`'AbortError'` itself) and arbitrary qualifier prefixes
(`'TimeoutAbortError'`, `'UserAbortError'`, `'NavigationAbortError'`) uniformly.
`AbortError` is the structural intersection `AnyError & { name: AbortErrorName }`.

`isAbortError(v)` composes `isError(v)` with `isStringValue(v.name)` and
`v.name.endsWith('AbortError')`. Short-circuit `&&` runs `isError` first as the cheaper
gate, then the string-type gate, then the suffix check. The string-type gate is
load-bearing: neither native `Error.isError` (which inspects only `[[ErrorData]]`) nor the
polyfill's structural path verifies the value's own `name` override, so an error with
`Object.defineProperty(err, 'name', { value: 42 })` passes `isError` but its `name` is not
a string — without the gate the bare `42.endsWith` would throw. Suffix-match is by design:
exact equality would reject the legitimate qualified variants. The template-literal type
is structural documentation, not a runtime guarantee (it collapses to `string`); the
runtime guarantee is the `endsWith` check.

The error-module discrimination is _value-side only_: `isAbortError` inspects the error
value's `name`, not the abort-channel mechanics. Producer-side inspection of the abort
channel (`AbortSignal.aborted`, `AbortController` linkage) belongs to the evented module.

## Cross-module abort-channel surface

Three modules together compose the full abort-channel surface, each in the module whose
vocabulary it belongs to:

- `evented` ships `AbortSignalLike` / `isAbortSignalLike` / `AbortSignal` /
  `isAbortSignal` — the producer-side contract ("values that emit abort signals").
- `error` (this module) ships `AbortError`, `AbortErrorName`, and `isAbortError` — the
  rejected-value side ("errors that look like abort-channel errors").
- `thenable` ships `AbortableThenable<T>` (decision #037) — the consumer-side contract
  that extends `Thenable<T>` with an `onaborted` callback typed against `AbortError`, so
  the abort channel survives the chain at the type level.

Consumers building an abortable operation depend on all three; consumers discriminating a
single concern depend on only the relevant module.

## Open architectural questions

- **A package-owned `GenericError` type alias (open, decision #067).** `isGenericError`
  currently narrows to the built-in `Error`, breaking the `predicate → same-named type`
  symmetry the other predicates have (`isDOMException → DOMException`,
  `isError → AnyError`). A `type GenericError = Error` alias would regularize it and let
  `AnyError = GenericError | DOMException` read in package vocabulary. It is nominal —
  TypeScript has no negation, and `Error` already excludes `DOMException` structurally —
  so it would change no runtime vector; a documentation / symmetry call left to the design
  owner.
- **Native `Error.isError(new DOMException())` membership (policy flag).** The polyfill
  guarantees a `DOMException` is admitted by `isError`, but the public binding defers to
  native when present, and whether native admits a `DOMException` depends on the engine
  granting it `[[ErrorData]]`. The behavior is asserted runtime-agnostically in
  `ERROR.spec.md`; a native verdict is not baked in, pending per-engine verification.
