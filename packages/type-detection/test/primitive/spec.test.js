// @ts-check

/**
 * @module test/primitive/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the family matrices
 * ({@link stringMatrix} … {@link bigintMatrix}), the {@link floorMatrix}, the
 * {@link numberStaticMatrix}, and the {@link registeredSymbolMatrix} from
 * `__config.js`: every clean candidate scored against its predicate set, each
 * matrix guarded by a completeness check so no predicate column can silently go
 * missing. Then the cross-family rejection sweep (each family's representatives
 * against every OTHER family's three predicates → false) and the cross-cutting
 * nullish / omitted-argument invariants. If a test here fails, the implementation
 * is wrong, not the test.
 *
 * Spoofs / grafts / subclasses live in `adversarial.test.js`; foreign-realm in
 * `cross-realm.test.js`; the hostile-input throw-safety matrix in
 * `throw-safety.test.js`; the `@internal` helpers in `_internal/helpers.test.js`.
 *
 * Mirrors `docs/spec/PRIMITIVE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isStringValue,
  isBoxedString,
  isString,
  isNumberValue,
  isBoxedNumber,
  isNumber,
  isBooleanValue,
  isBoxedBoolean,
  isBoolean,
  isSymbolValue,
  isBoxedSymbol,
  isSymbol,
  isBigIntValue,
  isBoxedBigInt,
  isBigInt,
  isNullishPrimitive,
  isBoxablePrimitive,
  isPrimitiveValue,
  isBoxedPrimitive,
  isFiniteNumberValue,
  isIntegerValue,
  isSafeIntegerValue,
  isRegisteredSymbol,
} from '#index';

import {
  familyMatrices,
  floorMatrix,
  numberStaticMatrix,
  registeredSymbolMatrix,
  familyRepresentatives,
  FAMILY_PREDICATES,
  FLOOR_PREDICATES,
  NUMBER_STATIC_PREDICATES,
  PUBLIC_PREDICATE_NAMES,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isStringValue,
  isBoxedString,
  isString,
  isNumberValue,
  isBoxedNumber,
  isNumber,
  isBooleanValue,
  isBoxedBoolean,
  isBoolean,
  isSymbolValue,
  isBoxedSymbol,
  isSymbol,
  isBigIntValue,
  isBoxedBigInt,
  isBigInt,
  isNullishPrimitive,
  isBoxablePrimitive,
  isPrimitiveValue,
  isBoxedPrimitive,
  isFiniteNumberValue,
  isIntegerValue,
  isSafeIntegerValue,
  isRegisteredSymbol,
};

/**
 * Look up a predicate by name, failing loudly (never vacuously) if absent.
 * @param {string} name - the predicate name
 * @returns {(value?: unknown) => boolean} the predicate function
 */
function predicateByName(name) {
  const predicate = predicates[name];
  if (!predicate) {
    throw new Error(`no predicate "${name}"`);
  }
  return predicate;
}

/**
 * Drive one matrix: a completeness guard (every row scores exactly `names`) plus
 * a per-cell assertion for every row.
 * @param {Record<string, { description: string, make: () => unknown, expected: Record<string, boolean>, vectors: string[] }>} matrix - the matrix to drive
 * @param {string[]} names - the predicate-name set every row must score
 * @returns {void}
 */
function driveMatrix(matrix, names) {
  const sortedNames = [...names].sort();

  it('completeness: every matrix row scores every predicate', () => {
    for (const [key, row] of Object.entries(matrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(sortedNames);
    }
  });

  for (const [key, { description, make, expected, vectors }] of Object.entries(matrix)) {
    describe(`${key} — ${description}`, () => {
      for (const [predName, want] of Object.entries(expected)) {
        it(`${predName} → ${String(want)}  [${vectors.join(', ')}]`, () => {
          expect(predicateByName(predName)(make())).toBe(want);
        });
      }
    });
  }
}

describe('primitive — spec/contract matrices', () => {
  const families = /** @type {Array<keyof typeof familyMatrices>} */ (
    Object.keys(familyMatrices)
  );
  for (const family of families) {
    const matrix = familyMatrices[family];
    const names = FAMILY_PREDICATES[family];
    describe(`${family} family — {isXValue, isBoxedX, isX}`, () => {
      driveMatrix(matrix, names);
    });
  }

  describe('floor predicates — {isNullishPrimitive, isBoxablePrimitive, isPrimitiveValue, isBoxedPrimitive}', () => {
    driveMatrix(floorMatrix, FLOOR_PREDICATES);
  });

  describe('Number static-method guards — {isFiniteNumberValue, isIntegerValue, isSafeIntegerValue}', () => {
    driveMatrix(numberStaticMatrix, NUMBER_STATIC_PREDICATES);
  });

  describe('registered-symbol — {isRegisteredSymbol}', () => {
    driveMatrix(registeredSymbolMatrix, ['isRegisteredSymbol']);
  });

  // CC/cross-family — each family's primitive + boxed representative is rejected
  // by every OTHER family's three predicates (isXValue/R2, isX/R1).
  describe('CC/cross-family — a family value/boxed is rejected by every other family', () => {
    for (const [family, factories] of Object.entries(familyRepresentatives)) {
      it(`${family} representatives rejected by the other four families`, () => {
        for (const make of factories) {
          for (const [otherFamily, names] of Object.entries(FAMILY_PREDICATES)) {
            if (otherFamily === family) {
              continue;
            }
            for (const name of names) {
              expect(predicateByName(name)(make()), `${name}(${family})`).toBe(false);
            }
          }
        }
      });
    }
  });

  // CC/non-primitive-object — a plain object / array / function is rejected by
  // every family's boxed and composite predicate (isBoxedX/R3, isX/R2).
  describe('CC/non-primitive-object — isBoxedX/R3, isX/R2', () => {
    it('a plain {}, an array, and a function are rejected by every family boxed + composite predicate', () => {
      const nonPrimitives = [{}, [], () => undefined];
      for (const input of nonPrimitives) {
        for (const names of Object.values(FAMILY_PREDICATES)) {
          // names = [isXValue, isBoxedX, isX]; sweep the boxed + composite arms.
          for (const name of names.slice(1)) {
            expect(predicateByName(name)(input), name).toBe(false);
          }
        }
      }
    });
  });

  // CC/nullish — a provided null / undefined is rejected by every predicate EXCEPT
  // isNullishPrimitive and isPrimitiveValue (isXValue/R3, isBoxedX/R2). An OMITTED call is
  // rejected by every predicate WITHOUT exception — those two distinguish "no value supplied"
  // from an explicit `undefined` and answer false (#079; isNullishPrimitive/B1, isPrimitiveValue/B1).
  describe('CC/nullish', () => {
    const nullishAdmitters = ['isNullishPrimitive', 'isPrimitiveValue'];
    const nullishRejectors = PUBLIC_PREDICATE_NAMES.filter(
      (name) => !nullishAdmitters.includes(name),
    );

    it('null / undefined rejected by every predicate except isNullishPrimitive + isPrimitiveValue', () => {
      for (const input of [null, undefined]) {
        for (const name of nullishRejectors) {
          expect(predicateByName(name)(input), `${name}(${String(input)})`).toBe(false);
        }
        expect(isNullishPrimitive(input), 'isNullishPrimitive').toBe(true);
        expect(isPrimitiveValue(input), 'isPrimitiveValue').toBe(true);
      }
    });

    it('omitted argument → rejected by every predicate, including isNullishPrimitive + isPrimitiveValue (#079: /B1)', () => {
      // an omitted call supplies no value to classify — the two accept-`undefined`
      // predicates arity-gate it to false, distinct from an explicit `undefined`.
      for (const name of PUBLIC_PREDICATE_NAMES) {
        expect(predicateByName(name)(), `${name}()`).toBe(false);
      }
    });
  });
});
