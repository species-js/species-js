// @ts-check

/**
 * @module @species-js/type-detection/object
 *
 * Object-shape discrimination.
 *
 * Three predicates compose: {@link isObject} (the structural floor),
 * {@link isPlainObject} (strict subtype: constructor === Object), and
 * {@link isDictionaryObject} (strict subtype: no prototype chain).
 * The two strict predicates use cross-realm-safe machinery
 * (`getPrototypeOf` from `@/config`; `getTypeSignature`,
 * `getDefinedConstructor`, `getDefinedConstructorName` from
 * `@/utility`) — they discriminate the constructor identity
 * realm-independently rather than via local `instanceof Object` which
 * would miss cross-realm Plain Objects.
 *
 * See the sibling `.d.ts` for type definitions and the per-predicate
 * specification; this `.js` carries the runtime implementation with
 * parallel JSDoc.
 */

import { getPrototypeOf } from '@/config';

import {
  getTypeSignature,
  getDefinedConstructor,
  getDefinedConstructorName,
} from '@/utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/object').AnyObject} AnyObject */
/** @typedef {import('@/object').PlainObject} PlainObject */
/** @typedef {import('@/object').DictionaryObject} DictionaryObject */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link AnyObject} — any non-null, non-function
 * object — via `!!value && typeof value === 'object'`.
 *
 * The truthiness gate rejects `null`, `undefined`, and all falsy
 * primitives in O(1); the `typeof` gate rejects truthy primitives and
 * functions in O(1). What remains is the set of non-null non-function
 * objects: plain objects, arrays, dates, maps, class instances,
 * prototype-less objects, and boxed primitives. Realm-independent.
 *
 * Generic in `T` per the family pattern (decisions #031, #039). The
 * narrow returns `T & AnyObject`; `T = unknown` collapses to
 * `AnyObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an object
 * @returns {value is T & AnyObject} `true` when the value is a
 *  non-null non-function object, narrowing `value` to `T & AnyObject`;
 *  `false` otherwise
 * @example
 * isObject({});                  // true
 * isObject([]);                  // true (arrays are objects)
 * isObject(Object.create(null)); // true (prototype-less objects qualify)
 * isObject('x');                 // false (primitive)
 * isObject(() => {});            // false (function)
 * isObject(null);                // false
 */
export function isObject(value) {
  return !!value && typeof value === 'object';
}

/**
 * Narrows a value to {@link PlainObject} — an object whose direct
 * constructor is the built-in `Object`.
 *
 * Composes the {@link isObject} gate with a two-branch identity
 * check: the local-realm fast path `getPrototypeOf(value) ===
 * Object.prototype` (an O(1) reference comparison) and the
 * cross-realm-safe structural fallback `getTypeSignature(value) ===
 * '[object Object]' && getDefinedConstructorName(value) === 'Object'`.
 *
 * Short-circuit `&&` runs the `isObject` gate first; inside the gate,
 * `||` runs the fast-path reference check first and the structural
 * fallback only on miss. Cross-realm Plain Objects (those from other
 * iframes, workers, vm contexts) pass via the fallback because the
 * local `Object.prototype` reference does not match their prototype.
 *
 * **Strict semantics.** Unlike lodash's permissive `_.isPlainObject`,
 * this predicate _rejects_ prototype-less objects
 * (`Object.create(null)`). Reach for {@link isDictionaryObject} for
 * those, or `isPlainObject(v) || isDictionaryObject(v)` for the
 * lodash-equivalent set.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & PlainObject`; `T = unknown` collapses to `PlainObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a plain object
 * @returns {value is T & PlainObject} `true` when the value is a
 *  non-null object whose direct constructor is the built-in `Object`
 *  (in any realm), narrowing `value` to `T & PlainObject`; `false`
 *  otherwise
 * @example
 * isPlainObject({});                  // true
 * isPlainObject(new Object());        // true
 * isPlainObject([]);                  // false (constructor is Array)
 * isPlainObject(Object.create(null)); // false (no constructor — use isDictionaryObject)
 */
export function isPlainObject(value) {
  return (
    isObject(value) &&
    (getPrototypeOf(value) === Object.prototype ||
      (getTypeSignature(value) === '[object Object]' &&
        getDefinedConstructorName(value) === 'Object'))
  );
}

/**
 * Narrows a value to {@link DictionaryObject} — an object with no
 * prototype chain. Typically the result of `Object.create(null)` for
 * use as a hashmap.
 *
 * Composes three markers via short-circuit `&&`: the {@link isObject}
 * gate (rejects primitives, `null`, functions), the prototype check
 * `getPrototypeOf(value) === null`, and the constructor-absence check
 * `getDefinedConstructor(value) === undefined`.
 *
 * The prototype check is the spec-correct test; the constructor-absence
 * check is the cross-validator that closes the spoof surface where
 * `getPrototypeOf === null` holds but a `constructor` property has been
 * attached to the value directly. For a true prototype-less object,
 * none of the four sources of `getDefinedConstructor`'s fallback walk
 * are reachable, so the walk returns `undefined`.
 *
 * Realm-independent. The prototype-less state is realm-orthogonal (no
 * constructor identity involved); the constructor walk is cross-realm
 * safe by construction.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & DictionaryObject`; `T = unknown` collapses to `DictionaryObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a dictionary object
 * @returns {value is T & DictionaryObject} `true` when the value is a
 *  non-null object with no prototype chain and no reachable
 *  constructor, narrowing `value` to `T & DictionaryObject`; `false`
 *  otherwise
 * @example
 * isDictionaryObject(Object.create(null)); // true
 * isDictionaryObject({});                  // false (has Object.prototype)
 * isDictionaryObject(null);                // false
 */
export function isDictionaryObject(value) {
  return (
    isObject(value) &&
    getPrototypeOf(value) === null &&
    getDefinedConstructor(value) === undefined
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
