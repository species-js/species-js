// @ts-check

/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection. The floor predicate {@link isCallable}
 * narrows any value to {@link Callable} via the minimal, realm-independent
 * callability test; richer function classification builds on top of it.
 */

import { getOwnPropertyDescriptor } from '@/config';
import { hasOwnWritablePrototype } from '@/utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').VerifiedFunction} VerifiedFunction */
/** @typedef {import('@/function').NewableFunction} NewableFunction */
/** @typedef {import('@/function').ClassConstructor} ClassConstructor */
/** @typedef {import('@/function').ES3Function} ES3Function */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows an unknown value to a {@link Callable} by the minimal callability
 * test.
 *
 * The implementation is a single `typeof` check. `typeof value === 'function'`
 * is the only realm-independent detection of the `[[Call]]` internal method,
 * and it is exhaustive — every callable form (regular, arrow, async, and
 * async-arrow functions; generator and async-generator functions; object and
 * class methods; class constructors; bound functions; callable proxies)
 * reports `'function'`. Because it touches no `Function.prototype` method, the
 * guard cannot be fooled by a value whose `call` / `apply` / `bind` were
 * deleted or reassigned.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as `undefined`
 * @returns {value is Callable} `true` when `typeof value === 'function'`
 */
export function isCallable(value) {
  return typeof value === 'function';
}

/**
 * Narrows a value to {@link VerifiedFunction} — composes four
 * {@link isCallable} checks: the value itself, then its own `bind`, `call`,
 * and `apply` properties. Each layer is a `typeof === 'function'` read, so the
 * guard stays realm-independent and indifferent to whether the three methods
 * come from `Function.prototype`, from a subclass, or from a substitute
 * object answering at those names.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not callable
 * @returns {value is VerifiedFunction} `true` when all four `isCallable` checks
 *  pass, narrowing `value` to {@link VerifiedFunction}; `false` otherwise
 * @example
 * isFunction(() => {});             // true
 * isFunction(function () {});       // true
 * isFunction(class Foo {});         // true
 * isFunction({ bind: () => {} });   // false (typeof not function)
 * isFunction(null);                 // false
 */
export function isFunction(value) {
  return (
    isCallable(value) &&
    isCallable(value.bind) &&
    isCallable(value.call) &&
    isCallable(value.apply)
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Newable Function Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Probes the value's `[[Construct]]` internal method via a `Proxy` `construct`
 * trap — attempts `new (new Proxy(value, { construct: () => ({}) }))()` inside
 * a `try` / `catch`. Success means the target had `[[Construct]]`; failure
 * means it did not. The probe never invokes `value` directly.
 *
 * @param {unknown} value - the value to probe
 * @returns {boolean} `true` when the value carries `[[Construct]]`; `false`
 *  otherwise
 */
export function hasConstructSlot(value) {
  try {
    new /** @type {NewableFunction} */ (
      new Proxy(/** @type {object} */ (value), { construct: () => ({}) })
    )();
    return true;
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the lenient {@link NewableFunction} gate — composes
 * {@link isFunction} with {@link hasConstructSlot}. Admits all three newable
 * species: ES3 functions, class constructors, and bound newables.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not callable
 * @returns {value is NewableFunction} `true` when the value is callable AND
 *  carries `[[Construct]]`; `false` otherwise
 */
export function isNewableFunction(value) {
  return isFunction(value) && hasConstructSlot(value);
}

/**
 * Narrows a value to {@link ClassConstructor} — builds on
 * {@link isNewableFunction} and verifies the descriptor: an own `prototype`
 * with `writable: false` whose `value.constructor` is the value itself.
 * Bound class constructors fail at the descriptor step (they have no own
 * `prototype`).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is ClassConstructor} `true` when the value is a class-shaped
 *  newable; `false` otherwise
 */
export function isClass(value) {
  if (!isNewableFunction(value)) {
    return false;
  }
  const descriptor = getOwnPropertyDescriptor(value, 'prototype');

  if (descriptor?.writable !== false) {
    return false;
  }
  const slotValue = /** @type {unknown} */ (descriptor.value);
  const prototype =
    /** @type {{ constructor?: unknown } | null | undefined} */
    (slotValue);

  return prototype?.constructor === value;
}

/**
 * Narrows a value to {@link ES3Function} — builds on
 * {@link isNewableFunction} and verifies an own `prototype` with
 * `writable: true` via {@link hasOwnWritablePrototype}. Bound ES3 functions
 * fail at the writable-prototype step (they have no own `prototype`).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is ES3Function} `true` when the value is an ES3-shaped
 *  newable; `false` otherwise
 */
export function isES3Function(value) {
  return isNewableFunction(value) && hasOwnWritablePrototype(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
