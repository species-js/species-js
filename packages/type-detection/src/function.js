// @ts-check

/**
 * @module @species-js/type-detection/function
 *
 * Function-shaped value detection. The floor predicate {@link isCallable}
 * narrows any value to {@link Callable} via the minimal, realm-independent
 * callability test; richer function classification builds on top of it.
 */

import { getOwnPropertyDescriptor, toFunctionString } from '@/config';
import {
  getDefinedConstructorName,
  getTypeSignature,
  hasOwnPrototype,
  hasOwnWritablePrototype,
} from '@/utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/function').Callable} Callable */
/** @typedef {import('@/function').VerifiedFunction} VerifiedFunction */
/** @typedef {import('@/function').NewableFunction} NewableFunction */
/** @typedef {import('@/function').ClassConstructor} ClassConstructor */
/** @typedef {import('@/function').ES3Function} ES3Function */
/** @typedef {import('@/function').AsyncFunction} AsyncFunction */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Internal Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Reads a function's source via `toFunctionString.call(value).trim()` — the
 * realm-fixed `Function.prototype.toString` capture, so a tampered instance
 * `toString` cannot deflect the read. The trim strips surrounding whitespace;
 * `[native code]` markers in the body are preserved (callers use them to tell
 * native from user code).
 *
 * @param {Callable} value - the function whose source should be read
 * @returns {string} the function's source as a trimmed string
 * @internal
 */
export function getFunctionSource(value) {
  return toFunctionString.call(value).trim();
}

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
 * Narrows a value to {@link ClassConstructor} — covers both custom
 * (`class`-syntax) constructors and built-in class constructors. Builds on
 * {@link isNewableFunction} and verifies the descriptor: an own `prototype`
 * with `writable: false` whose `value.constructor` is the value itself. To
 * tell the two families apart, use {@link isCustomClass} or
 * {@link isBuiltInClass}.
 *
 * Bound class constructors fail at the descriptor step (they have no own
 * `prototype`).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is ClassConstructor} `true` when the value is a
 *  class-shaped newable (built-in or `class`-syntax); `false` otherwise
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
 * Narrows a value to a custom (`class`-syntax) constructor — composes
 * {@link isClass} with a source-prefix check via {@link getFunctionSource}.
 * Custom classes stringify with `'class'` as their leading keyword; built-in
 * constructors do not. Bound classes fail {@link isClass} upstream and never
 * reach this check.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is ClassConstructor} `true` when the value is a
 *  custom-class constructor; `false` otherwise
 */
export function isCustomClass(value) {
  return isClass(value) && getFunctionSource(value).startsWith('class');
}

/**
 * Narrows a value to a built-in class constructor — composes {@link isClass}
 * with the inverse source-prefix check from {@link isCustomClass}. Built-in
 * classes render as `function Foo() { [native code] }` and do not start with
 * `'class'`. Bound classes fail {@link isClass} upstream.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`
 * @returns {value is ClassConstructor} `true` when the value is a built-in
 *  class constructor; `false` otherwise
 */
export function isBuiltInClass(value) {
  return isClass(value) && !getFunctionSource(value).startsWith('class');
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
//
//  Async Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link AsyncFunction} — composite check using both
 * `Symbol.toStringTag` (via {@link getTypeSignature}) and constructor name
 * (via {@link getDefinedConstructorName}), both required to equal
 * `'AsyncFunction'`. The redundant `!hasOwnPrototype(value) &&
 * !hasConstructSlot(value)` checks reinforce the spec invariants of the
 * family (no own prototype, not newable). Defensive against single-slot
 * spoofing: a tampered tag without a matching constructor chain (or vice
 * versa) is rejected.
 *
 * Admits all four source forms AND their bound variants — `bind` preserves
 * the prototype chain, so the tag and constructor-name resolution survive.
 * Async-generator functions are *not* in this family: they trace to
 * `%AsyncGeneratorFunction%`, a kin of sync `function*`, not of
 * `%AsyncFunction%`. Use the generator predicates for those.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an async function
 * @returns {value is AsyncFunction} `true` when the value is an async
 *  function in the species-js taxonomy; `false` otherwise
 * @example
 * isAsyncFunction(async () => {});                // true
 * isAsyncFunction(async function () {});          // true
 * isAsyncFunction({ async m() {} }.m);            // true
 * isAsyncFunction((async () => 1).bind(null));    // true — bound forms admitted
 * isAsyncFunction(() => Promise.resolve());       // false — returns a Promise,
 *                                                 // but not tagged AsyncFunction
 * isAsyncFunction(async function* () {});         // false — generator-family
 *                                                 // intrinsic, not async-family
 */
export function isAsyncFunction(value) {
  return (
    isFunction(value) &&
    !hasOwnPrototype(value) &&
    !hasConstructSlot(value) &&
    getTypeSignature(value) === '[object AsyncFunction]' &&
    getDefinedConstructorName(value) === 'AsyncFunction'
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
