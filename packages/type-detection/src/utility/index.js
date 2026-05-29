// @ts-check

/**
 * @module @species-js/type-detection/utility
 *
 * Cached prototype references and type-signature helpers, used internally by
 * the package's predicates and exposed via subpath for downstream packages
 * that need the same cross-realm-safe primitives.
 */

import { getOwnPropertyDescriptor, getPrototypeOf, toObjectString } from '@/config';

import { isFunction } from '@/function';
import { isNumberValue, isStringValue, isSymbolValue } from '@/primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('./index').PropertyDescriptor} PropertyDescriptor */
/** @typedef {import('./index').TypeSignature} TypeSignature */
/** @typedef {import('./index').TaggedType} TaggedType */
/** @typedef {import('./index').ConstructorName} ConstructorName */
/** @typedef {import('./index').ResolvedType} ResolvedType */

/** @typedef {import('@/function').NewableFunction} NewableFunction */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype-Property Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects an own `prototype` property — `!!value &&` first to handle nullish
 * (no descriptor lookup on `null` / `undefined`), then a single
 * `Object.getOwnPropertyDescriptor` read. Inherited prototypes are excluded
 * at construction.
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
 * Detects an own `prototype` property whose descriptor is `writable: true` —
 * the same nullish guard as {@link hasOwnPrototype} plus a direct read of the
 * descriptor's `writable` field. The structural tell of an ES3 function
 * versus a class constructor.
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
 * Narrows a value to `PropertyKey` — composes the three primitive guards
 * (`isStringValue`, `isSymbolValue`, `isNumberValue`) and adds `Number.isFinite`
 * to reject `NaN` and `±Infinity` (which coerce to property keys but introduce
 * lookup surprises).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a property key
 * @returns {value is PropertyKey} `true` when the value can be safely used as
 *  a property key; `false` otherwise
 */
export function isValidPropertyKey(value) {
  return (
    isStringValue(value) ||
    isSymbolValue(value) ||
    (isNumberValue(value) && Number.isFinite(value))
  );
}

/**
 * Returns the first {@link PropertyDescriptor} found while walking the value's
 * prototype chain. Uses a typed `currentValue: object | null` local, so the
 * loop's `!== null` check narrows correctly through the `getPrototypeOf`
 * step; accessor descriptors are returned as-is (the getter is never
 * invoked).
 *
 * @param {object} value - the object whose descriptor chain should be
 *  inspected
 * @param {PropertyKey} key - the property key to resolve; invalid keys yield
 *  `undefined`
 * @returns {PropertyDescriptor | undefined} the first descriptor found while
 *  walking up the chain; `undefined` if none exists
 */
export function getNextAvailablePropertyDescriptor(value, key) {
  if (!isValidPropertyKey(key)) {
    return void 0;
  }
  let descriptor;

  /** @type {object | null} */
  let currentValue = value;

  while (!descriptor && currentValue !== null) {
    descriptor = getOwnPropertyDescriptor(currentValue, key);

    currentValue = /** @type {object | null} */ (
      /** @type {unknown} */ (getPrototypeOf(currentValue)) ?? null
    );
  }
  return descriptor;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Signature Readers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns the value's internal `[[Class]]` signature via the cached
 * `Object.prototype.toString.call`. Uses `args.length` to distinguish an
 * omitted call from one that explicitly passed `undefined` — the latter yields
 * `'[object Undefined]'`, the former yields `undefined`.
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
 * Returns the tag portion of the type signature — calls
 * {@link getTypeSignature} and slices `[object ` / `]` off the result.
 * `isStringValue` short-circuits the no-argument case (where
 * `getTypeSignature` returned `undefined`).
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
 * Walks the value to its constructor function. Tries up to four sources in
 * order: the value's own `constructor` descriptor, its
 * `constructor.constructor` (meta-constructor), the prototype's `constructor`
 * descriptor, and the prototype's `constructor.constructor`. Each candidate is
 * gated by {@link isFunction}; failure at every step returns `undefined`.
 *
 * The return is cast to {@link NewableFunction} because a real constructor is
 * by definition newable — but `[[Construct]]` cannot be probed without
 * invoking, so this is an assertion grounded in the runtime callability check,
 * not a verified property.
 *
 * @param {unknown} [value] - the value whose constructor should be retrieved
 * @returns {NewableFunction | undefined} the constructor function when
 *  reachable; `undefined` otherwise
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

  const prototype = /** @type {object | null} */ (
    /** @type {unknown} */ (getPrototypeOf(value)) ?? null
  );

  if (prototype === null) {
    return void 0;
  }

  const protoConstructor =
    /** @type {unknown} */ (getOwnPropertyDescriptor(prototype, 'constructor')?.value) ??
    /** @type {{ constructor?: unknown }} */ (prototype).constructor;

  if (isFunction(protoConstructor)) {
    return /** @type {NewableFunction} */ (protoConstructor);
  } else {
    // Prototype's `constructor` is also unusable; one more level — the
    // meta-constructor (`constructor.constructor`) — before giving up.
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
 * Returns the constructor's `name` — composes {@link getDefinedConstructor}
 * with a property read, then narrows via {@link isStringValue} so that a
 * non-string `name` (a malicious replacement) yields `undefined` rather than
 * leaking.
 *
 * @param {unknown} [value] - the value whose constructor name should be
 *  retrieved
 * @returns {ConstructorName | undefined} the constructor's `name` string when
 *  reachable; `undefined` otherwise
 */
export function getDefinedConstructorName(value) {
  const constructor = getDefinedConstructor(value) ?? null;
  if (constructor === null) {
    return void 0;
  }
  const { name } = constructor;
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
 * Resolves the value to its type-name — tries the constructor-name path
 * first, falling back to the tagged-type when the constructor is unreachable
 * or when the constructor slot itself is non-function (i.e., the value's
 * `constructor` was replaced with something non-callable). Uses `args.length`
 * to distinguish an omitted call from an explicit `undefined`.
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value;
 *  presence is detected via `args.length`
 * @returns {ResolvedType | undefined} the resolved type-name when an argument
 *  was provided; `undefined` when no argument was passed
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
