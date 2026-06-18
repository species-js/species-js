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
 * narrows any value to the contract via an `instanceof` fast-path
 * against the realm-fixed capture plus a structural fallback.
 * {@link isEventTarget} layers `[[Class]]` tag and constructor-name
 * markers on top for direct-instance discrimination.
 *
 * The second extends the first: AbortSignal adds an `aborted` boolean
 * and a `throwIfAborted` callable on top of the EventTarget surface.
 * {@link isAbortSignalLike} and {@link isAbortSignal} mirror the same
 * structural-then-identity layering as their EventTarget counterparts.
 */

import { getPrototypeOf } from '@/config';
import { hasInertMethod, getTypeSignature, getDefinedConstructorName } from '@/utility';

import { isCallable } from '@/function';
import { isBooleanValue } from '@/primitive';

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
const eventTargetPrototype = EventTargetConstructor && EventTargetConstructor.prototype;
const abortSignalPrototype = AbortSignalConstructor && AbortSignalConstructor.prototype;
/**
 * Whether `value` is an instance of the realm-fixed `EventTarget`
 * capture (or any subclass — `Element`, `Document`, `Window`,
 * `XMLHttpRequest`, …). The leading `!!EventTargetConstructor` guard
 * returns `false` when the runtime lacks a global `EventTarget`
 * (pre-Node-15 environments, special embeddings) without exercising
 * `instanceof`.
 *
 * Invoked exclusively after the caller's `!!value` truthiness guard, so
 * the helper carries the constructor-presence guard only.
 *
 * @param {unknown} value - the value to test; assumed truthy by the caller
 * @returns {boolean} `true` when `EventTargetConstructor` is captured and
 *  `value instanceof EventTargetConstructor` holds; `false` otherwise
 * @internal
 */
function isCurrentRealmEventTargetInstance(value) {
  return !!EventTargetConstructor && value instanceof EventTargetConstructor;
}
/**
 * Whether `value` is an instance of the realm-fixed `AbortSignal`
 * capture (or any subclass). The leading `!!AbortSignalConstructor`
 * guard returns `false` when the runtime lacks a global `AbortSignal`
 * (pre-Node-15 environments, special embeddings) without exercising
 * `instanceof`.
 *
 * Invoked exclusively after the caller's `!!value` truthiness guard, so
 * the helper carries the constructor-presence guard only.
 *
 * @param {unknown} value - the value to test; assumed truthy by the caller
 * @returns {boolean} `true` when `AbortSignalConstructor` is captured and
 *  `value instanceof AbortSignalConstructor` holds; `false` otherwise
 * @internal
 */
function isCurrentRealmAbortSignalInstance(value) {
  return !!AbortSignalConstructor && value instanceof AbortSignalConstructor;
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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & EventTargetLike`; `T = unknown` collapses to `EventTargetLike`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an _event-target-like_ type
 * @returns {value is T & EventTargetLike} `true` when the value is either
 *  a local-realm `EventTarget` (or subclass) or satisfies the EventTarget
 *  method contract, narrowing `value` to `T & EventTargetLike`; `false`
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
export function isEventTargetLike(value) {
  return (
    !!value &&
    (isCurrentRealmEventTargetInstance(value) || doesMatchEventTargetContract(value))
  );
}

/**
 * Narrows a value to `EventTarget` via a two-branch identity-check.
 *
 * The local-realm fast-path pairs `isCurrentRealmEventTargetInstance(value)`
 * (the captured `value instanceof EventTargetConstructor`) with
 * `getPrototypeOf(value) === eventTargetPrototype`. The pair admits only
 * direct `EventTarget` instances. Subclasses (`Element`, `Document`,
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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & EventTarget`; `T = unknown` collapses to `EventTarget`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an `EventTarget`
 * @returns {value is T & EventTarget} `true` when either the local-realm
 *  identity pair or the cross-realm structural chain holds, narrowing
 *  `value` to `T & EventTarget`; `false` otherwise
 * @example
 * isEventTarget(new EventTarget());                       // true (instanceof + proto)
 * isEventTarget(document);                                // false (subclass)
 * isEventTarget({ [Symbol.toStringTag]: 'EventTarget' }); // false (spoof — no methods)
 * isEventTarget(null);                                    // false
 */
export function isEventTarget(value) {
  return (
    !!value &&
    (isCurrentRealmEventTargetInstance(value)
      ? getPrototypeOf(value) === eventTargetPrototype
      : getTypeSignature(value) === '[object EventTarget]' &&
        getDefinedConstructorName(value) === 'EventTarget' &&
        doesMatchEventTargetContract(value))
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
 * @param {unknown} [value] - the value to inspect; omitted is treated
 *  as `undefined`, which does not match the AbortSignal method contract
 * @returns {boolean} `true` when the value satisfies the EventTarget
 *  contract, has a boolean `aborted` property, and has a callable
 *  `throwIfAborted`; `false` otherwise (including when the `aborted`
 *  getter throws)
 * @example
 * doesMatchAbortSignalContract(new AbortController().signal); // true
 * doesMatchAbortSignalContract(AbortSignal.timeout(1000));    // true
 * doesMatchAbortSignalContract(new EventTarget());            // false (no abort surface)
 * doesMatchAbortSignalContract({});                           // false
 * @internal
 */
export function doesMatchAbortSignalContract(value) {
  try {
    return (
      hasInertMethod(value, 'throwIfAborted') &&
      isBooleanValue(/** @type {{ aborted?: unknown }} */ (value).aborted) &&
      doesMatchEventTargetContract(value)
    );
  } catch {
    return false;
  }
}

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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AbortSignalLike`; `T = unknown` collapses to `AbortSignalLike`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an _abort-signal-like_ type
 * @returns {value is T & AbortSignalLike} `true` when the value is either
 *  a local-realm `AbortSignal` or satisfies the AbortSignal method
 *  contract, narrowing `value` to `T & AbortSignalLike`; `false` otherwise
 * @example
 * isAbortSignalLike(new AbortController().signal); // true (instanceof)
 * isAbortSignalLike(AbortSignal.timeout(1000));    // true (instanceof)
 * isAbortSignalLike(new EventTarget());            // false (no abort surface)
 * isAbortSignalLike(null);                         // false
 */
export function isAbortSignalLike(value) {
  return (
    !!value &&
    (isCurrentRealmAbortSignalInstance(value) || doesMatchAbortSignalContract(value))
  );
}

/**
 * Narrows a value to `AbortSignal` via a two-branch identity-check.
 *
 * The local-realm fast-path pairs `isCurrentRealmAbortSignalInstance(value)`
 * (the captured `value instanceof AbortSignalConstructor`) with
 * `getPrototypeOf(value) === abortSignalPrototype`. The pair admits only
 * direct `AbortSignal` instances. Subclasses pass `instanceof` but fail
 * the `prototype` identity-check, preserving subclass rejection in two O(1)
 * operations. Both captures are realm-fixed at module-load.
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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AbortSignal`; `T = unknown` collapses to `AbortSignal`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an `AbortSignal`
 * @returns {value is T & AbortSignal} `true` when either the local-realm
 *  identity pair or the cross-realm structural chain holds, narrowing
 *  `value` to `T & AbortSignal`; `false` otherwise
 * @example
 * isAbortSignal(new AbortController().signal);            // true (instanceof + proto)
 * isAbortSignal(AbortSignal.timeout(1000));               // true (instanceof + proto)
 * isAbortSignal(new EventTarget());                       // false (no abort surface)
 * isAbortSignal({ [Symbol.toStringTag]: 'AbortSignal' }); // false (spoof)
 * isAbortSignal(null);                                    // false
 */
export function isAbortSignal(value) {
  return (
    !!value &&
    (isCurrentRealmAbortSignalInstance(value)
      ? getPrototypeOf(value) === abortSignalPrototype
      : getTypeSignature(value) === '[object AbortSignal]' &&
        getDefinedConstructorName(value) === 'AbortSignal' &&
        doesMatchAbortSignalContract(value))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
