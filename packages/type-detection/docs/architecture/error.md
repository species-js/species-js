# type-detection / error

## Mental model

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

## Cross-realm safety

The realm-safety pattern combines the strategies from [`./thenable.md`](./thenable.md) and
[`./evented.md`](./evented.md). The local-realm fast path uses `value instanceof Error`;
the cross-realm fallback uses `Object.prototype.toString`-based `[[Class]]` tag
inspection. Both are inlined inside `isGenericError` rather than exposed as separate
`isCurrentRealmError` / `isAlienRealmError` predicates (equip-js had exposed both; the
species-js round consolidates them — decision #032).

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

## Predicate composition

Five predicates — two public, three `@internal` — composing the polyfill stack. Three
supporting types and one interface declaration round out the surface:

| Symbol                      | Kind        | Composition / shape                                                                                     |
| --------------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `GenericError`              | type        | `DOMException \| Error` — TypeScript approximation of `[[ErrorData]]`-bearing values                    |
| `AbortErrorName`            | type        | `` `${string}AbortError` `` — template-literal type for the abort-channel naming convention             |
| `AbortError`                | type        | `GenericError & { name: AbortErrorName }` — refined intersection                                        |
| `ErrorConstructorES2025`    | interface   | `ErrorConstructor` extended with optional `isError?(v): v is GenericError` (`@internal`)                |
| `hasErrorPrototypeContract` | `@internal` | descriptor walk: 4 own descriptors of `prototype` + trailing-`'Error'` name marker; recursive `isError` |
| `doesMatchErrorContract`    | `@internal` | `sig === '[object Error]' \|\| sig === '[object DOMException]' \|\| (sig === '[object Object]' && ...)` |
| `isGenericError`            | `@internal` | `!!v && (v instanceof Error \|\| doesMatchErrorContract(v))`                                            |
| `isError`                   | `public`    | `const isError = isFunction(nativeIsError) ? nativeIsError : isGenericError` (captured at module-load)  |
| `isAbortError`              | `public`    | `isError(v) && v.name.endsWith('AbortError')`                                                           |

The composition mirrors the established `doesImplement<X>Contract` pattern from thenable
(`doesImplementPromiseContract`) and evented (`doesImplementEventTargetContract`,
`doesImplementAbortSignalContract`) — same "structural fallback dispatcher" role at the
internal layer. The realm-fast-path inlining inside `isGenericError` matches the
`isPromiseLike` / `isEventTargetLike` shape, where the `instanceof <Constructor>` fast
path composes with the structural fallback inside one umbrella predicate without exposing
the two halves separately.

## Polyfill widening over `[[ErrorData]]`

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

## Native-or-polyfill capture at module-load

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
optional `isError?` method, narrowed to its present-or-absent form by the runtime
`isFunction` gate. See decision #032.

## `AbortError` as a name-suffix refinement

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

## Cross-module abort-channel surface

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

## Open architectural questions

_Section currently empty — Q.004 (`AbortableThenable<T>` placement) was resolved
2026-06-06 by decision #037._
