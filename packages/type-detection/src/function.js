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
  getDefinedConstructor,
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
/** @typedef {import('@/function').Generator} Generator */
/** @typedef {import('@/function').AsyncGenerator} AsyncGenerator */
/** @typedef {import('@/function').GeneratorFunction} GeneratorFunction */
/** @typedef {import('@/function').AsyncGeneratorFunction} AsyncGeneratorFunction */
/** @typedef {import('@/function').AnyGeneratorFunction} AnyGeneratorFunction */

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
 * Tests whether a value carries the runtime "shape" of the `%AsyncFunction%`
 * intrinsic — composes the four realm-independent markers any such value
 * must exhibit: no own `prototype`, no `[[Construct]]`, `Symbol.toStringTag`
 * equals `'AsyncFunction'`, and the resolved constructor name equals
 * `'AsyncFunction'`. Returns plain `boolean`; narrowing is
 * {@link isAsyncFunction}'s job, which also runs the same-realm `instanceof`
 * fast path before delegating here.
 *
 * Standalone — does not pre-gate via {@link isFunction}, so the helper can
 * be tested directly against any value. Non-callables fall through the
 * marker chain and return `false` (no own prototype, no `[[Construct]]`,
 * non-matching tag).
 *
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when all four markers match; `false` otherwise
 * @internal
 */
export function hasAsyncFunctionShape(value) {
  return (
    !hasOwnPrototype(value) &&
    !hasConstructSlot(value) &&
    getTypeSignature(value) === '[object AsyncFunction]' &&
    getDefinedConstructorName(value) === 'AsyncFunction'
  );
}

/**
 * Narrows a value to {@link AsyncFunction} — orchestrates three phases:
 * the `isFunction` gate, a same-realm `instanceof` fast path against the
 * captured `%AsyncFunction%` intrinsic, then the realm-independent
 * structural check via {@link hasAsyncFunctionShape}. The fast path lands
 * the common case in one `[[Prototype]]` walk; the shape check is the
 * cross-realm fallback (foreign-realm async functions have a different
 * `%AsyncFunction%` identity but the same observable markers).
 *
 * Admits all four source forms AND their bound variants — `bind` preserves
 * the prototype chain, so the local-realm fast path admits bound async
 * functions directly and the cross-realm fallback admits foreign-realm
 * bound async functions via the shape check.
 *
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
    (value instanceof AsyncFunctionConstructor || hasAsyncFunctionShape(value))
  );
}

const AsyncFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(async () => Promise.resolve())
);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generator Function Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Tests whether a value carries the runtime "shape" of the
 * `%GeneratorFunction%` intrinsic — composes the three realm-independent
 * markers: no `[[Construct]]`, `Symbol.toStringTag === 'GeneratorFunction'`,
 * and the resolved constructor name `=== 'GeneratorFunction'`.
 *
 * No prototype-slot check (unlike {@link hasAsyncFunctionShape}) — unbound
 * generator functions carry an own writable `prototype`, bound ones don't;
 * `bind` strips own slots, so admitting both forms requires omitting any
 * prototype-slot assertion. The tag and constructor-name resolution are
 * preserved via the prototype chain in both cases.
 *
 * Returns plain `boolean`; narrowing is {@link isGeneratorFunction}'s job.
 *
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when all three markers match; `false` otherwise
 * @internal
 */
export function hasGeneratorFunctionShape(value) {
  return (
    !hasConstructSlot(value) &&
    getTypeSignature(value) === '[object GeneratorFunction]' &&
    getDefinedConstructorName(value) === 'GeneratorFunction'
  );
}

/**
 * Narrows a value to {@link GeneratorFunction} — orchestrates the three
 * phases: `isFunction` gate, same-realm `instanceof` fast path against the
 * captured `%GeneratorFunction%` intrinsic, then the realm-independent
 * fallback via {@link hasGeneratorFunctionShape}.
 *
 * Admits sync-generator function declarations, expressions, concise-method
 * forms, AND their bound variants — `bind` preserves the prototype chain.
 * Async-generator functions are *not* in this family: they trace to
 * `%AsyncGeneratorFunction%`. Use {@link isAsyncGeneratorFunction} or
 * {@link isAnyGeneratorFunction}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a generator function
 * @returns {value is GeneratorFunction} `true` when the value is a
 *  sync-generator function; `false` otherwise
 * @example
 * isGeneratorFunction(function* () {});            // true
 * isGeneratorFunction((function* () {}).bind(null)); // true — bound forms admitted
 * isGeneratorFunction(async function* () {});      // false — async-generator family
 * isGeneratorFunction(async () => {});             // false — async-function family
 */
export function isGeneratorFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof GeneratorFunctionConstructor || hasGeneratorFunctionShape(value))
  );
}

/**
 * Tests whether a value carries the runtime "shape" of the
 * `%AsyncGeneratorFunction%` intrinsic — composes the three realm-independent
 * markers: no `[[Construct]]`,
 * `Symbol.toStringTag === 'AsyncGeneratorFunction'`, and the resolved
 * constructor name `=== 'AsyncGeneratorFunction'`. Same no-prototype-slot
 * rationale as {@link hasGeneratorFunctionShape} (bound vs. unbound differ
 * on the slot; both should be admitted).
 *
 * Returns plain `boolean`; narrowing is {@link isAsyncGeneratorFunction}'s
 * job.
 *
 * @param {unknown} [value] - the value to inspect
 * @returns {boolean} `true` when all three markers match; `false` otherwise
 * @internal
 */
export function hasAsyncGeneratorFunctionShape(value) {
  return (
    !hasConstructSlot(value) &&
    getTypeSignature(value) === '[object AsyncGeneratorFunction]' &&
    getDefinedConstructorName(value) === 'AsyncGeneratorFunction'
  );
}

/**
 * Narrows a value to {@link AsyncGeneratorFunction} — orchestrates the
 * three phases: `isFunction` gate, same-realm `instanceof` fast path
 * against the captured `%AsyncGeneratorFunction%` intrinsic, then the
 * realm-independent fallback via {@link hasAsyncGeneratorFunctionShape}.
 *
 * Admits `async function*` declarations, expressions, async concise
 * methods, AND their bound variants. NOT a member: async functions (they
 * trace to `%AsyncFunction%`, a different intrinsic — see
 * {@link isAsyncFunction}); sync generator functions (use
 * {@link isGeneratorFunction}).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an async-generator function
 * @returns {value is AsyncGeneratorFunction} `true` when the value is an
 *  async-generator function; `false` otherwise
 * @example
 * isAsyncGeneratorFunction(async function* () {});           // true
 * isAsyncGeneratorFunction((async function* () {}).bind(null)); // true
 * isAsyncGeneratorFunction(function* () {});                 // false — sync generator
 * isAsyncGeneratorFunction(async () => {});                  // false — async function
 */
export function isAsyncGeneratorFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof AsyncGeneratorFunctionConstructor ||
      hasAsyncGeneratorFunctionShape(value))
  );
}

/**
 * Narrows a value to {@link AnyGeneratorFunction} — the umbrella over both
 * sync and async generator-function species. Composes the two single-family
 * orchestrator pieces: `isFunction` gate + EITHER instanceof fast path
 * passes OR EITHER shape helper passes.
 *
 * No dedicated `hasAnyGeneratorFunctionShape` helper — the umbrella's job is
 * exactly the union, and composing the two single-family shape helpers is
 * the codified pattern (recorded in `project_function_type_hierarchy`).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a generator function
 * @returns {value is AnyGeneratorFunction} `true` when the value is either a
 *  sync or async generator function (including bound variants); `false`
 *  otherwise
 */
export function isAnyGeneratorFunction(value) {
  return (
    isFunction(value) &&
    (value instanceof GeneratorFunctionConstructor ||
      value instanceof AsyncGeneratorFunctionConstructor ||
      hasGeneratorFunctionShape(value) ||
      hasAsyncGeneratorFunctionShape(value))
  );
}

const GeneratorFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(function* () {
    yield;
  })
);

const AsyncGeneratorFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(async function* () {
    await Promise.resolve();
    yield;
  })
);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
