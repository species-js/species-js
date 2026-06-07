// @ts-check

/**
 * @module @species-js/type-detection/primitive
 *
 * Primitive-value and boxed-primitive detection.
 *
 * Each of JavaScript's five primitive families (`string`, `number`,
 * `boolean`, `symbol`, `bigint`) ships three predicates here: a
 * `typeof`-based value predicate, a three-marker boxed predicate, and
 * a composite predicate admitting either form. Boxed predicates use
 * the cross-realm-safe `getTypeSignature` (realm-fixed
 * `Object.prototype.toString.call` capture) and
 * `getDefinedConstructorName` (four-source constructor walk) from
 * `@/utility`, paired with a `typeof === 'object'` gate that runs first
 * for O(1) primitive rejection. The three-marker chain matches the
 * conservative-narrowing posture established by `isPromise` /
 * `isEventTarget` (decisions #010, #023, #028).
 *
 * See the sibling `.d.ts` for the per-predicate doc; this `.js` carries
 * the runtime implementation with parallel JSDoc.
 */

import { objectIs } from '@/config';
import { getTypeSignature, getDefinedConstructorName } from '@/utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/primitive').StringValue} StringValue */
/** @typedef {import('@/primitive').BoxedString} BoxedString */
/** @typedef {import('@/primitive').StringType} StringType */

/** @typedef {import('@/primitive').NumberValue} NumberValue */
/** @typedef {import('@/primitive').BoxedNumber} BoxedNumber */
/** @typedef {import('@/primitive').NumberType} NumberType */

/** @typedef {import('@/primitive').BooleanValue} BooleanValue */
/** @typedef {import('@/primitive').BoxedBoolean} BoxedBoolean */
/** @typedef {import('@/primitive').BooleanType} BooleanType */

/** @typedef {import('@/primitive').SymbolValue} SymbolValue */
/** @typedef {import('@/primitive').BoxedSymbol} BoxedSymbol */
/** @typedef {import('@/primitive').SymbolType} SymbolType */

/** @typedef {import('@/primitive').BigIntValue} BigIntValue */
/** @typedef {import('@/primitive').BoxedBigInt} BoxedBigInt */
/** @typedef {import('@/primitive').BigIntType} BigIntType */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const toStringValue = String.prototype.valueOf;
const toNumberValue = Number.prototype.valueOf;
const toBooleanValue = Boolean.prototype.valueOf;
const toSymbolValue = Symbol.prototype.valueOf;
const toBigIntValue = BigInt.prototype.valueOf;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  String Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @param {unknown} value
 * @returns {boolean}
 * @internal
 */
export function doesHaveStrictUnboxedStringValueEquality(value) {
  try {
    return toStringValue.call(value) === String(/** @type {string} */ (value));
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the primitive `string` form via
 * `typeof value === 'string'`.
 *
 * Matches the primitive form only; boxed `String` objects are rejected.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & StringValue`; `T = unknown` collapses to `StringValue`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a string
 * @returns {value is T & StringValue} `true` when
 *  `typeof value === 'string'`, narrowing `value` to `T & StringValue`;
 *  `false` otherwise
 * @example
 * isStringValue('x');             // true
 * isStringValue('');              // true
 * isStringValue(new String('x')); // false (boxed)
 * isStringValue(42);              // false
 */
export function isStringValue(value) {
  return typeof value === 'string';
}

/**
 * Narrows a value to the boxed `String` wrapper-object form via three
 * cross-validating structural markers — `typeof === 'object'`, the
 * `[[Class]]` tag `'[object String]'`, and the constructor name
 * `'String'`.
 *
 * Short-circuit `&&` runs the markers in performance order: `typeof`
 * first (O(1) primitive-rejection gate), tag check second
 * (cross-realm-safe via realm-fixed `toObjectString.call`), constructor
 * walk last. Null is admitted by `typeof === 'object'` momentarily and
 * rejected by the tag check via `'[object Null]'`. The three markers
 * together provide bounded-cost insurance against single-marker
 * `Symbol.toStringTag` spoofing.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedString`; `T = unknown` collapses to `BoxedString`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed string
 * @returns {value is T & BoxedString} `true` when all three markers
 *  hold, narrowing `value` to `T & BoxedString`; `false` otherwise
 * @example
 * isBoxedString(new String('x'));                    // true
 * isBoxedString(Object('x'));                        // true
 * isBoxedString('x');                                // false (primitive)
 * isBoxedString({ [Symbol.toStringTag]: 'String' }); // false (ctor mismatch)
 */
export function isBoxedString(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    getTypeSignature(value) === '[object String]' &&
    getDefinedConstructorName(value) === 'String' &&
    doesHaveStrictUnboxedStringValueEquality(value)
  );
}

/**
 * Narrows a value to either the primitive `string` form or the boxed
 * `String` wrapper-object form — the union {@link StringType}.
 *
 * Composes `isStringValue || isBoxedString` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & StringType`; `T = unknown` collapses to `StringType`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of string
 * @returns {value is T & StringType} `true` when the value is either a
 *  primitive `string` or a boxed `String`, narrowing `value` to
 *  `T & StringType`; `false` otherwise
 * @example
 * isString('x');                  // true
 * isString(new String('x'));      // true
 * isString(42);                   // false
 */
export function isString(value) {
  return isStringValue(value) || isBoxedString(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Number Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @param {unknown} value
 * @returns {boolean}
 * @internal
 */
export function doesHaveStrictUnboxedNumberValueEquality(value) {
  try {
    return objectIs(toNumberValue.call(value), Number(/** @type {number} */ (value)));
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the primitive `number` form via
 * `typeof value === 'number'`.
 *
 * Matches every numeric primitive — `NaN`, `±Infinity`, and finite
 * numbers alike. Finiteness, integrality, and safe-integer checks are
 * caller's concerns (see `@/config` for `isFiniteNumberValue` etc.,
 * decision #026). Boxed `Number` objects are rejected.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & NumberValue`; `T = unknown` collapses to `NumberValue`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a number
 * @returns {value is T & NumberValue} `true` when
 *  `typeof value === 'number'`, narrowing `value` to `T & NumberValue`;
 *  `false` otherwise
 * @example
 * isNumberValue(42);             // true
 * isNumberValue(NaN);            // true
 * isNumberValue(Infinity);       // true
 * isNumberValue('42');           // false
 * isNumberValue(new Number(42)); // false (boxed)
 */
export function isNumberValue(value) {
  return typeof value === 'number';
}

/**
 * Narrows a value to the boxed `Number` wrapper-object form via three
 * cross-validating structural markers — `typeof === 'object'`, the
 * `[[Class]]` tag `'[object Number]'`, and the constructor name
 * `'Number'`.
 *
 * Marker chain and short-circuit ordering match {@link isBoxedString};
 * see that predicate's doc for the structural rationale.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedNumber`; `T = unknown` collapses to `BoxedNumber`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed number
 * @returns {value is T & BoxedNumber} `true` when all three markers
 *  hold, narrowing `value` to `T & BoxedNumber`; `false` otherwise
 * @example
 * isBoxedNumber(new Number(42)); // true
 * isBoxedNumber(Object(42));     // true
 * isBoxedNumber(42);             // false (primitive)
 */
export function isBoxedNumber(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    getTypeSignature(value) === '[object Number]' &&
    getDefinedConstructorName(value) === 'Number' &&
    doesHaveStrictUnboxedNumberValueEquality(value)
  );
}

/**
 * Narrows a value to either the primitive `number` form or the boxed
 * `Number` wrapper-object form — the union {@link NumberType}.
 *
 * Composes `isNumberValue || isBoxedNumber` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & NumberType`; `T = unknown` collapses to `NumberType`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of number
 * @returns {value is T & NumberType} `true` when the value is either a
 *  primitive `number` or a boxed `Number`, narrowing `value` to
 *  `T & NumberType`; `false` otherwise
 * @example
 * isNumber(42);             // true
 * isNumber(NaN);            // true
 * isNumber(new Number(42)); // true
 * isNumber('42');           // false
 */
export function isNumber(value) {
  return isNumberValue(value) || isBoxedNumber(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Boolean Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @param {unknown} value
 * @returns {boolean}
 * @internal
 */
export function doesHaveStrictUnboxedBooleanValueEquality(value) {
  try {
    const unboxedValue = toBooleanValue.call(value);
    return (
      isBooleanValue(unboxedValue) &&
      String(unboxedValue) === String(/** @type {boolean} */ (value))
    );
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the primitive `boolean` form via
 * `typeof value === 'boolean'`.
 *
 * Matches the primitive form only — both `true` and `false`. Truthy/falsy
 * coercion is a different operation; this predicate discriminates the
 * primitive type, not the truthiness. Boxed `Boolean` objects are
 * rejected.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BooleanValue`; `T = unknown` collapses to `BooleanValue`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boolean
 * @returns {value is T & BooleanValue} `true` when
 *  `typeof value === 'boolean'`, narrowing `value` to `T & BooleanValue`;
 *  `false` otherwise
 * @example
 * isBooleanValue(true);              // true
 * isBooleanValue(false);             // true
 * isBooleanValue(0);                 // false
 * isBooleanValue(new Boolean(true)); // false (boxed)
 */
export function isBooleanValue(value) {
  return typeof value === 'boolean';
}

/**
 * Narrows a value to the boxed `Boolean` wrapper-object form via three
 * cross-validating structural markers — `typeof === 'object'`, the
 * `[[Class]]` tag `'[object Boolean]'`, and the constructor name
 * `'Boolean'`.
 *
 * Marker chain and short-circuit ordering match {@link isBoxedString};
 * see that predicate's doc for the structural rationale.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedBoolean`; `T = unknown` collapses to `BoxedBoolean`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed boolean
 * @returns {value is T & BoxedBoolean} `true` when all three markers
 *  hold, narrowing `value` to `T & BoxedBoolean`; `false` otherwise
 * @example
 * isBoxedBoolean(new Boolean(true));  // true
 * isBoxedBoolean(new Boolean(false)); // true
 * isBoxedBoolean(true);               // false (primitive)
 */
export function isBoxedBoolean(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    getTypeSignature(value) === '[object Boolean]' &&
    getDefinedConstructorName(value) === 'Boolean' &&
    doesHaveStrictUnboxedBooleanValueEquality(value)
  );
}

/**
 * Narrows a value to either the primitive `boolean` form or the boxed
 * `Boolean` wrapper-object form — the union {@link BooleanType}.
 *
 * Composes `isBooleanValue || isBoxedBoolean` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BooleanType`; `T = unknown` collapses to `BooleanType`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of boolean
 * @returns {value is T & BooleanType} `true` when the value is either a
 *  primitive `boolean` or a boxed `Boolean`, narrowing `value` to
 *  `T & BooleanType`; `false` otherwise
 * @example
 * isBoolean(true);              // true
 * isBoolean(new Boolean(true)); // true
 * isBoolean(0);                 // false
 */
export function isBoolean(value) {
  return isBooleanValue(value) || isBoxedBoolean(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Symbol Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @param {unknown} value
 * @returns {boolean}
 * @internal
 */
export function doesHaveStrictUnboxedSymbolValueEquality(value) {
  try {
    const unboxedValue = toSymbolValue.call(value);
    return (
      isSymbolValue(unboxedValue) &&
      unboxedValue.description === /** @type {symbol} */ (value).description
    );
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the primitive `symbol` form via
 * `typeof value === 'symbol'`.
 *
 * Covers unique symbols (`Symbol('x')`), registered symbols
 * (`Symbol.for('x')`), and well-known symbols (`Symbol.iterator` etc.).
 * Boxed `Symbol` objects, produced via `Object(Symbol('x'))`, are
 * rejected.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & SymbolValue`; `T = unknown` collapses to `SymbolValue`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a symbol
 * @returns {value is T & SymbolValue} `true` when
 *  `typeof value === 'symbol'`, narrowing `value` to `T & SymbolValue`;
 *  `false` otherwise
 * @example
 * isSymbolValue(Symbol('x'));         // true
 * isSymbolValue(Symbol.iterator);     // true
 * isSymbolValue('x');                 // false
 * isSymbolValue(Object(Symbol('x'))); // false (boxed)
 */
export function isSymbolValue(value) {
  return typeof value === 'symbol';
}

/**
 * Narrows a value to the boxed `Symbol` wrapper-object form via three
 * cross-validating structural markers — `typeof === 'object'`, the
 * `[[Class]]` tag `'[object Symbol]'`, and the constructor name
 * `'Symbol'`.
 *
 * Marker chain and short-circuit ordering match {@link isBoxedString};
 * see that predicate's doc for the structural rationale.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedSymbol`; `T = unknown` collapses to `BoxedSymbol`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed symbol
 * @returns {value is T & BoxedSymbol} `true` when all three markers
 *  hold, narrowing `value` to `T & BoxedSymbol`; `false` otherwise
 * @example
 * isBoxedSymbol(Object(Symbol('x'))); // true
 * isBoxedSymbol(Symbol('x'));         // false (primitive)
 */
export function isBoxedSymbol(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    getTypeSignature(value) === '[object Symbol]' &&
    getDefinedConstructorName(value) === 'Symbol' &&
    doesHaveStrictUnboxedSymbolValueEquality(value)
  );
}

/**
 * Narrows a value to either the primitive `symbol` form or the boxed
 * `Symbol` wrapper-object form — the union {@link SymbolType}.
 *
 * Composes `isSymbolValue || isBoxedSymbol` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & SymbolType`; `T = unknown` collapses to `SymbolType`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of symbol
 * @returns {value is T & SymbolType} `true` when the value is either a
 *  primitive `symbol` or a boxed `Symbol`, narrowing `value` to
 *  `T & SymbolType`; `false` otherwise
 * @example
 * isSymbol(Symbol('x'));         // true
 * isSymbol(Object(Symbol('x'))); // true
 * isSymbol('x');                 // false
 */
export function isSymbol(value) {
  return isSymbolValue(value) || isBoxedSymbol(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  BigInt Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @param {unknown} value
 * @returns {boolean}
 * @internal
 */
export function doesHaveStrictUnboxedBigIntValueEquality(value) {
  try {
    return toBigIntValue.call(value) === BigInt(/** @type {bigint} */ (value));
  } catch {
    return false;
  }
}

/**
 * Narrows a value to the primitive `bigint` form via
 * `typeof value === 'bigint'`.
 *
 * Matches literal form (`1n`), `BigInt()` calls, and any arithmetic
 * result that stays in the bigint domain. Boxed `BigInt` objects,
 * produced via `Object(1n)`, are rejected.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BigIntValue`; `T = unknown` collapses to `BigIntValue`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a bigint
 * @returns {value is T & BigIntValue} `true` when
 *  `typeof value === 'bigint'`, narrowing `value` to `T & BigIntValue`;
 *  `false` otherwise
 * @example
 * isBigIntValue(1n);         // true
 * isBigIntValue(BigInt(1));  // true
 * isBigIntValue(1);          // false (number)
 * isBigIntValue(Object(1n)); // false (boxed)
 */
export function isBigIntValue(value) {
  return typeof value === 'bigint';
}

/**
 * Narrows a value to the boxed `BigInt` wrapper-object form via three
 * cross-validating structural markers — `typeof === 'object'`, the
 * `[[Class]]` tag `'[object BigInt]'`, and the constructor name
 * `'BigInt'`.
 *
 * Marker chain and short-circuit ordering match {@link isBoxedString};
 * see that predicate's doc for the structural rationale.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedBigInt`; `T = unknown` collapses to `BoxedBigInt`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed bigint
 * @returns {value is T & BoxedBigInt} `true` when all three markers
 *  hold, narrowing `value` to `T & BoxedBigInt`; `false` otherwise
 * @example
 * isBoxedBigInt(Object(1n));         // true
 * isBoxedBigInt(Object(BigInt(42))); // true
 * isBoxedBigInt(1n);                 // false (primitive)
 */
export function isBoxedBigInt(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    getTypeSignature(value) === '[object BigInt]' &&
    getDefinedConstructorName(value) === 'BigInt' &&
    doesHaveStrictUnboxedBigIntValueEquality(value)
  );
}

/**
 * Narrows a value to either the primitive `bigint` form or the boxed
 * `BigInt` wrapper-object form — the union {@link BigIntType}.
 *
 * Composes `isBigIntValue || isBoxedBigInt` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BigIntType`; `T = unknown` collapses to `BigIntType`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of bigint
 * @returns {value is T & BigIntType} `true` when the value is either a
 *  primitive `bigint` or a boxed `BigInt`, narrowing `value` to
 *  `T & BigIntType`; `false` otherwise
 * @example
 * isBigInt(1n);         // true
 * isBigInt(Object(1n)); // true
 * isBigInt(1);          // false
 */
export function isBigInt(value) {
  return isBigIntValue(value) || isBoxedBigInt(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
