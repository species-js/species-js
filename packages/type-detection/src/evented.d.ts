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
 * inspection; {@link isEventTarget} layers tag and constructor-name
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
 * as callable data properties reachable through its prototype chain.
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
 * exposes `throwIfAborted` as a callable. This is the structural shape
 * native `AbortSignal` instances and their producers
 * (`AbortController.signal`, `AbortSignal.timeout()`,
 * `AbortSignal.any()`) naturally satisfy, plus userland abort-signal
 * implementations that mirror the same minimum surface.
 *
 * `AbortSignalLike` sits strictly between `EventTargetLike` (any
 * EventTarget method contract) and `AbortSignal` (the realm-fixed
 * intrinsic identified by tag and constructor name). It is the right
 * narrowing target for predicates that admit any value whose method
 * shape matches the abort-channel contract, without requiring identity
 * equality with `%AbortSignal%`.
 *
 * The contract is intentionally minimal: only the two abort-channel
 * members that are spec-required AND structurally testable without
 * invoking accessors. The full DOM `AbortSignal` carries additional
 * members — `reason`, `onabort`, the `AbortSignalEventMap` overloads
 * for `addEventListener` / `removeEventListener` — that are deliberately
 * omitted here. `reason: any` has no structural constraint to verify;
 * `onabort` is sugar over the base EventTarget contract that is already
 * validated; the typed-event-map overloads are TypeScript convenience,
 * not part of the runtime contract.
 *
 * ## Future use as the `AbortableThenable<T>` abort channel
 *
 * The thenable module's `AbortableThenable<T>` (deferred to the
 * `@/error` migration, see DECISION-LOG Q.004) accepts an abort channel
 * typed as `AbortError`. Once `@/error` lands and `AbortableThenable<T>`
 * extends `Thenable<T>` with the abort channel, this module's
 * `AbortSignalLike` and `isAbortSignalLike` become the cross-module
 * surface for validating the abort channel structurally. Plan ahead by
 * keeping the contracts compatible.
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
   * otherwise. Spec-defined as DOM WHATWG
   * `AbortSignal.throwIfAborted`. Convenient for guarding the entry of
   * an abortable operation.
   */
  throwIfAborted(): void;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  EventTarget Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Verifies that the value matches the `EventTarget` method contract —
 * callable `dispatchEvent`, `addEventListener`, and `removeEventListener`
 * data properties reachable through the value's prototype chain.
 *
 * Composes three `hasInertMethod` checks for the methods specified by
 * DOM WHATWG `EventTarget`. Short-circuit `&&` enforces an inner cost
 * ordering: `dispatchEvent` (the spec-defined emission hook) runs first,
 * `addEventListener` second, `removeEventListener` last.
 *
 * Used as the structural fallback inside `isEventTargetLike` when the
 * realm-fixed `instanceof EventTargetConstructor` fast path fails — for
 * example, on cross-realm `EventTarget` instances or userland
 * event-emitter implementations that mirror the EventTarget method
 * surface.
 *
 * Does not require `Symbol.toStringTag === 'EventTarget'` or a
 * particular constructor name; that level of identity narrowing belongs
 * to `isEventTarget`. `doesMatchEventTargetContract` is purely
 * structural.
 *
 * @param value - the value to inspect; omitted is treated as
 *  `undefined`, which does not match the EventTarget method contract
 * @returns `true` when all three methods are callable data properties
 *  in the value's prototype chain; `false` otherwise
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
 * Tests in cost order: the inexpensive `instanceof EventTargetConstructor`
 * check against the realm-fixed `EventTarget` capture catches
 * local-realm `EventTarget` instances and their subclasses (`Element`,
 * `Document`, `Window`, and so on) in a single prototype walk. If that
 * fails, falls back to `doesMatchEventTargetContract` for the
 * structural inspect-without-invoke check — which catches cross-realm
 * `EventTarget` instances and userland event-emitter implementations
 * that mirror the full method contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity; the structural fallback admits
 * foreign-realm instances on contract. The captured `EventTarget`
 * reference is `null` when the runtime lacks a global `EventTarget`
 * (pre-Node-15 environments, special embeddings); the instanceof
 * branch is then skipped, and only the structural check fires.
 *
 * Generic in `T` per the family pattern. The narrow returns
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
 * Narrows a value to `EventTarget` via three cross-validating
 * structural markers: the EventTarget method contract (per
 * {@link isEventTargetLike}), the `[[Class]]` tag `'EventTarget'`, and
 * the constructor name `'EventTarget'` resolved through the package's
 * constructor walk.
 *
 * Short-circuit `&&` runs the markers in fixed order — `isEventTargetLike`
 * gates the tag read, the tag read gates the constructor walk. Each
 * marker is independent and rules out a distinct false-positive class:
 * the `isEventTargetLike` gate rejects values that claim `EventTarget`
 * identity without exposing the method contract; the constructor-name
 * marker rejects values that look right structurally and via tag but
 * whose actual constructor is something other than `EventTarget`,
 * closing the `Symbol.toStringTag`-spoofing hole the tag check alone
 * would leave open.
 *
 * Cross-realm safe. The `instanceof` fast path inside
 * `isEventTargetLike` admits local-realm instances on identity; the
 * structural fallback admits foreign-realm instances on contract. The
 * tag-read and the constructor-walk both work realm-independently.
 *
 * `EventTarget` subclasses are rejected. `Element`, `Document`,
 * `Window`, `XMLHttpRequest`, and other DOM types that extend
 * `EventTarget` resolve their constructor name to their own class
 * (`'Element'`, `'Document'`, etc.), which fails the equality check
 * against `'EventTarget'`. This is a deliberate strictness — consumers
 * needing subclass admission should compose with `isEventTargetLike`,
 * which accepts subclasses via the `instanceof` fast path.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & EventTarget`; `T = unknown` collapses to `EventTarget`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an `EventTarget`
 * @returns `true` when the value satisfies all three markers, narrowing
 *  `value` to `T & EventTarget`; `false` otherwise
 * @example
 * isEventTarget(new EventTarget());                       // true
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
 * discrimination cost: `hasInertMethod(value, 'throwIfAborted')` runs first
 * as a nullish-safe leading gate — its descriptor-walk via the
 * parameter-default-to-`null` pattern returns `false` for any nullish
 * input without touching the property surface. The direct `aborted`
 * value-read runs after, by which point `value` is guaranteed non-nullish.
 * The three-descriptor-walk `doesMatchEventTargetContract` runs last as
 * the heaviest discriminator and the structural baseline.
 *
 * The `aborted` check uses `isBooleanValue(value.aborted)`. Spec defines
 * `aborted` as a read-only accessor attribute; the predicate accepts
 * the spec-defined accessor by reading the value directly. The
 * `throwIfAborted` check uses `hasInertMethod` for the standard
 * inspect-without-invoke contract — `throwIfAborted` is a data-property
 * method on `AbortSignal.prototype`, so the descriptor-walk pattern
 * applies without spec friction.
 *
 * Used as the structural fallback inside `isAbortSignalLike` when the
 * realm-fixed `instanceof AbortSignalConstructor` fast path fails — for
 * example, on cross-realm `AbortSignal` instances or userland
 * abort-signal implementations.
 *
 * @param value - the value to inspect; omitted is treated as
 *  `undefined`, which does not match the AbortSignal method contract
 * @returns `true` when the value satisfies the EventTarget contract,
 *  has a boolean `aborted` property, and has a callable
 *  `throwIfAborted`; `false` otherwise
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
 * Tests in cost order: the inexpensive `instanceof AbortSignalConstructor`
 * check against the realm-fixed `AbortSignal` capture catches
 * local-realm instances in a single prototype walk. If that fails,
 * falls back to `doesMatchAbortSignalContract` for the structural
 * check — which catches cross-realm `AbortSignal` instances and
 * userland abort-signal implementations that mirror the minimum
 * contract.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity; the structural fallback admits
 * foreign-realm instances on contract. The captured `AbortSignal`
 * reference is `null` when the runtime lacks a global `AbortSignal`
 * (pre-Node-15 environments, special embeddings); the instanceof
 * branch is then skipped, and only the structural check fires.
 *
 * Generic in `T` per the family pattern. The narrow returns
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
 * Narrows a value to `AbortSignal` via three cross-validating
 * structural markers: the AbortSignal method contract (per
 * {@link isAbortSignalLike}), the `[[Class]]` tag `'AbortSignal'`, and
 * the constructor name `'AbortSignal'` resolved through the package's
 * constructor walk.
 *
 * Short-circuit `&&` runs the markers in fixed order — `isAbortSignalLike`
 * gates the tag read, the tag read gates the constructor walk. Each
 * marker is independent and rules out a distinct false-positive class.
 *
 * Cross-realm safe. The `instanceof` fast path inside
 * `isAbortSignalLike` admits local-realm instances on identity; the
 * structural fallback admits foreign-realm instances on contract. The
 * tag-read and the constructor-walk both work realm-independently.
 *
 * `AbortSignal` subclasses are rejected via the strict constructor-name
 * equality, consistent with `isEventTarget` and `isPromise`. Consumers
 * needing subclass admission should compose with `isAbortSignalLike`,
 * which accepts subclasses via the `instanceof` fast path.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AbortSignal`; `T = unknown` collapses to `AbortSignal`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an `AbortSignal`
 * @returns `true` when the value satisfies all three markers, narrowing
 *  `value` to `T & AbortSignal`; `false` otherwise
 * @example
 * isAbortSignal(new AbortController().signal);            // true
 * isAbortSignal(AbortSignal.timeout(1000));               // true
 * isAbortSignal(new EventTarget());                       // false (no abort surface)
 * isAbortSignal({ [Symbol.toStringTag]: 'AbortSignal' }); // false (spoof)
 * isAbortSignal(null);                                    // false
 */
export function isAbortSignal<T = unknown>(value?: T): value is T & AbortSignal;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
