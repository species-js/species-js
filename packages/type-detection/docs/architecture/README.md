# type-detection — Architecture

A current-state conceptual map of `@species-js/type-detection`. The decision log
(`../decisions/`) answers _why_ the code looks the way it does, as discrete
chronologically-numbered ADRs. This directory answers _how_ it works, organized by module
— one file per module.

Each module file starts with the mental model a contributor needs to read the code, then
describes the cross-cutting patterns the code embodies, and ends with the open
architectural questions that the code has not yet answered.

## Modules

| Module        | File                           | Surface                                                                                                                                                                                                                                             |
| ------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/function`  | [function.md](./function.md)   | Function-family classification: `isCallable`, `isFunction`, `isNewableFunction`, `isClass`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, plus the shape/signal/contract helper family                                      |
| `@/thenable`  | [thenable.md](./thenable.md)   | `Thenable<T>`, `PromiseLike<T>`, `Promise<T>` lattice and predicates                                                                                                                                                                                |
| `@/evented`   | [evented.md](./evented.md)     | `EventTargetLike` / `EventTarget` and `AbortSignalLike` / `AbortSignal` lattices                                                                                                                                                                    |
| `@/error`     | [error.md](./error.md)         | `GenericError`, `isError`, `isAbortError`, polyfill discipline                                                                                                                                                                                      |
| `@/primitive` | [primitive.md](./primitive.md) | Five primitive families: string, number, boolean, bigint, symbol; the boxed-primitive discrimination chain with the local-realm `instanceof` shortcut; three generic floor predicates (`isWrappablePrimitive`, `isNullishPrimitive`, `isPrimitive`) |
| `@/object`    | [object.md](./object.md)       | `isObject`, `isPlainObject`, `isDictionaryObject`, the five-marker structural anchor                                                                                                                                                                |
| `@/utility`   | [utility.md](./utility.md)     | Inert descriptor walks, type-signature readers, constructor inspection, `resolveType`                                                                                                                                                               |

## Cross-cutting patterns

Each module embeds the cross-cutting patterns it uses. The patterns themselves
(boundary-retyping at `@/config`, conservative-narrowing posture, spec-shape access
discipline, family pattern with sub-helpers, strict-by-default + composable lenient forms,
cross-realm fast path + structural fallback, structural sealability) are referenced from
the relevant module files. They are not deduplicated into a workspace-level document yet —
that will land if and when a second package adopts them.

**Structural sealability** (decision #052) is the principle that unifies the
boxed-primitive slot-seal with the predicates that cannot have one: a runtime type is
sealable against prototype-graft spoofing (`Object.create(X.prototype)`) iff it exposes an
_inert_ prototype accessor or method — side-effect-free, invoking no user code — that
reads a characteristic internal slot and throws on an incompatible receiver. Boxed
primitives (`valueOf` → `[[XData]]`, decision #042), `Map` / `Set` (`get size`), `Date`
(`getTime`), and `WeakRef` (`deref`) qualify; `Promise` does not (its only slot readers,
`then` / `catch` / `finally`, invoke `SpeciesConstructor` and allocate), so `isPromise`
admits the graft by documented boundary. The principle predicts which future predicates
can gain a slot-seal and which cannot. See [`./thenable.md`](./thenable.md) and
[`./primitive.md`](./primitive.md).

## Open questions

Per-module sections close with a "Open architectural questions" subsection. The tracked
open questions across the package live in
[[`../decisions/open-questions.md`](../decisions/open-questions.md)](../decisions/open-questions.md).
