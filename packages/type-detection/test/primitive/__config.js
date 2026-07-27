// @ts-check

/**
 * @module test/primitive/__config
 *
 * Test configuration for the `primitive` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrices. Because `primitive`
 * spans five families and a floor lattice, the axis-1 surface is carried as
 * SEVERAL matrices rather than one wide table — mirroring the spec's own
 * organization and keeping each family's value/boxed/composite trichotomy
 * auditable at a glance:
 *
 *   Per family X ∈ { String, Number, Boolean, Symbol, BigInt }:
 *     {@link stringMatrix} / {@link numberMatrix} / … — candidates × {isXValue, isBoxedX, isX}
 *   Floor (cross-family):
 *     {@link floorMatrix} — candidates × {isNullishPrimitive, isBoxablePrimitive, isPrimitiveValue, isBoxedPrimitive}
 *   Number refinement:
 *     {@link numberStaticMatrix} — numeric candidates × {isFiniteNumberValue, isIntegerValue, isSafeIntegerValue}
 *   Symbol registry:
 *     {@link registeredSymbolMatrix} — symbol/non-symbol candidates × {isRegisteredSymbol}
 *
 * `spec.test.js` drives the matrices + the cross-family rejection sweep; the
 * targeted axis suites (cross-realm, adversarial, throw-safety, _internal) import
 * the specific named factories they need. Spoof / graft / subclass / hostile
 * candidates are deliberately NOT in the clean matrices — their rationale belongs
 * in `adversarial.test.js` / `throw-safety.test.js` prose, not a silent data row.
 *
 * Mirrors `docs/spec/PRIMITIVE.spec.md`.
 */

import { objectCreate } from '#index';

import { foreignRealmEval } from '../_cross-realm.js';

const T = true;
const F = false;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Predicate-name groups (the completeness-guard oracles)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** Per-family value / boxed / composite predicate names, keyed by family. */
export const FAMILY_PREDICATES = {
  String: ['isStringValue', 'isBoxedString', 'isString'],
  Number: ['isNumberValue', 'isBoxedNumber', 'isNumber'],
  Boolean: ['isBooleanValue', 'isBoxedBoolean', 'isBoolean'],
  Symbol: ['isSymbolValue', 'isBoxedSymbol', 'isSymbol'],
  BigInt: ['isBigIntValue', 'isBoxedBigInt', 'isBigInt'],
};

export const FLOOR_PREDICATES = [
  'isNullishPrimitive',
  'isBoxablePrimitive',
  'isPrimitiveValue',
  'isBoxedPrimitive',
];

export const NUMBER_STATIC_PREDICATES = [
  'isFiniteNumberValue',
  'isIntegerValue',
  'isSafeIntegerValue',
];

/** Every public predicate — the throw-safety completeness oracle (23 total). */
export const PUBLIC_PREDICATE_NAMES = [
  ...FAMILY_PREDICATES.String,
  ...FAMILY_PREDICATES.Number,
  ...FAMILY_PREDICATES.Boolean,
  ...FAMILY_PREDICATES.Symbol,
  ...FAMILY_PREDICATES.BigInt,
  ...FLOOR_PREDICATES,
  ...NUMBER_STATIC_PREDICATES,
  'isRegisteredSymbol',
];

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Candidate factories (fresh, genuine value per call)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// `Object` retyped as a primitive-boxing function. The lib types `Object(value)`
// as `any`, which cascades `no-unsafe-*` through every boxed factory; casting the
// global once to `(primitive) => object` gives every boxing call a concrete
// object type. `Object(symbol)` / `Object(bigint)` is the ONLY way to box those
// two families (`new Symbol` / `new BigInt` throw), so a typed boxer is required.
const boxPrimitive = /** @type {(primitive: unknown) => object} */ (
  /** @type {unknown} */ (Object)
);

// --- String family ---
export const primString = () => 'x';
export const emptyString = () => '';
export const boxedString = () => new String('x');
export const objectString = () => boxPrimitive('x');
export const stringSubclass = () => new (class extends String {})('x');

// --- Number family ---
export const primNumber = () => 42;
export const primNaN = () => NaN;
export const primInfinity = () => Infinity;
export const primNegInfinity = () => -Infinity;
export const primNegZero = () => -0;
export const boxedNumber = () => new Number(42);
export const objectNumber = () => boxPrimitive(42);
export const boxedNumberNaN = () => new Number(NaN);
export const numberSubclass = () => new (class extends Number {})(42);

// --- Boolean family ---
export const primTrue = () => true;
export const primFalse = () => false;
export const boxedBooleanTrue = () => new Boolean(true);
export const boxedBooleanFalse = () => new Boolean(false);
export const objectBoolean = () => boxPrimitive(true);
export const booleanSubclass = () => new (class extends Boolean {})(true);

// --- Symbol family ---
export const primSymbol = () => Symbol('x');
export const wellKnownSymbol = () => Symbol.iterator;
export const registeredSymbol = () => Symbol.for('species-js:primitive-test');
export const boxedSymbol = () => boxPrimitive(Symbol('x'));
export const boxedRegisteredSymbol = () =>
  boxPrimitive(Symbol.for('species-js:primitive-test'));

// --- BigInt family ---
export const primBigInt = () => 1n;
export const bigintFromCall = () => BigInt(1);
export const boxedBigInt = () => boxPrimitive(1n);

// --- Nullish + non-primitive rejections (cross-cutting) ---
export const nullValue = () => null;
export const undefinedValue = () => undefined;
export const plainObject = () => ({});
export const arrayValue = () => [];
export const arrowFunction = () => () => undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 per-family matrices — candidates × {isXValue, isBoxedX, isX}
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} FamilyRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {Record<string, boolean>} expected - outcome of the family's three predicates
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, FamilyRow>} */
export const stringMatrix = {
  primString: {
    description: "the primitive `'x'`",
    make: primString,
    expected: { isStringValue: T, isBoxedString: F, isString: T },
    vectors: ['isStringValue/A1', 'isBoxedString/R1', 'isString/A1'],
  },
  emptyString: {
    description: "the empty string `''`",
    make: emptyString,
    expected: { isStringValue: T, isBoxedString: F, isString: T },
    vectors: ['isStringValue/A-empty'],
  },
  boxedString: {
    description: "a `new String('x')`",
    make: boxedString,
    expected: { isStringValue: F, isBoxedString: T, isString: T },
    vectors: ['isStringValue/R1', 'isBoxedString/A1', 'isString/A2'],
  },
  objectString: {
    description: "an `Object('x')`",
    make: objectString,
    expected: { isStringValue: F, isBoxedString: T, isString: T },
    vectors: ['isBoxedString/A1'],
  },
  stringSubclass: {
    description: 'a `class extends String {}` instance',
    make: stringSubclass,
    expected: { isStringValue: F, isBoxedString: F, isString: F },
    vectors: ['isBoxedString/R-subclass'],
  },
};

/** @type {Record<string, FamilyRow>} */
export const numberMatrix = {
  primNumber: {
    description: 'the primitive `42`',
    make: primNumber,
    expected: { isNumberValue: T, isBoxedNumber: F, isNumber: T },
    vectors: ['isNumberValue/A1', 'isBoxedNumber/R1', 'isNumber/A1'],
  },
  primNaN: {
    description: '`NaN`',
    make: primNaN,
    expected: { isNumberValue: T, isBoxedNumber: F, isNumber: T },
    vectors: ['isNumberValue/A-special'],
  },
  primInfinity: {
    description: '`Infinity`',
    make: primInfinity,
    expected: { isNumberValue: T, isBoxedNumber: F, isNumber: T },
    vectors: ['isNumberValue/A-special'],
  },
  primNegInfinity: {
    description: '`-Infinity`',
    make: primNegInfinity,
    expected: { isNumberValue: T, isBoxedNumber: F, isNumber: T },
    vectors: ['isNumberValue/A-special'],
  },
  primNegZero: {
    description: '`-0`',
    make: primNegZero,
    expected: { isNumberValue: T, isBoxedNumber: F, isNumber: T },
    vectors: ['isNumberValue/A-special'],
  },
  boxedNumber: {
    description: 'a `new Number(42)`',
    make: boxedNumber,
    expected: { isNumberValue: F, isBoxedNumber: T, isNumber: T },
    vectors: ['isNumberValue/R1', 'isBoxedNumber/A1', 'isNumber/A2'],
  },
  objectNumber: {
    description: 'an `Object(42)`',
    make: objectNumber,
    expected: { isNumberValue: F, isBoxedNumber: T, isNumber: T },
    vectors: ['isBoxedNumber/A1'],
  },
  boxedNumberNaN: {
    description: 'a `new Number(NaN)`',
    make: boxedNumberNaN,
    expected: { isNumberValue: F, isBoxedNumber: T, isNumber: T },
    vectors: ['isBoxedNumber/A-NaN'],
  },
  numberSubclass: {
    description: 'a `class extends Number {}` instance',
    make: numberSubclass,
    expected: { isNumberValue: F, isBoxedNumber: F, isNumber: F },
    vectors: ['isBoxedNumber/R-subclass'],
  },
};

/** @type {Record<string, FamilyRow>} */
export const booleanMatrix = {
  primTrue: {
    description: 'the primitive `true`',
    make: primTrue,
    expected: { isBooleanValue: T, isBoxedBoolean: F, isBoolean: T },
    vectors: ['isBooleanValue/A1', 'isBoxedBoolean/R1', 'isBoolean/A1'],
  },
  primFalse: {
    description: 'the primitive `false`',
    make: primFalse,
    expected: { isBooleanValue: T, isBoxedBoolean: F, isBoolean: T },
    vectors: ['isBooleanValue/A1'],
  },
  boxedBooleanTrue: {
    description: 'a `new Boolean(true)`',
    make: boxedBooleanTrue,
    expected: { isBooleanValue: F, isBoxedBoolean: T, isBoolean: T },
    vectors: ['isBooleanValue/R1', 'isBoxedBoolean/A1', 'isBoolean/A2'],
  },
  boxedBooleanFalse: {
    description: 'a `new Boolean(false)`',
    make: boxedBooleanFalse,
    expected: { isBooleanValue: F, isBoxedBoolean: T, isBoolean: T },
    vectors: ['isBoxedBoolean/A-false'],
  },
  booleanSubclass: {
    description: 'a `class extends Boolean {}` instance',
    make: booleanSubclass,
    expected: { isBooleanValue: F, isBoxedBoolean: F, isBoolean: F },
    vectors: ['isBoxedBoolean/R-subclass'],
  },
};

/** @type {Record<string, FamilyRow>} */
export const symbolMatrix = {
  primSymbol: {
    description: "a `Symbol('x')`",
    make: primSymbol,
    expected: { isSymbolValue: T, isBoxedSymbol: F, isSymbol: T },
    vectors: ['isSymbolValue/A1', 'isBoxedSymbol/R1', 'isSymbol/A1'],
  },
  wellKnownSymbol: {
    description: 'the well-known `Symbol.iterator`',
    make: wellKnownSymbol,
    expected: { isSymbolValue: T, isBoxedSymbol: F, isSymbol: T },
    vectors: ['isSymbolValue/A-wellknown'],
  },
  registeredSymbol: {
    description: 'a registered `Symbol.for(...)`',
    make: registeredSymbol,
    expected: { isSymbolValue: T, isBoxedSymbol: F, isSymbol: T },
    vectors: ['isSymbolValue/A-wellknown'],
  },
  boxedSymbol: {
    description: "an `Object(Symbol('x'))`",
    make: boxedSymbol,
    expected: { isSymbolValue: F, isBoxedSymbol: T, isSymbol: T },
    vectors: ['isSymbolValue/R1', 'isBoxedSymbol/A1', 'isSymbol/A2'],
  },
  boxedRegisteredSymbol: {
    description: 'an `Object(Symbol.for(...))`',
    make: boxedRegisteredSymbol,
    expected: { isSymbolValue: F, isBoxedSymbol: T, isSymbol: T },
    vectors: ['isBoxedSymbol/A1'],
  },
};

/** @type {Record<string, FamilyRow>} */
export const bigintMatrix = {
  primBigInt: {
    description: 'the literal `1n`',
    make: primBigInt,
    expected: { isBigIntValue: T, isBoxedBigInt: F, isBigInt: T },
    vectors: ['isBigIntValue/A1', 'isBoxedBigInt/R1', 'isBigInt/A1'],
  },
  bigintFromCall: {
    description: 'a `BigInt(1)`',
    make: bigintFromCall,
    expected: { isBigIntValue: T, isBoxedBigInt: F, isBigInt: T },
    vectors: ['isBigIntValue/A1'],
  },
  boxedBigInt: {
    description: 'an `Object(1n)`',
    make: boxedBigInt,
    expected: { isBigIntValue: F, isBoxedBigInt: T, isBigInt: T },
    vectors: ['isBigIntValue/R1', 'isBoxedBigInt/A1', 'isBigInt/A2'],
  },
};

/** The five per-family matrices, keyed by family (for the spec.test.js loop). */
export const familyMatrices = {
  String: stringMatrix,
  Number: numberMatrix,
  Boolean: booleanMatrix,
  Symbol: symbolMatrix,
  BigInt: bigintMatrix,
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 floor matrix — candidates × the four floor predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} FloorRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isNullishPrimitive: boolean, isBoxablePrimitive: boolean, isPrimitiveValue: boolean, isBoxedPrimitive: boolean }} expected - outcome of the four floor predicates
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, FloorRow>} */
export const floorMatrix = {
  primString: {
    description: "the primitive `'x'`",
    make: primString,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: T,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isBoxablePrimitive/A1', 'isPrimitiveValue/A1'],
  },
  primNumber: {
    description: 'the primitive `42`',
    make: primNumber,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: T,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isBoxablePrimitive/A1', 'isPrimitiveValue/A1'],
  },
  primTrue: {
    description: 'the primitive `true`',
    make: primTrue,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: T,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isBoxablePrimitive/A1', 'isPrimitiveValue/A1'],
  },
  primSymbol: {
    description: "a `Symbol('y')`",
    make: primSymbol,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: T,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isBoxablePrimitive/A1', 'isPrimitiveValue/A1'],
  },
  primBigInt: {
    description: 'the literal `1n`',
    make: primBigInt,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: T,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isBoxablePrimitive/A1', 'isPrimitiveValue/A1'],
  },
  nullValue: {
    description: '`null`',
    make: nullValue,
    expected: {
      isNullishPrimitive: T,
      isBoxablePrimitive: F,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isNullishPrimitive/A1', 'isBoxablePrimitive/R1', 'isPrimitiveValue/A1'],
  },
  undefinedValue: {
    description: '`undefined`',
    make: undefinedValue,
    expected: {
      isNullishPrimitive: T,
      isBoxablePrimitive: F,
      isPrimitiveValue: T,
      isBoxedPrimitive: F,
    },
    vectors: ['isNullishPrimitive/A1', 'isBoxablePrimitive/R1', 'isPrimitiveValue/A1'],
  },
  boxedString: {
    description: "a `new String('x')`",
    make: boxedString,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: T,
    },
    vectors: ['isBoxablePrimitive/R2', 'isPrimitiveValue/R1', 'isBoxedPrimitive/A1'],
  },
  boxedNumber: {
    description: 'a `new Number(42)`',
    make: boxedNumber,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: T,
    },
    vectors: ['isBoxedPrimitive/A1'],
  },
  boxedNumberNaN: {
    description: 'a `new Number(NaN)`',
    make: boxedNumberNaN,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: T,
    },
    vectors: ['isBoxedPrimitive/A-NaN'],
  },
  boxedBooleanFalse: {
    description: 'a `new Boolean(false)`',
    make: boxedBooleanFalse,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: T,
    },
    vectors: ['isBoxedPrimitive/A1'],
  },
  boxedSymbol: {
    description: "an `Object(Symbol('y'))`",
    make: boxedSymbol,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: T,
    },
    vectors: ['isBoxedPrimitive/A1'],
  },
  boxedBigInt: {
    description: 'an `Object(1n)`',
    make: boxedBigInt,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: T,
    },
    vectors: ['isBoxedPrimitive/A1'],
  },
  plainObject: {
    description: 'a plain `{}`',
    make: plainObject,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: F,
    },
    vectors: [
      'isBoxablePrimitive/R1',
      'isPrimitiveValue/R1',
      'isBoxedPrimitive/R3',
      'isNullishPrimitive/R1',
    ],
  },
  arrowFunction: {
    description: 'an arrow function',
    make: arrowFunction,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: F,
    },
    vectors: ['isBoxablePrimitive/R1', 'isPrimitiveValue/R1', 'isBoxedPrimitive/R3'],
  },
  arrayValue: {
    description: 'an array `[]`',
    make: arrayValue,
    expected: {
      isNullishPrimitive: F,
      isBoxablePrimitive: F,
      isPrimitiveValue: F,
      isBoxedPrimitive: F,
    },
    vectors: ['isPrimitiveValue/R1', 'isBoxedPrimitive/R3'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 Number static-method matrix — numeric candidates × the three guards
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} NumberStaticRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isFiniteNumberValue: boolean, isIntegerValue: boolean, isSafeIntegerValue: boolean }} expected - outcome of the three Number static guards
 * @property {string[]} vectors - spec vector IDs this row covers
 */

const maxSafeInteger = () => Number.MAX_SAFE_INTEGER;
const maxSafeIntegerPlusOne = () => 2 ** 53;
const pi = () => 3.14;
const numericString = () => '42';

/** @type {Record<string, NumberStaticRow>} */
export const numberStaticMatrix = {
  zero: {
    description: '`0`',
    make: () => 0,
    expected: { isFiniteNumberValue: T, isIntegerValue: T, isSafeIntegerValue: T },
    vectors: ['isFiniteNumberValue/A1', 'isIntegerValue/A1', 'isSafeIntegerValue/A1'],
  },
  negZero: {
    description: '`-0`',
    make: primNegZero,
    expected: { isFiniteNumberValue: T, isIntegerValue: T, isSafeIntegerValue: T },
    vectors: ['isFiniteNumberValue/A1', 'isIntegerValue/A1', 'isSafeIntegerValue/A1'],
  },
  fortyTwo: {
    description: '`42`',
    make: primNumber,
    expected: { isFiniteNumberValue: T, isIntegerValue: T, isSafeIntegerValue: T },
    vectors: ['isFiniteNumberValue/A1', 'isIntegerValue/A1', 'isSafeIntegerValue/A1'],
  },
  negSeven: {
    description: '`-7`',
    make: () => -7,
    expected: { isFiniteNumberValue: T, isIntegerValue: T, isSafeIntegerValue: T },
    vectors: ['isIntegerValue/A1', 'isSafeIntegerValue/A1'],
  },
  pi: {
    description: '`3.14`',
    make: pi,
    expected: { isFiniteNumberValue: T, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/A1', 'isIntegerValue/R1', 'isSafeIntegerValue/R2'],
  },
  maxSafeInteger: {
    description: '`Number.MAX_SAFE_INTEGER` (2^53 - 1)',
    make: maxSafeInteger,
    expected: { isFiniteNumberValue: T, isIntegerValue: T, isSafeIntegerValue: T },
    vectors: ['isSafeIntegerValue/A1', 'isSafeIntegerValue/B1'],
  },
  maxSafeIntegerPlusOne: {
    description: '`2 ** 53` (MAX_SAFE_INTEGER + 1) — an integer outside the safe range',
    make: maxSafeIntegerPlusOne,
    expected: { isFiniteNumberValue: T, isIntegerValue: T, isSafeIntegerValue: F },
    vectors: ['isIntegerValue/A1', 'isSafeIntegerValue/B1', 'isSafeIntegerValue/R1'],
  },
  nan: {
    description: '`NaN`',
    make: primNaN,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R1', 'isIntegerValue/R2', 'isSafeIntegerValue/R2'],
  },
  infinity: {
    description: '`Infinity`',
    make: primInfinity,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R1', 'isIntegerValue/R2', 'isSafeIntegerValue/R2'],
  },
  negInfinity: {
    description: '`-Infinity`',
    make: primNegInfinity,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R1'],
  },
  numericString: {
    description: "the numeric string `'42'` (the coercion trap)",
    make: numericString,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R2', 'isIntegerValue/R3', 'isSafeIntegerValue/R2'],
  },
  boxedNumber: {
    description: 'a `new Number(42)` (boxed, rejected)',
    make: boxedNumber,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R3'],
  },
  nullValue: {
    description: '`null`',
    make: nullValue,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R3'],
  },
  bigintOne: {
    description: '`1n` (bigint, not number)',
    make: primBigInt,
    expected: { isFiniteNumberValue: F, isIntegerValue: F, isSafeIntegerValue: F },
    vectors: ['isFiniteNumberValue/R3'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 registered-symbol matrix — candidates × isRegisteredSymbol
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} RegisteredSymbolRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isRegisteredSymbol: boolean }} expected - outcome of isRegisteredSymbol
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, RegisteredSymbolRow>} */
export const registeredSymbolMatrix = {
  registeredSymbol: {
    description: 'a `Symbol.for(...)` (registered)',
    make: registeredSymbol,
    expected: { isRegisteredSymbol: T },
    vectors: ['isRegisteredSymbol/A1'],
  },
  primSymbol: {
    description: "a `Symbol('x')` (unregistered)",
    make: primSymbol,
    expected: { isRegisteredSymbol: F },
    vectors: ['isRegisteredSymbol/R1'],
  },
  wellKnownSymbol: {
    description: 'a well-known symbol (`Symbol.iterator`)',
    make: wellKnownSymbol,
    expected: { isRegisteredSymbol: F },
    vectors: ['isRegisteredSymbol/R2'],
  },
  boxedRegisteredSymbol: {
    description: 'an `Object(Symbol.for(...))` (boxed registered)',
    make: boxedRegisteredSymbol,
    expected: { isRegisteredSymbol: F },
    vectors: ['isRegisteredSymbol/R3'],
  },
  nonSymbolString: {
    description: "a non-symbol `'x'`",
    make: primString,
    expected: { isRegisteredSymbol: F },
    vectors: ['isRegisteredSymbol/R4'],
  },
  nonSymbolNull: {
    description: '`null`',
    make: nullValue,
    expected: { isRegisteredSymbol: F },
    vectors: ['isRegisteredSymbol/R4'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Cross-cutting rejection inputs (CC/nullish, CC/cross-family)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// The five families' representative value + boxed candidates, keyed by family —
// spec.test.js sweeps each against every OTHER family's three predicates (all
// → false), covering CC/cross-family + the isXValue/R2 and isX/R1 vectors.
export const familyRepresentatives = {
  String: [primString, boxedString],
  Number: [primNumber, boxedNumber],
  Boolean: [primTrue, boxedBooleanTrue],
  Symbol: [primSymbol, boxedSymbol],
  BigInt: [primBigInt, boxedBigInt],
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Foreign-realm factories (targeted by cross-realm.test.js)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// String / Number / Boolean / Symbol / BigInt are ECMAScript intrinsics, so a
// REAL foreign boxed primitive is constructible in the vm realm — the structural
// (alien) arm is designed to admit them. Foreign primitives carry no realm
// identity, so the value predicates answer identically (realm-agnostic).

export const foreignBoxedString = () => foreignRealmEval('new String("x")');
export const foreignBoxedNumber = () => foreignRealmEval('new Number(42)');
export const foreignBoxedBoolean = () => foreignRealmEval('new Boolean(true)');
export const foreignBoxedSymbol = () => foreignRealmEval('Object(Symbol("x"))');
export const foreignBoxedBigInt = () => foreignRealmEval('Object(1n)');

export const foreignPrimString = () => foreignRealmEval('"x"');
export const foreignPrimNumber = () => foreignRealmEval('(42)');

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Adversarial factories (targeted by adversarial.test.js — NON-throwing)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// tag-spoof: `Symbol.toStringTag` claims the wrapper tag, but the constructor
// walk reaches `Object` and the slot probe throws (no `[[XData]]`). R-tagspoof.
export const tagSpoofString = () => ({ [Symbol.toStringTag]: 'String' });
export const tagSpoofNumber = () => ({ [Symbol.toStringTag]: 'Number' });
export const tagSpoofBoolean = () => ({ [Symbol.toStringTag]: 'Boolean' });
export const tagSpoofSymbol = () => ({ [Symbol.toStringTag]: 'Symbol' });
export const tagSpoofBigInt = () => ({ [Symbol.toStringTag]: 'BigInt' });

// proto-graft: real `X.prototype` (so proto-identity holds for the ES3 families,
// and the inherited `Symbol.toStringTag` tags the Symbol/BigInt grafts), but no
// `[[XData]]` slot — the slot probe rejects it. R-protograft. This is the seal
// the thenable module's `isPromise` cannot have (decision #052).
export const protoGraftString = () => objectCreate(String.prototype);
export const protoGraftNumber = () => objectCreate(Number.prototype);
export const protoGraftBoolean = () => objectCreate(Boolean.prototype);
export const protoGraftSymbol = () => objectCreate(Symbol.prototype);
export const protoGraftBigInt = () => objectCreate(BigInt.prototype);

// ctor-name-spoof: a userland `class String {}` — the instance tag is
// `'[object Object]'`, so the tag check fails before the ctor-name even matters.
// (the `tag()` member is only there to keep the class non-extraneous for lint.)
export const ctorNameSpoofString = () =>
  /** @type {object} */ (
    new (class String {
      tag() {
        return 'x';
      }
    })()
  );

// description-shadow: a REAL boxed Symbol whose `description` own-data property
// shadows the inherited getter — survives the slot probe, caught by the
// description cross-check. isBoxedSymbol/R-descshadow.
export const descriptionShadowedBoxedSymbol = () => {
  const boxed = boxPrimitive(Symbol('x'));
  Object.defineProperty(boxed, 'description', { value: 'tampered', configurable: true });
  return boxed;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Throw-safety matrix (hostile-input-class × predicate — the THROWING surface)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// primitive's re-derived hostile set. Only the BOXED predicates have a read
// surface (the value / floor-typeof / Number-static predicates are pure `typeof`
// / arithmetic and cannot throw); the boxed predicates read through the
// throw-safe `instanceof` wrap (isCurrentRealmNative*Instance), the realm-fixed
// tag read (getTypeSignature), the constructor walk (getDefinedConstructorName),
// and the captured-valueOf slot probe. Three reachable throw classes:
//   - prototype-trap  → the `instanceof` wrap + `getPrototypeOf`
//   - tag-getter-throw → getTypeSignature's `toObjectString.call` try/catch
//   - descriptor-trap  → the constructor walk's inert descriptor read
// Every hostile input is a non-primitive object, so EVERY public predicate
// answers `false` (never throws) — the completeness set is the full public
// surface.

/**
 * @typedef {object} ThrowSafetyRow
 * @property {string} surface - the throw-surface class this row exercises
 * @property {() => unknown} make - fresh hostile-value factory
 */

/** @type {Record<string, ThrowSafetyRow>} */
export const throwSafetyMatrix = {
  prototypeTrap: {
    surface: 'prototype-trap: a Proxy whose `getPrototypeOf` throws',
    make: () =>
      new Proxy(
        {},
        {
          getPrototypeOf() {
            throw new Error('proto-trap');
          },
        },
      ),
  },
  tagGetterThrow: {
    surface: 'tag-getter-throw: an object whose `Symbol.toStringTag` getter throws',
    make: () =>
      objectCreate(Object.prototype, {
        [Symbol.toStringTag]: {
          get() {
            throw new Error('tag-trap');
          },
          configurable: true,
        },
      }),
  },
  descriptorTrap: {
    surface:
      'descriptor-trap: a value over a `[[Prototype]]` whose `getOwnPropertyDescriptor` throws',
    make: () =>
      objectCreate(
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error('desc-trap');
            },
          },
        ),
      ),
  },
};

// The all-`false` expectation shared by every throw-safety row: no hostile input
// is a primitive or a boxed primitive, so every public predicate rejects it.
/** @type {Record<string, boolean>} */
export const throwSafetyExpected = PUBLIC_PREDICATE_NAMES.reduce(
  (acc, name) => ({ ...acc, [name]: false }),
  {},
);
