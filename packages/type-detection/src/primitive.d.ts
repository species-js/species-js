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
 * Narrows a value to the `string` primitive via `typeof value === 'string'`.
 *
 * Matches the primitive form only; boxed `String` objects (`new String('x')`)
 * report `typeof === 'object'` and are deliberately excluded.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a string
 * @returns `true` when `typeof value === 'string'`, narrowing `value` to
 *  `string`; `false` otherwise
 * @example
 * isStringValue('x'); // true
 * isStringValue(new String('x')); // false
 */
export function isStringValue(value?: unknown): value is string;

/**
 * Narrows a value to the `number` primitive via `typeof value === 'number'`.
 *
 * Matches every numeric primitive, `NaN` and `±Infinity` included; finiteness
 * is a separate concern the caller layers on (e.g. `Number.isFinite`). Boxed
 * `Number` objects report `typeof === 'object'` and are excluded.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a number
 * @returns `true` when `typeof value === 'number'`, narrowing `value` to
 *  `number`; `false` otherwise
 * @example
 * isNumberValue(42); // true
 * isNumberValue(NaN); // true
 */
export function isNumberValue(value?: unknown): value is number;

/**
 * Narrows a value to the `symbol` primitive via `typeof value === 'symbol'`.
 *
 * Covers unique, registered (`Symbol.for`), and well-known (`Symbol.iterator`,
 * …) symbols alike.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a symbol
 * @returns `true` when `typeof value === 'symbol'`, narrowing `value` to
 *  `symbol`; `false` otherwise
 * @example
 * isSymbolValue(Symbol('x')); // true
 * isSymbolValue('x'); // false
 */
export function isSymbolValue(value?: unknown): value is symbol;
