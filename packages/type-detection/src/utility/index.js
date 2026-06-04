// @ts-check

/**
 * @module @species-js/type-detection/utility
 *
 * Cached prototype references and type-signature helpers.
 *
 * Used internally by the package's predicates and exposed via subpath for
 * downstream packages that need the same cross-realm-safe primitives.
 */

import {
  getOwnPropertyDescriptors,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  objectKeys,
  toObjectString,
  isSafeIntegerValue,
} from '@/config';

import { isStringValue, isSymbolValue } from '@/primitive';
import { isCallable, isFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('./index').PropertyDescriptor} PropertyDescriptor */
/** @typedef {import('./index').ConstructorName} ConstructorName */
/** @typedef {import('./index').TypeSignature} TypeSignature */
/** @typedef {import('./index').TaggedType} TaggedType */
/** @typedef {import('./index').ResolvedType} ResolvedType */

/** @typedef {import('@/function').NewableFunction} NewableFunction */
/** @typedef {import('@/function').ES3Function} ES3Function */
/** @typedef {import('@/function').ClassConstructor} ClassConstructor */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype-Property Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether the value carries an own `prototype` property.
 *
 * The implementation guards nullish input with `!!value` first, so no
 * descriptor lookup runs on `null` or `undefined`. The descriptor read is
 * a single `getOwnPropertyDescriptor` call; inherited prototypes are
 * excluded at construction.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which has no own prototype
 * @returns {boolean} `true` when the value carries an own `prototype`
 *  property; `false` otherwise
 */
export function hasOwnPrototype(value) {
  return !!value && !!getOwnPropertyDescriptor(value, 'prototype');
}

/**
 * Detects whether the value carries an own `prototype` property whose
 * descriptor is `writable: true`.
 *
 * Uses the same nullish guard as {@link hasOwnPrototype}, plus a direct
 * read of the descriptor's `writable` field. This is the structural tell
 * of an {@link ES3Function} versus a {@link ClassConstructor}, whose own
 * `prototype` is read-only.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which has no own prototype
 * @returns {boolean} `true` when the value's own `prototype` exists and is
 *  writable; `false` otherwise
 */
export function hasOwnWritablePrototype(value) {
  return !!value && getOwnPropertyDescriptor(value, 'prototype')?.writable === true;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Property-Key Utilities
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `PropertyKey`.
 *
 * Composes `isStringValue`, `isSymbolValue`, and `isSafeIntegerValue` —
 * the last from `@/config`, capturing `Number.isSafeInteger` with a
 * polyfill fallback. The safe-integer restriction means numeric property
 * keys are limited to the range `[-(2^53 - 1), 2^53 - 1]` where they
 * round-trip losslessly. Finite-but-non-integer numbers like `1.5`
 * coerce to strings (`"1.5"`) at runtime with lookup surprises; integers
 * beyond `Number.MAX_SAFE_INTEGER` lose precision in the round-trip.
 * Both are excluded. `NaN` and `±Infinity` are also excluded — they fail
 * the finite check that underlies safe-integer.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a property key
 * @returns {value is PropertyKey} `true` when the value can be safely used
 *  as a property key; `false` otherwise
 */
export function isValidPropertyKey(value) {
  return isStringValue(value) || isSymbolValue(value) || isSafeIntegerValue(value);
}

/**
 * Returns the first {@link PropertyDescriptor} found while walking the
 * value's prototype chain.
 *
 * Uses the parameter-default-to-`null` pattern so the `!== null` loop
 * guard narrows `value` through each `getPrototypeOf` step. Each
 * iteration reads the own descriptor at the current level, then steps up
 * via `getPrototypeOf(value) ?? null`; the loop terminates on the first
 * descriptor hit or when the chain runs out.
 *
 * Accessor descriptors are returned as-is. The getter is never invoked.
 *
 * @param {unknown} value - the value whose descriptor chain should be
 *  inspected
 * @param {PropertyKey} key - the property key to resolve; invalid keys
 *  yield `undefined`
 * @returns {PropertyDescriptor | undefined} the first descriptor found while
 *  walking up the chain; `undefined` if none exists
 */
export function getNextAvailablePropertyDescriptor(value = null, key) {
  if (!isValidPropertyKey(key)) {
    return void 0;
  }
  /** @type {PropertyDescriptor | undefined} */
  let descriptor;

  while (!descriptor && value !== null) {
    descriptor = /** @type {PropertyDescriptor | undefined} */ (
      getOwnPropertyDescriptor(value, key)
    );
    value = getPrototypeOf(value) ?? null;
  }
  return descriptor;
}

/**
 * Returns the own string-keyed property names of a value, including
 * non-enumerable ones.
 *
 * Composes the cached `objectKeys` with `getOwnPropertyDescriptors`.
 * `getOwnPropertyDescriptors` writes every descriptor entry as enumerable
 * on its returned object, so `objectKeys` over that result surfaces every
 * own string-keyed name regardless of the source's enumerability.
 *
 * Symbol-keyed entries are excluded, since `objectKeys` reads strings only.
 *
 * The `value ?? !0` shorthand coerces nullish input to a boxed `true`,
 * which sidesteps the `TypeError` that `getOwnPropertyDescriptors(null)`
 * would raise.
 *
 * @param {unknown} [value] - the value whose own string-keyed property names
 *  should be returned; nullish (or omitted) yields `[]`
 * @returns {string[]} the array of own string-keyed property names
 * @example
 * const obj = Object.defineProperty({ a: 1 }, 'b', { value: 2 });
 * Object.keys(obj);                    // ['a']
 * getOwnPropertyDescriptorsKeys(obj);  // ['a', 'b']
 * getOwnPropertyDescriptorsKeys(null); // []
 */
export function getOwnPropertyDescriptorsKeys(value) {
  return objectKeys(getOwnPropertyDescriptors(value ?? !0));
}

/**
 * Returns the own string-keyed property names of a value as a `Set<string>`.
 *
 * Composes {@link getOwnPropertyDescriptorsKeys} with the `Set` constructor.
 *
 * The Set primitive carries set-equality, subset, and superset semantics
 * natively and supports per-key membership checks (`.has(key)`) directly.
 * This is the right primitive for shape-comparison checks that read
 * individual key presence or absence rather than full-shape equality.
 *
 * @param {unknown} [value] - the value whose own string-keyed names should
 *  be returned as a Set; nullish (or omitted) yields an empty `Set`
 * @returns {Set<string>} a `Set` of the value's own string-keyed property
 *  names
 * @example
 * const obj = Object.defineProperty({ a: 1 }, 'b', { value: 2 });
 * getOwnPropertyDescriptorsKeySet(obj);   // Set { 'a', 'b' }
 * getOwnPropertyDescriptorsKeySet({});    // Set {}
 * getOwnPropertyDescriptorsKeySet(null);  // Set {}
 */
export function getOwnPropertyDescriptorsKeySet(value) {
  return new Set(getOwnPropertyDescriptorsKeys(value));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Tests whether the value carries a callable data property at `key`,
 * reachable through its prototype chain.
 *
 * The lookup walks the prototype chain via own-descriptor reads at
 * each level, matching how ECMA-262 `Get(value, key)` resolves the
 * property at runtime. A `key` found anywhere along the chain — own
 * or inherited — satisfies the predicate, provided the descriptor is
 * a data descriptor whose value is callable.
 *
 * "Inert" refers to the inspect-without-invoke guarantee. The check
 * confirms callability via descriptor reads, never by accessing the
 * property directly. An accessor `get key()` would fire on access
 * regardless of whether the getter returns a callable; the predicate
 * rejects accessor descriptors, so the inspection itself remains inert.
 *
 * Used by Promise-contract predicates to verify the spec-defined `then`,
 * `catch`, and `finally` methods of a _thenable_ or _promise-like_
 * type without triggering side effects. The helper is general-purpose:
 * any method-contract predicate that needs the inspect-without-invoke
 * guarantee should compose it.
 *
 * @param {unknown} type - the value to inspect
 * @param {PropertyKey} key - the property key to resolve through the
 *  value's prototype chain
 * @returns {boolean} `true` when the value carries a callable data
 *  property at `key` in its prototype chain; `false` otherwise
 * @example
 * hasInertMethod(Promise.resolve(), 'then');                   // true (inherited)
 * hasInertMethod({ then: () => {} }, 'then');                  // true (own)
 * hasInertMethod({}, 'then');                                  // false
 * hasInertMethod({ get then() { return () => {}; } }, 'then'); // false (accessor)
 * hasInertMethod(null, 'then');                                // false
 */
export function hasInertMethod(type = null, key) {
  return (
    type !== null && isCallable(getNextAvailablePropertyDescriptor(type, key)?.value)
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Signature Readers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns the value's internal `[[Class]]` signature.
 *
 * Reads the tag through the cached `Object.prototype.toString.call`. Uses
 * `args.length` to distinguish an omitted call from one that explicitly
 * passed `undefined`. Explicit `undefined` yields `'[object Undefined]'`;
 * an omitted call yields `undefined`.
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value to
 *  read; presence is detected via `args.length` rather than `!== undefined`
 * @returns {TypeSignature | undefined} the `[object Tag]` string when an
 *  argument was provided; `undefined` when no argument was passed
 * @example
 * getTypeSignature([]);                // '[object Array]'
 * getTypeSignature(null);              // '[object Null]'
 * getTypeSignature(Promise.resolve()); // '[object Promise]'
 * getTypeSignature();                  // undefined
 */
export function getTypeSignature(...args) {
  const /** @type {unknown} */ value = args[0];

  return /** @type {TypeSignature | undefined} */ (
    (args.length > 0 && /** @type {TypeSignature} */ toObjectString.call(value)) ||
      /** @type {undefined} */ value
  );
}

/**
 * Returns the tag portion of the type signature.
 *
 * Calls {@link getTypeSignature} and slices `[object ` and `]` off the
 * result. The `isStringValue` check short-circuits the no-argument case,
 * where `getTypeSignature` returned `undefined`.
 *
 * @param {...unknown} args - forwarded as-is to {@link getTypeSignature};
 *  presence is detected from its return value
 * @returns {TaggedType | undefined} the tag substring when an argument was
 *  provided; `undefined` when no argument was passed
 * @example
 * getTaggedType([]);                                 // 'Array'
 * getTaggedType(new Date());                         // 'Date'
 * getTaggedType({ [Symbol.toStringTag]: 'Custom' }); // 'Custom'
 * getTaggedType();                                   // undefined
 */
export function getTaggedType(...args) {
  const result = getTypeSignature(...args);

  return /** @type {TaggedType | undefined} */ (
    (isStringValue(result) && /** @type {TaggedType} */ result.slice(8, -1).trim()) ||
      /** @type {undefined} */ result
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Constructor Inspection
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Walks the value to its constructor function.
 *
 * Inspects up to four sources in order, gated by {@link isFunction} at
 * each step:
 *
 * 1. The value's own `constructor` descriptor.
 * 2. The meta-constructor on that value (`constructor.constructor`).
 * 3. The prototype's `constructor` descriptor.
 * 4. The prototype's meta-constructor.
 *
 * If all four are unreachable or non-callable, the result is `undefined`.
 *
 * The return type is {@link NewableFunction} because a real constructor is
 * newable by definition. The runtime guard verifies callability only,
 * since the `[[Construct]]` slot cannot be probed without invoking, so the
 * newable claim is asserted rather than verified.
 *
 * @param {unknown} [value] - the value whose constructor should be retrieved
 * @returns {NewableFunction | undefined} the constructor function when
 *  reachable; `undefined` otherwise
 * @example
 * getDefinedConstructor([]);                  // Array
 * getDefinedConstructor(new Date());          // Date
 * getDefinedConstructor(Object.create(null)); // undefined
 */
export function getDefinedConstructor(value = null) {
  if (value === null) {
    return void 0;
  }
  const constructor =
    /** @type {unknown} */ (
      getOwnPropertyDescriptor(/** @type {object} */ (value), 'constructor')?.value
    ) ?? /** @type {{ constructor?: unknown }} */ (value).constructor;

  if (isFunction(constructor)) {
    return /** @type {NewableFunction} */ (constructor);
  } else {
    // Meta-constructor fallback. Direct `constructor?.constructor` access is
    // deliberate, not a defensive miss: `constructor` on the constructor is
    // inherited via the prototype chain (e.g. `%GeneratorFunction%.constructor`
    // resolves through `%Function.prototype%` to `%Function%`), and the
    // engine's prototype-chain walk is the spec-correct resolution. A
    // descriptor-first read here would return `undefined` for every
    // inherited case and fall through to direct access anyway. See
    // [[design-rulings]] "spec-shape determines the access path".
    const creator = /** @type {{ constructor?: unknown } | null | undefined} */ (
      constructor
    )?.constructor;

    if (isFunction(creator)) {
      return /** @type {NewableFunction} */ (creator);
    }
  }
  // Value's own `constructor` slot is unusable — replaced, or the value was
  // created via `Object.create(null)`. Fall through to the prototype's
  // `constructor` as the next-best source.

  const prototype = getPrototypeOf(value) ?? null;

  if (prototype === null) {
    return void 0;
  }

  const protoConstructor =
    /** @type {unknown} */ (getOwnPropertyDescriptor(prototype, 'constructor')?.value) ??
    /** @type {{ constructor?: unknown }} */ (prototype).constructor;

  if (isFunction(protoConstructor)) {
    return /** @type {NewableFunction} */ (protoConstructor);
  } else {
    // Prototype-side meta-constructor fallback. Same rationale as the
    // value-side meta-constructor step above: direct access lets the
    // engine resolve `constructor.constructor` through the prototype
    // chain, which is the spec-correct path for inherited reciprocal
    // references (GeneratorFunction↔Generator, etc.). See
    // [[design-rulings]] "spec-shape determines the access path".
    const protoCreator = /** @type {{ constructor?: unknown } | null | undefined} */ (
      protoConstructor
    )?.constructor;

    if (isFunction(protoCreator)) {
      return /** @type {NewableFunction} */ (protoCreator);
    }
  }
  return void 0;
}

/**
 * Returns the constructor's `name`.
 *
 * Composes {@link getDefinedConstructor} with a descriptor-based `name`
 * read, then narrows the result via {@link isStringValue}.
 *
 * Edge cases:
 *
 * - A non-string `name` (for example, a malicious replacement) yields
 *   `undefined` rather than leaking through.
 * - An unnamed function returns the empty string `''`.
 * - A value with no reachable constructor returns `undefined`.
 *
 * @param {unknown} [value] - the value whose constructor name should be
 *  retrieved
 * @returns {ConstructorName | undefined} the constructor's `name` string
 *  when reachable; `undefined` otherwise
 * @example
 * getDefinedConstructorName([]);         // 'Array'
 * getDefinedConstructorName(new Date()); // 'Date'
 * getDefinedConstructorName(null);       // undefined
 */
export function getDefinedConstructorName(value) {
  const constructor = getDefinedConstructor(value) ?? null;
  if (constructor === null) {
    return void 0;
  }
  // `name` is spec-defined as an own data descriptor on every function
  // (ECMA-262 §10.2.9 `SetFunctionName`). Reading via the descriptor
  // returns the data value directly; an accessor `get name()` — e.g. a
  // malicious replacement — leaves `descriptor.value` undefined and is
  // therefore rejected by the `isStringValue` narrow. No direct-access
  // fallback, because direct access would invoke the accessor.
  const name = /** @type {unknown} */ (
    getOwnPropertyDescriptor(/** @type {object} */ (constructor), 'name')?.value
  );
  if (!isStringValue(name)) {
    return void 0;
  }
  return name;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type Resolution
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Resolves a value to its type-name.
 *
 * Tries the constructor-name when reachable; falls back to the
 * tagged-type otherwise. The fallback also fires when the value's
 * `constructor` slot has been replaced with a non-callable.
 *
 * Works for every built-in. Custom types remain stable across
 * minification only if both the constructor's `name` descriptor and the
 * prototype's `Symbol.toStringTag` are frozen.
 *
 * Uses `args.length` to distinguish an omitted call from one that
 * explicitly passed `undefined`.
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value;
 *  presence is detected via `args.length`
 * @returns {ResolvedType | undefined} the resolved type-name when an
 *  argument was provided; `undefined` when no argument was passed
 * @example
 * resolveType([]);                // 'Array'
 * resolveType(Promise.resolve()); // 'Promise'
 * resolveType(null);              // 'Null'
 * resolveType();                  // undefined
 */
export function resolveType(...args) {
  const /** @type {unknown} */ value = args[0];

  if (args.length === 0) {
    return /** @type {undefined} */ (value);
  }
  const resolvedType = getDefinedConstructorName(value) ?? null;

  if (resolvedType === null) {
    // Covers `undefined`, `null`, and prototype-less objects.
    return getTaggedType(value);
  }
  const constructor =
    /** @type {unknown} */ (
      getOwnPropertyDescriptor(/** @type {object} */ (value), 'constructor')?.value
    ) ?? /** @type {{ constructor?: unknown }} */ (value).constructor;

  if (!isFunction(constructor)) {
    // Value has no function-typed `constructor` slot — fall back to the tag.
    return getTaggedType(value);
  }
  return resolvedType;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
