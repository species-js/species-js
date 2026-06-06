/**
 * @module @species-js/type-detection/thenable
 *
 * `Thenable` shaped value detection.
 *
 * The {@link Thenable} interface captures the structural floor of the
 * Promise resolution protocol: any value with a callable `then` method
 * of the right shape may be adopted by `Promise.resolve` and unwrapped
 * by `await`. Two independent refinements layer on the floor:
 * {@link PromiseLike} adds the chaining-method contract (`catch` and
 * `finally`); {@link AbortableThenable} adds the abort-channel surface
 * (an optional `onaborted` callback to `then`, typed against
 * `AbortError`). The realm-fixed `Promise` intrinsic combines the
 * PromiseLike refinement and is discriminated by {@link isPromise}.
 */

import type { AbortError } from '@/error';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Thenable
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The structural floor of the `Promise` resolution protocol. Any
 * value carrying a `then` method matching the signature below
 * satisfies `Thenable<T>`, and `Promise.resolve(value)` adopts
 * its eventual fulfillment value of type `T`.
 *
 * The single guarantee is the `then` method: a _thenable_ instance
 * guarantees that `then` is callable and accepts two callback channels
 * (fulfillment and rejection). It promises nothing about whether the
 * callbacks fire, when they fire, how often `then` is called, or what
 * `then` returns.
 * Per the ECMA-262 `PromiseResolveThenableJob` algorithm, only the
 * `resolve`/`reject` invocations made from inside `then` participate in
 * the adoption; the return value of `then` is not part of the protocol.
 *
 * Everything beyond `then` is unpromised:
 *
 * - No `catch`. `Promise.prototype.catch` is a `Promise` refinement,
 *   not a `Thenable` contract; a _thenable_ type does not need to
 *   expose any rejection-only shortcut.
 * - No `finally`. Settlement-agnostic handlers belong to `Promise`,
 *   not `Thenable`.
 * - No microtask scheduling. The `Promise` spec demands a microtask
 *   queue boundary between producer and consumer; a `Thenable` does
 *   not promise anything about timing and even may invoke its callbacks
 *   synchronously.
 * - No abortability. A _thenable_ type cannot be canceled through its
 *   `then` surface; abort-channel support is a strict refinement, reserved
 *   for a separate `AbortableThenable` type.
 * - No settled-state observability. A `Thenable` does not have to expose
 *   `[[PromiseState]]`, a `status` property, or any other inspectable
 *   marker of whether settlement has occurred.
 *
 * `Thenable<T>` is declared with covariant variance (`out T`) because
 * a _thenable_ type is a producer of `T` — it emits a `T` on the
 * fulfillment channel and never consumes one. A `Thenable<Cat>`
 * is therefore assignable to a `Thenable<Animal>` under TypeScript's
 * variance checking.
 *
 * @typeParam T - the type of the value produced on the fulfillment
 *  channel
 */
export interface Thenable<out T> {
  /**
   * Registers callbacks for the fulfillment and rejection channels and
   * returns a _thenable_ type for the chained result.
   *
   * Both callbacks are optional; either may be omitted, `null`, or
   * `undefined`, in which case the corresponding channel passes
   * through unchanged to the returned _thenable_ type. `onfulfilled`
   * receives the produced value and may itself return a direct result
   * or another _thenable_ type, which the resolution algorithm unwraps.
   * `onrejected` plays the same role on the rejection channel, with
   * the reason typed as `unknown` because the spec gives no guarantee
   * about its shape.
   *
   * The _chained-thenable_ return is a convention this package retains
   * for `await` ergonomics, not a spec requirement: per
   * `PromiseResolveThenableJob`, the return value of `then` is not
   * part of the adoption protocol, and callers that ignore the return
   * value are spec-conformant.
   *
   * @param onfulfilled - callback for the fulfillment channel
   * @param onrejected - callback for the rejection channel
   * @returns a _thenable_ type for the result of whichever channel
   *  fires, typed as the union of the two callback result types
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | Thenable<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | Thenable<TResult2>) | null,
  ): Thenable<TResult1 | TResult2>;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  PromiseLike
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The Promise-method contract — `Thenable<T>` extended with the chaining
 * sugar specified by ECMA-262 §27.2 on `Promise.prototype`.
 *
 * A value satisfies `PromiseLike<T>` when it carries three callable
 * methods: `then` (inherited from `Thenable`), `catch`, and `finally`.
 * This is the contract native `Promise` instances and their subclasses
 * naturally satisfy, and the contract custom Promise-like implementations
 * need to match to be safely usable in code that calls the full chaining
 * API.
 *
 * `PromiseLike<T>` sits strictly between `Thenable<T>` (only `then`)
 * and `Promise<T>` (the realm-fixed intrinsic identified by `[[Class]]`
 * tag and constructor name). It is the right narrowing target for
 * predicates that admit any value satisfying the `Promise.prototype`
 * method contract, without requiring identity equality with
 * `%Promise%`. Notable members of this set: native `Promise` instances;
 * subclasses of `Promise`; cross-realm `Promise` instances; userland
 * implementations such as Bluebird or Q that satisfy the full
 * Promise-method contract.
 *
 * Chained-method return types are `PromiseLike<...>` rather than
 * `Thenable<...>`. A `PromiseLike` chain therefore stays
 * `PromiseLike`-typed through `then`, `catch`, and `finally` — a
 * covariant refinement over the `Thenable.then` return that lets
 * consumers chain further methods without re-narrowing.
 *
 * Like `Thenable<T>`, `PromiseLike<T>` is covariant in `T` (`out T`)
 * because a _promise-like_ instance is a producer of `T` and never
 * a consumer.
 *
 * ## How this `PromiseLike` differs from TypeScript's lib version
 *
 * TypeScript's built-in `lib.es5.PromiseLike<T>` is structurally
 * identical to this package's `Thenable<T>` — a single `then` method,
 * nothing more. This package's `PromiseLike<T>` is strictly richer:
 *
 * - Adds `catch` and `finally` so the type captures the full
 *   Promise-method contract. The lib version cannot express "has the
 *   chaining sugar".
 * - `unknown` typing on rejection-channel reasons. The lib version
 *   uses `any`, which leaks through every consumer of the type.
 * - `out T` variance annotation, making the producer-only role
 *   explicit to TypeScript's variance checking.
 * - No redundant `| undefined` on optional callbacks; the `?` already
 *   widens to it.
 *
 * @typeParam T - the type of the value produced on the fulfillment
 *  channel
 */
export interface PromiseLike<out T> extends Thenable<T> {
  /**
   * Registers callbacks for the fulfillment and rejection channels and
   * returns a `PromiseLike` for the chained result.
   *
   * Refines `Thenable.then` only in the return type — the callback
   * shapes are unchanged. The refined return keeps `catch` and
   * `finally` callable on the chained value without a fresh narrow.
   *
   * @param onfulfilled - callback for the fulfillment channel
   * @param onrejected - callback for the rejection channel
   * @returns a `PromiseLike` for the result of whichever channel fires
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | Thenable<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | Thenable<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;

  /**
   * Registers a callback for the rejection channel only. Spec-equivalent
   * to `then(null, onrejected)` per ECMA-262 §27.2.5.1
   * `Promise.prototype.catch`.
   *
   * @param onrejected - callback for the rejection channel
   * @returns a `PromiseLike` whose fulfillment channel passes through
   *  unchanged and whose rejection channel adopts the handler's result
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | Thenable<TResult>) | null,
  ): PromiseLike<T | TResult>;

  /**
   * Registers a settlement-agnostic callback. Per ECMA-262 §27.2.5.3
   * `Promise.prototype.finally`, `onfinally` fires on either
   * fulfillment or rejection; the original value or reason flows
   * through unchanged unless `onfinally` itself throws or returns a
   * thenable that rejects, in which case the chained `PromiseLike`
   * adopts that rejection.
   *
   * @param onfinally - callback fired on settlement; receives no
   *  arguments and its return value is normally ignored
   * @returns a `PromiseLike` for the original outcome
   */
  finally(onfinally?: (() => void) | null): PromiseLike<T>;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortableThenable
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The abort-aware refinement of `Thenable<T>` — adds an optional third
 * `onaborted` callback to the `then` signature, typed against
 * {@link AbortError}. A value satisfies `AbortableThenable<T>` when its
 * `then` method accepts the three-channel callback set: fulfillment,
 * rejection, and abort.
 *
 * `AbortableThenable<T>` and `PromiseLike<T>` are _independent_
 * refinements of `Thenable<T>`. `PromiseLike<T>` refines the
 * chaining-method surface (adding `catch` and `finally`);
 * `AbortableThenable<T>` refines the settlement-channel surface
 * (adding the abort channel). The two can be combined in a value's type
 * signature (a value can satisfy both), but neither implies the other.
 *
 * ## Cross-module abort-channel surface
 *
 * The abort-channel feature is structurally distributed across three
 * type-detection modules. Each module discriminates one side of the
 * three-party contract:
 *
 * - `@/error` ships {@link AbortError} (and `AbortErrorName`) for the
 *   rejected-value side — the error type the `onaborted` callback
 *   receives.
 * - `@/evented` ships `AbortSignalLike` and `isAbortSignalLike` for the
 *   producer side — the structural contract of values that emit abort
 *   signals (`AbortSignal`, `AbortController.signal`, userland abortable
 *   producers).
 * - `@/thenable` ships `AbortableThenable<T>` (this interface) — the
 *   structural contract of consumer-side abortable thenables that
 *   receive abort signals through their `then.onaborted` callback.
 *
 * Consumers building an abortable operation depend on all three;
 * consumers handling only one side depend on only the relevant module.
 *
 * ## Variance and chain preservation
 *
 * `AbortableThenable<T>` is declared with covariant variance (`out T`),
 * matching `Thenable<T>` and `PromiseLike<T>` — an abortable thenable
 * is a producer of `T` and never a consumer. Chained results from
 * `then` are typed as `AbortableThenable<...>` rather than degrading to
 * bare `Thenable<...>`, so the abort channel stays in the type system
 * through the chain. A consumer who calls `chain.then(_, _, onAborted)`
 * further down the chain still receives the typed `AbortError` on the
 * abort callback.
 *
 * Whether the producer ACTUALLY propagates abort signals down the chain
 * is up to the producer — the type system documents the contract but
 * cannot enforce it. This mirrors how `Promise.then`'s return is
 * structurally guaranteed to be Promise-like while runtime behavior is
 * the producer's responsibility.
 *
 * ## No structural predicate
 *
 * There is no `isAbortableThenable` predicate, by design. A `Thenable`
 * with a two-argument `then` and one with a three-argument `then` are
 * structurally indistinguishable at runtime — the third callback is
 * optional, and a two-argument `then` gracefully ignores any extra
 * argument. The `.length` property of `then` could be inspected as a
 * heuristic but is easily spoofed and not spec-required. Consumers
 * receive `AbortableThenable<T>` because their producer declares it
 * structurally; there is no runtime test to verify it.
 *
 * @typeParam T - the type of the value produced on the fulfillment
 *  channel
 */
export interface AbortableThenable<out T> extends Thenable<T> {
  /**
   * Registers callbacks for the fulfillment, rejection, and abort
   * channels, and returns an `AbortableThenable` for the chained result.
   *
   * Refines `Thenable.then` by adding the optional third `onaborted`
   * callback typed against {@link AbortError}. All three callbacks are
   * optional; omitted or `null` channels pass through unchanged to the
   * returned thenable. Each callback may return a direct result or
   * another `Thenable`, which the resolution algorithm unwraps. The
   * return type is `AbortableThenable<...>` rather than `Thenable<...>`
   * to keep the abort channel in the type system through chaining.
   *
   * @param onfulfilled - callback for the fulfillment channel
   * @param onrejected - callback for the rejection channel
   * @param onaborted - callback for the abort channel; receives the
   *  spec-conventional `AbortError`
   * @returns an `AbortableThenable` for the result of whichever channel
   *  fires, typed as the union of the three callback result types
   */
  then<TResult1 = T, TResult2 = never, TResult3 = never>(
    onfulfilled?: ((value: T) => TResult1 | Thenable<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | Thenable<TResult2>) | null,
    onaborted?: ((reason: AbortError) => TResult3 | Thenable<TResult3>) | null,
  ): AbortableThenable<TResult1 | TResult2 | TResult3>;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Thenable Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `Thenable<unknown>` by verifying that `then` is a
 * callable data property reachable through the value's prototype chain.
 *
 * The lookup walks the chain via own-descriptor reads at each level,
 * matching how ECMA-262 `Get(value, "then")` resolves the property
 * during `Promise` adoption. A `then` found anywhere along the chain
 * — own or inherited — satisfies the predicate; native `Promise`
 * instances pass because their `then` lives on `Promise.prototype`.
 *
 * Verifies callability only — it does not validate the `then` signature
 * shape or whether the value honors the `resolve`/`reject` protocol.
 * Accessor descriptors are deliberately rejected: the predicate's
 * contract is to inspect without invoking, so a `get then()` shape is
 * treated as "not a _thenable_ type" even if this very getter returns
 * a callable type.
 *
 * Generic in `T` per the family pattern set by `isCallable` and
 * `isFunction` in `@/function`. The narrow returns `T & Thenable<unknown>`;
 * `T = unknown` collapses to `Thenable<unknown>`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a _thenable_ type
 * @returns `true` when the value carries a callable `then` data property
 *  in its prototype chain, narrowing `value` to `T & Thenable<unknown>`;
 *  `false` otherwise
 * @example
 * isThenable(Promise.resolve());                   // true (inherited)
 * isThenable({ then: () => {} });                  // true (own)
 * isThenable({ then: 'not a function' });          // false
 * isThenable({ get then() { return () => {}; } }); // false (accessor)
 * isThenable(null);                                // false
 */
export function isThenable<T = unknown>(value?: T): value is T & Thenable<unknown>;

/**
 * Verifies that the value matches the `Promise.prototype` method
 * contract — callable `then`, `catch`, and `finally` data properties
 * reachable through the value's prototype chain.
 *
 * Composes three `hasInertMethod` checks for the methods defined on
 * `Promise.prototype` by ECMA-262 §27.2. Short-circuit `&&` enforces
 * an inner cost ordering: `then` (the spec-defined adoption hook) runs
 * first, `catch` second, and `finally` last.
 *
 * Used as the structural fallback inside `isPromiseLike` when the
 * realm-fixed `instanceof PromiseConstructor` fast path fails — for
 * example, on cross-realm `Promise` instances or userland Promise-like
 * implementations such as Bluebird or Q.
 *
 * Does not require `Symbol.toStringTag === 'Promise'` or a particular
 * constructor name; that level of identity narrowing belongs to
 * `isPromise`. `doesMatchPromiseContract` is purely structural.
 *
 * @param value - the value to inspect; omitted is treated as `undefined`,
 *  which does not match the Promise-method contract
 * @returns `true` when all three methods are callable data properties
 *  in the value's prototype chain; `false` otherwise
 * @example
 * doesMatchPromiseContract(Promise.resolve());  // true (inherited from prototype)
 * doesMatchPromiseContract({ then: () => {} }); // false (no `catch` or `finally`)
 * doesMatchPromiseContract(42);                 // false
 * @internal
 */
export function doesMatchPromiseContract(value?: unknown): boolean;

/**
 * Narrows a value to `PromiseLike<unknown>` via either local-realm
 * `Promise` identity or the structural `Promise.prototype` method
 * contract.
 *
 * Tests in cost order: the inexpensive `instanceof PromiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
 * If that fails, falls back to `doesMatchPromiseContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `Promise` instances (produced in iframes, workers, vm contexts) and
 * userland _promise-like_ implementations (such as Bluebird or Q) that
 * satisfy the full Promise-method contract.
 *
 * The leading `!!value` guard short-circuits on nullish input before
 * any property work, so neither branch runs for `null` or `undefined`.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm `Promise` instances on identity; the `doesMatchPromiseContract`
 * branch admits foreign-realm `Promise` instances on structure. No
 * value satisfying the `Promise.prototype` method contract is rejected
 * on realm membership alone.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & PromiseLike<unknown>`; `T = unknown` collapses to `PromiseLike<unknown>`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a _promise-like_ type
 * @returns `true` when the value is either a local-realm `Promise`
 *  (or subclass) or satisfies the `Promise.prototype` method contract,
 *  narrowing `value` to `T & PromiseLike<unknown>`; `false` otherwise
 * @example
 * isPromiseLike(Promise.resolve());                                      // true (instanceof)
 * isPromiseLike({ then: () => {} });                                     // false (no `catch`/`finally`)
 * isPromiseLike({ then: () => {}, catch: () => {}, finally: () => {} }); // true (structural)
 * isPromiseLike(null);                                                   // false
 */
export function isPromiseLike<T = unknown>(value?: T): value is T & PromiseLike<unknown>;

/**
 * Narrows a value to `Promise<unknown>` via three cross-validating
 * structural markers: the `Promise.prototype` method contract (per
 * {@link isPromiseLike}), the `[[Class]]` tag `'Promise'`, and the
 * constructor name `'Promise'` resolved through the package's
 * constructor walk.
 *
 * Short-circuit `&&` runs the markers in fixed order — `isPromiseLike`
 * gates the tag read, the tag read gates the constructor walk. Each
 * marker is independent and rules out a distinct false-positive class:
 * the `isPromiseLike` gate rejects values that claim Promise identity
 * without satisfying the method contract (e.g., a `Symbol.toStringTag`-
 * tagged object with no `catch` or `finally`); the constructor-name
 * marker rejects values that look right structurally and via tag but
 * whose actual constructor is something other than `Promise`, closing
 * the `Symbol.toStringTag`-spoofing hole the tag check alone would
 * leave open. The common case (native `Promise` in the current realm)
 * settles cheaply on the `instanceof PromiseConstructor` fast path
 * inside `isPromiseLike`.
 *
 * Cross-realm safe. The realm-fixed `instanceof` fast path inside
 * `isPromiseLike` admits local-realm `Promise` instances on identity;
 * its structural fallback (`doesMatchPromiseContract`) admits foreign-realm
 * `Promise` instances on contract. The tag-read and the constructor-walk
 * both work realm-independently. No legitimate `Promise` is rejected
 * on realm membership alone.
 *
 * `Promise` subclasses are rejected. A value of
 * `class MyPromise extends Promise {}` resolves its constructor name
 * to `'MyPromise'`, which fails the equality check against `'Promise'`.
 * This is a deliberate strictness — consumers needing subclass
 * admission should compose with a constructor-chain walk on top of
 * this predicate.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & Promise<unknown>`; `T = unknown` collapses to `Promise<unknown>`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a `Promise`
 * @returns `true` when the value satisfies all three markers, narrowing
 *  `value` to `T & Promise<unknown>`; `false` otherwise
 * @example
 * isPromise(Promise.resolve());                                   // true
 * isPromise({ then: () => {} });                                  // false
 * isPromise({ [Symbol.toStringTag]: 'Promise', then: () => {} }); // false (spoof)
 * isPromise(42);                                                  // false
 */
export function isPromise<T = unknown>(value?: T): value is T & Promise<unknown>;
