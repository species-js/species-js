// @ts-check

/**
 * @module @species-js/type-detection/primitive
 *
 * Primitive-value detection. Realm-independent `typeof` guards that narrow an
 * unknown value to a specific JavaScript primitive type. Primitives carry no
 * cross-realm identity hazard — `typeof` reads the same in every realm — so
 * these are the simplest predicates in the package and the building blocks
 * stricter checks compose from.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Primitive Value Guards
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to the `string` primitive — implemented as a single
 * `typeof value === 'string'` check. Boxed `String` objects report `'object'`
 * and are therefore excluded.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a string
 * @returns {value is string} `true` when `typeof value === 'string'`
 * @example
 * isStringValue('x'); // true
 * isStringValue(new String('x')); // false
 */
export function isStringValue(value) {
  return typeof value === 'string';
}

/**
 * Narrows a value to the `number` primitive — a single
 * `typeof value === 'number'` check, so `NaN` and `±Infinity` are included;
 * the caller layers finiteness on separately. Boxed `Number` objects report
 * `'object'` and are excluded.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a number
 * @returns {value is number} `true` when `typeof value === 'number'`
 * @example
 * isNumberValue(42); // true
 * isNumberValue(NaN); // true
 */
export function isNumberValue(value) {
  return typeof value === 'number';
}

/**
 * Narrows a value to the `symbol` primitive — a single
 * `typeof value === 'symbol'` check, covering unique, registered, and
 * well-known symbols alike.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a symbol
 * @returns {value is symbol} `true` when `typeof value === 'symbol'`
 * @example
 * isSymbolValue(Symbol('x')); // true
 * isSymbolValue('x'); // false
 */
export function isSymbolValue(value) {
  return typeof value === 'symbol';
}
