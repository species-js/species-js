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
multiple `hasInertMethod` checks (the `@internal` `doesImplementXContract` helper),
Like-tier predicates that combine the realm-fixed `instanceof` fast path (through the
`isCurrentRealm{X}Instance` named helper) with that structural fallback, and identity-tier
predicates that dispatch via a two-axis ternary — a local-realm
`instanceof + proto-identity` arm, and a cross-realm arm that proves structural
prototype-equivalence (a tag + constructor-name signal gate followed by an own-descriptor
prototype contract).

The patterns mirror [`./thenable.md`](./thenable.md)'s lattice. The Promise-method
contract from the thenable round was one instance of a general rule: _spec-defined method
sets admit duck-typing alongside instance discrimination_. `EventTarget` and `AbortSignal`
are two more instances, applied here. The two-axis dispatch on the strict-identity tier is
the lift-from-`Like`-cascade pattern from decision #050; its cross-realm arm was lifted to
full structural prototype-equivalence (decision #061), mirroring `isPromise` (decision
#054), and applied uniformly to `isEventTarget` and `isAbortSignal`.

## Cross-realm safety

`EventTarget` and `AbortSignal` produced in one realm (iframe, worker, vm context) have
the same structural shapes as their local-realm counterparts but a _different intrinsic
identity_. `instanceof EventTarget` against a foreign-realm `EventTarget` returns `false`
even when the value carries the full method contract. The pattern from thenable applies:

- `isEventTargetLike` tests `isCurrentRealmEventTargetInstance(v)` first (the realm-fixed
  `v instanceof EventTargetConstructor` capture); if that fails, falls back to
  `doesImplementEventTargetContract` for the structural check. The same pattern in
  `isAbortSignalLike` through `isCurrentRealmAbortSignalInstance`.
- `isEventTarget` and `isAbortSignal` each resolve the value's `[[Prototype]]` ONCE via
  `getInertPrototypeOf` and thread it onward (decision #059). A leading `!!prototype`
  short-circuit rejects nullish and other falsy values (and absorbs a hostile
  `getPrototypeOf`-trap, which the inert read collapses to `undefined`) before any further
  read. They then DISPATCH on the same realm-fixed `instanceof` helper — the local-realm
  arm commits to `prototype === eventTargetPrototype` / `abortSignalPrototype` ANDed with
  the own-surface integrity gate `doesNotShadowXContract` (decision #063 — reject an
  instance-level override of the inherited contract) for direct-instance discrimination in
  O(1); the cross-realm arm runs `isAlienRealmX` — the tag + constructor-name signal gate
  plus the own-descriptor prototype-equivalence contract (decision #061) — but only when
  the realm actually carries a global `X` (the sentinel guard below).

### The instance-less-constructor sentinel (decision #060)

The `EventTargetConstructor` and `AbortSignalConstructor` captures use the
`isCallable(X) ? X : INSTANCE_LESS_CONSTRUCTOR` pattern: when the runtime lacks the global
(pre-Node-15 environments, special embeddings), the capture is the realm-fixed
`INSTANCE_LESS_CONSTRUCTOR` sentinel from `@/utility` — a never-instantiated function. No
value ever carries it on its prototype chain, so
`value instanceof INSTANCE_LESS_CONSTRUCTOR` is always `false` without a presence guard.
The paired `eventTargetPrototype` / `abortSignalPrototype` captures resolve to
`objectCreate(null)` in that same absent-global case (the boundary-retyping pattern,
decision #034), so the local-realm `prototype === Xprototype` identity-compare can never
match a real value.

Two consequences of the sentinel:

- The realm-instance helpers reduce to a bare
  `try { value instanceof XConstructor } catch { false }`. The `try`/`catch` absorbs a
  hostile right-hand side — a patched `Symbol.hasInstance` or a throwing prototype-walk —
  yielding `false` rather than propagating, the package-wide throw-safety invariant
  applied to the `instanceof` operator itself. The old `!!XConstructor &&` presence guard
  is gone: the sentinel makes it unnecessary.
- The strict predicates' cross-realm arm carries an explicit
  `XConstructor !== INSTANCE_LESS_CONSTRUCTOR` guard, so the structural
  prototype-equivalence walk is skipped entirely when the realm genuinely lacks the
  global. The module no longer crashes at module-load on a bareword access — the sentinel
  makes the absent-global path total.

### Own-level contract-shadow rejection (decision #063)

The local-realm fast-path is prototype-identity — O(1), but blind to what a value does at
its OWN level. `Object.create(EventTarget.prototype, { dispatchEvent })` carries the real
prototype yet overrides the inherited method; its own behavior is not `EventTarget`
behavior. So the fast-path ANDs `doesNotShadowXContract(value)`: a value that owns any
name in a reserved denylist (the `constructor` back-reference + the contract-methods;
`AbortSignal` adds the abort-accessors — a superset) is an instance-level subclass-layer
and is demoted from `is` to merely `Like`, exactly as decision #028 demotes a real
subclass — own-level shadowing is structurally the same interposed behavior-layer, first
in the lookup-chain. The mechanism is a throw-safe, fail-closed own-name enumeration
(`!getOwnPropertyNames(value).some(isValueOfBoundSet, denylist)`); `Symbol.toStringTag` is
excluded (a symbol key, cosmetic once identity holds), and orthogonal own state never
disqualifies — only the reserved member-names do.

### Realm asymmetry on tampered inputs (deliberate)

This refines the object-round realm-asymmetry (a tampered graft reading `true` locally /
`false` cross-realm) into a SPLIT: BEHAVIORAL tampering (own method / constructor) is now
rejected in both realms — reconciled with the structural cross-realm arm — while COSMETIC
tag-tampering stays local-admit / cross-realm-reject, retained by design. The predicate
guarantees identity + own-surface non-tampering, NOT functional viability (a bare graft,
which interposes nothing, is still admitted). Applies only to spec-pinned architectures
whose instances own none of their contract (`EventTarget` / `AbortSignal` / `Promise`),
not to user types that own their surface by design. Complementary to #052's slot-seal
(which needs an inert accessor these types lack, but catches even the bare graft).

## Predicate composition

Eighteen functions — four public predicates, fourteen `@internal` helpers — distributed
across two two-tier lattices. The public composition shapes
(`proto = getInertPrototypeOf(v)`, resolved once and threaded, decision #059):

| Predicate           | Composition                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isEventTargetLike` | `!!v && (isCurrentRealmEventTargetInstance(v) \|\| doesImplementEventTargetContract(v))`                                                                                                                                  |
| `isEventTarget`     | `!!proto && (isCurrentRealmEventTargetInstance(v) ? (proto === eventTargetPrototype && doesNotShadowEventTargetContract(v)) : EventTargetConstructor !== INSTANCE_LESS_CONSTRUCTOR && isAlienRealmEventTarget(v, proto))` |
| `isAbortSignalLike` | `!!v && (isCurrentRealmAbortSignalInstance(v) \|\| doesImplementAbortSignalContract(v))`                                                                                                                                  |
| `isAbortSignal`     | `!!proto && (isCurrentRealmAbortSignalInstance(v) ? (proto === abortSignalPrototype && doesNotShadowAbortSignalContract(v)) : AbortSignalConstructor !== INSTANCE_LESS_CONSTRUCTOR && isAlienRealmAbortSignal(v, proto))` |

The `@internal` helper compositions (EventTarget side; AbortSignal mirrors it):

| Helper                                      | Composition                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isCurrentRealm{X}Instance`                 | `try { v instanceof XConstructor } catch { false }`                                                                                                                                  |
| `doesImplementEventTargetContract`          | `hasInertMethod(v, 'dispatchEvent') && hasInertMethod(v, 'addEventListener') && hasInertMethod(v, 'removeEventListener')`                                                            |
| `hasEventTargetIdentitySignal`              | `name === 'EventTarget' && getTypeSignature(v) === '[object EventTarget]'`                                                                                                           |
| `doesImplementEventTargetPrototypeContract` | `try { the three methods are own callable data props of proto } catch { false }`                                                                                                     |
| `isEventTargetPrototypeEquivalent`          | `isClass(ctor) && getTypeSignature(proto) === '[object EventTarget]' && ctor.prototype === proto && doesImplementEventTargetPrototypeContract(proto)`                                |
| `isAlienRealmEventTarget`                   | `hasEventTargetIdentitySignal(v, getVerifiedOwnName(ctor)) && isEventTargetPrototypeEquivalent(proto, ctor)`, where `ctor = getDefinedConstructor(proto, { assumePrototype: true })` |

The AbortSignal Like-tier `doesImplementAbortSignalContract` adds the two abort markers to
the EventTarget contract:
`try { hasInertMethod(v, 'throwIfAborted') && isBooleanValue(v.aborted) && doesImplementEventTargetContract(v) } catch { false }`.
Its strict-tier `doesImplementAbortSignalPrototypeContract` reads the spec accessor
surface off the prototype's own descriptors — `aborted` (boolean getter, no setter,
invoked with the real receiver `value`), `reason` (getter, no setter), `onabort` (get/set
pair), `throwIfAborted` (callable) — and `isAbortSignalPrototypeEquivalent` threads
`value` through as that getter's receiver (decision #029).

Each Like-tier predicate composes the corresponding `doesImplementXContract` helper as the
structural fallback. The strict-tier predicates DISPATCH via a two-axis ternary — the
local-realm arm commits to `proto-identity`; the cross-realm arm runs `isAlienRealmX` (the
signal gate + prototype-equivalence contract) directly, not via the `Like` sibling. Same
shape as `isPromise` from [`./thenable.md`](./thenable.md), and same rationale: no shared
engine-attested bottom seal exists, so the arms have different bottom semantics and the
ternary committing to the right arm is the structurally honest combination. See decisions
#050, #054, and #061.

Two ordering choices worth naming:

- **`doesImplementAbortSignalContract` runs `hasInertMethod(throwIfAborted)` first**, not
  the EventTarget contract. The reason is nullish-safety: `hasInertMethod` uses
  parameter-default-to-`null` (decision #025) as its leading gate, which rejects
  null/undefined inputs without touching the property surface. The direct `aborted` read
  fires only after that gate passes, guaranteeing `value` is non-nullish. The heavier
  EventTarget contract runs last as the heaviest discriminator and the structural
  baseline. See decision #029 for why `aborted` is read directly rather than via
  `hasInertMethod`.
- **`isEventTarget` and `isAbortSignal` reject subclasses** on both arms — by prototype
  identity locally, and cross-realm by the constructor-name signal gate plus the
  `constructor.prototype === prototype` round-trip in `isXPrototypeEquivalent`. DOM types
  extending `EventTarget` (`Element`, `Document`, etc.) resolve their constructor name to
  their own class, which fails the gate; a grafted prototype fails the round-trip.
  Consistent with `isPromise` (decision #023). Consumers needing subclass admission should
  compose with the Like-tier predicates, which accept subclasses via the `instanceof` fast
  path.

## Conservative-narrowing in the EventTarget / AbortSignal domain

The conservative-narrowing posture from
[`./function.md`](./function.md#two-postures-minimal-floor-vs-conservative-narrowing) §
"Two postures: minimal-floor vs. conservative-narrowing" lands a third time here, after
the thenable round. `isEventTarget` and `isAbortSignal` each run a multi-marker
prototype-equivalence chain on their **cross-realm arm** — the `[[Class]]` tag and the
constructor-name signal gate, then `constructor` is-a-class, the prototype's own tag, the
`constructor.prototype === prototype` round-trip, and the own-descriptor method/accessor
contract — even though the signal gate alone is usually enough for typical-case
discrimination. The local-realm arm uses `proto-identity` as its self-sealing single
marker (the realm-fixed `EventTarget.prototype` / `AbortSignal.prototype` cannot be
spoofed at the prototype-identity level from userland). The reasoning matches
[`./function.md`](./function.md) and [`./thenable.md`](./thenable.md): foundation-tier
predicates that downstream packages depend on benefit from multiple cross-validating
markers as bounded-cost insurance against single-marker spoofing on the surface where
spoofing is possible. Proving structural prototype-equivalence rather than mere
method-name presence (decision #061) is what closes the foreign-realm spoof where a plain
object carries the right tag, name, and method names without the real prototype shape. The
marker independence on the cross-realm arm makes the layered check trustworthy.

Subclass rejection benefits from the same two-axis split. A local-realm DOM subclass
(`Element`, `Document`, `Window`, `XMLHttpRequest`, …) rejects at `proto-identity` in O(1)
without any cross-realm work; a cross-realm subclass rejects at constructor-name before
paying for the contract. The cascade through the `Like` sibling that the old shape used
would have paid tag → constructor-name → (via `Like`) instanceof re-run + structural
fallback on every subclass-rejection path. See decisions #028 and #050.

## The `aborted` accessor exception

Both AbortSignal contracts read `aborted` directly rather than through `hasInertMethod`,
deviating from decision #021's third pattern (predicate over inherited → descriptor-walk
for safety). The reason is spec-grounded: `AbortSignal.aborted` is defined as
`[GetterAttribute] readonly attribute boolean`. Native `AbortSignal` returns an accessor
descriptor for `aborted`. Using `hasInertMethod` would reject every native `AbortSignal`.
The third pattern's contract is "no getter fires that shouldn't fire by spec" — for
spec-defined accessor properties, the direct read IS the spec-required path.

The two tiers read it differently, by design:

- The Like-tier `doesImplementAbortSignalContract` reads the `aborted` VALUE in any
  descriptor shape — a plain data boolean is admitted — via
  `isBooleanValue(value.aborted)`. The `&&` chain ordering is load-bearing: the direct
  read only fires after the nullish-safe `hasInertMethod(throwIfAborted)` gate. This is
  the lenient, userland-admitting reading (decision #030).
- The strict-tier `doesImplementAbortSignalPrototypeContract` reads the `aborted` accessor
  off the prototype's own descriptor and INVOKES its getter with the real receiver
  (`aborted.get.call(value)`), requiring a boolean result and rejecting a setter — the
  spec-faithful shape. This is the identity-tier reading.

Both are wrapped in `try`/`catch` so a throwing getter reduces to `false` rather than
propagating. The rule generalizes: descriptor-walk when invocation is unsafe per the
predicate's contract; direct-read when the spec defines the property as an accessor and
invocation IS the spec-required path. See decision #029 for the chronological capture and
the forward-applicable framing. The same exception will likely apply to other contracts
with spec-defined accessor attributes (`Iterator`'s `done`, `ReadableStream`'s `locked`,
etc.) when they enter the migration pipeline.

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
