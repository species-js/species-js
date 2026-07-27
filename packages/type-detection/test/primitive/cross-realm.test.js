// @ts-check

/**
 * @module test/primitive/cross-realm
 *
 * Axis 2 — cross-realm. A foreign-realm boxed primitive has the SAME structural
 * shape as a local one but a DIFFERENT intrinsic identity, so the local-realm
 * `instanceof` fast-path (and the ES3 native hot-path) misses and the alien-realm
 * structural arm must carry the verdict. `String` / `Number` / `Boolean` /
 * `Symbol` / `BigInt` are ALL ECMAScript intrinsics, so a REAL foreign boxed
 * primitive of every family is constructible in the vm realm.
 *
 * The value predicates (`isXValue`) are realm-agnostic by construction — `typeof`
 * reads identically in every realm — so a foreign primitive is admitted exactly
 * like a local one, with no fixture asymmetry.
 *
 * Mirrors the "Cross-realm expectation (axis 2)" sections of
 * `docs/spec/PRIMITIVE.spec.md` (`isBoxedX/A-crossrealm`,
 * `isBoxedPrimitive/A-crossrealm`, `rVAlien/A-crossrealm`).
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
  isBoxedPrimitive,
  resolvedViaES3NativePrimitiveTypesHotPaths,
  resolvedViaAlienRealmPrimitiveTypesEvaluation,
} from '#index';

import {
  foreignBoxedString,
  foreignBoxedNumber,
  foreignBoxedBoolean,
  foreignBoxedSymbol,
  foreignBoxedBigInt,
  foreignPrimString,
  foreignPrimNumber,
} from './__config.js';

/**
 * @typedef {object} ForeignBoxedCase
 * @property {string} family - the family name
 * @property {() => unknown} make - foreign boxed-value factory
 * @property {(value?: unknown) => boolean} isValue - the family's value predicate
 * @property {(value?: unknown) => boolean} isBoxed - the family's boxed predicate
 * @property {(value?: unknown) => boolean} isComposite - the family's composite predicate
 */

/** @type {ForeignBoxedCase[]} */
const foreignBoxedCases = [
  {
    family: 'String',
    make: foreignBoxedString,
    isValue: isStringValue,
    isBoxed: isBoxedString,
    isComposite: isString,
  },
  {
    family: 'Number',
    make: foreignBoxedNumber,
    isValue: isNumberValue,
    isBoxed: isBoxedNumber,
    isComposite: isNumber,
  },
  {
    family: 'Boolean',
    make: foreignBoxedBoolean,
    isValue: isBooleanValue,
    isBoxed: isBoxedBoolean,
    isComposite: isBoolean,
  },
  {
    family: 'Symbol',
    make: foreignBoxedSymbol,
    isValue: isSymbolValue,
    isBoxed: isBoxedSymbol,
    isComposite: isSymbol,
  },
  {
    family: 'BigInt',
    make: foreignBoxedBigInt,
    isValue: isBigIntValue,
    isBoxed: isBoxedBigInt,
    isComposite: isBigInt,
  },
];

const allBoxedPredicates = [
  isBoxedString,
  isBoxedNumber,
  isBoxedBoolean,
  isBoxedSymbol,
  isBoxedBigInt,
];

describe('primitive — cross-realm (axis 2)', () => {
  for (const { family, make, isValue, isBoxed, isComposite } of foreignBoxedCases) {
    describe(`foreign boxed ${family}`, () => {
      it(`isBoxedX/A-crossrealm (${family}): admitted via the alien structural arm`, () => {
        expect(isBoxed(make())).toBe(true);
      });

      it('the value predicate rejects it (typeof object); the composite admits it', () => {
        expect(isValue(make()), 'isXValue').toBe(false);
        expect(isComposite(make()), 'isX').toBe(true);
      });

      it('isBoxedPrimitive/A-crossrealm: admitted by the umbrella', () => {
        expect(isBoxedPrimitive(make())).toBe(true);
      });

      it('rejected by the other four families’ boxed predicates', () => {
        for (const otherBoxed of allBoxedPredicates) {
          if (otherBoxed === isBoxed) {
            continue;
          }
          expect(otherBoxed(make())).toBe(false);
        }
      });

      it('rVAlien/A-crossrealm: the ALIEN arm carries it — the ES3 native hot-path misses', () => {
        const foreign = /** @type {object} */ (make());
        expect(
          resolvedViaES3NativePrimitiveTypesHotPaths(foreign),
          'ES3 native hot-path (local instanceof) misses the foreign value',
        ).toBe(false);
        expect(
          resolvedViaAlienRealmPrimitiveTypesEvaluation(foreign),
          'alien structural arm carries the verdict',
        ).toBe(true);
      });
    });
  }

  describe('value predicates are realm-agnostic (foreign primitive === local)', () => {
    it('a foreign primitive string is admitted exactly like a local one', () => {
      const foreign = foreignPrimString();
      expect(isStringValue(foreign), 'isStringValue').toBe(true);
      expect(isString(foreign), 'isString').toBe(true);
      expect(isBoxedString(foreign), 'isBoxedString (still a primitive)').toBe(false);
    });

    it('a foreign primitive number is admitted exactly like a local one', () => {
      const foreign = foreignPrimNumber();
      expect(isNumberValue(foreign), 'isNumberValue').toBe(true);
      expect(isNumber(foreign), 'isNumber').toBe(true);
      expect(isBoxedNumber(foreign), 'isBoxedNumber (still a primitive)').toBe(false);
    });
  });
});
