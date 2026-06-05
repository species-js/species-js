// @ts-check

/**
 * @module @species-js/type-detection/error
 *
 * Error value detection and abort-error refinement.
 *
 * The public {@link isError} captures native ECMA-262 `Error.isError` at
 * module-load when the runtime provides it (Node 23+, modern browsers)
 * and binds to the polyfill {@link isGenericError} otherwise. The
 * polyfill composes a local-realm `instanceof Error` fast path with the
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
 * own descriptors via the realm-fixed `getOwnPropertyDescriptors`, then
 * verifies callability of `constructor` and `toString` plus string-typed
 * `name` and `message` — the four spec-required members of
 * `Error.prototype` (ECMA-262 §20.5.3). The trailing `slice(-5) === 'Error'`
 * heuristic catches custom Error-named prototypes (e.g.
 * `'MyError: bad input'` → `'MyError'` → ends in `'Error'`).
 *
 * Falls through to {@link isError}(prototype) when the descriptor walk
 * fails — handles the case where the prototype is itself an Error
 * instance the parent check should accept (canonical case:
 * `Object.create(new Error())`, whose `[[Prototype]]` is an Error
 * instance with its own real `[[ErrorData]]`).
 *
 * Used as the structural sub-helper inside {@link doesMatchErrorContract}
 * for values whose `[[Class]]` tag is `'[object Object]'` — the case
 * covering `Object.create(Error.prototype)` and ES3-style legacy errors
 * that never went through the `Error` constructor and therefore lack
 * `[[ErrorData]]`. The polyfill widens to admit them.
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
 *   `SyntaxError`, `RangeError`, …) tags this way, as does every
 *   `class X extends Error` instance unless it overrides
 *   `Symbol.toStringTag`.
 * - `'[object DOMException]'` — DOMException defines its own
 *   `Symbol.toStringTag` per WebIDL, so it tags differently despite
 *   carrying `[[ErrorData]]`.
 * - `'[object Object]'` with matching prototype — the heuristic
 *   admission for `Object.create(Error.prototype)` and ES3-style legacy
 *   errors, delegated to {@link hasErrorPrototypeContract}.
 *
 * Used as the structural fallback inside {@link isGenericError} when the
 * realm-fixed `instanceof Error` fast path fails — for cross-realm Error
 * instances, DOMException in environments where it does not inherit
 * Error, and legacy values that match the Error shape but were never
 * instantiated via the `Error` constructor.
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
 * Composes a local-realm `instanceof Error` fast path with the
 * structural fallback {@link doesMatchErrorContract}. Short-circuit
 * `||` runs the cheap identity check first, then the structural
 * dispatcher only on miss. Cross-realm safe by construction.
 *
 * Exported for testing and for callers that want the polyfill semantics
 * irrespective of native `Error.isError`. The acceptance set is a
 * deliberate superset of the spec-level `[[ErrorData]]` check — the
 * `Object.create(Error.prototype)` and ES3-style legacy paths are
 * admitted via {@link hasErrorPrototypeContract}'s prototype-shape
 * heuristic. Callers needing strict spec semantics should reach for
 * {@link isError}, which delegates to the native method when available.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & GenericError`; `T = unknown` collapses to `GenericError`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a generic error
 * @returns {value is T & GenericError} `true` when the value is a
 *  local-realm Error or matches the structural Error contract; `false`
 *  otherwise
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
 * Captured at module-load: native `Error.isError` when the runtime
 * provides it (ES2025+), otherwise the polyfill {@link isGenericError}.
 * The capture is realm-fixed — later tampering with `globalThis.Error`'s
 * `isError` does not affect this binding.
 *
 * Native is the spec-precise check (`[[ErrorData]]` slot inspection);
 * the polyfill widens to a heuristic structural check because
 * `[[ErrorData]]` is unobservable from userland. The two forms agree on
 * well-behaved code and diverge only on the legacy edge cases the
 * polyfill admits.
 *
 * @type {import('@/error').isError}
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
 * Composes {@link isError} with `value.name.endsWith('AbortError')`.
 * Short-circuit `&&` runs `isError` first as the less expensive gate;
 * the suffix check fires only after the value is confirmed to be an
 * Error — which also guarantees `name` is a string per the Error contract.
 *
 * Suffix-match by design — exact equality would reject the legitimate
 * qualified variants (`'TimeoutAbortError'`, `'UserAbortError'`). The
 * empty-prefix case `'AbortError'` is admitted by the
 * `${string}AbortError` template-literal pattern of
 * `import('@/error').AbortErrorName`.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AbortError`; `T = unknown` collapses to `AbortError`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an abort error
 * @returns {value is T & AbortError} `true` when the value is an Error
 *  whose `name` ends with `'AbortError'`; `false` otherwise
 */
export function isAbortError(value) {
  return isError(value) && value.name.endsWith('AbortError');
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
