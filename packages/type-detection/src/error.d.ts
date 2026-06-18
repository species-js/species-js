/**
 * @module @species-js/type-detection/error
 *
 * Error value detection and abort-error refinement.
 *
 * The public predicate {@link isError} narrows any value to
 * {@link GenericError}, using native ECMA-262 `Error.isError` when the
 * runtime provides it (Node 23+, modern browsers) and falling back to the
 * polyfill {@link isGenericError} otherwise. The polyfill composes a
 * local-realm `instanceof Error` fast-path with the structural fallback
 * {@link doesMatchErrorContract}, which reads the value's `[[Class]]` tag
 * and (for the `'[object Object]'` edge cases) walks its prototype for
 * the spec-defined Error shape via {@link hasErrorPrototypeContract}.
 *
 * {@link isAbortError} refines {@link isError} via a suffix match against
 * {@link AbortErrorName}, the template-literal type that captures the
 * abort-channel naming convention shared by DOM WHATWG `AbortSignal` /
 * `AbortController` and userland abortable operations.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error Value Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The TypeScript union for values carrying the internal `[[ErrorData]]`
 * slot — the slot ECMA-262 §20.5.2.2 `Error.isError` reads.
 *
 * `[[ErrorData]]` is set by the `Error` constructor and inherited via
 * `OrdinaryCreateFromConstructor` by every built-in Error subclass
 * (`TypeError`, `SyntaxError`, `RangeError`, `ReferenceError`,
 * `URIError`, `EvalError`, `AggregateError`) and by user-defined
 * `class X extends Error` instances. DOMException is defined by WebIDL
 * to be an Error variant with its own `[[ErrorData]]` but does not
 * inherit from `Error` in TypeScript's `lib.dom.d.ts`, so the union
 * carries it as a separate alternative.
 *
 * The union is the TypeScript-side approximation of "anything
 * `Error.isError` accepts". The spec-precise slot check is unobservable
 * from userland and therefore cannot directly be modeled at the type level.
 * User-defined `class MyError extends Error` instances flow through the
 * `Error` arm via subtype assignability.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError}
 */
export type GenericError = DOMException | Error;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * `ErrorConstructor` extended with an _optional_ ES2025+ `isError` static
 * method. The honest typing for the global `Error` when the runtime may
 * or may not provide the static method.
 *
 * Used at the polyfill site to read `(Error as ErrorConstructorES2025).isError`
 * without asserting presence. The subsequent `isFunction` narrow handles
 * the actual decision.
 *
 * @see {@link https://tc39.es/ecma262/#sec-error.iserror}
 * @internal
 */
export interface ErrorConstructorES2025 extends ErrorConstructor {
  /** Optional — present in ES2025+ runtimes, absent otherwise. */
  isError?(value: unknown): value is GenericError;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  AbortError Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An error-name string ending with the `'AbortError'` suffix.
 *
 * Captures the abort-channel naming convention spec-defined by DOM
 * WHATWG: `AbortSignal.abort()` rejects with a `DOMException` whose
 * `name` is `'AbortError'`. Userland abortable operations frequently
 * prefix their own qualifier (`'TimeoutAbortError'`,
 * `'UserAbortError'`, `'NavigationAbortError'`) to disambiguate the
 * cause without losing the convention. The leading `string` admits the
 * empty case — `'AbortError'` itself — and arbitrary qualifiers alike.
 *
 * Template-literal types collapse to `string` at the runtime level, so
 * this type is structural documentation rather than a runtime guarantee.
 * The runtime check happens in {@link isAbortError} via
 * `name.endsWith('AbortError')`.
 */
export type AbortErrorName = `${string}AbortError`;

/**
 * A {@link GenericError} whose `name` ends with `'AbortError'`.
 *
 * Layers {@link AbortErrorName} as the `name` field over the base
 * `GenericError` union via structural intersection, capturing the
 * abort-channel idiom at the type level. The narrow target of
 * {@link isAbortError}.
 */
export type AbortError = GenericError & {
  name: AbortErrorName;
};

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
 * Reads the prototype's own descriptors via the realm-fixed
 * `getOwnPropertyDescriptors`, then applies five checks:
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
 * @param value - the value whose prototype should be inspected; omitted
 *  is treated as `undefined`, which has no prototype
 * @returns `true` when the prototype matches the Error shape; `false`
 *  otherwise
 * @internal
 */
export function hasErrorPrototypeContract(value?: unknown): boolean;

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
 * @param value - the value to inspect; omitted is treated as `undefined`,
 *  which does not match the Error contract
 * @returns `true` when the value matches the structural Error contract;
 *  `false` otherwise
 * @internal
 */
export function doesMatchErrorContract(value?: unknown): boolean;

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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & GenericError`; `T = unknown` collapses to `GenericError`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a generic error
 * @returns `true` when the value is a local-realm Error or matches the
 *  structural Error contract, narrowing `value` to `T & GenericError`;
 *  `false` otherwise
 * @internal
 */
export function isGenericError<T = unknown>(value?: T): value is T & GenericError;

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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & GenericError`; `T = unknown` collapses to `GenericError`. The
 * generic form is applied to the public signature even though the captured
 * native `Error.isError` is non-generic per its ES2025 declaration. The
 * runtime semantics are unchanged; only the type-system surface widens.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a generic error
 * @returns `true` when the value carries `[[ErrorData]]` (native) or
 *  matches the polyfill semantics, narrowing `value` to
 *  `T & GenericError`; `false` otherwise
 * @example
 * isError(new Error('boom'));                   // true
 * isError(new TypeError('x'));                  // true
 * isError(new DOMException('msg', 'XError'));   // true
 * isError(Object.create(Error.prototype));      // true (polyfill widens)
 * isError({ name: 'Error', message: '' });      // false
 * isError(null);                                // false
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/isError}
 */
export function isError<T = unknown>(value?: T): value is T & GenericError;

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
 * Generic in `T` per the family pattern. The narrow returns
 * `T & AbortError`; `T = unknown` collapses to `AbortError`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an abort error
 * @returns `true` when the value is an Error whose `name` is a string
 *  ending with `'AbortError'`, narrowing `value` to `T & AbortError`;
 *  `false` otherwise
 * @example
 * isAbortError(new DOMException('aborted', 'AbortError')); // true
 *
 * class TimeoutAbortError extends Error {
 *   override name = 'TimeoutAbortError';
 * }
 * isAbortError(new TimeoutAbortError());                   // true
 *
 * isAbortError(new Error('plain'));                        // false (no suffix)
 * isAbortError({ name: 'AbortError' });                    // false (not an Error)
 * isAbortError(null);                                      // false
 */
export function isAbortError<T = unknown>(value?: T): value is T & AbortError;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
