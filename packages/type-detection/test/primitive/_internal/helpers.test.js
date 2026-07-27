// @ts-check

/**
 * @module test/primitive/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The 14 exported `@internal` helpers, tested
 * in isolation: the 5 unboxed-value equality slot-probes, the 3 constructor-aware
 * realm discriminators, the 2 boxed-primitive resolution paths, the
 * symbol-registry probe, and the 3 Number static-method polyfills. Exported
 * `@internal` for exactly this — single-realm testability (decision #053): the
 * alien-realm resolver's markers are realm-independent, so its cross-realm code
 * path is exercised with LOCAL boxed values here (the foreign-realm confirmation
 * lives in `cross-realm.test.js`).
 *
 * Mirrors the "Helper specification (axis 4)" sections of
 * `docs/spec/PRIMITIVE.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  doesHaveStrictUnboxedStringValueEquality,
  doesHaveStrictUnboxedNumberValueEquality,
  doesHaveStrictUnboxedBooleanValueEquality,
  doesHaveStrictUnboxedSymbolValueEquality,
  doesHaveStrictUnboxedBigIntValueEquality,
  isCurrentRealmNativeStringInstance,
  isCurrentRealmNativeNumberInstance,
  isCurrentRealmNativeBooleanInstance,
  resolvedViaES3NativePrimitiveTypesHotPaths,
  resolvedViaAlienRealmPrimitiveTypesEvaluation,
  unguardedIsUnregisteredSymbol,
  isFiniteNumber,
  isInteger,
  isSafeInteger,
} from '#index';

import {
  boxedString,
  boxedNumber,
  boxedNumberNaN,
  boxedBooleanTrue,
  boxedBooleanFalse,
  boxedSymbol,
  boxedBigInt,
  stringSubclass,
  numberSubclass,
  booleanSubclass,
  descriptionShadowedBoxedSymbol,
  protoGraftString,
  protoGraftNumber,
  protoGraftBoolean,
  tagSpoofString,
  plainObject,
} from '../__config.js';

describe('[Internal] primitive helpers (axis 4)', () => {
  // ----- the five unboxed-value equality slot-probes -----
  // Each admits BOTH the boxed X (via the `[[XData]]` slot) AND the same-family
  // PRIMITIVE (the captured `X.prototype.valueOf` returns the primitive receiver
  // unchanged), and throws → `false` for anything else. In `isBoxedX` the upstream
  // `isObject` gate is what excludes the primitive — not the helper.
  describe('equality slot-probes — doesHaveStrictUnboxedXValueEquality', () => {
    /**
     * @typedef {object} EqualityCase
     * @property {string} family - the family name
     * @property {(value: unknown) => boolean} helper - the equality probe
     * @property {() => unknown} boxed - a genuine boxed X
     * @property {unknown} primitive - the same-family primitive
     * @property {unknown} foreign - a primitive of a DIFFERENT family (rejected)
     */

    /** @type {EqualityCase[]} */
    const cases = [
      {
        family: 'String',
        helper: doesHaveStrictUnboxedStringValueEquality,
        boxed: boxedString,
        primitive: 'x',
        foreign: 42,
      },
      {
        family: 'Number',
        helper: doesHaveStrictUnboxedNumberValueEquality,
        boxed: boxedNumber,
        primitive: 42,
        foreign: 'x',
      },
      {
        family: 'Boolean',
        helper: doesHaveStrictUnboxedBooleanValueEquality,
        boxed: boxedBooleanTrue,
        primitive: true,
        foreign: 42,
      },
      {
        family: 'Symbol',
        helper: doesHaveStrictUnboxedSymbolValueEquality,
        boxed: boxedSymbol,
        primitive: Symbol('x'),
        foreign: 42,
      },
      {
        family: 'BigInt',
        helper: doesHaveStrictUnboxedBigIntValueEquality,
        boxed: boxedBigInt,
        primitive: 1n,
        foreign: 42,
      },
    ];

    for (const { family, helper, boxed, primitive, foreign } of cases) {
      describe(family, () => {
        it('dHSUXVE/A1: a genuine boxed X → true', () => {
          expect(helper(boxed())).toBe(true);
        });
        it('dHSUXVE/A2: the same-family primitive → true (valueOf returns the receiver)', () => {
          expect(helper(primitive)).toBe(true);
        });
        it('dHSUXVE/R1: a plain object and a different-family primitive → false (valueOf throws)', () => {
          expect(helper(plainObject()), 'plain object').toBe(false);
          expect(helper(foreign), 'foreign-family primitive').toBe(false);
        });
      });
    }

    it('dHSUNumberVE/A-NaN: new Number(NaN) and NaN → true (Object.is)', () => {
      expect(doesHaveStrictUnboxedNumberValueEquality(boxedNumberNaN()), 'boxed').toBe(
        true,
      );
      expect(doesHaveStrictUnboxedNumberValueEquality(NaN), 'primitive').toBe(true);
    });

    it('dHSUBooleanVE/A-false: new Boolean(false) and false → true (stringified compare)', () => {
      expect(
        doesHaveStrictUnboxedBooleanValueEquality(boxedBooleanFalse()),
        'boxed',
      ).toBe(true);
      expect(doesHaveStrictUnboxedBooleanValueEquality(false), 'primitive').toBe(true);
    });

    it('dHSUSymbolVE/R-descshadow: a description-shadowed boxed Symbol → false; a no-description Symbol() → true', () => {
      expect(
        doesHaveStrictUnboxedSymbolValueEquality(descriptionShadowedBoxedSymbol()),
        'shadowed',
      ).toBe(false);
      expect(
        doesHaveStrictUnboxedSymbolValueEquality(Symbol()),
        'undefined === undefined',
      ).toBe(true);
    });
  });

  // ----- the three constructor-aware realm discriminators -----
  // `instanceof X && getPrototypeOf === X.prototype` — subclass-rejecting; does
  // NOT seal the slot (the graft passes, the downstream probe rejects it).
  describe('realm discriminators — isCurrentRealmNativeXInstance', () => {
    /**
     * @typedef {object} RealmNativeCase
     * @property {string} family - the family name
     * @property {(value: object) => boolean} helper - the discriminator
     * @property {() => object} instance - a direct instance of the family
     * @property {() => object} otherInstance - a direct instance of a different family
     * @property {() => object} subclass - a subclass instance
     * @property {() => object} graft - `Object.create(X.prototype)`
     */

    /** @type {RealmNativeCase[]} */
    const cases = [
      {
        family: 'String',
        helper: isCurrentRealmNativeStringInstance,
        instance: () => new String('x'),
        otherInstance: () => new Number(1),
        subclass: () => stringSubclass(),
        graft: () => protoGraftString(),
      },
      {
        family: 'Number',
        helper: isCurrentRealmNativeNumberInstance,
        instance: () => new Number(42),
        otherInstance: () => new String('x'),
        subclass: () => numberSubclass(),
        graft: () => protoGraftNumber(),
      },
      {
        family: 'Boolean',
        helper: isCurrentRealmNativeBooleanInstance,
        instance: () => new Boolean(true),
        otherInstance: () => new Number(1),
        subclass: () => booleanSubclass(),
        graft: () => protoGraftBoolean(),
      },
    ];

    for (const { family, helper, instance, otherInstance, subclass, graft } of cases) {
      describe(family, () => {
        it('iCRNX/A1: a direct instance → true', () => {
          expect(helper(instance())).toBe(true);
        });
        it('iCRNX/R1: a different-family instance → false', () => {
          expect(helper(otherInstance())).toBe(false);
        });
        it('iCRNX/R2: a subclass instance → false (proto-identity)', () => {
          expect(helper(subclass())).toBe(false);
        });
        it('iCRNX/R3: a plain {} → false', () => {
          expect(helper(plainObject())).toBe(false);
        });
        it('iCRNX/B1: Object.create(X.prototype) → true (proto-identity holds; the slot-probe is what rejects the graft)', () => {
          expect(helper(graft())).toBe(true);
        });
      });
    }
  });

  // ----- the ES3 native hot-path resolver -----
  describe('resolvedViaES3NativePrimitiveTypesHotPaths', () => {
    it('rVE3/A1: local boxed String / Number / Boolean (incl. new Number(NaN)) → true', () => {
      expect(resolvedViaES3NativePrimitiveTypesHotPaths(new String('x')), 'String').toBe(
        true,
      );
      expect(resolvedViaES3NativePrimitiveTypesHotPaths(new Number(42)), 'Number').toBe(
        true,
      );
      expect(
        resolvedViaES3NativePrimitiveTypesHotPaths(new Boolean(true)),
        'Boolean',
      ).toBe(true);
      expect(resolvedViaES3NativePrimitiveTypesHotPaths(boxedNumberNaN()), 'NaN').toBe(
        true,
      );
    });

    it('rVE3/R1: boxed Symbol / BigInt → false (factory carve-out, not on the ES3 path)', () => {
      expect(resolvedViaES3NativePrimitiveTypesHotPaths(boxedSymbol()), 'Symbol').toBe(
        false,
      );
      expect(resolvedViaES3NativePrimitiveTypesHotPaths(boxedBigInt()), 'BigInt').toBe(
        false,
      );
    });

    it('rVE3/R2: a plain {} and a proto-graft → false (the slot-probe rejects the graft)', () => {
      expect(resolvedViaES3NativePrimitiveTypesHotPaths(plainObject()), '{}').toBe(false);
      expect(
        resolvedViaES3NativePrimitiveTypesHotPaths(protoGraftString()),
        'graft',
      ).toBe(false);
    });
  });

  // ----- the alien-realm structural resolver (single-realm cross-realm coverage) -----
  describe('resolvedViaAlienRealmPrimitiveTypesEvaluation', () => {
    it('rVAlien/A1: all five families resolve structurally with LOCAL values', () => {
      expect(
        resolvedViaAlienRealmPrimitiveTypesEvaluation(new String('x')),
        'String',
      ).toBe(true);
      expect(
        resolvedViaAlienRealmPrimitiveTypesEvaluation(new Number(42)),
        'Number',
      ).toBe(true);
      expect(
        resolvedViaAlienRealmPrimitiveTypesEvaluation(new Boolean(true)),
        'Boolean',
      ).toBe(true);
      expect(resolvedViaAlienRealmPrimitiveTypesEvaluation(boxedSymbol()), 'Symbol').toBe(
        true,
      );
      expect(resolvedViaAlienRealmPrimitiveTypesEvaluation(boxedBigInt()), 'BigInt').toBe(
        true,
      );
    });

    it('rVAlien/R1: a plain {} → false (tag is Object, no dispatch entry)', () => {
      expect(resolvedViaAlienRealmPrimitiveTypesEvaluation(plainObject())).toBe(false);
    });

    it('rVAlien/R-tagspoof: a Symbol.toStringTag spoof → false (ctor-name walk reaches Object)', () => {
      expect(resolvedViaAlienRealmPrimitiveTypesEvaluation(tagSpoofString())).toBe(false);
    });

    it('rVAlien/R-protograft: Object.create(String.prototype) → false (tag resolves to Object)', () => {
      expect(resolvedViaAlienRealmPrimitiveTypesEvaluation(protoGraftString())).toBe(
        false,
      );
    });
  });

  // ----- the symbol-registry probe -----
  describe('unguardedIsUnregisteredSymbol', () => {
    it('uIUS/A1: a Symbol() → true (unregistered)', () => {
      expect(unguardedIsUnregisteredSymbol(Symbol('x'))).toBe(true);
    });
    it('uIUS/A2: a well-known symbol → true (unregistered)', () => {
      expect(unguardedIsUnregisteredSymbol(Symbol.iterator)).toBe(true);
    });
    it('uIUS/R1: a Symbol.for(...) → false (registered)', () => {
      expect(unguardedIsUnregisteredSymbol(Symbol.for('species-js:uius'))).toBe(false);
    });
    it('uIUS/B1: unguarded by contract — a non-symbol receiver THROWS (why isRegisteredSymbol gates first)', () => {
      const nonSymbol = /** @type {symbol} */ (/** @type {unknown} */ ('not-a-symbol'));
      expect(() => unguardedIsUnregisteredSymbol(nonSymbol)).toThrow();
    });
  });

  // ----- the three Number static-method polyfills (the fallback path) -----
  // Exported so the polyfill is exercised even where the native method exists.
  // Same behavioral profile as the public guards — asserted directly here.
  describe('Number static-method polyfills', () => {
    it('isFiniteNumber: finite → true; NaN/Infinity → false; the coercion trap "42" → false', () => {
      expect(isFiniteNumber(42), '42').toBe(true);
      expect(isFiniteNumber(NaN), 'NaN').toBe(false);
      expect(isFiniteNumber(Infinity), 'Infinity').toBe(false);
      expect(isFiniteNumber('42'), 'numeric string').toBe(false);
      expect(isFiniteNumber(new Number(42)), 'boxed').toBe(false);
    });

    it('isInteger: integer → true; fractional / non-finite / non-number → false', () => {
      expect(isInteger(42), '42').toBe(true);
      expect(isInteger(2 ** 53), '2**53 (integer, not safe)').toBe(true);
      expect(isInteger(3.14), '3.14').toBe(false);
      expect(isInteger(Infinity), 'Infinity').toBe(false);
      expect(isInteger('42'), 'numeric string').toBe(false);
    });

    it('isSafeInteger: in-range → true; the MAX_SAFE_INTEGER + 1 edge → false', () => {
      expect(isSafeInteger(42), '42').toBe(true);
      expect(isSafeInteger(Number.MAX_SAFE_INTEGER), 'MAX_SAFE_INTEGER').toBe(true);
      expect(isSafeInteger(2 ** 53), 'MAX_SAFE_INTEGER + 1').toBe(false);
      expect(isSafeInteger(3.14), '3.14').toBe(false);
      expect(isSafeInteger('42'), 'numeric string').toBe(false);
    });
  });
});
