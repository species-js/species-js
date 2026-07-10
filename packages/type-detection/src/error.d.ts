/**
 * @module @species-js/type-detection/error
 *
 * Error value detection, DOMException discrimination, and abort-error
 * refinement.
 *
 * Three public predicates split the error surface: {@link isGenericError}
 * narrows to an `Error` that is not a `DOMException`, {@link isDOMException}
 * to a {@link DOMException}, and {@link isError} to either — the
 * {@link AnyError} union. Each is realm-partitioned: a local-realm value is
 * confirmed by an `instanceof` fast-path against the realm's captured
 * constructor, a foreign-realm value by a throw-safe prototype walk that
 * matches the spec-defined shape. {@link isError} prefers native ECMA-262
 * `Error.isError` when the runtime provides it (Node 23+, modern browsers)
 * and falls back to the {@link isAnyError} polyfill otherwise.
 *
 * The polyfill's structural gate pairs a minimum duck-type (`name` and
 * `message` strings) with a stack-graft filter that rejects error-shaped
 * values exposing no reachable `stack` — the observable side effect that
 * separates a genuine error from an `Object.create(Error.prototype)` graft.
 *
 * {@link isAbortError} refines {@link isError} via a suffix match against
 * {@link AbortErrorName}, the template-literal type that captures the
 * abort-channel naming convention shared by DOM WHATWG `AbortSignal` /
 * `AbortController` and userland abortable operations.
 */

import type { NewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  DOMException Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The legacy numeric error-code constants defined by the WebIDL
 * `DOMException` interface — each mapping a historical DOM error name to
 * its fixed integer code (`INDEX_SIZE_ERR === 1` … `DATA_CLONE_ERR ===
 * 25`). Present on every `DOMException` instance and on the constructor.
 *
 * The entire surface is discouraged. Modern code discriminates on the
 * string `name` (`'AbortError'`, `'SecurityError'`, …), never these
 * codes. Every member is `@deprecated` so a consumer that reads one gets
 * an editor strike-through — the uniform signal `lib.dom.d.ts` omits (it
 * flags only `code`, leaving these 25 un-annotated). The block is
 * retained on {@link DOMException} for runtime-faithfulness: real
 * instances carry it, so the type describes the value rather than hiding
 * present members.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/DOMException#error_names}
 */
export interface DOMExceptionLegacyCodes {
  /** @deprecated */ readonly INDEX_SIZE_ERR: 1;
  /** @deprecated */ readonly DOMSTRING_SIZE_ERR: 2;
  /** @deprecated */ readonly HIERARCHY_REQUEST_ERR: 3;
  /** @deprecated */ readonly WRONG_DOCUMENT_ERR: 4;
  /** @deprecated */ readonly INVALID_CHARACTER_ERR: 5;
  /** @deprecated */ readonly NO_DATA_ALLOWED_ERR: 6;
  /** @deprecated */ readonly NO_MODIFICATION_ALLOWED_ERR: 7;
  /** @deprecated */ readonly NOT_FOUND_ERR: 8;
  /** @deprecated */ readonly NOT_SUPPORTED_ERR: 9;
  /** @deprecated */ readonly INUSE_ATTRIBUTE_ERR: 10;
  /** @deprecated */ readonly INVALID_STATE_ERR: 11;
  /** @deprecated */ readonly SYNTAX_ERR: 12;
  /** @deprecated */ readonly INVALID_MODIFICATION_ERR: 13;
  /** @deprecated */ readonly NAMESPACE_ERR: 14;
  /** @deprecated */ readonly INVALID_ACCESS_ERR: 15;
  /** @deprecated */ readonly VALIDATION_ERR: 16;
  /** @deprecated */ readonly TYPE_MISMATCH_ERR: 17;
  /** @deprecated */ readonly SECURITY_ERR: 18;
  /** @deprecated */ readonly NETWORK_ERR: 19;
  /** @deprecated */ readonly ABORT_ERR: 20;
  /** @deprecated */ readonly URL_MISMATCH_ERR: 21;
  /** @deprecated */ readonly QUOTA_EXCEEDED_ERR: 22;
  /** @deprecated */ readonly TIMEOUT_ERR: 23;
  /** @deprecated */ readonly INVALID_NODE_TYPE_ERR: 24;
  /** @deprecated */ readonly DATA_CLONE_ERR: 25;
}

/**
 * The strict narrow target of {@link isDOMException} — species-js's model
 * of the WebIDL `DOMException` interface: the string `name` / `message`
 * identity surface, the legacy numeric `code`, and the
 * {@link DOMExceptionLegacyCodes} constant block.
 *
 * Deliberately NOT declared `extends Error`. WebIDL only made `DOMException`
 * an `Error` subclass recently, and engines still disagree at runtime — in
 * some, `new DOMException() instanceof Error` is `false`. Modelling it as an
 * `Error` subtype would collapse the {@link AnyError} union
 * (`Error | DOMException`) back to `Error` and let a `DOMException` inhabit
 * `T & Error` even though {@link isGenericError} rejects it at runtime,
 * reintroducing the exact type-vs-runtime gap the split predicates close.
 * Keeping it a standalone interface holds the union genuinely two-armed. For
 * the same reason no `stack` member is declared: WebIDL defines none, and
 * its presence is an engine extension available only where `DOMException`
 * happens to subclass `Error` — a consumer that needs a stack narrows
 * through `Error` or {@link AnyError}.
 *
 * Package-owned rather than an alias of `lib.dom.d.ts`'s global so the
 * discouraged legacy surface is flagged uniformly — `lib.dom.d.ts`
 * deprecates only `code` and leaves the 25 error-code constants
 * un-annotated. This type marks `code` AND every constant `@deprecated`,
 * giving consumers a strike-through on the whole legacy surface. It is
 * runtime-faithful, not a stripped view: a real `DOMException` genuinely
 * carries these members, so they are discouraged, not removed — a consumer
 * that must read `code` still can, under a deprecation warning.
 */
export interface DOMException extends DOMExceptionLegacyCodes {
  /**
   * The WHATWG DOM error name (`'AbortError'`, `'SecurityError'`,
   * `'SyntaxError'`, …) — the modern discriminator. Prefer it over
   * {@link code}.
   */
  readonly name: string;

  /** A human-readable description of the error. */
  readonly message: string;

  /**
   * The legacy numeric error code, or `0` when `name` maps to none of the
   * {@link DOMExceptionLegacyCodes} constants.
   * @deprecated
   */
  readonly code: number;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error Value Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The union of everything the error predicates accept — an `Error` or a
 * {@link DOMException}. The narrow target of {@link isError} and
 * {@link isAnyError}.
 *
 * The `Error` arm covers every value carrying the internal `[[ErrorData]]`
 * slot: the built-in subclasses (`TypeError`, `SyntaxError`, `RangeError`,
 * `ReferenceError`, `URIError`, `EvalError`, `AggregateError`) and every
 * user-defined `class X extends Error`, all flowing through it by subtype
 * assignability.
 *
 * `DOMException` is named as an explicit, distinct alternative rather than
 * folded into `Error` because species-js deliberately does NOT model
 * `DOMException` as an `Error` subtype (see {@link DOMException}). Engines
 * disagree on whether the subclass relation holds at runtime, so the union
 * stays genuinely two-armed and does not collapse to `Error` — which keeps
 * `DOMException`'s distinct, deliberately deprecated legacy `code` surface
 * documented at the type level.
 *
 * The union is the TypeScript-side approximation of "anything `Error.isError`
 * accepts". The spec-precise `[[ErrorData]]` slot check is unobservable from
 * userland and therefore cannot be modeled directly at the type level.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError}
 */
export type AnyError = DOMException | Error;

/**
 * `ErrorConstructor` extended with an _optional_ ES2025+ `isError` static
 * method. The honest typing for the global `Error` when the runtime may
 * or may not provide the static method.
 *
 * Used at the polyfill site to read `(Error as ErrorConstructorES2025).isError`
 * without asserting presence. The subsequent `isFunction` narrow handles
 * the actual decision.
 *
 * @see {@link https://tc39.es/ecma262/#sec-error.iserror}
 * @internal
 */
export interface ErrorConstructorES2025 extends ErrorConstructor {
  /** Optional — present in ES2025+ runtimes, absent otherwise. */
  isError?(value: unknown): value is AnyError;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortError Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An error-name string ending with the `'AbortError'` suffix.
 *
 * Captures the abort-channel naming convention spec-defined by DOM
 * WHATWG: `AbortSignal.abort()` rejects with a `DOMException` whose
 * `name` is `'AbortError'`. Userland abortable operations frequently
 * prefix their own qualifier (`'TimeoutAbortError'`,
 * `'UserAbortError'`, `'NavigationAbortError'`) to disambiguate the
 * cause without losing the convention. The leading `string` admits the
 * empty case — `'AbortError'` itself — and arbitrary qualifiers alike.
 *
 * Template-literal types collapse to `string` at the runtime level, so
 * this type is structural documentation rather than a runtime guarantee.
 * The runtime check happens in {@link isAbortError} via
 * `name.endsWith('AbortError')`.
 */
export type AbortErrorName = `${string}AbortError`;

/**
 * A {@link AnyError} whose `name` ends with `'AbortError'`.
 *
 * Layers {@link AbortErrorName} as the `name` field over the base
 * `AnyError` union via structural intersection, capturing the
 * abort-channel idiom at the type level. The narrow target of
 * {@link isAbortError}.
 */
export type AbortError = AnyError & {
  name: AbortErrorName;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Stack-Capability Internals
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Reads a value's `stack` string, or `undefined` when none is reachable.
 * The access strategy is fixed once at module-load from how the realm's
 * `Error.prototype` exposes `stack` — an accessor `stack` (V8's
 * `gated-slot`) is read through its getter, a data `stack` (`plain-data`)
 * read directly and type-checked. Throw-safe: a hostile getter or an absent
 * property yields `undefined`. The resolved strategy is carried on the
 * function's own `mode` property, surfaced as {@link errorStackMode}.
 *
 * @param value - the value whose `stack` should be read
 * @returns the `stack` string, or `undefined` when absent or unreadable
 * @internal
 */
export const retrieveErrorStack: ((value: object) => string | undefined) & {
  readonly mode: 'gated-slot' | 'plain-data';
};

/**
 * How {@link retrieveErrorStack} reaches a value's `stack` in this realm —
 * `'gated-slot'` when `Error.prototype.stack` is an accessor (read through
 * its getter), `'plain-data'` when it is a data property (read directly).
 * @internal
 */
export const errorStackMode: 'gated-slot' | 'plain-data';

/**
 * Whether this environment populates a string `stack` on thrown errors,
 * probed once at module-load. Engines disagree — V8 yes, some others no —
 * and the answer gates {@link doesPassErrorGraftFilter}: the stack-graft
 * filter only discriminates where a genuine error is guaranteed to carry a
 * `stack`.
 * @internal
 */
export const ERROR_STACK_CAPABLE: boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal Error and DOMException Predicate Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether a value exposes a `stack` string reachable through
 * {@link retrieveErrorStack} — the realm's fixed access strategy, so an
 * inherited accessor `stack` counts, not only an own data property.
 *
 * @param value - the value to inspect
 * @returns `true` when a `stack` string is reachable; `false` otherwise
 * @internal
 */
export function hasReachableErrorStack(value: object): boolean;

/**
 * The stack-graft filter — the gate that separates a genuine error from an
 * `Object.create(Error.prototype)` graft. Where the environment does not
 * populate stacks ({@link ERROR_STACK_CAPABLE} is `false`) the filter is
 * disabled and every value passes, since a missing `stack` proves nothing
 * there. Where stacks are guaranteed, a value passes only when it carries a
 * reachable `stack` — the grafted shell, which never ran an `Error`
 * constructor, does not. A heuristic, not a slot check: it filters by the
 * observable side effect of construction, the closest reachable proxy for
 * the unobservable `[[ErrorData]]`.
 *
 * @param value - the value to test
 * @returns `true` when the value passes the graft filter; `false` otherwise
 * @internal
 */
export function doesPassErrorGraftFilter(value: object): boolean;

/**
 * The minimum error duck-type — `name` and `message` both present as
 * strings. The floor shared by every `Error` and `DOMException` across
 * realms, and the only structural claim that holds without inspecting the
 * prototype or a `[[Class]]` tag. Throw-safe.
 *
 * @param value - the value to test
 * @param value.message - the candidate `message`, required to be a string
 * @param value.name - the candidate `name`, required to be a string
 * @returns `true` when both `name` and `message` are strings; `false`
 *  otherwise
 * @internal
 */
export function doesImplementMinimumErrorContract(value: {
  message?: unknown;
  name?: unknown;
}): boolean;

/**
 * The generic-error structural contract — the stack-graft filter
 * ({@link doesPassErrorGraftFilter}) AND the minimum duck-type
 * ({@link doesImplementMinimumErrorContract}). The graft filter runs first
 * by deliberate precedence: the more discriminating gate, ordered ahead of
 * the `name` / `message` read so a grafted shell is rejected before its
 * coincidental string members are ever considered. On a graft it
 * short-circuits cheaply; on a genuine error it is the costlier half (reading
 * a reachable `stack` can force stack materialization), but the ordering costs
 * nothing there and buys the early-out on the graft path.
 *
 * @param value - the value to test
 * @returns `true` when the value satisfies the generic-error contract;
 *  `false` otherwise
 * @internal
 */
export function doesImplementGenericErrorContract(value: object): boolean;

/**
 * The `DOMException` structural contract — `name` and `message` both present
 * as inert getters. The descriptor shape (an accessor, never invoked) is the
 * marker that separates a `DOMException`, whose `name` / `message` are
 * prototype accessors backed by an internal slot, from a plain `Error`,
 * whose same-named members are data properties. The legacy numeric `code` is
 * deliberately not tested — discouraged, and carrying no discriminating
 * value.
 *
 * @param value - the value to test
 * @returns `true` when both `name` and `message` are exposed as getters;
 *  `false` otherwise
 * @internal
 */
export function doesImplementDOMExceptionContract(value: object): boolean;

/**
 * Whether a prototype is the genuine root `Error.prototype` — identified by
 * its own descriptors: an own callable `toString`, string `name` and
 * `message`, and the three pinned values `toString.call(prototype) ===
 * 'Error'`, `name === 'Error'`, `message === ''`. Pinning to the root
 * values (not merely a name ending in `'Error'`) identifies `Error.prototype`
 * itself rather than any error-named prototype, so it serves as both the
 * module-load capture gate and the walk target. Throw-safe.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first (decision #059)
 * @returns `true` when the prototype is the root `Error.prototype` shape;
 *  `false` otherwise
 * @internal
 */
export function doesImplementGenericErrorPrototypeContract(prototype: object): boolean;

/**
 * Whether a prototype exposes the `DOMException` accessor shape — `name` and
 * `message` each a getter with no setter, both yielding strings when invoked
 * with `value` as receiver. The receiver must be the original root value,
 * not the prototype: the spec-defined getters read an internal slot and
 * throw on anything that is not a live `DOMException`. Unlike the
 * generic-error prototype contract it pins no specific strings —
 * `DOMException` `name` / `message` vary per instance. Throw-safe.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first (decision #059)
 * @param value - the root value, threaded as the receiver for the
 *  spec-defined `name` / `message` getter invocations
 * @returns `true` when both accessors are present in the spec-defined getter
 *  shape and yield strings; `false` otherwise
 * @internal
 */
export function doesImplementDOMExceptionPrototypeContract(
  prototype: object,
  value: object,
): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal (generic) Error and (generic) DOMException Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether a `(prototype, constructor)` pair is the realm's genuine `Error` /
 * `Error.prototype` pairing. Four identity markers, in load-bearing order —
 * the prototype tags `'[object Object]'` (`Error.prototype` carries no
 * `[[ErrorData]]` and no `Symbol.toStringTag`, so it reports as a plain
 * object), the constructor's own `name` is `'Error'`, the constructor is
 * class-shaped (a newable with a non-writable `prototype`), and its
 * `prototype` descriptor points back at this prototype — followed by the
 * delegated {@link doesImplementGenericErrorPrototypeContract}. Used both as
 * the module-load capture gate for `Error` and as the match test at each
 * level of the alien-realm prototype walk.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first (decision #059)
 * @param constructor - the value's already-resolved `[[Constructor]]`,
 *  threaded in by the caller
 * @returns `true` when the pair matches the genuine `Error` /
 *  `Error.prototype`; `false` otherwise
 * @internal
 */
export function isGenericErrorPrototypeEquivalent(
  prototype: unknown,
  constructor: unknown,
): boolean;

/**
 * Whether a `(prototype, constructor, value)` triple is the realm's genuine
 * `DOMException` / `DOMException.prototype` pairing. The same four identity
 * markers as {@link isGenericErrorPrototypeEquivalent}, tuned to
 * `DOMException` — the prototype tags `'[object DOMException]'` (the
 * interface defines its own `Symbol.toStringTag`), the constructor's own
 * `name` is `'DOMException'`, it is class-shaped, and its `prototype`
 * descriptor points back at this prototype — followed by the delegated
 * {@link doesImplementDOMExceptionPrototypeContract}, which invokes the spec
 * accessors against `value`. The root `value` is threaded through as that
 * receiver because the `name` / `message` getters throw on anything but a
 * live `DOMException`.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first (decision #059)
 * @param constructor - the value's already-resolved `[[Constructor]]`,
 *  threaded in by the caller
 * @param value - the root value, threaded as the receiver for the
 *  spec-defined accessor invocations
 * @returns `true` when the triple matches the genuine `DOMException` /
 *  `DOMException.prototype`; `false` otherwise
 * @internal
 */
export function isDOMExceptionPrototypeEquivalent(
  prototype: object,
  constructor: NewableFunction | undefined,
  value: object,
): boolean;

/**
 * Whether a value is a foreign-realm `Error` that is not a `DOMException` —
 * the path taken when the local-realm `instanceof` fast-path misses (a value
 * from an iframe, `vm` context, or worker whose `Error` is a different
 * constructor identity).
 *
 * Rejects up front unless the value passes the generic-error contract AND is
 * not itself an alien `DOMException`. The DOMException exclusion is
 * mandatory: where `DOMException` subclasses `Error` it also satisfies the
 * stack-graft filter, so the contract alone would admit it — the explicit
 * {@link isAlienRealmDOMException} check keeps {@link isGenericError} and
 * {@link isDOMException} disjoint across realms. Then walks the prototype
 * chain for a level equivalent to the genuine `Error.prototype`, reading
 * each level's constructor from its own `constructor` back-reference (so
 * subclass levels are matched, not only a direct `new Error()`). Throw-safe.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test
 * @returns `true` when the value is a foreign-realm generic Error, narrowing
 *  `value` to `T & Error`; `false` otherwise
 * @internal
 */
export function isAlienRealmGenericError<T = unknown>(value: T): value is T & Error;

/**
 * Whether a value is a foreign-realm `DOMException` — the path taken when the
 * local-realm `instanceof DOMException` fast-path misses.
 *
 * Rejects up front unless the value passes the DOMException contract (both
 * `name` and `message` exposed as inert getters). Then walks the prototype
 * chain for a level equivalent to the genuine `DOMException.prototype`,
 * reading each level's constructor from its own `constructor` back-reference.
 * The original root `value` — never the walked node — is threaded as the
 * receiver, because the spec-defined `name` / `message` accessors throw
 * unless invoked on a live `DOMException`. Throw-safe.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test
 * @returns `true` when the value is a foreign-realm DOMException, narrowing
 *  `value` to `T & DOMException`; `false` otherwise
 * @internal
 */
export function isAlienRealmDOMException<T = unknown>(
  value: T,
): value is T & DOMException;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal (current-realm-instance based) Error and DOMException Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether a value is an `instanceof` the captured current-realm `Error`
 * constructor — the inexpensive local-realm fast-path. Admits current-realm
 * `DOMException` instances where `DOMException` subclasses `Error`;
 * "Generic" names the captured `Error` constructor, not the
 * Error-not-DOMException distinction, which {@link isGenericError} applies
 * via an explicit {@link isCurrentRealmDOMExceptionInstance} exclusion.
 * Throw-safe against a poisoned `Symbol.hasInstance`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test
 * @returns `true` when the value is a current-realm `Error` instance,
 *  narrowing `value` to `T & Error`; `false` otherwise
 * @internal
 */
export function isCurrentRealmGenericErrorInstance<T = unknown>(
  value: T,
): value is T & Error;

/**
 * Whether a value is an `instanceof` the captured current-realm
 * `DOMException` constructor — the inexpensive local-realm fast-path for
 * DOMException. Throw-safe against a poisoned `Symbol.hasInstance`; when the
 * realm has no `DOMException` the capture is the inert sentinel and this is
 * uniformly `false`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test
 * @returns `true` when the value is a current-realm `DOMException` instance,
 *  narrowing `value` to `T & DOMException`; `false` otherwise
 * @internal
 */
export function isCurrentRealmDOMExceptionInstance<T = unknown>(
  value: T,
): value is T & DOMException;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Public (generic) Error and (generic) DOMException Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to a generic `Error` — one that is not a `DOMException`.
 *
 * Realm-partitioned, with the `DOMException` exclusion applied first and by
 * identity: a current-realm `DOMException` instance is rejected up front (an
 * `instanceof` check) ahead of any structural test, so even a `DOMException`
 * whose contract {@link isDOMException} rejects cannot leak into the
 * generic-error result. A current-realm `Error` instance is then confirmed by
 * the generic-error contract (the fast, common path); a foreign-realm value
 * falls to the prototype walk, which re-applies the exclusion structurally.
 * The exclusion is exact in the current realm and structural across realms —
 * a foreign `DOMException` with a broken contract is classified as a generic
 * `Error`, the one accepted cross-realm asymmetry — while a well-formed
 * `DOMException` of either realm is excluded at runtime.
 *
 * That exclusion is a runtime guarantee. It is not carried in the narrow
 * type: TypeScript has no negation type, so `value is T & Error` cannot
 * express "and not a `DOMException`". Because species-js does not model
 * `DOMException` as an `Error` subtype (see {@link DOMException}), the two
 * are already disjoint arms of {@link AnyError} and `T & Error` excludes
 * `DOMException` structurally in ordinary use; the runtime check remains the
 * authoritative one.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an error
 * @returns `true` when the value is a generic `Error` and not a
 *  `DOMException`, narrowing `value` to `T & Error`; `false` otherwise
 * @example
 * isGenericError(new TypeError('x'));             // true
 * isGenericError(new DOMException('m', 'N'));      // false (a DOMException)
 * isGenericError({ name: 'Error', message: '' });  // false (not an Error)
 * isGenericError(null);                            // false
 */
export function isGenericError<T = unknown>(value?: T): value is T & Error;

/**
 * Narrows a value to {@link DOMException}.
 *
 * Realm-partitioned. A truthy current-realm `DOMException` instance is
 * confirmed structurally by the DOMException contract; everything else falls
 * to the foreign-realm prototype walk. No cross-exclusion is needed — a
 * `DOMException` is the specific type, so a current-realm-instance hit is
 * unambiguous.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not a DOMException
 * @returns `true` when the value is a `DOMException`, narrowing `value` to
 *  `T & DOMException`; `false` otherwise
 * @example
 * isDOMException(new DOMException('m', 'AbortError')); // true
 * isDOMException(new Error('x'));                       // false
 * isDOMException(null);                                 // false
 */
export function isDOMException<T = unknown>(value?: T): value is T & DOMException;

/**
 * Narrows a value to {@link AnyError} — an `Error` or a `DOMException`. The
 * {@link isError} polyfill body, used when the runtime lacks native
 * `Error.isError`.
 *
 * Realm-partitioned with the DOMException arm ordered first: a truthy
 * current-realm `DOMException` is confirmed by its contract; else a
 * current-realm `Error` by the generic contract; else the value falls to the
 * two foreign-realm walks. Checking DOMException ahead of Error matters where
 * the two co-classify — a `DOMException` that also subclasses `Error` must
 * resolve on the more specific arm. Unlike {@link isGenericError} this admits
 * both branches, so no cross-exclusion is applied.
 *
 * Exported for tests and for callers that want the polyfill semantics
 * regardless of the runtime's native `Error.isError`. The polyfill is NOT a
 * widening superset of the native check: its stack-graft filter rejects
 * `Object.create(Error.prototype)` grafts wherever the environment guarantees
 * stacks ({@link ERROR_STACK_CAPABLE}), converging on the native
 * `[[ErrorData]]` verdict rather than widening past it; only where no stacks
 * are populated — the filter disabled — does it admit grafts native would
 * reject.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an error
 * @returns `true` when the value is an `Error` or `DOMException`, narrowing
 *  `value` to `T & AnyError`; `false` otherwise
 * @internal
 */
export function isAnyError<T = unknown>(value?: T): value is T & AnyError;

/**
 * Narrows a value to {@link AnyError} — the public Error predicate.
 *
 * Bound once at module-load: native ECMA-262 `Error.isError` when the
 * captured realm provides it (ES2025+ — Node 23+, modern browsers), the
 * {@link isAnyError} polyfill otherwise. The binding is realm-fixed — it does
 * not re-read `globalThis.Error` at each call, so later tampering with the
 * global `Error.isError` does not reach it.
 *
 * Native `Error.isError` is the spec-precise check — it reads the internal
 * `[[ErrorData]]` slot, which userland code cannot observe directly. The
 * polyfill approximates it structurally because that slot is unobservable;
 * the two admit the same set in well-behaved code, and the polyfill's
 * stack-graft filter keeps them convergent on the legacy
 * `Object.create(Error.prototype)` graft — both reject it wherever the
 * environment guarantees stacks ({@link ERROR_STACK_CAPABLE}) — rather than
 * widening; only where no stacks are populated does the filter stand down and
 * the polyfill admit grafts native would reject. The generic `T` surface is
 * applied even though the captured native method is non-generic per its ES2025
 * declaration — runtime semantics are unchanged, only the type-surface widens.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  is not an error
 * @returns `true` when the value carries `[[ErrorData]]` (native) or matches
 *  the polyfill semantics, narrowing `value` to `T & AnyError`; `false`
 *  otherwise
 * @example
 * isError(new Error('boom'));                   // true
 * isError(new TypeError('x'));                  // true
 * isError(new DOMException('msg', 'XError'));   // true
 * isError(null);                                // false
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError}
 */
export function isError<T = unknown>(value?: T): value is T & AnyError;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortError Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link AbortError} — a {@link AnyError} whose
 * `name` ends with the `'AbortError'` suffix.
 *
 * Composes {@link isError} with an explicit `name` string-type check
 * and a suffix-match on `value.name`. Short-circuit `&&` runs `isError`
 * first as the inexpensive gate, then `isStringValue(value.name)` to confirm
 * the `name` is a string, then the suffix check. The string-type gate
 * is load-bearing because neither the native `Error.isError` (which
 * inspects only the `[[ErrorData]]` slot) nor the polyfill's
 * prototype-walk verifies the value's own `name` override. An Error
 * with `Object.defineProperty(err, 'name', { value: 42 })` passes
 * `isError`, but its `name` is not a string and the bare suffix-call
 * would throw `TypeError`.
 *
 * Captures the abort-channel naming convention shared by:
 *
 * - DOM WHATWG `AbortSignal.abort()`, which rejects with a
 *   `DOMException` named `'AbortError'`.
 * - `AbortController.abort()`, which propagates the same name through
 *   the signal it controls.
 * - Userland abortable operations that wrap the convention with a
 *   qualifier prefix (`'TimeoutAbortError'`, `'UserAbortError'`).
 *
 * Suffix-match by design — exact equality would reject the legitimate
 * qualified variants (`'TimeoutAbortError'`, `'UserAbortError'`). The
 * empty-prefix case `'AbortError'` is included by the {@link AbortErrorName}
 * template-literal pattern.
 *
 * Does not verify any abort-channel _mechanics_ (no inspection of
 * `AbortSignal.aborted`, no link to an `AbortController`). The check is
 * purely on the error's name. Producer-side inspection of the abort
 * channel belongs to predicates in the `evented` module
 * (`isAbortSignal`, `isAbortSignalLike`).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AbortError`; `T = unknown` collapses to `AbortError`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an abort error
 * @returns `true` when the value is an Error whose `name` is a string
 *  ending with `'AbortError'`, narrowing `value` to `T & AbortError`;
 *  `false` otherwise
 * @example
 * isAbortError(new DOMException('aborted', 'AbortError')); // true
 *
 * class TimeoutAbortError extends Error {
 *   override name = 'TimeoutAbortError';
 * }
 * isAbortError(new TimeoutAbortError());                   // true
 *
 * isAbortError(new Error('plain'));                        // false (no suffix)
 * isAbortError({ name: 'AbortError' });                    // false (not an Error)
 * isAbortError(null);                                      // false
 */
export function isAbortError<T = unknown>(value?: T): value is T & AbortError;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
