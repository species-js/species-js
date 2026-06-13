# type-detection — Architecture

A current-state conceptual map of `@species-js/type-detection`. The decision log
(`../decisions/`) answers _why_ the code looks the way it does, as discrete
chronologically-numbered ADRs. This directory answers _how_ it works, organized by module
— one file per module.

Each module file starts with the mental model a contributor needs to read the code, then
describes the cross-cutting patterns the code embodies, and ends with the open
architectural questions that the code has not yet answered.

## Modules

| Module        | File                           | Surface                                                                                                                                                                                                        |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/function`  | [function.md](./function.md)   | Function-family classification: `isCallable`, `isFunction`, `isNewableFunction`, `isClass`, `isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`, plus the shape/signal/contract helper family |
| `@/thenable`  | [thenable.md](./thenable.md)   | `Thenable<T>`, `PromiseLike<T>`, `Promise<T>` lattice and predicates                                                                                                                                           |
| `@/evented`   | [evented.md](./evented.md)     | `EventTargetLike` / `EventTarget` and `AbortSignalLike` / `AbortSignal` lattices                                                                                                                               |
| `@/error`     | [error.md](./error.md)         | `GenericError`, `isError`, `isAbortError`, polyfill discipline                                                                                                                                                 |
| `@/primitive` | [primitive.md](./primitive.md) | Five primitive families: string, number, boolean, bigint, symbol; the four-marker boxed-primitive chain                                                                                                        |
| `@/object`    | [object.md](./object.md)       | `isObject`, `isPlainObject`, `isDictionaryObject`, the five-marker structural anchor                                                                                                                           |
| `@/utility`   | [utility.md](./utility.md)     | Inert descriptor walks, type-signature readers, constructor inspection, `resolveType`                                                                                                                          |

## Cross-cutting patterns

Each module embeds the cross-cutting patterns it uses. The patterns themselves
(boundary-retyping at `@/config`, conservative-narrowing posture, spec-shape access
discipline, family pattern with sub-helpers, strict-by-default + composable lenient forms,
cross-realm fast path + structural fallback) are referenced from the relevant module
files. They are not deduplicated into a workspace-level document yet — that will land if
and when a second package adopts them.

## Open questions

Per-module sections close with a "Open architectural questions" subsection. The tracked
open questions across the package live in
[`../decisions/open-questions.md`](../decisions/open-questions.md).
