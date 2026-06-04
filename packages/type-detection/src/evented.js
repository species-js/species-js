// @ts-check

/**
 * @module @species-js/type-detection/evented
 *
 * `EventTarget` and `AbortSignal` value detection.
 *
 * Two structural lattices live in this module. The first centers on
 * the EventTarget method contract — three callable methods
 * (`dispatchEvent`, `addEventListener`, `removeEventListener`)
 * specified by DOM WHATWG `EventTarget`. {@link isEventTargetLike}
 * narrows any value to the contract via an `instanceof` fast path
 * against the realm-fixed capture plus a structural fallback;
 * {@link isEventTarget} layers `[[Class]]` tag and constructor-name
 * markers on top for direct-instance discrimination.
 *
 * The second extends the first: AbortSignal adds an `aborted` boolean
 * and a `throwIfAborted` callable on top of the EventTarget surface.
 * {@link isAbortSignalLike} and {@link isAbortSignal} mirror the same
 * structural-then-identity layering as their EventTarget counterparts.
 */

import { hasInertMethod, getTypeSignature, getDefinedConstructorName } from '@/utility';

import { isBooleanValue } from '@/primitive';
import { isCallable } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/evented').EventTargetLike} EventTargetLike */
/** @typedef {import('@/evented').AbortSignalLike} AbortSignalLike */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const EventTargetConstructor = /** @type {typeof EventTarget | null} */ (
  isCallable(EventTarget) ? EventTarget : null
);
const AbortSignalConstructor = /** @type {typeof AbortSignal | null} */ (
  isCallable(AbortSignal) ? AbortSignal : null
);

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
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the EventTarget method contract
 * @returns {boolean} `true` when all three methods are callable data
 *  properties in the value's prototype chain; `false` otherwise
 * @example
 * doesMatchEventTargetContract(new EventTarget()); // true (inherited)
 * doesMatchEventTargetContract(document);          // true (subclass methods inherited)
 * doesMatchEventTargetContract({});                // false
 * doesMatchEventTargetContract(42);                // false
 * @internal
 */
export function doesMatchEventTargetContract(value) {
  return (
    hasInertMethod(value, 'dispatchEvent') &&
    hasInertMethod(value, 'addEventListener') &&
    hasInertMethod(value, 'removeEventListener')
  );
}

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
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an _event-target-like_ type
 * @returns {value is EventTargetLike} `true` when the value is either a
 *  local-realm `EventTarget` (or subclass) or satisfies the EventTarget
 *  method contract, narrowing `value` to `EventTargetLike`; `false`
 *  otherwise
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
export function isEventTargetLike(value = null) {
  return (
    !!value &&
    ((!!EventTargetConstructor && value instanceof EventTargetConstructor) ||
      doesMatchEventTargetContract(value))
  );
}

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
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an `EventTarget`
 * @returns {value is EventTarget} `true` when the value satisfies all
 *  three markers, narrowing `value` to `EventTarget`; `false` otherwise
 * @example
 * isEventTarget(new EventTarget());                       // true
 * isEventTarget(document);                                // false (subclass)
 * isEventTarget({ [Symbol.toStringTag]: 'EventTarget' }); // false (spoof — no methods)
 * isEventTarget(null);                                    // false
 */
export function isEventTarget(value) {
  return (
    isEventTargetLike(value) &&
    getTypeSignature(value) === '[object EventTarget]' &&
    getDefinedConstructorName(value) === 'EventTarget'
  );
}

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
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the AbortSignal method contract
 * @returns {boolean} `true` when the value satisfies the EventTarget
 *  contract, has a boolean `aborted` property, and has a callable
 *  `throwIfAborted`; `false` otherwise
 * @example
 * doesMatchAbortSignalContract(new AbortController().signal); // true
 * doesMatchAbortSignalContract(AbortSignal.timeout(1000));    // true
 * doesMatchAbortSignalContract(new EventTarget());            // false (no abort surface)
 * doesMatchAbortSignalContract({});                           // false
 * @internal
 */
export function doesMatchAbortSignalContract(value) {
  return (
    hasInertMethod(value, 'throwIfAborted') &&
    isBooleanValue(/** @type {{ aborted?: unknown }} */ (value).aborted) &&
    doesMatchEventTargetContract(value)
  );
}

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
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an _abort-signal-like_ type
 * @returns {value is AbortSignalLike} `true` when the value is either a
 *  local-realm `AbortSignal` or satisfies the AbortSignal method
 *  contract, narrowing `value` to `AbortSignalLike`; `false` otherwise
 * @example
 * isAbortSignalLike(new AbortController().signal); // true (instanceof)
 * isAbortSignalLike(AbortSignal.timeout(1000));    // true (instanceof)
 * isAbortSignalLike(new EventTarget());            // false (no abort surface)
 * isAbortSignalLike(null);                         // false
 */
export function isAbortSignalLike(value = null) {
  return (
    !!value &&
    ((!!AbortSignalConstructor && value instanceof AbortSignalConstructor) ||
      doesMatchAbortSignalContract(value))
  );
}

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
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an `AbortSignal`
 * @returns {value is AbortSignal} `true` when the value satisfies all
 *  three markers, narrowing `value` to `AbortSignal`; `false` otherwise
 * @example
 * isAbortSignal(new AbortController().signal);            // true
 * isAbortSignal(AbortSignal.timeout(1000));               // true
 * isAbortSignal(new EventTarget());                       // false (no abort surface)
 * isAbortSignal({ [Symbol.toStringTag]: 'AbortSignal' }); // false (spoof)
 * isAbortSignal(null);                                    // false
 */
export function isAbortSignal(value) {
  return (
    isAbortSignalLike(value) &&
    getTypeSignature(value) === '[object AbortSignal]' &&
    getDefinedConstructorName(value) === 'AbortSignal'
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
