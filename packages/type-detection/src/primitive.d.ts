/**
 * @module @species-js/type-detection/primitive
 *
 * Primitive-value detection.
 *
 * Realm-independent `typeof` guards that narrow an unknown value to a
 * specific JavaScript primitive type. Primitives carry no cross-realm
 * identity hazard, since `typeof` reads the same in every realm. These
 * are the simplest predicates in the package and the building blocks
 * stricter checks compose from.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Primitive Value Guards
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to the `boolean` primitive via `typeof value === 'boolean'`.
 *
 * Matches the primitive form only — both `true` and `false`. Boxed
 * `Boolean` objects, such as `new Boolean(true)`, report
 * `typeof === 'object'` and are deliberately excluded.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a boolean
 * @returns `true` when `typeof value === 'boolean'`, narrowing `value` to
 *  `boolean`; `false` otherwise
 * @example
 * isBooleanValue(true);              // true
 * isBooleanValue(false);             // true
 * isBooleanValue(0);                 // false
 * isBooleanValue(new Boolean(true)); // false
 */
export function isBooleanValue(value?: unknown): value is boolean;

/**
 * Narrows a value to the `number` primitive via `typeof value === 'number'`.
 *
 * Matches every numeric primitive, `NaN` and `±Infinity` included.
 * Finiteness is a separate concern the caller layers on, for example, with
 * `Number.isFinite`. Boxed `Number` objects, such as `new Number(42)`,
 * report `typeof === 'object'` and are deliberately excluded.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a number
 * @returns `true` when `typeof value === 'number'`, narrowing `value` to
 *  `number`; `false` otherwise
 * @example
 * isNumberValue(42);             // true
 * isNumberValue(NaN);            // true
 * isNumberValue('42');           // false
 * isNumberValue(new Number(42)); // false
 */
export function isNumberValue(value?: unknown): value is number;

/**
 * Narrows a value to the `string` primitive via `typeof value === 'string'`.
 *
 * Matches the primitive form only. Boxed `String` objects, such as
 * `new String('x')`, report `typeof === 'object'` and are deliberately
 * excluded.
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
 * Narrows a value to the `symbol` primitive via `typeof value === 'symbol'`.
 *
 * Covers unique symbols, registered symbols from `Symbol.for`, and
 * well-known symbols such as `Symbol.iterator` alike.
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

/**
 * Narrows a value to the `bigint` primitive via `typeof value === 'bigint'`.
 *
 * Matches the primitive form only — literals (`1n`) and `BigInt()` calls
 * alike. Boxed `BigInt` objects, such as `Object(1n)`, report
 * `typeof === 'object'` and are deliberately excluded.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a bigint
 * @returns `true` when `typeof value === 'bigint'`, narrowing `value` to
 *  `bigint`; `false` otherwise
 * @example
 * isBigIntValue(1n);          // true
 * isBigIntValue(BigInt(1));   // true
 * isBigIntValue(1);           // false
 * isBigIntValue(Object(1n));  // false
 */
export function isBigIntValue(value?: unknown): value is bigint;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
