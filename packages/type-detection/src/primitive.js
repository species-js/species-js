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
 * fixtures: the {@link isObject} gate from `#object` (truthiness +
 * `typeof === 'object'`) at the top for O(1) primitive-and-null
 * rejection, and the spec-precise `[[XData]]` internal-slot probe via
 * the captured `X.prototype.valueOf` at the bottom as the spoof-proof
 * sealing marker.
 *
 * Between those fixtures, the families split by whether their type's
 * intrinsic is a true constructor:
 *
 * - **`isBoxedString` / `isBoxedNumber` / `isBoxedBoolean`** — two-branch
 *   identity check. The local-realm fast path pairs `value instanceof X`
 *   with `getPrototypeOf(value) === X.prototype`. The cross-realm
 *   structural fallback pairs the `[[Class]]` tag with the resolved
 *   constructor name. Both branches reject subclasses (the proto-identity
 *   check on the local path, the constructor-name walk on the cross-realm
 *   path). The slot probe seals either branch.
 * - **`isBoxedSymbol` / `isBoxedBigInt`** — four-marker structural chain
 *   only (`isObject` + tag + constructor name + slot probe). The
 *   local-realm `instanceof` branch is deliberately omitted because
 *   `Symbol` and `BigInt` are factory functions, not constructors —
 *   `new Symbol()` and `new BigInt()` both throw. Although
 *   `Object(Symbol('x')) instanceof Symbol` evaluates to `true` under
 *   the default `OrdinaryHasInstance` algorithm, that result is
 *   incidental to prototype-chain walking rather than a meaningful
 *   identity test. The structural chain is the honest discriminator
 *   for these families.
 *
 * The module also exposes three generic predicates at the floor of the
 * primitive lattice ({@link isBoxablePrimitive},
 * {@link isNullishPrimitive}, {@link isPrimitiveValue}) and a boxed-side
 * umbrella ({@link isBoxedPrimitive}) admitting any of the five boxed
 * wrapper-object forms.
 *
 * The boxed predicates extend the conservative-narrowing posture
 * established by `isPromise` / `isEventTarget` / `isAbortSignal`
 * (decisions #010, #023, #028) with engine-attested internal-slot
 * evidence (decision #042). The two-branch identity check on String /
 * Number / Boolean and the factory-function carve-out for `Symbol` /
 * `BigInt` are decision #049.
 *
 * See the sibling `.d.ts` for the per-predicate doc. This `.js` carries
 * the runtime implementation with parallel JSDoc.
 */

import { globalContext, objectIs, getPrototypeOf } from '#config';
import { getDefinedConstructorName, getTypeSignature, getTaggedType } from '#utility';

import { isCallable } from '#function';
import { isObject } from '#object';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('#primitive').StringValue} StringValue */
/** @typedef {import('#primitive').BoxedString} BoxedString */
/** @typedef {import('#primitive').StringType} StringType */

/** @typedef {import('#primitive').NumberValue} NumberValue */
/** @typedef {import('#primitive').BoxedNumber} BoxedNumber */
/** @typedef {import('#primitive').NumberType} NumberType */

/** @typedef {import('#primitive').BooleanValue} BooleanValue */
/** @typedef {import('#primitive').BoxedBoolean} BoxedBoolean */
/** @typedef {import('#primitive').BooleanType} BooleanType */

/** @typedef {import('#primitive').SymbolValue} SymbolValue */
/** @typedef {import('#primitive').BoxedSymbol} BoxedSymbol */
/** @typedef {import('#primitive').SymbolType} SymbolType */

/** @typedef {import('#primitive').BigIntValue} BigIntValue */
/** @typedef {import('#primitive').BoxedBigInt} BoxedBigInt */
/** @typedef {import('#primitive').BigIntType} BigIntType */

/** @typedef {import('#primitive').NullishPrimitive} NullishPrimitive */
/** @typedef {import('#primitive').BoxablePrimitive} BoxablePrimitive */
/** @typedef {import('#primitive').PrimitiveValue} PrimitiveValue */
/** @typedef {import('#primitive').BoxedPrimitive} BoxedPrimitive */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const StringConstructor = globalContext.String;
const NumberConstructor = globalContext.Number;
const BooleanConstructor = globalContext.Boolean;

const SymbolFactory = globalContext.Symbol;
const BigIntFactory = globalContext.BigInt;

const stringPrototype = StringConstructor.prototype;
const numberPrototype = NumberConstructor.prototype;
const booleanPrototype = BooleanConstructor.prototype;

const toStringValue = stringPrototype.valueOf;
const toNumberValue = numberPrototype.valueOf;
const toBooleanValue = booleanPrototype.valueOf;

const symbolKeyFor = SymbolFactory.keyFor;

const toSymbolValue = SymbolFactory.prototype.valueOf;
const toBigIntValue = BigIntFactory.prototype.valueOf;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Boxed-Primitive Realm-Resolution Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Whether `value` is a direct current-realm `String` instance — passes
 * `value instanceof StringConstructor` AND has `stringPrototype` as its
 * immediate prototype. The proto-identity arm rejects `String`
 * subclasses (admitted by the bare `instanceof`), preserving the
 * direct-instance discrimination the boxed-primitive predicates require.
 *
 * Invoked exclusively after the caller's `isObject` gate, so the helper
 * carries no nullish or non-object guard of its own. The captured
 * `StringConstructor` is always present (the `String` global is a
 * runtime fixture), so no constructor-presence guard either.
 *
 * @param {object} value - the value to test; assumed object-typed by
 *  the caller
 * @returns {value is BoxedString} `true` when both the `instanceof` check and the
 *  prototype-identity check hold; `false` otherwise
 * @internal
 */
export function isCurrentRealmNativeStringInstance(value) {
  try {
    return (
      value instanceof StringConstructor && getPrototypeOf(value) === stringPrototype
    );
  } catch {
    return false;
  }
}

/* @@throw-safe */
/**
 * Whether `value` is a direct current-realm `Number` instance — passes
 * `value instanceof NumberConstructor` AND has `numberPrototype` as its
 * immediate prototype. The proto-identity arm rejects `Number`
 * subclasses (admitted by the bare `instanceof`), preserving the
 * direct-instance discrimination the boxed-primitive predicates require.
 *
 * Invoked exclusively after the caller's `isObject` gate, so the helper
 * carries no nullish or non-object guard of its own. The captured
 * `NumberConstructor` is always present (the `Number` global is a
 * runtime fixture), so no constructor-presence guard either.
 *
 * @param {object} value - the value to test; assumed object-typed by
 *  the caller
 * @returns {value is BoxedNumber} `true` when both the `instanceof` check and the
 *  prototype-identity check hold; `false` otherwise
 * @internal
 */
export function isCurrentRealmNativeNumberInstance(value) {
  try {
    return (
      value instanceof NumberConstructor && getPrototypeOf(value) === numberPrototype
    );
  } catch {
    return false;
  }
}

/* @@throw-safe */
/**
 * Whether `value` is a direct current-realm `Boolean` instance — passes
 * `value instanceof BooleanConstructor` AND has `booleanPrototype` as
 * its immediate prototype. The proto-identity arm rejects `Boolean`
 * subclasses (admitted by the bare `instanceof`), preserving the
 * direct-instance discrimination the boxed-primitive predicates require.
 *
 * Invoked exclusively after the caller's `isObject` gate, so the helper
 * carries no nullish or non-object guard of its own. The captured
 * `BooleanConstructor` is always present (the `Boolean` global is a
 * runtime fixture), so no constructor-presence guard either.
 *
 * @param {object} value - the value to test; assumed object-typed by
 *  the caller
 * @returns {value is BoxedBoolean} `true` when both the `instanceof` check and the
 *  prototype-identity check hold; `false` otherwise
 * @internal
 */
export function isCurrentRealmNativeBooleanInstance(value) {
  try {
    return (
      value instanceof BooleanConstructor && getPrototypeOf(value) === booleanPrototype
    );
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Unboxed-Value Equality Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Verifies that the boxed `String` value's `[[StringData]]` internal slot
 * is present and that its unboxed primitive value equals `String(value)`
 * — the load-bearing fourth marker of {@link isBoxedString}'s
 * discrimination chain. Invokes the module-scoped captured
 * `String.prototype.valueOf` (`toStringValue`) on the candidate via
 * `.call`. The call throws on any value lacking the `[[StringData]]`
 * slot. The `try/catch` reduces the throw to `false`. The comparison
 * `=== String(value)` round-trips both sides through spec-mechanic
 * coercion paths that unwrap the boxed primitive.
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

/* @@throw-safe */
/**
 * Verifies that the boxed `Number` value's `[[NumberData]]` internal slot
 * is present and that its unboxed primitive value matches `Number(value)`
 * compared via `Object.is` — the load-bearing fourth marker of
 * {@link isBoxedNumber}'s discrimination chain. Invokes the
 * module-scoped captured `Number.prototype.valueOf` (`toNumberValue`)
 * via `.call`. The call throws on any value lacking the `[[NumberData]]`
 * slot. `Object.is` is used in preference to `===` so that
 * `new Number(NaN)` is correctly admitted (`Object.is(NaN, NaN) === true`,
 * whereas `NaN === NaN` is `false`). The realm-fixed `objectIs` from
 * `#config` is the capture.
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

/* @@throw-safe */
/**
 * Verifies that the boxed `Boolean` value's `[[BooleanData]]` internal
 * slot is present and that its unboxed primitive value's string form
 * matches the boxed value's string coercion — the load-bearing fourth
 * marker of {@link isBoxedBoolean}'s discrimination chain. Invokes the
 * module-scoped captured `Boolean.prototype.valueOf` (`toBooleanValue`)
 * via `.call`. The call throws on any value lacking the
 * `[[BooleanData]]` slot. Stringified comparison via `String(...)` on
 * both sides sidesteps the `ToBoolean(Object) === true` trap that
 * `Boolean(new Boolean(false))` would otherwise produce. `String` uses
 * `ToPrimitive("string")` which unwraps via `Boolean.prototype.toString`.
 *
 * Boolean is the only one of the five primitive equality helpers whose
 * boxed-side comparison routes through `prototype.toString` (`String` and
 * `BigInt` use direct `===`, Number uses `Object.is`, `Symbol` uses a
 * description cross-check). The asymmetry is forced by the
 * `ToBoolean(Object) → true` trap, which closes off the direct-`===`
 * path the other families use. As a consequence, the helper assumes
 * `Boolean.prototype.toString` is untampered on the local realm.
 * `toBooleanValue` is captured realm-fixed for the slot-probe. The
 * `String(value)` path on the boxed side resolves through the live
 * `Boolean.prototype.toString`. In an adversarial environment that has
 * replaced `Boolean.prototype.toString`, real boxed Booleans may be
 * falsely rejected. The unboxed side is unaffected because
 * primitive-to-string coercion bypasses the prototype method. The
 * tampering surface is unusual in practice, and
 * `Boolean.prototype.toString` is not realm-fixed by this package.
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

/* @@throw-safe */
/**
 * Verifies that the boxed `Symbol` value's `[[SymbolData]]` internal slot
 * is present and that the unboxed primitive symbol's `description`
 * matches the boxed value's `description` — the load-bearing fourth
 * marker of {@link isBoxedSymbol}'s discrimination chain. Invokes the
 * module-scoped captured `Symbol.prototype.valueOf` (`toSymbolValue`)
 * via `.call`. The call throws on any value lacking the `[[SymbolData]]`
 * slot.
 *
 * The description cross-check catches the own-property-shadowing
 * tampering surface. A real boxed `Symbol` whose `description` getter
 * has been overridden by an own data property has a valueOf that still
 * works but an observable description that lies. The unboxed-side read
 * goes through the primitive's `[[Description]]` slot via
 * `Symbol.prototype.description`. The boxed-side read goes through the
 * (shadowed) accessor chain. The two diverge.
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

/* @@throw-safe */
/**
 * Verifies that the boxed `BigInt` value's `[[BigIntData]]` internal slot
 * is present and that its unboxed primitive value equals `BigInt(value)`
 * — the load-bearing fourth marker of {@link isBoxedBigInt}'s
 * discrimination chain. Invokes the module-scoped captured
 * `BigInt.prototype.valueOf` (`toBigIntValue`) via `.call`. The call
 * throws on any value lacking the `[[BigIntData]]` slot. `BigInt(value)`
 * per ECMA-262 §21.2.1.1 starts with `ToPrimitive(value, "number")`,
 * which calls `valueOf` on the boxed `BigInt` and unwraps, so both sides
 * land on the same primitive `bigint`. Direct `===` is sufficient.
 *
 * @param {unknown} value - the value to test
 * @returns {boolean} `true` when the unboxed primitive equals
 *  `BigInt(value)`; `false` otherwise (including when `valueOf` throws)
 * @internal
 */
export function doesHaveStrictUnboxedBigIntValueEquality(value) {
  try {
    return toBigIntValue.call(value) === BigIntFactory(/** @type {bigint} */ (value));
  } catch {
    return false;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  String Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to the primitive string form via
 * `typeof value === 'string'`.
 *
 * Matches the primitive form only. Boxed `String` objects, such as
 * `new String('x')`, report `typeof === 'object'` and are deliberately
 * excluded. Admitting both forms requires {@link isString}.
 * Discriminating the boxed form requires {@link isBoxedString}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a string
 * @returns {value is StringValue} `true` when
 *  `typeof value === 'string'`; `false` otherwise
 * @example
 * isStringValue('x');              // true
 * isStringValue('');               // true (empty string is still a string)
 * isStringValue(new String('x'));  // false (already boxed)
 * isStringValue(42);               // false
 */
export function isStringValue(value) {
  return typeof value === 'string';
}

/* @@throw-safe */
/**
 * Narrows a value to the boxed `String` wrapper-object form via the
 * {@link isObject} gate, a two-branch identity-check, and the
 * spec-precise `[[StringData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedStringValueEquality}.
 *
 * The two-branch identity-check runs in cost-order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast-path: `value instanceof StringConstructor` paired
 *   with `getPrototypeOf(value) === stringPrototype`. The pair admits
 *   only direct `String` instances. Subclasses pass `instanceof` but
 *   fail the prototype identity-check, preserving subclass rejection.
 *   Both captures (`StringConstructor` and `stringPrototype`) are
 *   realm-fixed at module-load, so the branch is robust to post-load
 *   tampering of the global `String` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object String]'` paired with the resolved constructor-name
 *   `'String'`. Both work realm-independently — the tag-read through
 *   the realm-fixed `toObjectString.call` capture, the constructor-walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor-name is derived from
 *   the subclass itself.
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[StringData]]` evidence. A value
 * passes only if the captured `String.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive equals
 * `String(value)`. The probe closes the `Symbol.toStringTag`-spoofing
 * surface the structural markers leave open even when paired with the
 * constructor-walk. It also rejects post-`Object.setPrototypeOf`
 * spoofs that would otherwise pass the local-realm pair.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed string
 * @returns {value is BoxedString} `true` when the identity-check
 *  and the `[[StringData]]` slot-probe both hold, narrowing `value`
 *  to `BoxedString`; `false` otherwise
 * @example
 * isBoxedString(new String('x'));                    // true (instanceof + slot)
 * isBoxedString(Object('x'));                        // true
 * isBoxedString('x');                                // false (primitive)
 * isBoxedString({ [Symbol.toStringTag]: 'String' }); // false (no [[StringData]])
 */
export function isBoxedString(value) {
  return (
    isObject(value) &&
    (isCurrentRealmNativeStringInstance(value) ||
      (getTypeSignature(value) === '[object String]' &&
        getDefinedConstructorName(value) === 'String')) &&
    doesHaveStrictUnboxedStringValueEquality(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to either the primitive string form or the boxed
 * `String` wrapper-object form — the union {@link StringType}.
 *
 * Composes `isStringValue || isBoxedString` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isString} when admitting both forms is intentional —
 * most string-handling code accepts boxed and primitive uniformly via
 * implicit coercion. Reach for {@link isStringValue} or
 * {@link isBoxedString} when the distinction matters (e.g., strict
 * equality with a primitive form, or wrapper-method invocation that
 * requires the boxed receiver).
 *
 * @param {unknown} [value] - the value to test; omitted is treated
 *  as `undefined`, which is neither form of string
 * @returns {value is StringType} `true` when the value is either a
 *  primitive string or a boxed `String`; `false` otherwise
 * @example
 * isString('x');             // true
 * isString(new String('x')); // true
 * isString(42);              // false
 * isString(null);            // false
 */
export function isString(value) {
  return isStringValue(value) || isBoxedString(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Number Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to the primitive number form via
 * `typeof value === 'number'`.
 *
 * Matches every numeric primitive — `NaN`, `±Infinity`, and finite
 * numbers alike. Finiteness, integrality, and safe-integer-range
 * checks are caller's concerns. Reach for {@link isFiniteNumberValue},
 * {@link isIntegerValue}, or {@link isSafeIntegerValue} — the
 * Number static-method guards in this module (relocated here from
 * `#config` by decision #074; finite-number contract per #072). Boxed
 * `Number` objects, such as `new Number(42)`,
 * report `typeof === 'object'` and are deliberately excluded. Admitting
 * both forms requires {@link isNumber}. Discriminating the boxed form
 * requires {@link isBoxedNumber}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a number
 * @returns {value is NumberValue} `true` when
 *  `typeof value === 'number'`, narrowing `value` to `NumberValue`;
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

/* @@throw-safe */
/**
 * Narrows a value to the boxed `Number` wrapper-object form via the
 * {@link isObject} gate, a two-branch identity-check, and the
 * spec-precise `[[NumberData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedNumberValueEquality}.
 *
 * The two-branch identity-check runs in cost-order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast-path: `value instanceof NumberConstructor` paired
 *   with `getPrototypeOf(value) === numberPrototype`. The pair admits
 *   only direct `Number` instances. Subclasses pass `instanceof` but
 *   fail the prototype identity-check, preserving subclass rejection.
 *   Both captures (`NumberConstructor` and `numberPrototype`) are
 *   realm-fixed at module-load, so the branch is robust to post-load
 *   tampering of the global `Number` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object Number]'` paired with the resolved constructor-name
 *   `'Number'`. Both work realm-independently — the tag-read through
 *   the realm-fixed `toObjectString.call` capture, the constructor-walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor-name is derived from
 *   the subclass itself.
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[NumberData]]` evidence. A value
 * passes only if the captured `Number.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive matches
 * `Number(value)` under `Object.is`. `Object.is` is preferred over
 * `===` so that `new Number(NaN)` is correctly admitted
 * (`Object.is(NaN, NaN) === true`, whereas `NaN === NaN` is `false`).
 * The probe closes the `Symbol.toStringTag`-spoofing surface the
 * structural markers leave open even when paired with the constructor
 * walk. It also rejects post-`Object.setPrototypeOf` spoofs that would
 * otherwise pass the local-realm pair.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed number
 * @returns {value is BoxedNumber} `true` when the identity-check
 *  and the `[[NumberData]]` slot-probe both hold, narrowing `value`
 *  to `BoxedNumber`; `false` otherwise
 * @example
 * isBoxedNumber(new Number(42)); // true (instanceof + slot)
 * isBoxedNumber(Object(42));     // true
 * isBoxedNumber(42);             // false (primitive)
 */
export function isBoxedNumber(value) {
  return (
    isObject(value) &&
    (isCurrentRealmNativeNumberInstance(value) ||
      (getTypeSignature(value) === '[object Number]' &&
        getDefinedConstructorName(value) === 'Number')) &&
    doesHaveStrictUnboxedNumberValueEquality(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to either the primitive number form or the boxed
 * `Number` wrapper-object form — the union {@link NumberType}.
 *
 * Composes `isNumberValue || isBoxedNumber` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isNumber} when admitting both forms is intentional —
 * most numeric code accepts boxed and primitive uniformly via implicit
 * coercion in arithmetic contexts. Reach for {@link isNumberValue} or
 * {@link isBoxedNumber} when the distinction matters (e.g., strict
 * equality with a primitive form, or wrapper-method invocation that
 * requires the boxed receiver).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of number
 * @returns {value is NumberType} `true` when the value is either a
 *  primitive number or a boxed `Number`, narrowing `value` to
 *  `NumberType`; `false` otherwise
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
//  Number Static-Method Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
// The `Number.isFinite` / `isInteger` / `isSafeInteger` mirrors, realm-fixed at
// module-load with polyfill fallbacks. Relocated from `#config` (ADR #074): they
// are Number-family type guards, not infrastructure, and the move drops config's
// only DIRECT `#primitive` import.
//
// Intrinsics are read from config's `globalContext` capture at eval time. This is
// safe because `config` is now a runtime leaf (zero internal imports): it can never
// be re-entered mid-cycle, so its body always fully evaluates before any importer's
// body runs, and `globalContext` is guaranteed initialized. (Before config became a
// leaf this same eval-time read TDZ-crashed on a `./config` entry — see ADR #074.)

const n = NumberConstructor;
const m = globalContext.Math;

const nativeIsFinite = globalContext.isFinite;
const mathAbs = m.abs;
const mathFloor = m.floor;

const { MAX_SAFE_INTEGER } = n;

/* @@throw-safe */
/**
 * The explicit polyfill behind {@link isFiniteNumberValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes the
 * {@link isNumberValue} typeof guard with the captured global `isFinite`,
 * reproducing `Number.isFinite` semantics — the leading typeof guard is what
 * suppresses the coercion the bare global `isFinite` applies (`isFinite('5')`
 * is `true`, but `isFiniteNumber('5')` is `false`).
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is a finite number;
 *  `false` otherwise
 * @internal
 */
export function isFiniteNumber(value) {
  return isNumberValue(value) && nativeIsFinite(value);
}

/* @@throw-safe */
/**
 * `Number.isFinite`, realm-fixed at module-load with a polyfill fallback
 * for runtimes lacking it.
 *
 * The `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing at
 * consumer call sites. The runtime export is the native method when
 * callable; otherwise it falls back to the {@link isFiniteNumber} polyfill.
 */
export const isFiniteNumberValue = isCallable(n.isFinite) ? n.isFinite : isFiniteNumber;

/* @@throw-safe */
/**
 * The explicit polyfill behind {@link isIntegerValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes
 * {@link isFiniteNumberValue} with a `Math.floor(value) === value`
 * whole-number check.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is an integer (finite
 *  number with no fractional part); `false` otherwise
 * @internal
 */
export function isInteger(value) {
  return isFiniteNumberValue(value) && mathFloor(/** @type {number} */ (value)) === value;
}

/* @@throw-safe */
/**
 * `Number.isInteger`, realm-fixed at module-load with a polyfill fallback
 * for runtimes lacking it.
 *
 * The `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing at
 * consumer call sites. The runtime export is the native method when
 * callable; otherwise it falls back to the {@link isInteger} polyfill.
 */
export const isIntegerValue = isCallable(n.isInteger) ? n.isInteger : isInteger;

/* @@throw-safe */
/**
 * The explicit polyfill behind {@link isSafeIntegerValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes
 * {@link isIntegerValue} with the absolute-value bound against
 * `Number.MAX_SAFE_INTEGER`.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is a safe integer
 *  (integer in the lossless-round-trip range `[-(2^53 - 1), 2^53 - 1]`);
 *  `false` otherwise
 * @internal
 */
export function isSafeInteger(value) {
  return (
    isIntegerValue(value) && mathAbs(/** @type {number} */ (value)) <= MAX_SAFE_INTEGER
  );
}

/* @@throw-safe */
/**
 * `Number.isSafeInteger`, realm-fixed at module-load with a polyfill
 * fallback for runtimes lacking it.
 *
 * Tests whether `value` is an integer in the range
 * `[-(2^53 - 1), 2^53 - 1]`, where round-tripping is lossless. The
 * `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing. The runtime
 * export is the native method when callable; otherwise it falls back to the
 * {@link isSafeInteger} polyfill.
 */
export const isSafeIntegerValue = isCallable(n.isSafeInteger)
  ? n.isSafeInteger
  : isSafeInteger;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Boolean Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to the primitive boolean form via
 * `typeof value === 'boolean'`.
 *
 * Matches the primitive form only — both `true` and `false`. Boxed
 * `Boolean` objects, such as `new Boolean(true)`, report
 * `typeof === 'object'` and are deliberately excluded. Admitting both
 * forms requires {@link isBoolean}. Discriminating the boxed form
 * requires {@link isBoxedBoolean}. Truthy/falsy coercion (`!!value`) is
 * a different operation. This predicate discriminates the primitive
 * type, not the truthiness.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boolean
 * @returns {value is BooleanValue} `true` when
 *  `typeof value === 'boolean'`, narrowing `value` to `BooleanValue`;
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

/* @@throw-safe */
/**
 * Narrows a value to the boxed `Boolean` wrapper-object form via the
 * {@link isObject} gate, a two-branch identity-check, and the
 * spec-precise `[[BooleanData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBooleanValueEquality}.
 *
 * The two-branch identity-check runs in cost-order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast-path: `value instanceof BooleanConstructor` paired
 *   with `getPrototypeOf(value) === booleanPrototype`. The pair admits
 *   only direct `Boolean` instances. Subclasses pass `instanceof` but
 *   fail the prototype identity-check, preserving subclass rejection.
 *   Both captures (`BooleanConstructor` and `booleanPrototype`) are
 *   realm-fixed at module-load, so the branch is robust to post-load
 *   tampering of the global `Boolean` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object Boolean]'` paired with the resolved constructor-name
 *   `'Boolean'`. Both work realm-independently — the tag-read through
 *   the realm-fixed `toObjectString.call` capture, the constructor-walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor-name is derived from the
 *   subclass itself.
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[BooleanData]]` evidence. A value
 * passes only if the captured `Boolean.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive's string form equals
 * `String(value)`. The stringified comparison sidesteps the
 * `ToBoolean(Object) === true` trap that `Boolean(new Boolean(false))`
 * would otherwise produce on a direct value compare. The probe closes
 * the `Symbol.toStringTag`-spoofing surface the structural markers
 * leave open even when paired with the constructor-walk. It also
 * rejects post-`Object.setPrototypeOf` spoofs that would otherwise pass
 * the local-realm pair.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed boolean
 * @returns {value is BoxedBoolean} `true` when the identity-check
 *  and the `[[BooleanData]]` slot-probe both hold, narrowing `value`
 *  to `BoxedBoolean`; `false` otherwise
 * @example
 * isBoxedBoolean(new Boolean(true));  // true (instanceof + slot)
 * isBoxedBoolean(new Boolean(false)); // true
 * isBoxedBoolean(true);               // false (primitive)
 */
export function isBoxedBoolean(value) {
  return (
    isObject(value) &&
    (isCurrentRealmNativeBooleanInstance(value) ||
      (getTypeSignature(value) === '[object Boolean]' &&
        getDefinedConstructorName(value) === 'Boolean')) &&
    doesHaveStrictUnboxedBooleanValueEquality(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to either the primitive boolean form or the boxed
 * `Boolean` wrapper-object form — the union {@link BooleanType}.
 *
 * Composes `isBooleanValue || isBoxedBoolean` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isBoolean} when admitting both forms is intentional —
 * most code that handles boolean values accepts boxed and primitive
 * uniformly. Reach for {@link isBooleanValue} or {@link isBoxedBoolean}
 * when the distinction matters (e.g., strict equality with a primitive
 * form, or distinguishing type narrowing from truthiness coercion:
 * `new Boolean(false)` is a `BoxedBoolean` but is truthy as an object).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of boolean
 * @returns {value is BooleanType} `true` when the value is either a
 *  primitive boolean or a boxed `Boolean`, narrowing `value` to
 *  `BooleanType`; `false` otherwise
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

/* @@throw-safe */
/**
 * Narrows a value to the primitive symbol form via
 * `typeof value === 'symbol'`.
 *
 * Covers unique symbols, registered symbols from `Symbol.for`, and
 * well-known symbols such as `Symbol.iterator`. Boxed `Symbol` objects
 * (produced via `Object(Symbol('x'))`) report `typeof === 'object'`
 * and are deliberately excluded. Admitting both forms requires
 * {@link isSymbol}. Discriminating the boxed form requires
 * {@link isBoxedSymbol}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a symbol
 * @returns {value is SymbolValue} `true` when
 *  `typeof value === 'symbol'`, narrowing `value` to `SymbolValue`;
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

/* @@throw-safe */
/**
 * Narrows a value to the boxed `Symbol` wrapper-object form via four
 * cross-validating markers: the {@link isObject} gate, the `[[Class]]`
 * tag `'[object Symbol]'`, the constructor-name `'Symbol'`, and the
 * spec-precise `[[SymbolData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedSymbolValueEquality}.
 *
 * Short-circuit `&&` runs the markers in cost-order: the `isObject`
 * gate first (O(1) primitive-and-null rejection), the tag-check
 * second (cross-realm-safe via realm-fixed `toObjectString.call`),
 * the constructor-walk third, and the valueOf-slot probe last as
 * the spec-precise spoof closure.
 *
 * Unlike {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity-branch.
 * `Symbol` is a factory-function, not a constructor — `new Symbol()`
 * throws. `Object(Symbol('x')) instanceof Symbol` evaluates to `true`
 * only by virtue of the default `OrdinaryHasInstance` algorithm
 * walking the prototype-chain, not because the spec treats the wrapper
 * as a `Symbol` instance in any identity-bearing sense. The structural
 * chain runs uniformly across local-realm and cross-realm boxed
 * `Symbol`s and is the honest discriminator here.
 *
 * The `[[SymbolData]]` probe cross-checks the unboxed primitive's
 * `description` against the boxed value's `description` — catching
 * the own-property-shadowing tampering surface where a real boxed
 * `Symbol` has had its `description` getter overridden by an own
 * data property.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed symbol
 * @returns {value is BoxedSymbol} `true` when all four markers
 *  hold, narrowing `value` to `BoxedSymbol`; `false` otherwise
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

/* @@throw-safe */
/**
 * Narrows a value to either the primitive symbol form or the boxed
 * `Symbol` wrapper-object form — the union {@link SymbolType}.
 *
 * Composes `isSymbolValue || isBoxedSymbol` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isSymbol} when admitting both forms is intentional —
 * JavaScript treats boxed and primitive symbols as interchangeable
 * property keys via implicit unwrapping. Reach for {@link isSymbolValue}
 * or {@link isBoxedSymbol} when the distinction matters (e.g., strict
 * equality with a specific primitive symbol, or asserting the literal
 * wrapper-object shape).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of symbol
 * @returns {value is SymbolType} `true` when the value is either a
 *  primitive symbol or a boxed `Symbol`, narrowing `value` to
 *  `SymbolType`; `false` otherwise
 * @example
 * isSymbol(Symbol('x'));         // true
 * isSymbol(Object(Symbol('x'))); // true
 * isSymbol('x');                 // false
 * isSymbol(null);                // false
 */
export function isSymbol(value) {
  return isSymbolValue(value) || isBoxedSymbol(value);
}

/**
 * Whether a symbol is _unregistered_ — created via `Symbol()` or a well-known
 * symbol, i.e. not obtained from the global registry via `Symbol.for`.
 *
 * "Unguarded": the caller must ensure `value` is a symbol; this performs no
 * `isSymbolValue` check. It reads the realm-fixed `Symbol.keyFor` capture —
 * `keyFor(value) === undefined` is the spec tell for an unregistered symbol.
 * The load-bearing use is weak-key validation: only unregistered symbols may
 * serve as `WeakMap` / `WeakSet` keys.
 *
 * @param {symbol} value - a symbol (precondition; not re-checked)
 * @returns {boolean} `true` when the symbol is unregistered; `false` for a
 *  registered one
 * @throws {TypeError} when `value` is not a symbol — `Symbol.keyFor` requires
 *  a symbol receiver (the unguarded precondition the caller must satisfy)
 * @internal
 */
export function unguardedIsUnregisteredSymbol(value) {
  return symbolKeyFor(value) === void 0;
}

/* @@throw-safe */
/**
 * Whether `value` is a _registered_ symbol — a symbol obtained from the global
 * symbol registry via `Symbol.for`.
 *
 * The guarded public counterpart of {@link unguardedIsUnregisteredSymbol}:
 * confirms `value` is a primitive symbol, then that `Symbol.keyFor` resolves a
 * registry key for it. Registered symbols are notable for being rejected as
 * `WeakMap` / `WeakSet` keys by the engine.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a symbol
 * @returns {boolean} `true` when the value is a registered symbol; `false`
 *  otherwise
 */
export function isRegisteredSymbol(value) {
  return isSymbolValue(value) && !unguardedIsUnregisteredSymbol(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  BigInt Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to the primitive bigint form via
 * `typeof value === 'bigint'`.
 *
 * Matches the primitive form only — literals (`1n`), `BigInt()` calls,
 * and any arithmetic result that stays in the bigint domain. Boxed
 * `BigInt` objects (produced via `Object(1n)`) report
 * `typeof === 'object'` and are deliberately excluded. Admitting both
 * forms requires {@link isBigInt}. Discriminating the boxed form
 * requires {@link isBoxedBigInt}.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a bigint
 * @returns {value is BigIntValue} `true` when
 *  `typeof value === 'bigint'`, narrowing `value` to `BigIntValue`;
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

/* @@throw-safe */
/**
 * Narrows a value to the boxed `BigInt` wrapper-object form via four
 * cross-validating markers: the {@link isObject} gate, the `[[Class]]`
 * tag `'[object BigInt]'`, the constructor-name `'BigInt'`, and the
 * spec-precise `[[BigIntData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBigIntValueEquality}.
 *
 * Short-circuit `&&` runs the markers in cost-order: the `isObject`
 * gate first, then tag-check, then constructor-walk, then the
 * valueOf-slot probe.
 *
 * Like {@link isBoxedSymbol}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity-branch that
 * {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean} use. `BigInt` is a factory-function, not
 * a constructor — `new BigInt(1n)` throws. `instanceof BigInt` is
 * incidental to `OrdinaryHasInstance` rather than a meaningful
 * identity test. The structural chain is the honest discriminator.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed bigint
 * @returns {value is BoxedBigInt} `true` when all four markers
 *  hold, narrowing `value` to `BoxedBigInt`; `false` otherwise
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

/* @@throw-safe */
/**
 * Narrows a value to either the primitive bigint form or the boxed
 * `BigInt` wrapper-object form — the union {@link BigIntType}.
 *
 * Composes `isBigIntValue || isBoxedBigInt` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isBigInt} when admitting both forms is intentional —
 * boxed and primitive bigints participate uniformly in arithmetic via
 * implicit coercion. Reach for {@link isBigIntValue} or
 * {@link isBoxedBigInt} when the distinction matters (e.g., strict
 * equality with a primitive form, or asserting the literal
 * wrapper-object shape).
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form of bigint
 * @returns {value is BigIntType} `true` when the value is either a
 *  primitive bigint or a boxed `BigInt`, narrowing `value` to
 *  `BigIntType`; `false` otherwise
 * @example
 * isBigInt(1n);         // true
 * isBigInt(Object(1n)); // true
 * isBigInt(1);          // false
 */
export function isBigInt(value) {
  return isBigIntValue(value) || isBoxedBigInt(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generic Primitive Type Handling
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to the nullish-primitive union {@link NullishPrimitive} —
 * `null` or `undefined`.
 *
 * Detects argument presence via `args.length` before classifying: an
 * omitted call supplies no value to judge, so it answers `false` rather
 * than claim a value that was never passed is nullish. Presence is a
 * property of the call (its arity), which a defaulted named parameter
 * would erase — so the rest parameter is load-bearing, not stylistic. For
 * a supplied argument, `?? null` collapses both nullish forms to `null`
 * for a single strict-equality test. The three input cases:
 *
 * 1. `isNullishPrimitive()` — no argument; `args.length === 0`
 *    short-circuits to `false` (there is no value to be nullish).
 * 2. `isNullishPrimitive(null)` and `isNullishPrimitive(undefined)` — an
 *    argument is present, so `?? null` collapses both to `null` and
 *    `=== null` is `true`.
 * 3. Every supplied non-nullish value survives `?? null` unchanged and
 *    fails the comparison.
 *
 * This supersedes the former parameter-default-to-`null` idiom (decision
 * #025), which could not distinguish an omitted call from an explicit
 * `undefined`.
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value
 *  to test; its presence is detected via `args.length`
 * @returns {value is NullishPrimitive} `true` when an argument is present
 *  and is `null` or `undefined`, narrowing it to `NullishPrimitive`;
 *  `false` otherwise (an omitted call included)
 * @example
 * isNullishPrimitive(null);      // true
 * isNullishPrimitive(undefined); // true
 * isNullishPrimitive();          // false (omitted ... cannot be answered with `true`)
 * isNullishPrimitive(0);         // false
 * isNullishPrimitive('');        // false
 * isNullishPrimitive(false);     // false
 */
export function isNullishPrimitive(...args) {
  return args.length > 0 && (args[0] ?? null) === null;
}

const nonBoxableTypeSignatures = new Set(['undefined', 'function', 'object']);

/* @@throw-safe */
/**
 * Narrows a value to the boxable-primitive union {@link BoxablePrimitive} —
 * `'string'`, `'number'`, `'boolean'`, `'symbol'`, or `'bigint'`.
 *
 * Shaped as a `typeof`-result EXCLUSION rather than an enumeration:
 * admits any value whose `typeof` is not `'undefined'`, `'function'`,
 * or `'object'`. The three rejected signatures cover the entire
 * non-boxable surface (undefined, callable Object, regular Object
 * including `null`), leaving the five boxable families as the
 * admitted set.
 *
 * The exclusion shape is deliberate and load-bearing — it makes the
 * predicate future-proof against new primitive types added by future
 * ECMA versions. Every primitive added since ES1 (`Symbol` in ES6,
 * `BigInt` in ES2020) has arrived with a new `typeof` result distinct
 * from the three rejection cases. The rejection set is spec-locked:
 * modern ECMA does not permit implementation-defined `typeof` strings.
 * An enumeration-based shape (`t === 'string' || t === 'number' || …`)
 * would silently fail to admit any new primitive; the exclusion form
 * admits it without code changes. The only legacy quirk that produces
 * a non-canonical `typeof` result is `document.all` returning
 * `'undefined'`. The exclusion correctly rejects it.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxable primitive
 * @returns {value is BoxablePrimitive} `true` when `typeof value`
 *  is not one of the three non-boxable signatures, narrowing `value`
 *  to `BoxablePrimitive`; `false` otherwise
 * @example
 * isBoxablePrimitive('x');             // true
 * isBoxablePrimitive(42);              // true
 * isBoxablePrimitive(true);            // true
 * isBoxablePrimitive(Symbol('y'));     // true
 * isBoxablePrimitive(1n);              // true
 * isBoxablePrimitive(null);            // false
 * isBoxablePrimitive(undefined);       // false
 * isBoxablePrimitive({});              // false
 * isBoxablePrimitive(() => {});        // false
 * isBoxablePrimitive(new String('x')); // false (already boxed)
 */
export function isBoxablePrimitive(value) {
  return !nonBoxableTypeSignatures.has(typeof value);
}

/* @@throw-safe */
/**
 * Narrows a value to the full primitive union {@link PrimitiveValue} — any
 * of the seven ECMA-262 primitive types.
 *
 * Detects argument presence via `args.length` first: `undefined` is a
 * member of the accept-set — it is a primitive value — so an omitted call
 * must answer `false` rather than admit a value that was never supplied.
 * A present argument is then classified by
 * `(args[0] ?? null) === null || isBoxablePrimitive(args[0])` — the
 * nullish arm inlines {@link isNullishPrimitive}'s strict-identity check
 * rather than calling it, sparing that call's own rest-parameter
 * allocation on every non-nullish input (the common case).
 *
 * The inlined check is strict identity (`=== null`), not truthiness
 * (`!value`) — the two diverge on `document.all`, the one falsy value in
 * the language whose `typeof` is `'undefined'`. `document.all ?? null`
 * leaves it untouched (it is not strictly `null` or `undefined`), so the
 * nullish arm rejects it and evaluation falls through to
 * `isBoxablePrimitive`, whose exclusion set rejects the `'undefined'`
 * signature in turn. A truthiness-based shortcut (`!value || …`) would
 * short-circuit `true` on `document.all` alone, misclassifying a host
 * exotic object as a primitive.
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value
 *  to test; its presence is detected via `args.length`
 * @returns {value is PrimitiveValue} `true` when an argument is present and
 *  is any of the seven primitive types, narrowing it to `PrimitiveValue`;
 *  `false` otherwise (an omitted call included)
 * @example
 * isPrimitiveValue('x');             // true
 * isPrimitiveValue(42);              // true
 * isPrimitiveValue(Symbol('y'));     // true
 * isPrimitiveValue(null);            // true
 * isPrimitiveValue(undefined);       // true
 * isPrimitiveValue();                // false (omitted — no value supplied)
 * isPrimitiveValue({});              // false
 * isPrimitiveValue(() => {});        // false
 * isPrimitiveValue(new String('x')); // false (already boxed)
 */
export function isPrimitiveValue(...args) {
  return args.length > 0 && ((args[0] ?? null) === null || isBoxablePrimitive(args[0]));
}

/**
 * Tag-to-equality-helper dispatch table for the alien-realm structural
 * path of {@link isBoxedPrimitive}. Maps the resolved `[[Class]]` tag
 * (e.g., `'String'`) to the family's
 * `doesHaveStrictUnboxedXValueEquality` slot-probe. The dispatch is
 * keyed lookup via `.get`, so insertion order does not affect
 * resolution.
 * @internal
 */
const unboxedPrimitiveValueEvaluations = new Map([
  ['String', doesHaveStrictUnboxedStringValueEquality],
  ['Number', doesHaveStrictUnboxedNumberValueEquality],
  ['Symbol', doesHaveStrictUnboxedSymbolValueEquality],
  ['BigInt', doesHaveStrictUnboxedBigIntValueEquality],
  ['Boolean', doesHaveStrictUnboxedBooleanValueEquality],
]);

/* @@throw-safe */
/**
 * Whether `value` resolves as a boxed primitive via the alien-realm
 * structural path — the resolved `[[Class]]` tag must match the walked
 * constructor-name, AND the matching `[[XData]]` slot-probe (looked up
 * through {@link unboxedPrimitiveValueEvaluations}) must pass. The
 * structural path covers cross-realm boxed primitives for all five
 * families and every local-realm `Symbol` / `BigInt` case, where the
 * factory-function carve-out (decision #049) precludes an `instanceof`
 * fast-path.
 *
 * Invoked exclusively after {@link isBoxedPrimitive}'s `isObject` gate,
 * so the helper carries no nullish or non-object guard of its own. The
 * tag-presence check (`taggedType && ...`) doubles as the rejection
 * floor for values whose `[[Class]]` does not name a known wrapper
 * type.
 *
 * @param {object} value - the value to test; assumed object-typed by
 *  the caller
 * @returns {boolean} `true` when the tag/constructor-name pair matches
 *  and the matching slot-probe passes; `false` otherwise
 * @internal
 */
export function resolvedViaAlienRealmPrimitiveTypesEvaluation(value) {
  const taggedType = getTaggedType(value);

  return !!(
    taggedType &&
    taggedType === getDefinedConstructorName(value) &&
    unboxedPrimitiveValueEvaluations.get(taggedType)?.(value)
  );
}

/* @@throw-safe */
/**
 * Whether `value` resolves as a boxed primitive via the ES3 native
 * hot-path — the local-realm fast-path for the three ES3 wrapper
 * constructors (`String`, `Number`, `Boolean`). Tries each candidate
 * in sequence; the candidate pairs `isCurrentRealmNativeX` with its
 * matching `[[XData]]` slot-probe and short-circuits on the first
 * match. Excludes `Symbol` and `BigInt` by the factory-function
 * carve-out (decision #049) — those families have no local-realm
 * `instanceof` branch and are routed through
 * {@link resolvedViaAlienRealmPrimitiveTypesEvaluation} instead.
 *
 * Invoked exclusively after {@link isBoxedPrimitive}'s `isObject` gate,
 * so the helper carries no nullish or non-object guard of its own.
 *
 * @param {object} value - the value to test; assumed object-typed by
 *  the caller
 * @returns {boolean} `true` when one of the three ES3 native pairs
 *  matches and its slot-probe passes; `false` otherwise
 * @internal
 */
export function resolvedViaES3NativePrimitiveTypesHotPaths(value) {
  return (
    (isCurrentRealmNativeStringInstance(value) &&
      doesHaveStrictUnboxedStringValueEquality(value)) ||
    (isCurrentRealmNativeNumberInstance(value) &&
      doesHaveStrictUnboxedNumberValueEquality(value)) ||
    (isCurrentRealmNativeBooleanInstance(value) &&
      doesHaveStrictUnboxedBooleanValueEquality(value))
  );
}

/* @@throw-safe */
/**
 * Narrows a value to the boxed-primitive union {@link BoxedPrimitive} —
 * any of the five boxed wrapper-object forms ({@link BoxedString},
 * {@link BoxedNumber}, {@link BoxedBoolean}, {@link BoxedSymbol},
 * {@link BoxedBigInt}).
 *
 * Composes the {@link isObject} gate with a two-path resolution:
 *
 * 1. **ES3 native hot-path**. The local-realm fast-path for the three
 *    ES3 wrapper constructors. Tries `String`, `Number`, and `Boolean`
 *    in sequence; each candidate pairs `isCurrentRealmNativeX` with the
 *    matching `[[XData]]` slot-probe. Short-circuits on the first match.
 *    `Symbol` and `BigInt` are excluded from this path by the
 *    factory-function carve-out (decision #049) — `new Symbol()` and
 *    `new BigInt()` both throw, so they have no local-realm
 *    `instanceof` branch.
 * 2. **Alien-realm structural path**. Resolves the `[[Class]]` tag,
 *    verifies the walked constructor-name matches the tag, and
 *    dispatches through the {@link unboxedPrimitiveValueEvaluations}
 *    map to run the matching `[[XData]]` slot-probe. Covers cross-realm
 *    boxed primitives for all five families and every local-realm
 *    `Symbol` / `BigInt` case.
 *
 * The slot-probe is the engine-attested seal on either path. A value
 * passes only if it carries one of the five `[[XData]]` internal slots,
 * confirmed by extracting the slot via the captured
 * `X.prototype.valueOf` and cross-checking the unboxed primitive
 * against `X(value)` under the family-appropriate equality strategy
 * (`===` for `String` / `BigInt`, `Object.is` for `Number`, stringified
 * compare for `Boolean`, `description`-value cross-check for `Symbol`).
 *
 * Reach for {@link isBoxedPrimitive} when admitting the boxed form
 * regardless of family is intentional (e.g., for stripping wrapper
 * objects to their primitive value before equality work). Reach for
 * the per-family {@link isBoxedString}, {@link isBoxedNumber},
 * {@link isBoxedBoolean}, {@link isBoxedSymbol}, or
 * {@link isBoxedBigInt} when only one family is acceptable.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a boxed primitive
 * @returns {value is BoxedPrimitive} `true` when the value carries
 *  one of the five `[[XData]]` internal slots, narrowing `value` to
 *  `BoxedPrimitive`; `false` otherwise
 * @example
 * isBoxedPrimitive(new String('x'));     // true
 * isBoxedPrimitive(Object(1n));          // true
 * isBoxedPrimitive(Object(Symbol('y'))); // true
 * isBoxedPrimitive(new Number(NaN));     // true (Object.is admits NaN)
 * isBoxedPrimitive('x');                 // false (primitive)
 * isBoxedPrimitive(null);                // false
 * isBoxedPrimitive({});                  // false (no [[XData]])
 */
export function isBoxedPrimitive(value) {
  return (
    isObject(value) &&
    (resolvedViaES3NativePrimitiveTypesHotPaths(value) ||
      resolvedViaAlienRealmPrimitiveTypesEvaluation(value))
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
