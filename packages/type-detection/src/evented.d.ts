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
 * `Window`, `XMLHttpRequest`, …). Returns `false` when the runtime lacks a
 * global `EventTarget` (pre-Node-15 environments, special embeddings),
 * short-circuiting before the `instanceof` test.
 *
 * The subclass-admitting realm-membership building block shared by the
 * EventTarget predicates — it carries no proto-identity narrowing, so the
 * strict {@link isEventTarget} layers that check on top while the lenient
 * {@link isEventTargetLike} uses it as its fast-path arm. Assumes a truthy
 * `value`; the public predicates apply the `!!value` guard before delegating.
 *
 * @param value - the value to test; assumed truthy by the caller
 * @returns `true` when an `EventTarget` intrinsic was captured and
 *  `value instanceof` it holds; `false` otherwise
 * @internal
 */
export function isCurrentRealmEventTargetInstance(value: unknown): boolean;

/**
 * Whether `value` is an instance of the realm-fixed `AbortSignal` intrinsic
 * captured at module load (or any subclass). Returns `false` when the
 * runtime lacks a global `AbortSignal` (pre-Node-15 environments, special
 * embeddings), short-circuiting before the `instanceof` test.
 *
 * The subclass-admitting realm-membership building block shared by the
 * AbortSignal predicates — it carries no proto-identity narrowing, so the
 * strict {@link isAbortSignal} layers that check on top while the lenient
 * {@link isAbortSignalLike} uses it as its fast-path arm. Assumes a truthy
 * `value`; the public predicates apply the `!!value` guard before delegating.
 *
 * @param value - the value to test; assumed truthy by the caller
 * @returns `true` when an `AbortSignal` intrinsic was captured and
 *  `value instanceof` it holds; `false` otherwise
 * @internal
 */
export function isCurrentRealmAbortSignalInstance(value: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  EventTarget Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

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
 * surface.
 *
 * Does not require `Symbol.toStringTag === 'EventTarget'` or a
 * particular constructor-name. That level of identity narrowing belongs
 * to `isEventTarget`. `doesMatchEventTargetContract` is purely
 * structural.
 *
 * @param value - the value to inspect; omitted is treated as
 *  `undefined`, which does not match the EventTarget method contract
 * @returns `true` when all three methods are callable data properties
 *  in the value's prototype-chain; `false` otherwise
 * @example
 * doesMatchEventTargetContract(new EventTarget()); // true (inherited)
 * doesMatchEventTargetContract(document);          // true (subclass methods inherited)
 * doesMatchEventTargetContract({});                // false
 * doesMatchEventTargetContract(42);                // false
 * @internal
 */
export function doesMatchEventTargetContract(value?: unknown): boolean;

/**
 * Narrows a value to `EventTargetLike` via either local-realm
 * `EventTarget` identity or the structural `EventTarget` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof EventTargetConstructor`
 * check against the realm-fixed `EventTarget` capture catches
 * local-realm `EventTarget` instances and their subclasses (`Element`,
 * `Document`, `Window`, and so on) in a single prototype-walk. If that
 * fails, falls back to `doesMatchEventTargetContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `EventTarget` instances and userland event-emitter implementations
 * that mirror the full method contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract. The captured `EventTarget`
 * reference is `null` when the runtime lacks a global `EventTarget`
 * (pre-Node-15 environments, special embeddings). The `instanceof`
 * branch is then skipped, and only the structural check fires.
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
 * Narrows a value to `EventTarget` via a two-branch identity-check.
 *
 * The local-realm fast-path pairs `value instanceof EventTargetConstructor`
 * with `getPrototypeOf(value) === eventTargetPrototype`. The pair admits
 * only direct `EventTarget` instances. Subclasses (`Element`, `Document`,
 * `Window`, `XMLHttpRequest`, …) pass `instanceof` but fail the
 * `prototype` identity-check, preserving subclass rejection in two O(1)
 * operations. Both captures are realm-fixed at module-load.
 *
 * On miss, falls back to a three-marker structural chain in cost-order:
 * the `[[Class]]` tag `'EventTarget'`, the constructor-name `'EventTarget'`
 * resolved through the package's constructor-walk, and
 * `doesMatchEventTargetContract` for the EventTarget method contract from
 * the DOM WHATWG specification. The cross-realm arm calls
 * `doesMatchEventTargetContract` directly rather than cascading through
 * {@link isEventTargetLike}, because the `instanceof` check, which it had
 * to re-run again, has already been disproved by the local-realm arm.
 *
 * Cross-realm safe. The local-realm pair admits only direct local-realm
 * `EventTarget` instances. The structural fallback admits foreign-realm
 * `EventTarget` instances on contract (the tag-read and constructor-walk
 * both work realm-independently). No legitimate `EventTarget` is
 * rejected on realm membership alone.
 *
 * `EventTarget` subclasses are rejected on both branches — by the
 * `prototype` identity-check on the local-realm path, by the
 * constructor-name equality on the cross-realm path. `Element`,
 * `Document`, `Window`, `XMLHttpRequest`, and other DOM types that
 * extend `EventTarget` resolve their constructor-name to their own
 * class (`'Element'`, `'Document'`, etc.), which fails the cross-realm
 * constructor-name equality. This is a deliberate strictness. Consumers
 * needing subclass admission should compose with
 * {@link isEventTargetLike}, which accepts subclasses via the
 * `instanceof` fast-path.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & EventTarget`; `T = unknown` collapses to `EventTarget`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an `EventTarget`
 * @returns `true` when either the local-realm identity pair or the
 *  cross-realm structural chain holds, narrowing `value` to
 *  `T & EventTarget`; `false` otherwise
 * @example
 * isEventTarget(new EventTarget());                       // true (instanceof + proto)
 * isEventTarget(document);                                // false (subclass)
 * isEventTarget({ [Symbol.toStringTag]: 'EventTarget' }); // false (spoof — no methods)
 * isEventTarget(null);                                    // false
 */
export function isEventTarget<T = unknown>(value?: T): value is T & EventTarget;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortSignal Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Verifies that the value matches the `AbortSignal` method contract —
 * `EventTargetLike` plus a boolean `aborted` and a callable
 * `throwIfAborted`.
 *
 * Composes two abort-specific markers with `doesMatchEventTargetContract`.
 * Short-circuit `&&` orders the checks for both nullish-safety and
 * discrimination cost: `hasInertMethod(value, 'throwIfAborted')` runs
 * first as a nullish-safe leading gate — its descriptor-walk via the
 * parameter-default-to-`null` pattern returns `false` for any nullish
 * input without touching the property surface. The direct `aborted`
 * value-read runs after, by which point `value` is guaranteed non-nullish.
 * The three-descriptor-walk `doesMatchEventTargetContract` runs last as
 * the heaviest discriminator and the structural baseline.
 *
 * The `aborted` check uses `isBooleanValue(value.aborted)` and invokes
 * the spec-defined accessor directly (decision #029) — the
 * descriptor-walk pattern would reject every real `AbortSignal` because
 * `aborted` IS an accessor. The body is wrapped in `try`/`catch` so a
 * throwing userland getter reduces to `false` rather than propagating.
 * The predicate's boolean-return contract is preserved. This is the
 * same exception-handling shape as the boxed-primitive equality helpers.
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
 * @param value - the value to inspect; omitted is treated as
 *  `undefined`, which does not match the AbortSignal method contract
 * @returns `true` when the value satisfies the EventTarget contract,
 *  has a boolean `aborted` property, and has a callable
 *  `throwIfAborted`; `false` otherwise (including when the `aborted`
 *  getter throws)
 * @example
 * doesMatchAbortSignalContract(new AbortController().signal); // true
 * doesMatchAbortSignalContract(AbortSignal.timeout(1000));    // true
 * doesMatchAbortSignalContract(new EventTarget());            // false (no abort surface)
 * doesMatchAbortSignalContract({});                           // false
 * @internal
 */
export function doesMatchAbortSignalContract(value?: unknown): boolean;

/**
 * Narrows a value to `AbortSignalLike` via either local-realm
 * `AbortSignal` identity or the structural `AbortSignal` method
 * contract.
 *
 * Tests in cost-order: the inexpensive `instanceof AbortSignalConstructor`
 * check against the realm-fixed `AbortSignal` capture catches
 * local-realm instances in a single prototype-walk. If that fails,
 * falls back to `doesMatchAbortSignalContract` for the structural
 * check — which catches cross-realm `AbortSignal` instances and
 * userland abort-signal implementations that mirror the minimum
 * contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract. The captured `AbortSignal`
 * reference is `null` when the runtime lacks a global `AbortSignal`
 * (pre-Node-15 environments, special embeddings). The `instanceof`
 * branch is then skipped, and only the structural check fires.
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
 * Narrows a value to `AbortSignal` via a two-branch identity-check.
 *
 * The local-realm fast-path pairs `value instanceof AbortSignalConstructor`
 * with `getPrototypeOf(value) === abortSignalPrototype`. The pair admits
 * only direct `AbortSignal` instances. Subclasses pass `instanceof` but
 * fail the `prototype` identity-check, preserving subclass rejection in
 * two O(1) operations. Both captures are realm-fixed at module-load.
 *
 * On miss, falls back to a three-marker structural chain in cost-order:
 * the `[[Class]]` tag `'AbortSignal'`, the constructor-name `'AbortSignal'`
 * resolved through the package's constructor-walk, and
 * `doesMatchAbortSignalContract` for the AbortSignal method contract (the
 * EventTarget contract plus the `aborted` and `throwIfAborted` markers).
 * The cross-realm arm calls `doesMatchAbortSignalContract` directly rather
 * than cascading through {@link isAbortSignalLike}, because the
 * `instanceof` check, which it had to re-run again, has already been
 * disproved by the local-realm arm.
 *
 * Cross-realm safe. The local-realm pair admits only direct local-realm
 * `AbortSignal` instances. The structural fallback admits foreign-realm
 * `AbortSignal` instances on contract (the tag-read and constructor-walk
 * both work realm-independently). No legitimate `AbortSignal` is
 * rejected on realm membership alone.
 *
 * `AbortSignal` subclasses are rejected on both branches — by the
 * `prototype` identity-check on the local-realm path, by the constructor-name
 * equality on the cross-realm path. Consistent with {@link isEventTarget}
 * and `isPromise`. Consumers needing subclass admission should compose
 * with {@link isAbortSignalLike}, which accepts subclasses via the
 * `instanceof` fast-path.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AbortSignal`; `T = unknown` collapses to `AbortSignal`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an `AbortSignal`
 * @returns `true` when either the local-realm identity pair or the
 *  cross-realm structural chain holds, narrowing `value` to
 *  `T & AbortSignal`; `false` otherwise
 * @example
 * isAbortSignal(new AbortController().signal);            // true (instanceof + proto)
 * isAbortSignal(AbortSignal.timeout(1000));               // true (instanceof + proto)
 * isAbortSignal(new EventTarget());                       // false (no abort surface)
 * isAbortSignal({ [Symbol.toStringTag]: 'AbortSignal' }); // false (spoof)
 * isAbortSignal(null);                                    // false
 */
export function isAbortSignal<T = unknown>(value?: T): value is T & AbortSignal;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
