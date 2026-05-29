// @ts-check

/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection. The floor predicate {@link isCallable}
 * narrows any value to {@link Callable} via the minimal, realm-independent
 * callability test; richer function classification builds on top of it.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').VerifiedFunction} VerifiedFunction */

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
