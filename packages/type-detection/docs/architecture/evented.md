# type-detection / evented

## Mental model

`type-detection / evented` exists because the Web Platform's event-handling primitives
(`EventTarget` and `AbortSignal`) carry the same dual concern as the Promise lattice in
[`./thenable.md`](./thenable.md): a structural method contract anyone can implement, and a
realm-fixed intrinsic identity that only DOM-aware runtimes provide. The module's job is
to give each of these two contracts both a structural predicate (admits anything matching
the spec method set) and an identity predicate (admits only the realm-fixed intrinsic),
with the discrimination organized as two parallel two-tier lattices:

```
EventTargetLike     (isEventTargetLike)   — three EventTarget methods
  └── EventTarget   (isEventTarget)       — EventTarget identity via two-axis dispatch

AbortSignalLike     (isAbortSignalLike)   — EventTargetLike + aborted + throwIfAborted
  └── AbortSignal   (isAbortSignal)       — AbortSignal identity via two-axis dispatch
```

`AbortSignalLike` extends `EventTargetLike`, mirroring the spec relationship: every
abort-signal is an event-target. The two lattices are structurally parallel: each tier
follows the same compositional shape — a Like-tier structural predicate composed of
multiple `hasInertMethod` checks (with an `@internal` `doesMatchXContract` helper),
Like-tier predicates that combine the realm-fixed `instanceof` fast path (through the
`isCurrentRealm{X}Instance` named helper) with the structural fallback, identity-tier
predicates that dispatch via a two-axis ternary — local-realm
`instanceof + proto-identity` arm, cross-realm `tag + constructor-name + contract` arm.

The patterns mirror [`./thenable.md`](./thenable.md)'s lattice. The Promise-method
contract from the thenable round was one instance of a general rule: _spec-defined method
sets admit duck-typing alongside instance discrimination_. `EventTarget` and `AbortSignal`
are two more instances, applied here. The two-axis dispatch on the strict-identity tier is
the lift-from-`Like`-cascade pattern from decision #050, applied uniformly to `isPromise`,
`isEventTarget`, and `isAbortSignal`.

## Cross-realm safety

`EventTarget` and `AbortSignal` produced in one realm (iframe, worker, vm context) have
the same structural shapes as their local-realm counterparts but a _different intrinsic
identity_. `instanceof EventTarget` against a foreign-realm `EventTarget` returns `false`
even when the value carries the full method contract. The pattern from thenable applies
unchanged:

- `isEventTargetLike` tests `isCurrentRealmEventTargetInstance(v)` first (the realm-fixed
  `!!EventTargetConstructor && v instanceof EventTargetConstructor` capture); if that
  fails, falls back to `doesMatchEventTargetContract` for the structural check. The same
  pattern in `isAbortSignalLike` through `isCurrentRealmAbortSignalInstance`.
- `isEventTarget` and `isAbortSignal` each DISPATCH on the same realm-fixed `instanceof`
  helper — local-realm arm commits to `getPrototypeOf(v) === eventTargetPrototype` /
  `abortSignalPrototype` for direct-instance discrimination in O(1); cross-realm arm runs
  three realm-independent markers — the `[[Class]]` tag, the constructor-name walk, and
  the structural `doesMatchXContract` check called directly (not via the `Like` sibling).

The `EventTargetConstructor` and `AbortSignalConstructor` captures use the
`isCallable(X) ? X : null` pattern with type-system narrowing through the
`typeof X | null` cast. The paired `eventTargetPrototype` / `abortSignalPrototype`
captures use the `&&` form (`XConstructor && XConstructor.prototype`) to propagate `null`
as the absence sentinel uniformly across the paired bindings — the
`@typescript-eslint/prefer-optional-chain` disable preserves this idiom against
optional-chain rewrites that would split the absence vocabulary across captures. Each
helper carries the `!!XConstructor` guard internally so the structural fallback still
fires when the capture is `null`. Runtime environments lacking the DOM globals would crash
at module-load on the bareword access — the type-system structure documents the defensive
shape even though the runtime requires the globals.

## Predicate composition

Eight predicates — four public, four `@internal` — distributed across two two-tier
lattices. The composition shapes:

| Predicate                      | Composition                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `doesMatchEventTargetContract` | `hasInertMethod(v, 'dispatchEvent') && hasInertMethod(v, 'addEventListener') && hasInertMethod(v, 'removeEventListener')`                                           |
| `isEventTargetLike`            | `!!v && (isCurrentRealmEventTargetInstance(v) \|\| doesMatchEventTargetContract(v))`                                                                                |
| `isEventTarget`                | `!!v && (isCurrentRealmEventTargetInstance(v) ? getPrototypeOf(v) === eventTargetPrototype : tag === '[object EventTarget]' && ctor === 'EventTarget' && contract)` |
| `doesMatchAbortSignalContract` | `hasInertMethod(v, 'throwIfAborted') && isBooleanValue(v.aborted) && doesMatchEventTargetContract(v)`                                                               |
| `isAbortSignalLike`            | `!!v && (isCurrentRealmAbortSignalInstance(v) \|\| doesMatchAbortSignalContract(v))`                                                                                |
| `isAbortSignal`                | `!!v && (isCurrentRealmAbortSignalInstance(v) ? getPrototypeOf(v) === abortSignalPrototype : tag === '[object AbortSignal]' && ctor === 'AbortSignal' && contract)` |

Each Like-tier predicate composes the corresponding `@internal` helper as the structural
fallback. The strict-tier predicates DISPATCH via a two-axis ternary — local-realm arm
commits to `proto-identity`; cross-realm arm runs `tag + constructor-name + contract`
directly. Same shape as `isPromise` from [`./thenable.md`](./thenable.md), and same
rationale: no shared engine-attested bottom seal exists, so the arms have different bottom
semantics and the ternary committing to the right arm is the structurally honest
combination. See decision #050.

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

## Conservative-narrowing in the EventTarget / AbortSignal domain

The conservative-narrowing posture from
[`./function.md`](./function.md#two-postures-minimal-floor-vs-conservative-narrowing) §
"Two postures: minimal-floor vs. conservative-narrowing" lands a third time here, after
the thenable round. `isEventTarget` and `isAbortSignal` each run three cross-validating
markers on their **cross-realm arm** — the structural method-contract helper, the
`[[Class]]` tag, the constructor-name walk — even though any one is usually enough for
typical-case discrimination. The local-realm arm uses `proto-identity` as its self-sealing
single marker (the realm-fixed `EventTarget.prototype` / `AbortSignal.prototype` cannot be
spoofed at the prototype-identity level from userland). The reasoning matches
[`./function.md`](./function.md) and [`./thenable.md`](./thenable.md): foundation-tier
predicates that downstream packages depend on benefit from multiple cross-validating
markers as bounded-cost insurance against single-marker spoofing on the surface where
spoofing is possible. The marker independence on the cross-realm arm makes the layered
check trustworthy.

Subclass rejection benefits from the same two-axis split. A local-realm DOM subclass
(`Element`, `Document`, `Window`, `XMLHttpRequest`, …) rejects at `proto-identity` in O(1)
without any cross-realm work; a cross-realm subclass rejects at constructor-name before
paying for the contract. The cascade through the `Like` sibling that the old shape used
would have paid tag → constructor-name → (via `Like`) instanceof re-run + structural
fallback on every subclass-rejection path. See decisions #028 and #050.

## The `aborted` accessor exception

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

## The `AbortSignalLike` minimum-surface choice

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

## Producer-side role in the cross-module abort-channel surface

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

## Open architectural questions

_Section currently empty — Q.004 (`AbortableThenable<T>` placement) was resolved
2026-06-06 by decision #037._
