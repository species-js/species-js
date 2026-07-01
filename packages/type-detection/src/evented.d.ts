/**
 * @module @species-js/type-detection/evented
 *
 * `EventTarget` and `AbortSignal` value detection.
 *
 * Two structural lattices live in this module. The first centers on
 * {@link EventTargetLike} — the three-method contract specified by DOM
 * WHATWG `EventTarget` (`dispatchEvent`, `addEventListener`,
 * `removeEventListener`). {@link isEventTargetLike} narrows any value
 * to the contract via either local-realm identity or structural
 * inspection. {@link isEventTarget} layers tag and constructor-name
 * markers on top for direct-instance discrimination.
 *
 * The second extends the first: {@link AbortSignalLike} adds the
 * abort-state surface (`aborted` and `throwIfAborted`) on top of
 * {@link EventTargetLike}, capturing the minimum DOM WHATWG
 * `AbortSignal` contract. {@link isAbortSignalLike} and
 * {@link isAbortSignal} follow the same structural-then-identity
 * layering as their `EventTarget` counterparts.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  EventTarget
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `EventTarget` method contract — the three methods specified by
 * the DOM WHATWG `EventTarget` interface (`dispatchEvent`,
 * `addEventListener`, `removeEventListener`), captured as a structural
 * interface for duck-typing scenarios.
 *
 * A value satisfies `EventTargetLike` when it carries the three methods
 * as callable data properties reachable through its prototype-chain.
 * Native `EventTarget` instances and their subclasses (`Element`,
 * `Document`, `Window`, `XMLHttpRequest`, `AudioNode`, and others) all
 * satisfy the contract. Cross-realm instances also satisfy it because
 * each realm's `EventTarget` exposes the same three methods.
 *
 * `EventTargetLike` is the structural floor of the EventTarget lattice:
 * predicates narrowing to it admit any value with the right method
 * shape, without requiring identity equality with `%EventTarget%`.
 * {@link isEventTarget} is the stricter refinement that adds the
 * `[[Class]]` tag and constructor-name markers for direct-instance
 * discrimination.
 *
 * The method signatures mirror `lib.dom.d.ts` precisely, including the
 * `EventListenerOrEventListenerObject`, `AddEventListenerOptions`, and
 * `EventListenerOptions` DOM types.
 *
 * ## How this `EventTargetLike` relates to TypeScript's `EventTarget`
 *
 * TypeScript's `lib.dom.d.ts` declares a global `EventTarget` interface
 * with the same three method signatures. The two are structurally
 * compatible — any value satisfying `EventTargetLike` satisfies the
 * lib's `EventTarget` and vice versa. This package defines its own
 * `EventTargetLike` rather than re-exporting the global so:
 *
 * - The duck-typing intent is explicit at the type-name level;
 *   `isEventTargetLike` narrows to a "Like" name, signaling the
 *   structural-contract reading.
 * - The package's predicate target is a name the package owns, with no
 *   coupling to `lib.dom.d.ts` evolution.
 * - Runtimes lacking the DOM lib still get a usable contract type from
 *   this package alone.
 */
export interface EventTargetLike {
  /**
   * Dispatches an event to this target. Spec-defined as DOM WHATWG
   * `EventTarget.dispatchEvent`.
   *
   * @param event - the event to dispatch
   * @returns `false` if any listener canceled the event via
   *  `Event.preventDefault()`; `true` otherwise
   */
  dispatchEvent(event: Event): boolean;

  /**
   * Registers an event listener. Spec-defined as DOM WHATWG
   * `EventTarget.addEventListener`.
   *
   * @param type - the event type to listen for
   * @param listener - the callback or `EventListenerObject` to invoke
   *  when an event of `type` fires; `null` is accepted as a no-op
   * @param options - listener options or a `capture: boolean` shorthand
   */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void;

  /**
   * Removes a previously registered event listener. Spec-defined as
   * DOM WHATWG `EventTarget.removeEventListener`. The `type`,
   * `listener`, and the `capture` flag must match the original
   * registration.
   *
   * @param type - the event type to stop listening for
   * @param listener - the callback or `EventListenerObject` to remove;
   *  `null` is accepted as a no-op
   * @param options - listener options or a `capture: boolean` shorthand
   */
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortSignal
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `AbortSignal` method contract — `EventTargetLike` extended with
 * the abort-state surface specified by DOM WHATWG `AbortSignal`: a
 * read-only `aborted` boolean property and a `throwIfAborted` method.
 *
 * A value satisfies `AbortSignalLike` when it satisfies
 * {@link EventTargetLike} AND exposes `aborted` as a boolean AND
 * exposes `throwIfAborted` as a callable. This is the structural
 * shape that native `AbortSignal` instances and their producers
 * — like `AbortController.signal`, `AbortSignal.timeout()`, and
 * `AbortSignal.any()` — naturally satisfy, as well as userland
 * abort-signal implementations that mirror the same minimum
 * surface.
 *
 * `AbortSignalLike` sits strictly between `EventTargetLike` (any
 * EventTarget method contract) and `AbortSignal` (the realm-fixed
 * intrinsic identified by tag and constructor-name). It is the right
 * narrowing target for predicates that admit any value whose method
 * shape matches the abort-channel contract, without requiring identity
 * equality with `%AbortSignal%`.
 *
 * The contract is intentionally minimal: only the two abort-channel
 * members that are spec-required AND structurally testable without
 * invoking accessors. The full DOM `AbortSignal` carries additional
 * members — `reason`, `onabort`, the `AbortSignalEventMap` overloads
 * for `addEventListener` / `removeEventListener` — that are deliberately
 * omitted here. `reason: any` has no structural constraint to verify and
 * `onabort` is sugar over the base EventTarget contract that is already
 * validated. The typed-event-map overloads are TypeScript convenience,
 * not part of the runtime contract.
 *
 * ## Producer-side role in the cross-module abort-channel surface
 *
 * The thenable module's `AbortableThenable<T>` (extends `Thenable<T>`
 * with an `onaborted` callback typed against `AbortError`) is the
 * consumer-side abortable-thenable contract. This module's
 * `AbortSignalLike` and `isAbortSignalLike` are the producer-side
 * structural contract for values that emit abort signals — the inputs
 * a producer accepts to thread an abort channel through to a chained
 * `AbortableThenable.then.onaborted` callback.
 *
 * The full cross-module abort-channel surface is distributed across
 * three modules: `@/error` for the rejected-value side (`AbortError`),
 * `@/evented` for the producer side (this interface), and `@/thenable`
 * for the consumer-side abortable-thenable (`AbortableThenable<T>`).
 * Consumers building an abortable operation depend on all three.
 */
export interface AbortSignalLike extends EventTargetLike {
  /**
   * Whether the abort signal has fired. Spec-defined as DOM WHATWG
   * `AbortSignal.aborted`. Set to `true` when the associated
   * `AbortController.abort()` is called, an `AbortSignal.timeout()`
   * elapses, or any signal passed to `AbortSignal.any()` aborts.
   */
  readonly aborted: boolean;

  /**
   * Throws the signal's abort reason if `aborted` is `true`; no-op
   * otherwise. Spec-defined as DOM WHATWG `AbortSignal.throwIfAborted`.
   * Convenient for guarding the entry of an abortable operation.
   */
  throwIfAborted(): void;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Realm-Membership Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether `value` is an instance of the realm-fixed `EventTarget` intrinsic
 * captured at module load (or any subclass — `Element`, `Document`,
 * `Window`, `XMLHttpRequest`, …).
 *
 * The subclass-admitting realm-membership building block shared by the
 * EventTarget predicates — it carries no proto-identity narrowing, so the
 * strict {@link isEventTarget} layers that check on top while the lenient
 * {@link isEventTargetLike} uses it as its fast-path arm. Assumes a truthy
 * `value`; the public predicates apply the `!!value` guard before delegating.
 *
 * When the runtime lacks a global `EventTarget` (pre-Node-15 environments,
 * special embeddings), the captured constructor is a never-instantiated
 * sentinel against which `instanceof` is always `false` without throwing.
 * Throw-safe: a hostile `getPrototypeOf` Proxy-trap that throws during the
 * `instanceof` prototype-walk is absorbed, yielding `false`.
 *
 * @param value - the value to test; assumed to be at least truthy by the
 *  caller
 * @returns `true` when `value instanceof` the captured `EventTarget` holds;
 *  `false` otherwise (including on a throwing trap)
 * @internal
 */
export function isCurrentRealmEventTargetInstance(value: unknown): boolean;

/**
 * Whether `value` is an instance of the realm-fixed `AbortSignal` intrinsic
 * captured at module load (or any subclass).
 *
 * The subclass-admitting realm-membership building block shared by the
 * AbortSignal predicates — it carries no proto-identity narrowing, so the
 * strict {@link isAbortSignal} layers that check on top while the lenient
 * {@link isAbortSignalLike} uses it as its fast-path arm. Assumes a truthy
 * `value`; the public predicates apply the `!!value` guard before delegating.
 *
 * When the runtime lacks a global `AbortSignal` (pre-Node-15 environments,
 * special embeddings), the captured constructor is a never-instantiated
 * sentinel against which `instanceof` is always `false` without throwing.
 * Throw-safe: a hostile `getPrototypeOf` Proxy-trap that throws during the
 * `instanceof` prototype-walk is absorbed, yielding `false`.
 *
 * @param value - the value to test; assumed to be at least truthy by the
 *  caller
 * @returns `true` when `value instanceof` the captured `AbortSignal` holds;
 *  `false` otherwise (including on a throwing trap)
 * @internal
 */
export function isCurrentRealmAbortSignalInstance(value: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  EventTarget Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The two inexpensive string-shape markers of a direct `EventTarget` — the
 * caller-threaded constructor `name` equal to `'EventTarget'` and the
 * `[[Class]]` tag `'[object EventTarget]'`. The inexpensive front-gate of
 * the cross-realm {@link isEventTarget} arm: if either marker fails, the
 * costlier prototype-contract walk is skipped.
 *
 * @param value - the value whose `[[Class]]` tag to read; assumed to be an
 *  object provided by the caller
 * @param name - the value's already-resolved constructor name, threaded in
 *  by the caller
 * @returns `true` when both string-shape markers match `EventTarget`'s
 *  signature; `false` otherwise
 * @internal
 */
export function hasEventTargetIdentitySignal(
  value: object,
  name: string | undefined,
): boolean;

/**
 * Verifies that the value matches the `EventTarget` method contract —
 * callable `dispatchEvent`, `addEventListener`, and `removeEventListener`
 * data properties reachable through the value's prototype-chain.
 *
 * Composes three `hasInertMethod` checks for the methods specified by
 * DOM WHATWG `EventTarget`. Short-circuit `&&` enforces an inner cost
 * ordering: `dispatchEvent` (the spec-defined emission hook) runs first,
 * `addEventListener` second, `removeEventListener` last.
 *
 * Used as the structural fallback inside `isEventTargetLike` when the
 * realm-fixed `instanceof EventTargetConstructor` fast-path fails — for
 * example, on cross-realm `EventTarget` instances or userland
 * event-emitter implementations that mirror the EventTarget method
 * surface. This is the duck-typed (prototype-chain-walking) Like-tier
 * contract; the strict {@link isEventTarget} uses the own-descriptor
 * {@link doesImplementEventTargetPrototypeContract} instead.
 *
 * Does not require `Symbol.toStringTag === 'EventTarget'` or a
 * particular constructor-name. That level of identity narrowing belongs
 * to `isEventTarget`. `doesImplementEventTargetContract` is purely
 * structural.
 *
 * Scoped to exactly these three canonical WHATWG methods — the
 * Observable-proposal `EventTarget.prototype.when()` is deliberately NOT
 * required. Requiring it would falsely reject `EventTarget`s from
 * pre-Observable runtimes and foreign realms; and this presence-check already
 * admits a `when`-bearing value, so nothing is lost by omitting it (#028).
 *
 * @param value - the value to inspect; assumed to be at least truthy by
 *  the caller
 * @returns `true` when all three methods are callable data properties
 *  in the value's prototype-chain; `false` otherwise
 * @example
 * doesImplementEventTargetContract(new EventTarget()); // true (inherited)
 * doesImplementEventTargetContract(document);          // true (subclass methods inherited)
 * doesImplementEventTargetContract({});                // false
 * doesImplementEventTargetContract(42);                // false
 * @internal
 */
export function doesImplementEventTargetContract(value: unknown): boolean;

/**
 * Whether `prototype` carries `EventTarget.prototype`'s own member surface —
 * the three DOM WHATWG methods `dispatchEvent`, `addEventListener`, and
 * `removeEventListener` as own callable data properties. The strict-tier
 * counterpart of the duck-typed {@link doesImplementEventTargetContract}: it
 * reads the already-resolved `[[Prototype]]`'s own descriptors rather than
 * walking the value's prototype-chain, because the strict
 * {@link isEventTarget} admits only direct instances whose `[[Prototype]]`
 * IS the realm's `EventTarget.prototype`. Unlike its AbortSignal sibling,
 * the EventTarget prototype carries no spec-defined state accessor, so no
 * receiver is threaded. Throw-safe.
 *
 * A presence-check of exactly these three, not an exact member set: a
 * `when`-bearing `EventTarget.prototype` (the Observable proposal) still
 * passes. `when()` is deliberately NOT required — requiring it would falsely
 * reject prototypes from pre-Observable runtimes and realms (#028).
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first
 * @returns `true` when all three methods are own callable data properties of
 *  `prototype`; `false` otherwise
 * @internal
 */
export function doesImplementEventTargetPrototypeContract(prototype: object): boolean;

/**
 * Whether `prototype` is structurally equivalent to the realm's
 * `EventTarget.prototype` — a four-marker chain: `constructor` is a class,
 * the prototype's `[[Class]]` tag is `'[object EventTarget]'`, the
 * constructor's own `prototype` round-trips back to `prototype`, and
 * `prototype` carries the EventTarget method surface
 * ({@link doesImplementEventTargetPrototypeContract}). The cross-realm
 * identity core of {@link isEventTarget}, run on the already-resolved
 * `[[Prototype]]` / `[[Constructor]]` pair.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first
 * @param constructor - the value's already-resolved `[[Constructor]]`,
 *  threaded in by the caller
 * @returns `true` when all four markers hold; `false` otherwise
 * @internal
 */
export function isEventTargetPrototypeEquivalent(
  prototype: object,
  constructor: import('@/function').NewableFunction | undefined,
): boolean;

/**
 * The cross-realm `EventTarget` identity arm, composed: the inexpensive
 * {@link hasEventTargetIdentitySignal} front-gate (tag + constructor-name)
 * AND the load-bearing {@link isEventTargetPrototypeEquivalent} structural
 * contract. Resolves the constructor from the threaded `[[Prototype]]` once
 * and feeds its verified own `name` into the signal gate.
 *
 * @param value - the value to test; assumed to be an object provided by the
 *  caller
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first
 * @returns `true` when the signal gate and the structural contract both
 *  hold; `false` otherwise
 * @internal
 */
export function isAlienRealmEventTarget(value: object, prototype: object): boolean;

/**
 * Narrows a value to `EventTargetLike` via either local-realm
 * `EventTarget` identity or the structural `EventTarget` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof EventTargetConstructor`
 * check against the realm-fixed `EventTarget` capture catches
 * local-realm `EventTarget` instances and their subclasses (`Element`,
 * `Document`, `Window`, and so on) in a single prototype-walk. If that
 * fails, falls back to `doesImplementEventTargetContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `EventTarget` instances and userland event-emitter implementations
 * that mirror the full method contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract. When the runtime lacks a global
 * `EventTarget` (pre-Node-15 environments, special embeddings), the
 * realm-fixed capture is a never-instantiated sentinel against which
 * `instanceof` is always `false`, so only the structural check fires.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & EventTargetLike`; `T = unknown` collapses to `EventTargetLike`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an _event-target-like_ type
 * @returns `true` when the value is either a local-realm `EventTarget`
 *  (or subclass) or satisfies the EventTarget method contract,
 *  narrowing `value` to `T & EventTargetLike`; `false` otherwise
 * @example
 * isEventTargetLike(new EventTarget()); // true (instanceof)
 * isEventTargetLike(document);          // true (subclass)
 * isEventTargetLike({
 *   dispatchEvent: () => true,
 *   addEventListener: () => {},
 *   removeEventListener: () => {},
 * });                                   // true (structural)
 * isEventTargetLike({});                // false
 * isEventTargetLike(null);              // false
 */
export function isEventTargetLike<T = unknown>(value?: T): value is T & EventTargetLike;

/**
 * Narrows a value to `EventTarget` via a two-axis identity dispatch.
 *
 * The prototype is resolved ONCE and threaded into the cross-realm arm. The
 * leading `!!prototype` short-circuit rejects nullish and other falsy values,
 * and absorbs a hostile `getPrototypeOf`-trap (collapsed to `undefined` by
 * the inert read) before any further read.
 *
 * The local-realm fast-path pairs `isCurrentRealmEventTargetInstance(value)`
 * with `prototype === eventTargetPrototype`. The pair admits only direct
 * `EventTarget` instances; subclasses (`Element`, `Document`, `Window`,
 * `XMLHttpRequest`, …) pass `instanceof` but fail the prototype identity-check
 * in O(1). On miss, the cross-realm arm runs {@link isAlienRealmEventTarget} —
 * the tag + constructor-name signal gate plus the prototype-contract walk —
 * but only when the realm actually has a global `EventTarget`.
 *
 * `EventTarget` subclasses are rejected on both arms — by prototype identity
 * locally, by constructor-name equality cross-realm. `Element`, `Document`,
 * `Window`, `XMLHttpRequest`, and other DOM types that extend `EventTarget`
 * resolve their constructor-name to their own class, which fails the
 * cross-realm constructor-name equality. This is a deliberate strictness;
 * consumers needing subclass admission compose with {@link isEventTargetLike}.
 *
 * Strict identity narrows to the concrete `EventTarget` intrinsic, so — unlike
 * the subclass-admitting `*Like` predicates — it is intentionally non-generic:
 * every admitted value IS exactly an `EventTarget`, with no caller-side type
 * to preserve.
 *
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an `EventTarget`
 * @returns `true` when either the local-realm identity pair or the
 *  cross-realm structural chain holds; `false` otherwise
 * @example
 * isEventTarget(new EventTarget());                       // true (instanceof + proto)
 * isEventTarget(document);                                // false (subclass)
 * isEventTarget({ [Symbol.toStringTag]: 'EventTarget' }); // false (spoof — no methods)
 * isEventTarget(null);                                    // false
 */
export function isEventTarget(value?: unknown): value is EventTarget;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortSignal Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The two inexpensive string-shape markers of a direct `AbortSignal` — the
 * caller-threaded constructor `name` equal to `'AbortSignal'` and the
 * `[[Class]]` tag `'[object AbortSignal]'`. The inexpensive front-gate of
 * the cross-realm {@link isAbortSignal} arm: if either marker fails, the
 * costlier prototype-contract walk is skipped.
 *
 * @param value - the value whose `[[Class]]` tag to read; assumed to be an
 *  object provided by the caller
 * @param name - the value's already-resolved constructor name, threaded in
 *  by the caller
 * @returns `true` when both string-shape markers match `AbortSignal`'s
 *  signature; `false` otherwise
 * @internal
 */
export function hasAbortSignalIdentitySignal(
  value: object,
  name: string | undefined,
): boolean;

/**
 * Verifies that the value matches the `AbortSignal` method contract —
 * `EventTargetLike` plus a boolean `aborted` and a callable
 * `throwIfAborted`.
 *
 * Composes two abort-specific markers with `doesImplementEventTargetContract`.
 * Short-circuit `&&` orders the checks for both nullish-safety and
 * discrimination cost: `hasInertMethod(value, 'throwIfAborted')` runs
 * first as a nullish-safe leading gate — its descriptor-walk via the
 * parameter-default-to-`null` pattern returns `false` for any nullish
 * input without touching the property surface. The direct `aborted`
 * value-read runs after, by which point `value` is guaranteed non-nullish.
 * The three-descriptor-walk `doesImplementEventTargetContract` runs last as
 * the heaviest discriminator and the structural baseline.
 *
 * The `aborted` check uses `isBooleanValue(value.aborted)` and invokes
 * the spec-defined accessor directly (decision #029), wrapped in
 * `try`/`catch` so a throwing userland getter reduces to `false`. This is
 * the duck-typed Like-tier contract: it reads the `aborted` VALUE in any
 * descriptor shape — a plain data boolean is admitted — deliberately NOT
 * requiring the native readonly-accessor shape. That spec-faithful
 * prototype check belongs to the identity tier
 * ({@link doesImplementAbortSignalPrototypeContract}). See decision #030.
 *
 * The `throwIfAborted` check uses `hasInertMethod` for the standard
 * inspect-without-invoke contract — `throwIfAborted` is a data-property
 * method on `AbortSignal.prototype`, so the descriptor-walk pattern
 * applies without spec friction.
 *
 * Used as the structural fallback inside `isAbortSignalLike` when the
 * realm-fixed `instanceof AbortSignalConstructor` fast-path fails — for
 * example, on cross-realm `AbortSignal` instances or userland
 * abort-signal implementations.
 *
 * @param value - the value to inspect; assumed to be at least truthy by
 *  the caller
 * @returns `true` when the value satisfies the EventTarget contract,
 *  has a boolean `aborted` property, and has a callable
 *  `throwIfAborted`; `false` otherwise (including when the `aborted`
 *  getter throws)
 * @example
 * doesImplementAbortSignalContract(new AbortController().signal); // true
 * doesImplementAbortSignalContract(AbortSignal.timeout(1000));    // true
 * doesImplementAbortSignalContract(new EventTarget());            // false (no abort surface)
 * doesImplementAbortSignalContract({});                           // false
 * @internal
 */
export function doesImplementAbortSignalContract(value: unknown): boolean;

/**
 * Whether `prototype` carries `AbortSignal.prototype`'s own member surface —
 * the spec-defined accessors and method of DOM WHATWG `AbortSignal`:
 * `aborted` (a boolean getter with no setter), `reason` (a getter, no
 * setter), `onabort` (a getter/setter accessor pair), and `throwIfAborted`
 * (a callable). The strict-tier counterpart of the duck-typed
 * {@link doesImplementAbortSignalContract}: it reads the already-resolved
 * `[[Prototype]]`'s own descriptors and invokes the `aborted` getter with
 * the real receiver `value` to confirm a boolean result — the spec-defined
 * direct read (decision #029). Throw-safe.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first
 * @param value - the root value, threaded as the receiver for the
 *  spec-defined `aborted` getter invocation
 * @returns `true` when the full accessor/method surface is present in the
 *  spec-defined shape; `false` otherwise
 * @internal
 */
export function doesImplementAbortSignalPrototypeContract(
  prototype: object,
  value: object,
): boolean;

/**
 * Whether `prototype` is structurally equivalent to the realm's
 * `AbortSignal.prototype` — a four-marker chain: `constructor` is a class,
 * the prototype's `[[Class]]` tag is `'[object AbortSignal]'`, the
 * constructor's own `prototype` round-trips back to `prototype`, and
 * `prototype` carries the AbortSignal accessor/method surface
 * ({@link doesImplementAbortSignalPrototypeContract}). The cross-realm
 * identity core of {@link isAbortSignal}, run on the already-resolved
 * `[[Prototype]]` / `[[Constructor]]` pair.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first
 * @param constructor - the value's already-resolved `[[Constructor]]`,
 *  threaded in by the caller
 * @param value - the root value, threaded as the receiver for the
 *  spec-defined `aborted` getter invocation
 * @returns `true` when all four markers hold; `false` otherwise
 * @internal
 */
export function isAbortSignalPrototypeEquivalent(
  prototype: object,
  constructor: import('@/function').NewableFunction | undefined,
  value: object,
): boolean;

/**
 * The cross-realm `AbortSignal` identity arm, composed: the inexpensive
 * {@link hasAbortSignalIdentitySignal} front-gate (tag + constructor-name)
 * AND the load-bearing {@link isAbortSignalPrototypeEquivalent} structural
 * contract. Resolves the constructor from the threaded `[[Prototype]]` once
 * and feeds its verified own `name` into the signal gate.
 *
 * @param value - the value to test; assumed to be an object provided by the
 *  caller
 * @param prototype - the value's already-resolved `[[Prototype]]`, threaded
 *  in by the caller that read it first
 * @returns `true` when the signal gate and the structural contract both
 *  hold; `false` otherwise
 * @internal
 */
export function isAlienRealmAbortSignal(value: object, prototype: object): boolean;

/**
 * Narrows a value to `AbortSignalLike` via either local-realm
 * `AbortSignal` identity or the structural `AbortSignal` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof AbortSignalConstructor`
 * check against the realm-fixed `AbortSignal` capture catches
 * local-realm instances in a single prototype-walk. If that fails,
 * falls back to `doesImplementAbortSignalContract` for the structural
 * check — which catches cross-realm `AbortSignal` instances and
 * userland abort-signal implementations that mirror the minimum
 * contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract. When the runtime lacks a global
 * `AbortSignal` (pre-Node-15 environments, special embeddings), the
 * realm-fixed capture is a never-instantiated sentinel against which
 * `instanceof` is always `false`, so only the structural check fires.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AbortSignalLike`; `T = unknown` collapses to `AbortSignalLike`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an _abort-signal-like_ type
 * @returns `true` when the value is either a local-realm `AbortSignal`
 *  or satisfies the AbortSignal method contract, narrowing `value` to
 *  `T & AbortSignalLike`; `false` otherwise
 * @example
 * isAbortSignalLike(new AbortController().signal); // true (instanceof)
 * isAbortSignalLike(AbortSignal.timeout(1000));    // true (instanceof)
 * isAbortSignalLike(new EventTarget());            // false (no abort surface)
 * isAbortSignalLike(null);                         // false
 */
export function isAbortSignalLike<T = unknown>(value?: T): value is T & AbortSignalLike;

/**
 * Narrows a value to `AbortSignal` via a two-axis identity dispatch.
 *
 * The prototype is resolved ONCE and threaded into the cross-realm arm. The
 * leading `!!prototype` short-circuit rejects nullish and other falsy values,
 * and absorbs a hostile `getPrototypeOf`-trap (collapsed to `undefined` by
 * the inert read) before any further read.
 *
 * The local-realm fast-path pairs `isCurrentRealmAbortSignalInstance(value)`
 * with `prototype === abortSignalPrototype`. The pair admits only direct
 * `AbortSignal` instances; subclasses pass `instanceof` but fail the prototype
 * identity-check in O(1). On miss, the cross-realm arm runs
 * {@link isAlienRealmAbortSignal} — the tag + constructor-name signal gate
 * plus the prototype-contract walk — but only when the realm actually has a
 * global `AbortSignal`.
 *
 * `AbortSignal` subclasses are rejected on both arms — by prototype identity
 * locally, by constructor-name equality cross-realm. Consistent with
 * {@link isEventTarget} and `isPromise`. Consumers needing subclass admission
 * compose with {@link isAbortSignalLike}.
 *
 * Strict identity narrows to the concrete `AbortSignal` intrinsic, so — unlike
 * the subclass-admitting `*Like` predicates — it is intentionally non-generic:
 * every admitted value IS exactly an `AbortSignal`, with no caller-side type
 * to preserve.
 *
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an `AbortSignal`
 * @returns `true` when either the local-realm identity pair or the
 *  cross-realm structural chain holds; `false` otherwise
 * @example
 * isAbortSignal(new AbortController().signal);            // true (instanceof + proto)
 * isAbortSignal(AbortSignal.timeout(1000));               // true (instanceof + proto)
 * isAbortSignal(new EventTarget());                       // false (no abort surface)
 * isAbortSignal({ [Symbol.toStringTag]: 'AbortSignal' }); // false (spoof)
 * isAbortSignal(null);                                    // false
 */
export function isAbortSignal(value?: unknown): value is AbortSignal;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
