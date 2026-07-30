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

import type { AbortError } from '#error';

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
 * This is the contract which native `Promise` instances and their subclasses
 * naturally satisfy, and the contract custom Promise-like implementations
 * need to match to be safely usable in code that calls the full chaining
 * API.
 *
 * `PromiseLike<T>` sits strictly between `Thenable<T>` (only `then`)
 * and `Promise<T>` (the realm-fixed intrinsic identified by `[[Class]]`
 * tag and constructor-name). It is the right narrowing target for
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
 * - `#error` ships {@link AbortError} (and `AbortErrorName`) for the
 *   rejected-value side — the error type the `onaborted` callback
 *   receives.
 * - `#evented` ships `AbortSignalLike` and `isAbortSignalLike` for the
 *   producer side — the structural contract of values that emit abort
 *   signals (`AbortSignal`, `AbortController.signal`, userland abortable
 *   producers).
 * - `#thenable` ships `AbortableThenable<T>` (this interface) — the
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
//  Promise Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Whether `value` leaves the inherited `Promise` surface unshadowed at its own
 * level: it owns no property whose name is in the reserved denylist (the
 * `constructor` back-reference plus the `then`/`catch`/`finally` method
 * contract). This is the own-surface integrity gate that the strict local
 * {@link isPromise} fast path ANDs onto its `prototype === Promise.prototype`
 * identity check (decision #063).
 *
 * A genuine direct `Promise` instance inherits its whole method contract and its
 * `constructor` link from `Promise.prototype`, owning none of it (its state lives
 * in internal slots). An own-shadowed contract member is an instance-level
 * override that demotes the value from `is` to merely `PromiseLike` — the #028
 * subclass rejection applied to the own layer. `Symbol.toStringTag` is
 * deliberately not guarded (cosmetic once prototype-identity holds), and
 * orthogonal own state never disqualifies: only the reserved member names do.
 *
 * Weaker than a structural seal by design (decision #052): `Promise` exposes no
 * inert slot-reader, so the bare graft `Object.create(Promise.prototype)` cannot
 * be caught and stays admitted; this gate closes the own-level override only.
 *
 * Throw-safe and fail-closed: a throwing own-key enumeration collapses to `false`
 * (a clean own surface cannot be confirmed → treat as shadowed).
 *
 * @param value - the direct-instance candidate whose OWN property names are
 *  enumerated; assumed by the caller to carry `Promise.prototype` as its
 *  `[[Prototype]]`
 * @returns `true` when no own property name shadows a reserved member; `false`
 *  when one does, or when the own-key enumeration throws
 * @internal
 */
export function doesNotShadowPromiseContract(value: object): boolean;

/* @@throw-safe */
/**
 * Verifies that the value matches the `Promise.prototype` method
 * contract — callable `then`, `catch`, and `finally` data properties
 * reachable through the value's prototype-chain.
 *
 * Composes three `hasInertMethod` checks for the methods defined on
 * `Promise.prototype` by ECMA-262 §27.2. Short-circuit `&&` enforces
 * an inner cost ordering: `then` (the spec-defined adoption hook) runs
 * first, `catch` second, and `finally` last.
 *
 * Used as the structural fallback inside {@link isPromiseLike} when the
 * realm-fixed `instanceof PromiseConstructor` fast-path fails — for
 * example, on cross-realm `Promise` instances or userland Promise-like
 * implementations such as Bluebird or Q.
 *
 * Does not require `Symbol.toStringTag === 'Promise'` or a particular
 * constructor-name; that level of identity narrowing belongs to
 * `isPromise`. `doesImplementPromiseContract` is purely structural.
 *
 * @param value - the value to inspect; omitted is treated as
 * `undefined`, which does not match the Promise-method contract
 * @returns `true` when all three methods are callable data
 *  properties in the value's prototype-chain; `false` otherwise
 * @example
 * doesImplementPromiseContract(Promise.resolve());  // true (inherited from prototype)
 * doesImplementPromiseContract({ then: () => {} }); // false (no `catch` or `finally`)
 * doesImplementPromiseContract(42);                 // false
 * @internal
 */
export function doesImplementPromiseContract(value: unknown): boolean;

/* @@throw-safe */
/**
 * The member-surface marker of the cross-realm `Promise` contract: confirms
 * that `prototype` carries `then`, `catch`, and `finally` as its own callable
 * data properties (ECMA-262 §27.2).
 *
 * This is the prototype-side counterpart to {@link doesImplementPromiseContract}.
 * That helper walks the value's chain for the lenient {@link isPromiseLike}; this
 * one reads the prototype's own descriptors for the strict cross-realm anchor,
 * inspecting what `Promise.prototype` itself implements, never what it inherits.
 *
 * Tests each member's `.value` for callability, so an accessor-form member
 * (`get then()`) yields `undefined` and fails — closing the lying-accessor
 * surface.
 *
 * Throw-safe: a hostile `ownKeys` / `getOwnPropertyDescriptor` Proxy-trap that
 * throws is absorbed and yields `false` rather than propagating.
 *
 * @param prototype - the prototype whose own member surface to verify (callers
 *  pass an already-resolved `[[Prototype]]`); a nullish or non-object value is
 *  absorbed by the guard and yields `false`
 * @returns `true` when all three members are own callable data properties;
 *  `false` otherwise (including on a throwing trap)
 * @internal
 */
export function doesImplementPromisePrototypeContract(prototype: unknown): boolean;

/* @@throw-safe */
/**
 * Verifies the structural anchor for cross-realm `Promise` discrimination over a
 * value's already-resolved `[[Prototype]]` — a four-marker chain, short-circuited
 * in cost-order:
 *
 * 1. `isClass(constructor)` — the constructor resolved from the prototype is a
 *    built-in or `class`-syntax newable (rejects non-function pointers).
 * 2. `getTypeSignature(prototype) === '[object Promise]'` — the prototype's own
 *    `[[Class]]` tag matches.
 * 3. The constructor's own `prototype` data property points back to the threaded
 *    `prototype` — round-trip identity, read via a throw-safe descriptor read
 *    (an accessor-form definition yields `undefined` and fails, closing the
 *    lying-accessor spoof).
 * 4. {@link doesImplementPromisePrototypeContract} — the prototype carries the
 *    `then`/`catch`/`finally` contract as its own callable members.
 *
 * Unlike the object-module counterpart `isObjectPrototypeEquivalent`, there is no
 * chain-depth marker: `Promise.prototype`'s `[[Prototype]]` is `Object.prototype`,
 * not `null`, so a top-level check would wrongly reject every genuine
 * `Promise.prototype`. The value's constructor-name identity is verified
 * separately by the caller `isAlienRealmPromise` via
 * `hasPromiseIdentitySignal`.
 *
 * Throw-safe end to end: each read absorbs a hostile Proxy-trap, failing the
 * contract rather than propagating; `isClass` is likewise throw-safe at its own
 * descriptor read.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded in by
 *  the caller that read it first (decision #059)
 * @param constructor - the constructor resolved from `prototype`, threaded in by
 *  the caller; a falsy value fails `isClass`
 * @returns `true` when all four markers hold; `false` otherwise
 * @internal
 */
export function isPromisePrototypeEquivalent(
  prototype: unknown,
  constructor: unknown,
): boolean;

/* @@throw-safe */
/**
 * Whether the value carries both of `Promise`'s string-shape identity
 * markers — the `[[Class]]` tag `'Promise'` and the resolved constructor-name
 * `'Promise'`. The name is threaded in by the caller (which resolves the
 * constructor once); this helper does no constructor resolution of its own.
 *
 * @param value - the value whose promise-shape tag to probe
 * @param name - the value's already-resolved constructor name, matched against
 *  `'Promise'`
 * @returns `true` when both string-shape markers match `Promise`'s
 *  signature; `false` otherwise
 * @internal
 */
export function hasPromiseIdentitySignal(
  value: unknown,
  name: string | undefined,
): boolean;

/* @@throw-safe */
/**
 * The cross-realm `Promise` fallback, composed: the inexpensive
 * `hasPromiseIdentitySignal` front-gate (the value's `[[Class]]` tag and
 * resolved constructor-name) AND the load-bearing
 * `isPromisePrototypeEquivalent` structural contract. A foreign-realm
 * `Promise` fails the local-realm `instanceof` + `=== Promise.prototype`
 * fast-path but matches this structural contract in every realm.
 *
 * This is the single seam {@link isPromise} takes on its cross-realm branch, the
 * direct parallel to the object module's `isAlienRealmPlainObject`. It resolves
 * the constructor once from the threaded prototype, then threads that
 * constructor's name into the signal gate — exactly as the object seam does
 * (decision #059). The `assumePrototype: true` hint reads the prototype's own
 * `constructor` descriptor (the spec-mandated source, ECMA-262 §10.2.6). Exported
 * `@internal` for direct unit-testability (decision #053).
 *
 * @param value - the candidate whose cross-realm `Promise` structure and identity
 *  are to be verified; assumed to be an object provided by the caller
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded in by
 *  the caller that read it first (decision #059)
 * @returns `true` when the signal gate and the structural contract both hold;
 *  `false` otherwise
 * @internal
 */
export function isAlienRealmPromise(value: object, prototype: object): boolean;

/* @@throw-safe */
/**
 * Whether `value` is an instance of the realm-fixed `Promise` intrinsic captured
 * at module load, or of any subclass.
 *
 * When the runtime has no global `Promise` (pre-Node-15, special embeddings), the
 * captured constructor is a never-instantiated sentinel against which
 * `instanceof` is always `false` without throwing, so the check runs unguarded.
 *
 * This is the realm-membership building block the thenable predicates share. It
 * narrows nothing on prototype identity, so strict {@link isPromise} adds its own
 * checks on top, while the lenient {@link isThenable} and {@link isPromiseLike}
 * use it directly as their fast-path arm. It assumes a truthy `value`; each
 * public predicate applies its nullish guard first.
 *
 * Throw-safe: `instanceof` walks the value's `[[Prototype]]` chain, so a Proxy
 * whose `getPrototypeOf` trap throws would otherwise propagate. The check is
 * wrapped to yield `false` instead — a realm-membership probe must answer, not
 * raise (decision #029 trust boundary, extended to the `instanceof` read).
 *
 * Generic in `T` per the family-pattern, narrowing exactly as
 * {@link isPromiseLike}. The narrow returns `T & PromiseLike<unknown>`;
 * `T = unknown` collapses to `PromiseLike<unknown>`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; assumed truthy by the caller
 * @returns `true` when a `Promise` intrinsic was captured and `value instanceof`
 *  it holds, narrowing `value` to `T & PromiseLike<unknown>`; `false` otherwise
 *  (including when a hostile `getPrototypeOf` trap throws)
 * @internal
 */
export function isCurrentRealmPromiseInstance<T = unknown>(
  value: T,
): value is T & PromiseLike<unknown>;

/* @@throw-safe */
/**
 * Narrows a value to `PromiseLike<unknown>` via either local-realm
 * `Promise` identity or the structural `Promise.prototype` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof PromiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
 * If that fails, falls back to `doesImplementPromiseContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `Promise` instances (produced in iframes, workers, vm contexts) and
 * userland _promise-like_ implementations (such as Bluebird or Q) that
 * satisfy the full Promise-method contract.
 *
 * The leading `!!value` guard short-circuits on nullish input before
 * any property work, so neither branch runs for `null` or `undefined`.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm `Promise` instances on identity; the `doesImplementPromiseContract`
 * branch admits foreign-realm `Promise` instances on structure. No
 * value satisfying the `Promise.prototype` method contract is rejected
 * on realm membership alone.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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

/* @@throw-safe */
/**
 * Narrows a value to `Promise<unknown>` via a two-branch identity check.
 *
 * The local-realm fast-path pairs `value instanceof PromiseConstructor`
 * with `prototype === promisePrototype`, where `prototype` is the
 * once-resolved throw-safe `getSafePrototypeOf(value)` read threaded
 * into both arms. The pair admits only direct `Promise` instances;
 * subclasses pass `instanceof` but fail the prototype identity-check,
 * preserving subclass rejection in two O(1) operations. Both captures
 * are realm-fixed at module-load.
 *
 * On miss, falls back to the cross-realm structural seam
 * `isAlienRealmPromise`: the `hasPromiseIdentitySignal` front-gate
 * (the `[[Class]]` tag `'Promise'` and the constructor-name `'Promise'` resolved
 * once from the threaded prototype) AND the `isPromisePrototypeEquivalent`
 * anchor (the constructor is a newable class, the prototype's own tag is
 * `'Promise'`, its constructor round-trips back to it, and it carries the
 * `then`/`catch`/`finally` contract as own members). Every marker reads
 * realm-independently, so foreign-realm `Promise` instances are admitted, while
 * the round-trip and member-surface markers close the tag / constructor-name
 * spoof. This cross-realm branch runs only when the realm captured a real
 * `Promise` at module-load; without a global `Promise` the branch is skipped
 * and the value yields `false`.
 *
 * Cross-realm safe. The local-realm pair admits only direct local-realm
 * `Promise` instances; the structural fallback admits foreign-realm
 * `Promise` instances on contract (the tag-read and constructor-walk
 * both work realm-independently). No legitimate `Promise` is rejected
 * on realm membership alone.
 *
 * `Promise` subclasses are rejected on both branches — by the
 * prototype identity-check on the local-realm path, by the
 * constructor-name equality on the structural path. A value of
 * `class MyPromise extends Promise {}` resolves its constructor-name to
 * `'MyPromise'`, which fails the cross-realm constructor-name equality.
 * Consumers needing subclass admission should compose with a
 * constructor-chain walk on top of this predicate.
 *
 * The local-realm pair is further gated by `doesNotShadowPromiseContract`:
 * a value that overrides an inherited contract method (or the `constructor`) at
 * its OWN level — `Object.create(Promise.prototype, { then })` — is an
 * instance-level subclass layer, demoted to merely `PromiseLike` (decision #063).
 * The bare graft `Object.create(Promise.prototype)` stays admitted: `Promise`
 * exposes no inert slot-reader, so a hollow direct-prototype value cannot be
 * caught (decision #052).
 *
 * Strict identity narrows to the concrete `Promise` intrinsic. Unlike the
 * subclass-admitting `isPromiseLike` / `isThenable`, it is intentionally
 * non-generic (decision #062): every admitted value IS exactly a `Promise`, with
 * no caller-side type to preserve.
 *
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a `Promise`
 * @returns `true` when the local-realm identity pair (with own-surface
 *  integrity) or the cross-realm structural chain holds; `false` otherwise
 * @example
 * isPromise(Promise.resolve());                                   // true (instanceof + proto)
 * isPromise(Object.create(Promise.prototype));                    // true (bare graft, #052)
 * isPromise(Object.assign(Object.create(Promise.prototype), { then() {} })); // false (own-shadow, #063)
 * isPromise({ [Symbol.toStringTag]: 'Promise', then: () => {} }); // false (spoof)
 * isPromise(42);                                                  // false
 */
export function isPromise(value?: unknown): value is Promise<unknown>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Sole Thenable Predicate
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to `Thenable<unknown>` by verifying that `then` is a
 * callable data property reachable through the value's prototype-chain.
 *
 * Tests in cost-order: the inexpensive `instanceof PromiseConstructor`
 * check against the realm-fixed `Promise` capture catches local-realm
 * `Promise` instances and their subclasses in a single prototype walk.
 * The admission is sound because every `Promise` is a _thenable_ —
 * `then` lives on `Promise.prototype`. The implication does not run
 * the other way (not every _thenable_ is a `Promise`), so the
 * `instanceof` arm is a sufficient short-circuit, not a definition.
 *
 * If `instanceof` fails (cross-realm `Promise`, userland _thenable_,
 * or any non-`Promise` candidate), falls back to a chain-walk via
 * own-descriptor reads at each level, matching how ECMA-262
 * `Get(value, "then")` resolves the property during `Promise`
 * adoption. A `then` found anywhere along the chain — own or
 * inherited — satisfies the predicate.
 *
 * Verifies callability only — it does not validate the `then` signature
 * shape or whether the value honors the `resolve`/`reject` protocol.
 * Accessor descriptors are deliberately rejected on the structural arm:
 * the predicate's contract is to inspect without invoking, so a
 * `get then()` shape is treated as "not a _thenable_ type" even if this
 * very getter returns a callable type.
 *
 * Generic in `T` per the family-pattern set by `isCallable` and
 * `isFunction` in `#function`. The narrow returns `T & Thenable<unknown>`;
 * `T = unknown` collapses to `Thenable<unknown>`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a _thenable_ type
 * @returns `true` when the value is either a local-realm `Promise`
 *  (or subclass) or carries a callable `then` data property in its
 *  prototype-chain, narrowing `value` to `T & Thenable<unknown>`;
 *  `false` otherwise
 * @example
 * isThenable(Promise.resolve());                   // true (instanceof)
 * isThenable({ then: () => {} });                  // true (own)
 * isThenable({ then: 'not a function' });          // false
 * isThenable({ get then() { return () => {}; } }); // false (accessor)
 * isThenable(null);                                // false
 */
export function isThenable<T = unknown>(value?: T): value is T & Thenable<unknown>;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
