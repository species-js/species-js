// @ts-check

/**
 * @module @species-js/type-detection/error
 *
 * Error value detection and abort-error refinement.
 *
 * The public {@link isError} captures native ECMA-262 `Error.isError` at
 * module-load when the runtime provides it (Node 23+, modern browsers)
 * and binds to the polyfill {@link isGenericError} otherwise. The
 * polyfill composes a local-realm `instanceof Error` fast-path with the
 * structural fallback {@link doesMatchErrorContract}, which dispatches on
 * the `[[Class]]` tag and delegates to {@link hasErrorPrototypeContract}
 * for the `'[object Object]'` edge cases (legacy `Object.create`-based
 * Error variants).
 *
 * {@link isAbortError} refines {@link isError} via a suffix match on the
 * error's `name`, capturing the abort-channel naming convention.
 */

import { getPrototypeOf, getOwnPropertyDescriptors } from '@/config';
import { getTypeSignature } from '@/utility';

import { isFunction } from '@/function';
import { isStringValue } from '@/primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/utility').PropertyDescriptor} PropertyDescriptor */
/** @typedef {import('@/utility').PropertyDescriptorMap} PropertyDescriptorMap */

/**
 * The shape of an Error-prototype's own `toString` method. Spec-defined
 * as `Error.prototype.toString` per ECMA-262 §20.5.3.4 — invoked with
 * the prototype as `this`, returns the prototype's name (or `name + ': ' + message`
 * when `message` is non-empty). Used to type the descriptor-extracted
 * toString function before invoking it via `.call(prototype)`.
 * @typedef {(this: object) => string} ProtoToStringMethod
 */

/** @typedef {import('@/error').ErrorConstructorES2025} ErrorConstructorES2025 */

/** @typedef {import('@/error').GenericError} GenericError */
/** @typedef {import('@/error').AbortError} AbortError */

/** @typedef {import('@/error').AbortErrorName} AbortErrorName */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @type {'[object Object]'} */
const BASE_OBJECT_SIGNATURE = '[object Object]';
/** @type {'[object Error]'} */
const BASE_ERROR_SIGNATURE = '[object Error]';
/** @type {'[object DOMException]'} */
const DOM_EXCEPTION_SIGNATURE = '[object DOMException]';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Verifies that the value's `[[Prototype]]` matches the spec-defined
 * Error shape — the four `Error.prototype` own descriptors plus a
 * `toString` output ending in `'Error'`, with a recursive fallback when
 * the prototype is itself an Error.
 *
 * Uses the parameter-default-to-`null` pattern so the `!== null` loop
 * guard narrows `value` through `getPrototypeOf`. Reads the prototype's
 * own descriptors via the realm-fixed {@link getOwnPropertyDescriptors},
 * then applies five checks:
 *
 * 1. The own `message` descriptor's `value` is a string.
 * 2. The own `name` descriptor's `value` is a string.
 * 3. The own `constructor` descriptor's `value` is callable.
 * 4. The own `toString` descriptor's `value` is callable.
 * 5. The prototype's `toString()` output, split on `':'` and trimmed,
 *    ends with `'Error'`.
 *
 * Checks 1–4 verify that the four spec-required `Error.prototype`
 * members (ECMA-262 §20.5.3) are present with the right value type.
 * Check 5 is the name heuristic that catches custom error-named
 * prototypes (`'MyError: bad input'.split(':')[0].trim().endsWith('Error')`)
 * without committing to a specific subclass name.
 *
 * Falls through to {@link isError}(prototype) when any of the five
 * checks fails. The recursion picks up the case where the prototype is
 * itself an `Error` instance which the parent check should accept (the
 * canonical case being `Object.create(new Error())`, whose
 * `[[Prototype]]` is an `Error` instance with its own real
 * `[[ErrorData]]`).
 *
 * Used as the structural sub-helper inside {@link doesMatchErrorContract}
 * for values whose `[[Class]]` tag is `'[object Object]'`. That case
 * covers `Object.create(Error.prototype)` and ES3-style legacy errors
 * whose prototype was assigned an `Error` instance instead of going
 * through the `Error` constructor. Both lack `[[ErrorData]]` and would
 * be rejected by the spec-precise check, but the polyfill widens to
 * admit them.
 *
 * Does not verify `[[ErrorData]]` — that internal slot is unobservable
 * from userland. The heuristic admits values lacking `[[ErrorData]]` so
 * long as they walk and quack like an Error.
 *
 * @param {unknown} [value] - the value whose prototype should be
 *  inspected; omitted is treated as `undefined`, which has no prototype
 * @returns {boolean} `true` when the prototype matches the Error shape;
 *  `false` otherwise
 * @internal
 */
export function hasErrorPrototypeContract(value = null) {
  if (value === null) {
    return false;
  }
  const prototype = getPrototypeOf(value) ?? null;

  if (prototype === null) {
    return false;
  }
  const descriptors = /** @type {PropertyDescriptorMap} */ (
    getOwnPropertyDescriptors(prototype)
  );
  // `descriptors.constructor` / `.toString` collide with inherited
  // `Object.prototype` members at the type level; the index signature is
  // the spec-correct read, but TS picks the prototype member. The casts
  // restore the index-signature reading.

  const messageDesc = /** @type {PropertyDescriptor | undefined} */ (descriptors.message);
  const nameDesc = /** @type {PropertyDescriptor | undefined} */ (descriptors.name);
  const constrDesc = /** @type {PropertyDescriptor | undefined} */ (
    descriptors.constructor
  );
  const toStringDesc = /** @type {PropertyDescriptor | undefined} */ (
    descriptors.toString
  );
  // The `prototype`-descriptor carries its OWN `toString` (verified
  // by the `isFunction(protoToString)` link below). Calling it via
  // `protoToString.call(prototype)` sidesteps the `no-base-to-string`
  // rule — which walks past inline `{ toString(): string }` casts on
  // `object` and pattern-matches the symbol identity of the resolved
  // `toString`, defaulting to `Object.prototype.toString`. Invoking the
  // descriptor's value directly bypasses the resolution entirely.

  return (
    (isStringValue(messageDesc?.value) &&
      isStringValue(nameDesc?.value) &&
      isFunction(constrDesc?.value) &&
      isFunction(toStringDesc?.value) &&
      /** @type {[string, ...string[]]} */ (
        /** @type {ProtoToStringMethod} */ (toStringDesc.value).call(prototype).split(':')
      )[0]
        .trim()
        .endsWith('Error')) ||
    isError(prototype)
  );
}

/**
 * Verifies that the value matches the structural Error contract —
 * either a recognized `[[Class]]` tag (`'[object Error]'` or
 * `'[object DOMException]'`) OR an `'[object Object]'` tag with a
 * prototype that satisfies {@link hasErrorPrototypeContract}.
 *
 * The three acceptance branches cover the spec-defined error families
 * the polyfill recognizes:
 *
 * - `'[object Error]'` — every value with `[[ErrorData]]` falls under
 *   ECMA-262 §20.1.3.6 step 17, which forces this tag regardless of
 *   inheritance. Every built-in Error subclass (`TypeError`,
 *   `SyntaxError`, etc.) and every `class X extends Error` instance
 *   tags this way unless explicitly overriding `Symbol.toStringTag`.
 * - `'[object DOMException]'` — DOMException defines its own
 *   `Symbol.toStringTag` per WebIDL, so it tags differently despite
 *   carrying `[[ErrorData]]`.
 * - `'[object Object]'` with matching prototype — the heuristic
 *   admission for `Object.create(Error.prototype)` and ES3-style legacy
 *   errors that never reached the `Error` constructor but inherit from
 *   `Error.prototype`. Delegated to {@link hasErrorPrototypeContract}.
 *
 * Short-circuit `||` reads the `[[Class]]` tag once, then matches it
 * against `'[object Error]'` and `'[object DOMException]'` in O(1). Only
 * the `'[object Object]'` branch pays for the prototype walk through
 * {@link hasErrorPrototypeContract}.
 *
 * Used as the structural fallback inside {@link isGenericError} when the
 * realm-fixed `instanceof Error` fast-path fails — for example, on
 * cross-realm Error instances (iframes, vm contexts, workers), on
 * DOMException in environments where it does not inherit `Error`, or on
 * legacy values that match the Error shape but were never instantiated
 * via `Error`.
 *
 * Does not require the value to be an `instanceof Error` of any realm.
 * That level of identity narrowing belongs to {@link isGenericError}'s
 * fast-path. `doesMatchErrorContract` is purely structural.
 *
 * Does not verify `[[ErrorData]]` — the spec-precise slot check is
 * unobservable, so the structural fallback is a deliberate superset of
 * the spec semantic. Values like `Object.create(Error.prototype)` lack
 * the slot but pass the structural check.
 *
 * @param {unknown} [value] - the value to inspect; omitted is treated as
 *  `undefined`, which does not match the Error contract
 * @returns {boolean} `true` when the value matches the structural Error
 *  contract; `false` otherwise
 * @internal
 */
export function doesMatchErrorContract(value = null) {
  const signature = value && getTypeSignature(value);
  return (
    !!signature &&
    (signature === BASE_ERROR_SIGNATURE ||
      signature === DOM_EXCEPTION_SIGNATURE ||
      (signature === BASE_OBJECT_SIGNATURE && hasErrorPrototypeContract(value)))
  );
}

/**
 * The {@link isError} polyfill body — the form that runs when the
 * runtime lacks native `Error.isError`.
 *
 * Composes a local-realm `instanceof Error` fast-path with the
 * structural fallback {@link doesMatchErrorContract} via short-circuit
 * `||`. The inexpensive `instanceof` runs first and catches every Error
 * in this realm in a single prototype-walk. The structural fallback
 * fires only on miss, catching cross-realm Errors, DOMException, and the
 * legacy `Object.create(Error.prototype)` / ES3-style errors via the
 * tag-and-prototype inspection.
 *
 * Cross-realm safe by construction. The `instanceof` branch admits
 * local-realm instances on identity. The structural fallback admits
 * foreign-realm instances on contract.
 *
 * Exported for testing and for callers that want the polyfill semantics
 * irrespective of the runtime's native `Error.isError`. The polyfill's
 * acceptance set is a deliberate _superset_ of the spec-level
 * `[[ErrorData]]` check: `Object.create(Error.prototype)` and ES3-style
 * legacy errors lack `[[ErrorData]]` but are admitted via the
 * prototype-shape heuristic. This widening matches the historical
 * equip-js behavior. Callers needing strict spec semantics should reach
 * for {@link isError}, which delegates to the native method when
 * available.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & GenericError`; `T = unknown` collapses to `GenericError`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a generic error
 * @returns {value is T & GenericError} `true` when the value is a
 *  local-realm Error or matches the structural Error contract,
 *  narrowing `value` to `T & GenericError`; `false` otherwise
 * @internal
 */
export function isGenericError(value) {
  return !!value && (value instanceof Error || doesMatchErrorContract(value));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// Native `Error.isError` capture. `(Error as ErrorConstructorES2025).isError`
// reads the optional method honestly — the type is
// `((value: unknown) => value is GenericError) | undefined`, narrowed by
// the runtime `isFunction` check below. Realm-fixed at module-load:
// later tampering with `globalThis.Error` does not reach this binding.
const nativeIsError = /** @type {import('@/error').isError | undefined} */ (
  /** @type {ErrorConstructorES2025} */ (Error).isError
);

/**
 * Narrows a value to {@link GenericError}.
 *
 * The public Error predicate. Captures `Error.isError` at module-load
 * when the runtime provides it (ES2025+ environments — Node 23+, modern
 * browsers) and binds to the polyfill {@link isGenericError} otherwise.
 * The capture is realm-fixed: the binding does not re-read from
 * `globalThis.Error` at each call, so later tampering with the global
 * `Error` constructor's `isError` does not affect this predicate.
 *
 * Native `Error.isError` is the spec-precise check. It reads the
 * internal `[[ErrorData]]` slot, which userland code cannot observe
 * directly. The polyfill widens to a heuristic structural check (see
 * {@link isGenericError}) because the spec-precise slot is unobservable.
 * Both forms admit the same set in well-behaved code. They diverge only
 * on the legacy edge cases the polyfill widens for.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & GenericError`; `T = unknown` collapses to `GenericError`. The
 * generic form is applied to the public signature even though the captured
 * native `Error.isError` is non-generic per its ES2025 declaration. The
 * runtime semantics are unchanged; only the type-system surface widens.
 *
 * @type {import('@/error').isError}
 * @example
 * isError(new Error('boom'));                   // true
 * isError(new TypeError('x'));                  // true
 * isError(new DOMException('msg', 'XError'));   // true
 * isError(Object.create(Error.prototype));      // true (polyfill widens)
 * isError({ name: 'Error', message: '' });      // false
 * isError(null);                                // false
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError}
 */
export const isError = /** @type {import('@/error').isError} */ (
  isFunction(nativeIsError) ? nativeIsError : isGenericError
);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortError Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link AbortError} — a {@link GenericError} whose
 * `name` ends with the `'AbortError'` suffix.
 *
 * Composes {@link isError} with an explicit `name` string-type check
 * and a suffix-match on `value.name`. Short-circuit `&&` runs `isError`
 * first as the cheap gate, then `isStringValue(value.name)` to confirm
 * the `name` is a string, then the suffix check. The string-type gate
 * is load-bearing because neither the native `Error.isError` (which
 * inspects only the `[[ErrorData]]` slot) nor the polyfill's
 * prototype-walk verifies the value's own `name` override. An Error
 * with `Object.defineProperty(err, 'name', { value: 42 })` passes
 * `isError`, but its `name` is not a string and the bare suffix-call
 * would throw `TypeError`.
 *
 * Captures the abort-channel naming convention shared by:
 *
 * - DOM WHATWG `AbortSignal.abort()`, which rejects with a
 *   `DOMException` named `'AbortError'`.
 * - `AbortController.abort()`, which propagates the same name through
 *   the signal it controls.
 * - Userland abortable operations that wrap the convention with a
 *   qualifier prefix (`'TimeoutAbortError'`, `'UserAbortError'`).
 *
 * Suffix-match by design — exact equality would reject the legitimate
 * qualified variants (`'TimeoutAbortError'`, `'UserAbortError'`). The
 * empty-prefix case `'AbortError'` is included by the {@link AbortErrorName}
 * template-literal pattern.
 *
 * Does not verify any abort-channel _mechanics_ (no inspection of
 * `AbortSignal.aborted`, no link to an `AbortController`). The check is
 * purely on the error's name. Producer-side inspection of the abort
 * channel belongs to predicates in the `evented` module
 * (`isAbortSignal`, `isAbortSignalLike`).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & AbortError`; `T = unknown` collapses to `AbortError`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an abort error
 * @returns {value is T & AbortError} `true` when the value is an Error
 *  whose `name` is a string ending with `'AbortError'`, narrowing
 *  `value` to `T & AbortError`; `false` otherwise
 * @example
 * isAbortError(new DOMException('aborted', 'AbortError')); // true
 *
 * class TimeoutAbortError extends Error {
 *   name = 'TimeoutAbortError';
 * }
 * isAbortError(new TimeoutAbortError());                   // true
 *
 * isAbortError(new Error('plain'));                        // false (no suffix)
 * isAbortError({ name: 'AbortError' });                    // false (not an Error)
 * isAbortError(null);                                      // false
 */
export function isAbortError(value) {
  return isError(value) && isStringValue(value.name) && value.name.endsWith('AbortError');
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
