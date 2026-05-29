// @ts-check

import { getOwnPropertyDescriptor, getPrototypeOf, toObjectString } from '@/config';

import { isFunction } from '@/function';
import { isNumberValue, isStringValue, isSymbolValue } from '@/primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('./index').TypeSignature} TypeSignature */
/** @typedef {import('./index').TaggedType} TaggedType */
/** @typedef {import('./index').ConstructorName} ConstructorName */
/** @typedef {import('./index').ResolvedType} ResolvedType */

/** @typedef {import('@/function').NewableFunction} NewableFunction */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether a passed value features an own `prototype` property.
 * @param {unknown} [value]
 *  An optionally passed value of an unknown type. Most naturally,
 *  a function type is assumed but is not explicitly checked for.
 * @returns {boolean}
 *  A boolean value that indicates whether the
 *  passed value features an own `prototype` property.
 */
export function hasOwnPrototype(value) {
  return !!value && !!getOwnPropertyDescriptor(value, 'prototype');
}

/**
 * Detects whether a passed value features an own, truly `writable`
 * `prototype` property.
 * @param {unknown} [value]
 *  An optionally passed value of an unknown type. Most naturally,
 *  a function type is assumed but is not explicitly checked for.
 * @returns {boolean}
 *  A boolean value that indicates whether the passed type
 *  features an own, truly `writable` `prototype` property.
 */
export function hasOwnWritablePrototype(value) {
  return !!value && getOwnPropertyDescriptor(value, 'prototype')?.writable === true;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether a passed value is a valid JavaScript property key.
 * @param {unknown} [value]
 *  The value to validate.
 * @returns {value is PropertyKey}
 *  Whether the value can be safely used as a property key.
 */
export function isValidPropertyKey(value) {
  return (
    isStringValue(value) ||
    isSymbolValue(value) ||
    (isNumberValue(value) && Number.isFinite(value))
  );
}

/**
 * Returns a property descriptor from an object's prototype chain without
 * invoking accessors.
 *
 * @param {object} value
 *  The object whose descriptor chain should be inspected.
 * @param {PropertyKey} key
 *  The property key to resolve.
 * @returns {PropertyDescriptor | undefined}
 *  The resolved property descriptor, if present.
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

/**
 * Returns the internal `[[Class]]` tag of an optionally passed value by
 * utilizing `Object.prototype.toString.call` or returns the `undefined`
 * value in case no argument was passed.
 * @param {...unknown} args
 *  A variadic argument list. The first argument (`args[0]`) is the optional
 *  `value` parameter. Its **presence** is detected via `args.length`, allowing
 *  the function to distinguish between an explicitly passed `undefined` value
 *  and a completely omitted argument.
 * @returns {TypeSignature | undefined}
 *  The value’s internal type-signature string (e.g., `"[object Promise]"`),
 *  or the `undefined` value if no argument was passed.
 * @example
 *  getTypeSignature([]); // "[object Array]"
 *  getTypeSignature(null); // "[object Null]"
 *  getTypeSignature(Promise.resolve()); // "[object Promise]"
 *  getTypeSignature(); // undefined
 */
export function getTypeSignature(...args) {
  const /** @type {unknown} */ value = args[0];

  return /** @type {TypeSignature | undefined} */ (
    (args.length > 0 && /** @type {TypeSignature} */ toObjectString.call(value)) ||
      /** @type {undefined} */ value
  );
}

/**
 * Returns the tag name extracted from a value's internal type signature.
 *
 * This function wraps `getTypeSignature` and extracts the value’s internal
 * `[[Class]]` tag name - e.g., `'Array'` for arrays, `'Date'` for dates, or
 * even `'FooBar'` for objects _"spoofed"_ via `Symbol.toStringTag` ...
 *
 * ```js
 * const myObj = { foo: 'bar' }
 * myObj[Symbol.toStringTag] = 'FooBar';
 * ```
 *
 * If no argument is passed, the function returns `undefined`.
 *
 * ### Note
 * The tag name is the portion inside the brackets of the full type signature:
 *
 * ```js
 * Object.prototype.toString.call([]); // => '[object Array]'
 * ```
 *
 * Custom tag names can be defined via the `Symbol.toStringTag` property.
 *
 * Full example code for a successful _"spoofing"_ attempt:
 *
 * ```js
 * const myObj = { foo: 'bar' }
 * myObj[Symbol.toStringTag] = 'FooBar';
 *
 * console.log(myObj+'');                               // '[object FooBar]'
 * console.log(String(myObj));                          // '[object FooBar]'
 * console.log(myObj.toString());                       // '[object FooBar]'
 * console.log(Object.prototype.toString.call(myObj));  // '[object FooBar]'
 * ```
 *
 * This works for both custom types and overrides of built-in types.
 * @param {...unknown} args
 *  A variadic argument list. The first argument (`args[0]`) is optional.
 *  Its **presence** is detected via the result of the forwarding call to
 *  `getTypeSignature`.
 * @returns {TaggedType | undefined}
 *  The extracted tag name (e.g. `'Array'`, `'Date'`) or `undefined` if no
 *  value was provided.
 */
export function getTaggedType(...args) {
  const result = getTypeSignature(...args);

  return /** @type {TaggedType | undefined} */ (
    (isStringValue(result) && /** @type {TaggedType} */ result.slice(8, -1).trim()) ||
      /** @type {undefined} */ result
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Retrieves a value's constructor function if available.
 *
 * This function traverses the prototype chain to find a valid constructor,
 * handling edge cases like manipulated `constructor` slots and objects
 * created via `Object.create(null)`.
 *
 * Note: The return type is `NewableFunction` because constructor functions
 * are by definition newable. However, TypeScript's `isFunction` type guard
 * only narrows to `VerifiedFunction` (callable and maybe newable), but not
 * explicitly/strictly to `NewableFunction`.
 * Since there's no reliable runtime way to detect the `[[Construct]]` internal
 * method, we use type assertions here - the runtime guards ensure correctness.
 * @param {unknown} [value]
 *  An optionally passed value of any type.
 * @returns {NewableFunction | undefined}
 *  If available, the passed value's constructor-function - either a built-in
 *  type's constructor-function or an ES6-class constructor-function or an
 *  ES3-function - otherwise `undefined`.
 */
export function getDefinedConstructor(value = null) {
  // guard.
  if (value === null) {
    // explicitly return an `undefined` value due to type-checker issues.
    return void 0;
  }
  const constructor =
    /** @type {unknown} */ (
      getOwnPropertyDescriptor(/** @type {object} */ (value), 'constructor')?.value
    ) ?? /** @type {{ constructor?: unknown }} */ (value).constructor;

  // various guards.
  if (isFunction(constructor)) {
    // exit early with a valid result.
    return /** @type {NewableFunction} */ (constructor);
  } else {
    const creator = /** @type {{ constructor?: unknown } | null | undefined} */ (
      constructor
    )?.constructor;

    if (isFunction(creator)) {
      // exit early with a valid result.
      return /** @type {NewableFunction} */ (creator);
    }
  }
  // - in case function execution reaches beyond this comment,
  //   the `constructor` slot most probably has been manipulated, ...
  //
  //   ... or the passed `value` was created via `Object.create(null)`.

  const prototype = /** @type {object | null} */ (
    /** @type {unknown} */ (getPrototypeOf(value)) ?? null
  );

  // guard.
  if (prototype === null) {
    // explicitly return an `undefined` value due to type-checker issues.
    return void 0;
  }
  // - in case function execution reaches beyond this comment,
  //   the `constructor` slot definitely has been maliciously
  //   manipulated.

  const protoConstructor =
    /** @type {unknown} */ (getOwnPropertyDescriptor(prototype, 'constructor')?.value) ??
    /** @type {{ constructor?: unknown }} */ (prototype).constructor;

  // various guards.
  if (isFunction(protoConstructor)) {
    // exit with a probably still valid result.
    return /** @type {NewableFunction} */ (protoConstructor);
  } else {
    const protoCreator = /** @type {{ constructor?: unknown } | null | undefined} */ (
      protoConstructor
    )?.constructor;

    if (isFunction(protoCreator)) {
      // exit with a probably still valid result.
      return /** @type {NewableFunction} */ (protoCreator);
    }
  }
  // explicitly return an `undefined` value due to type-checker issues.
  return void 0;
}

/**
 * Implements a getter for the passed value's constructor-function name.
 * In case of being able to retrieve a constructor, the remaining constraint
 * is due to any function's `name` related property descriptor, which by default,
 * hence without any intentional further change, is ...
 *
 * ```
 * { ... writable: false, enumerable: false, configurable: true }
 * ```
 *
 * ...
 * - neither writable
 * - nor enumerable
 * - but configurable.
 *
 * Thus, something like ...
 *
 * ```
 * Object.defineProperty(fct, 'name', { value: 'FOO' })
 * ```
 *
 * ... will change any passed function's `name`-value to "FOO". As long
 * as the latter can be safely excluded, the detection approach is safe.
 * One even can or better yet should take advantage of it, branding a
 * function permanently, in order to e.g., let constructor functions
 * harden each their name as a countermeasure to code-minification tasks.
 * @param {unknown} [value]
 *  An optionally passed value of any type.
 * @returns {ConstructorName | undefined}
 *  if available, the passed value's constructor-function name - retrieved
 *  exclusively from linked property-descriptors - otherwise `undefined`.
 *  Any unnamed function refers to the empty string value/`''` as its name.
 */
export function getDefinedConstructorName(value) {
  const constructor = getDefinedConstructor(value) ?? null;

  // guard.
  if (constructor === null) {
    // explicitly return an `undefined` value.
    return void 0;
  }
  const { name } = constructor;

  if (!isStringValue(name)) {
    // explicitly return an `undefined` value.
    return void 0;
  }
  return name;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Resolves the passed value's type-name through a combined, balanced approach of
 * retrieving either the value's constructor-function name or its `toString` tag.
 *
 * This works for every built-in type.
 *
 * In order to assure stable type-identity of custom type systems, based
 * on both class- and ES3-constructor functions, that remain unaffected
 * by code minification processes, one has to apply a utility function
 * which does permanently brand such types by writing and freezing both
 * of a constructor-function's property-descriptors - the function's `name`
 * property and its `Symbol.toStringTag` slot.
 * @param {...unknown} args
 *  A variadic argument list. The first argument (`args[0]`) is the optional
 *  `value` parameter. Its **presence** is detected via `args.length`, allowing
 *  the function to distinguish between an explicitly passed `undefined` value
 *  and a completely omitted argument.
 * @returns {ResolvedType | undefined}
 *  A `'string'` value which either corresponds with the passed value's
 *  constructor-function's name or its tagged type; or the `undefined`
 *  value if no argument was passed.
 */
export function resolveType(...args) {
  const /** @type {unknown} */ value = args[0];

  // guard.
  if (args.length === 0) {
    // - covers the omitted value.
    return /** @type {undefined} */ (value);
  }
  const resolvedType = getDefinedConstructorName(value) ?? null;

  // guard.
  if (resolvedType === null) {
    // - covers the `undefined` and the `null` value
    //   as well as objects created via `Object.create(null)`.
    return getTaggedType(value);
  }
  // - The following block provides a more generic solution ...

  const constructor =
    /** @type {unknown} */ (
      getOwnPropertyDescriptor(/** @type {object} */ (value), 'constructor')?.value
    ) ?? /** @type {{ constructor?: unknown }} */ (value).constructor;

  // guard.
  if (!isFunction(constructor)) {
    // - covers any value that does not have a function-type `constructor` property.
    return getTaggedType(value);
  }
  return resolvedType;

  // ... to special cases like the one of ...
  //
  // // - `Generator` and `AsyncGenerator` instances (objects) as well as
  // //   `GeneratorFunction` and `AsyncGeneratorFunction` types (functions)
  // //   need to be handled separately, in order to distinguish them.
  // ((
  //
  //   (resolvedType === 'GeneratorFunction' || resolvedType === 'AsyncGeneratorFunction') &&
  //   getTaggedType(value)
  //
  // ) || resolvedType);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
