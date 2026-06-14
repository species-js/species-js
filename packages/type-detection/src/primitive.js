// @ts-check

/**
 * @module @species-js/type-detection/primitive
 *
 * Primitive-value and boxed-primitive detection.
 *
 * Each of JavaScript's five primitive families (`string`, `number`,
 * `boolean`, `symbol`, `bigint`) ships three predicates here: a
 * `typeof`-based value predicate, a boxed predicate, and a composite
 * predicate admitting either form. All boxed predicates share two
 * fixtures — the {@link isObject} gate from `@/object` (truthiness +
 * `typeof === 'object'`) at the top for O(1) primitive-and-null
 * rejection, and the spec-precise `[[XData]]` internal-slot probe via
 * the captured `X.prototype.valueOf` at the bottom as the spoof-proof
 * sealing marker.
 *
 * Between those fixtures the families split by whether their type's
 * intrinsic is a true constructor:
 *
 * - **`isBoxedString` / `isBoxedNumber` / `isBoxedBoolean`** — two-branch
 *   identity check. The local-realm fast path pairs `value instanceof X`
 *   with `getPrototypeOf(value) === X.prototype`; the cross-realm
 *   structural fallback pairs the `[[Class]]` tag with the resolved
 *   constructor name. Both branches reject subclasses (the proto-identity
 *   check on the local path, the constructor-name walk on the cross-realm
 *   path). The slot probe seals either branch.
 * - **`isBoxedSymbol` / `isBoxedBigInt`** — four-marker structural chain
 *   only (`isObject` + tag + constructor name + slot probe). The
 *   local-realm `instanceof` branch is deliberately omitted because
 *   `Symbol` and `BigInt` are factory functions, not constructors —
 *   `new Symbol()` and `new BigInt()` both throw, and although
 *   `Object(Symbol('x')) instanceof Symbol` evaluates to `true` under
 *   the default `OrdinaryHasInstance` algorithm, the result is incidental
 *   to prototype-chain walking rather than a meaningful identity test.
 *   The structural chain is the honest discriminator for these families.
 *
 * The boxed predicates extend the conservative-narrowing posture
 * established by `isPromise` / `isEventTarget` (decisions #010, #023,
 * #028) with engine-attested internal-slot evidence (decision #042);
 * the two-branch identity check on String / Number / Boolean and the
 * factory-function carve-out for Symbol / BigInt are decision #049.
 *
 * See the sibling `.d.ts` for the per-predicate doc; this `.js` carries
 * the runtime implementation with parallel JSDoc.
 */

import { objectIs, getPrototypeOf } from '@/config';
import { getTypeSignature, getDefinedConstructorName } from '@/utility';

import { isObject } from '@/object.js';

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

const StringConstructor = String;
const NumberConstructor = Number;
const BooleanConstructor = Boolean;

const stringPrototype = StringConstructor.prototype;
const numberPrototype = NumberConstructor.prototype;
const booleanPrototype = BooleanConstructor.prototype;

const toStringValue = stringPrototype.valueOf;
const toNumberValue = numberPrototype.valueOf;
const toBooleanValue = booleanPrototype.valueOf;
const toSymbolValue = Symbol.prototype.valueOf;
const toBigIntValue = BigInt.prototype.valueOf;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  String Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Verifies that the boxed `String` value's `[[StringData]]` internal slot
 * is present and that its unboxed primitive value equals `String(value)`
 * — the load-bearing fourth marker of {@link isBoxedString}'s
 * discrimination chain. Implementation: invokes the module-scoped
 * captured `String.prototype.valueOf` (`toStringValue`) on the candidate
 * via `.call`; the call throws on any value lacking the
 * `[[StringData]]` slot, and the `try/catch` reduces the throw to
 * `false`. The comparison `=== String(value)` round-trips both sides
 * through spec-mechanic coercion paths that unwrap the boxed primitive.
 *
 * @param {unknown} value - the value to test
 * @returns {boolean} `true` when the unboxed primitive equals
 *  `String(value)`; `false` otherwise (including when `valueOf` throws)
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
 * Narrows a value to the boxed `String` wrapper-object form via the
 * {@link isObject} gate, a two-branch identity check, and the
 * spec-precise `[[StringData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedStringValueEquality}.
 *
 * The two-branch identity check runs in cost order:
 *
 * - Local-realm fast path: `value instanceof StringConstructor` paired
 *   with `getPrototypeOf(value) === stringPrototype`. The pair admits
 *   only direct `String` instances; subclasses pass `instanceof` but
 *   fail the prototype-identity check, preserving subclass rejection.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object String]'` paired with the resolved constructor name
 *   `'String'` — both work realm-independently, admitting cross-realm
 *   boxed strings and rejecting subclasses (whose walked constructor
 *   name is the subclass's).
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[StringData]]` evidence. A value
 * passes only if the captured `String.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive equals
 * `String(value)`. Closes the `Symbol.toStringTag`-spoofing surface
 * the structural markers leave open even when paired with the
 * constructor walk, and rejects post-`Object.setPrototypeOf` spoofs
 * that would otherwise pass the local-realm pair.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedString`; `T = unknown` collapses to `BoxedString`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed string
 * @returns {value is T & BoxedString} `true` when the identity check
 *  and the `[[StringData]]` slot-probe both hold, narrowing `value`
 *  to `T & BoxedString`; `false` otherwise
 * @example
 * isBoxedString(new String('x'));                    // true (instanceof + slot)
 * isBoxedString(Object('x'));                        // true
 * isBoxedString('x');                                // false (primitive)
 * isBoxedString({ [Symbol.toStringTag]: 'String' }); // false (no [[StringData]])
 */
export function isBoxedString(value) {
  return (
    isObject(value) &&
    ((value instanceof StringConstructor && getPrototypeOf(value) === stringPrototype) ||
      (getTypeSignature(value) === '[object String]' &&
        getDefinedConstructorName(value) === 'String')) &&
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
 * Verifies that the boxed `Number` value's `[[NumberData]]` internal slot
 * is present and that its unboxed primitive value matches `Number(value)`
 * compared via `Object.is` — the load-bearing fourth marker of
 * {@link isBoxedNumber}'s discrimination chain. Implementation: invokes
 * the module-scoped captured `Number.prototype.valueOf` (`toNumberValue`)
 * via `.call`; the call throws on any value lacking the `[[NumberData]]`
 * slot. `Object.is` is used in preference to `===` so that
 * `new Number(NaN)` is correctly admitted — `Object.is(NaN, NaN) === true`
 * whereas `NaN === NaN` is `false`. The realm-fixed `objectIs` from
 * `@/config` is the capture.
 *
 * @param {unknown} value - the value to test
 * @returns {boolean} `true` when `Object.is(unboxed, Number(value))`
 *  holds; `false` otherwise (including when `valueOf` throws)
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
 * Narrows a value to the boxed `Number` wrapper-object form via the
 * {@link isObject} gate, a two-branch identity check, and the
 * spec-precise `[[NumberData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedNumberValueEquality}.
 *
 * Identity-check branches and slot-probe role match {@link isBoxedString};
 * see that predicate's doc for the structural rationale. The
 * `[[NumberData]]` probe uses `Object.is` rather than `===` so that
 * `new Number(NaN)` is correctly admitted.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedNumber`; `T = unknown` collapses to `BoxedNumber`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed number
 * @returns {value is T & BoxedNumber} `true` when the identity check
 *  and the `[[NumberData]]` slot-probe both hold, narrowing `value`
 *  to `T & BoxedNumber`; `false` otherwise
 * @example
 * isBoxedNumber(new Number(42)); // true (instanceof + slot)
 * isBoxedNumber(Object(42));     // true
 * isBoxedNumber(42);             // false (primitive)
 */
export function isBoxedNumber(value) {
  return (
    isObject(value) &&
    ((value instanceof NumberConstructor && getPrototypeOf(value) === numberPrototype) ||
      (getTypeSignature(value) === '[object Number]' &&
        getDefinedConstructorName(value) === 'Number')) &&
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
 * Verifies that the boxed `Boolean` value's `[[BooleanData]]` internal
 * slot is present and that its unboxed primitive value's string form
 * matches the boxed value's string coercion — the load-bearing fourth
 * marker of {@link isBoxedBoolean}'s discrimination chain. Implementation:
 * invokes the module-scoped captured `Boolean.prototype.valueOf`
 * (`toBooleanValue`) via `.call`; the call throws on any value lacking
 * the `[[BooleanData]]` slot. Stringified comparison via `String(...)`
 * on both sides sidesteps the `ToBoolean(Object) === true` trap that
 * `Boolean(new Boolean(false))` would otherwise produce — `String` uses
 * `ToPrimitive("string")` which unwraps via `Boolean.prototype.toString`.
 *
 * Boolean is the only one of the five primitive equality helpers whose
 * boxed-side comparison routes through `prototype.toString` (String/BigInt
 * use direct `===`, Number uses `Object.is`, Symbol uses a description
 * cross-check). The asymmetry is forced by the `ToBoolean(Object) → true`
 * trap, which closes off the direct-`===` path the other families use.
 * As a consequence, the helper assumes `Boolean.prototype.toString` is
 * untampered on the local realm — `toBooleanValue` is captured
 * realm-fixed for the slot-probe, but the `String(value)` path on the
 * boxed side resolves through the live `Boolean.prototype.toString`.
 * In an adversarial environment that has replaced
 * `Boolean.prototype.toString`, real boxed Booleans may be falsely
 * rejected; the unboxed side is unaffected because primitive-to-string
 * coercion bypasses the prototype method. The tampering surface is
 * unusual in practice, and `Boolean.prototype.toString` is not realm-fixed
 * by this package.
 *
 * @param {unknown} value - the value to test
 * @returns {boolean} `true` when the unboxed primitive's string form
 *  equals `String(value)`; `false` otherwise (including when `valueOf`
 *  throws)
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
 * Narrows a value to the boxed `Boolean` wrapper-object form via the
 * {@link isObject} gate, a two-branch identity check, and the
 * spec-precise `[[BooleanData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBooleanValueEquality}.
 *
 * Identity-check branches and slot-probe role match {@link isBoxedString};
 * see that predicate's doc for the structural rationale. The
 * `[[BooleanData]]` probe compares string-coerced forms rather than the
 * raw values, sidestepping the `ToBoolean(Object) === true` trap that
 * `Boolean(new Boolean(false))` would otherwise produce.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedBoolean`; `T = unknown` collapses to `BoxedBoolean`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed boolean
 * @returns {value is T & BoxedBoolean} `true` when the identity check
 *  and the `[[BooleanData]]` slot-probe both hold, narrowing `value`
 *  to `T & BoxedBoolean`; `false` otherwise
 * @example
 * isBoxedBoolean(new Boolean(true));  // true (instanceof + slot)
 * isBoxedBoolean(new Boolean(false)); // true
 * isBoxedBoolean(true);               // false (primitive)
 */
export function isBoxedBoolean(value) {
  return (
    isObject(value) &&
    ((value instanceof BooleanConstructor &&
      getPrototypeOf(value) === booleanPrototype) ||
      (getTypeSignature(value) === '[object Boolean]' &&
        getDefinedConstructorName(value) === 'Boolean')) &&
    doesHaveStrictUnboxedBooleanValueEquality(value)
  );
}

/**
 * Narrows a value to either the primitive `boolean` form or the boxed
 * `Boolean` wrapper-object form — the union {@link BooleanType}.
 *
 * Composes `isBooleanValue || isBoxedBoolean` with short-circuit `||`
 * running the less expensive primitive check first.
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
 * Verifies that the boxed `Symbol` value's `[[SymbolData]]` internal slot
 * is present and that the unboxed primitive symbol's `description`
 * matches the boxed value's `description` — the load-bearing fourth
 * marker of {@link isBoxedSymbol}'s discrimination chain. Implementation:
 * invokes the module-scoped captured `Symbol.prototype.valueOf`
 * (`toSymbolValue`) via `.call`; the call throws on any value lacking
 * the `[[SymbolData]]` slot. The description cross-check catches the
 * own-property-shadowing tampering surface — a real boxed Symbol whose
 * `description` getter has been overridden by an own data property has
 * a valueOf that still works but observable description that lies; the
 * unboxed-side read goes through the primitive's `[[Description]]` slot
 * via `Symbol.prototype.description`, the boxed-side read goes through
 * the (shadowed) accessor chain, so they diverge.
 *
 * @param {unknown} value - the value to test
 * @returns {boolean} `true` when the unboxed primitive's `description`
 *  equals `value.description`; `false` otherwise (including when
 *  `valueOf` throws, and including the `undefined === undefined` case
 *  for `Symbol()` with no description argument)
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
 * Narrows a value to the boxed `Symbol` wrapper-object form via four
 * cross-validating markers — the {@link isObject} gate, the `[[Class]]`
 * tag `'[object Symbol]'`, the constructor name `'Symbol'`, and the
 * spec-precise `[[SymbolData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedSymbolValueEquality}.
 *
 * Short-circuit `&&` runs the markers in cost order: the `isObject`
 * gate first (O(1) primitive-and-null rejection), the tag-check
 * second (cross-realm-safe via realm-fixed `toObjectString.call`),
 * the constructor-walk third, and the valueOf-slot probe last as
 * the spec-precise spoof closure.
 *
 * Unlike {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity branch.
 * `Symbol` is a factory function, not a constructor — `new Symbol()`
 * throws, and `Object(Symbol('x')) instanceof Symbol` evaluates to
 * `true` only by virtue of the default `OrdinaryHasInstance`
 * algorithm walking the prototype chain, not because the spec
 * treats the wrapper as a `Symbol` instance in any identity-bearing
 * sense. The structural chain runs uniformly across local-realm and
 * cross-realm boxed Symbols and is the honest discriminator here.
 *
 * The `[[SymbolData]]` probe cross-checks the unboxed primitive's
 * `description` against the boxed value's `description` — catching the
 * own-property-shadowing tampering surface where a real boxed Symbol
 * has had its `description` getter overridden by an own data property.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedSymbol`; `T = unknown` collapses to `BoxedSymbol`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed symbol
 * @returns {value is T & BoxedSymbol} `true` when all four markers
 *  hold, narrowing `value` to `T & BoxedSymbol`; `false` otherwise
 * @example
 * isBoxedSymbol(Object(Symbol('x'))); // true
 * isBoxedSymbol(Symbol('x'));         // false (primitive)
 */
export function isBoxedSymbol(value) {
  return (
    isObject(value) &&
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
 * Verifies that the boxed `BigInt` value's `[[BigIntData]]` internal slot
 * is present and that its unboxed primitive value equals `BigInt(value)`
 * — the load-bearing fourth marker of {@link isBoxedBigInt}'s
 * discrimination chain. Implementation: invokes the module-scoped
 * captured `BigInt.prototype.valueOf` (`toBigIntValue`) via `.call`;
 * the call throws on any value lacking the `[[BigIntData]]` slot.
 * `BigInt(value)` per ECMA-262 §21.2.1.1 starts with
 * `ToPrimitive(value, "number")`, which calls `valueOf` on the boxed
 * BigInt and unwraps, so both sides land on the same primitive `bigint`
 * — direct `===` is sufficient.
 *
 * @param {unknown} value - the value to test
 * @returns {boolean} `true` when the unboxed primitive equals
 *  `BigInt(value)`; `false` otherwise (including when `valueOf` throws)
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
 * Narrows a value to the boxed `BigInt` wrapper-object form via four
 * cross-validating markers — the {@link isObject} gate, the `[[Class]]`
 * tag `'[object BigInt]'`, the constructor name `'BigInt'`, and the
 * spec-precise `[[BigIntData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBigIntValueEquality}.
 *
 * Short-circuit `&&` runs the markers in cost order: the `isObject`
 * gate first, then tag-check, then constructor-walk, then the
 * valueOf-slot probe.
 *
 * Like {@link isBoxedSymbol}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity branch that
 * {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean} use. `BigInt` is a factory function, not
 * a constructor — `new BigInt(1n)` throws, and `instanceof BigInt`
 * is incidental to `OrdinaryHasInstance` rather than a meaningful
 * identity test. The structural chain is the honest discriminator.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedBigInt`; `T = unknown` collapses to `BoxedBigInt`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed bigint
 * @returns {value is T & BoxedBigInt} `true` when all four markers
 *  hold, narrowing `value` to `T & BoxedBigInt`; `false` otherwise
 * @example
 * isBoxedBigInt(Object(1n));         // true
 * isBoxedBigInt(Object(BigInt(42))); // true
 * isBoxedBigInt(1n);                 // false (primitive)
 */
export function isBoxedBigInt(value) {
  return (
    isObject(value) &&
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
