// @ts-check

/**
 * @module test/primitive/invariants
 *
 * Standing structural-invariant oracle for `#primitive` — the spec-free RELATIONSHIP
 * laws of the primitive lattice, asserted over the full value corpus. These laws are
 * genuinely NEW coverage the absolute-value matrices in `spec.test.js` do not assert:
 * the matrices pin each value's verdict per predicate; this suite pins the
 * CROSS-PREDICATE relationships that must hold for EVERY value — foreign, spoofed and
 * hostile ones included. A violation is a real bug regardless of what the spec says.
 *
 * ```
 *   isPrimitiveValue  ≡  isNullishPrimitive  ⊎  isBoxablePrimitive     (the partition)
 *   isX               ≡  isXValue  ∨  isBoxedX          (per family, five times)
 *   isBoxedPrimitive  ≡  isBoxedString ∨ … ∨ isBoxedBigInt      (the umbrella)
 *   isRegisteredSymbol           ⇒  isSymbolValue
 *   isSafeIntegerValue ⇒ isIntegerValue ⇒ isFiniteNumberValue ⇒ isNumberValue
 * ```
 *
 * The laws:
 *   A. TWO-TIER COMPOSITE — `isX(v) === isXValue(v) || isBoxedX(v)` for each of the
 *      five families. The composite is defined as the union of its tiers; nothing may
 *      reach the composite that reaches neither tier.
 *   B. UMBRELLA ≡ OR-OF-BOXED — `isBoxedPrimitive(v)` agrees with the disjunction of
 *      the five per-family boxed predicates. NOT how it is implemented (it routes
 *      through `isObject` + the ES3 hot paths + the alien-realm tag dispatch), so the
 *      law is an independent oracle over that machinery, not a restatement of it.
 *   C. FAMILY MUTUAL-EXCLUSIVITY — no value satisfies two families' composites. The
 *      guard against a spoof or a graft being admitted by more than one family.
 *   D. THE PARTITION — `isPrimitiveValue(v) === isNullishPrimitive(v) ||
 *      isBoxablePrimitive(v)`, and the two arms are DISJOINT (nullish is never
 *      boxable). Every present value lands in exactly one arm or outside both.
 *   E. TIER DISJOINTNESS — `isBoxedPrimitive(v) ⇒ !isPrimitiveValue(v)`. A boxed
 *      primitive is an object; the value tier and the boxed tier never overlap.
 *   F. REFINEMENT — the implications that must hold in one direction only:
 *      `isXValue ⇒ isBoxablePrimitive`, `isBoxedX ⇒ isBoxedPrimitive`,
 *      `isRegisteredSymbol ⇒ isSymbolValue`, and the Number-static ladder
 *      (`isSafeIntegerValue ⇒ isIntegerValue ⇒ isFiniteNumberValue ⇒ isNumberValue`).
 *   G. CROSS-REALM VERDICT SYMMETRY — an untampered foreign value scores identically
 *      to its local twin across the WHOLE 23-predicate public surface. Primitives
 *      carry no realm identity and the boxed arm admits alien instances structurally,
 *      so `#primitive` is realm-agnostic by design — no verdict may depend on realm
 *      membership alone.
 *   H. DETERMINISM — repeated calls on the same value agree (the #059 posture: no
 *      registries, resolve-once-and-thread; a predicate that cached across calls or
 *      leaked stateful residue would break this).
 *   I. THE LATTICE DOES NOT COLLAPSE — witnesses that each tier is inhabited and
 *      distinguishable: a value-only, a boxed-only, and a neither for every family.
 *
 * NOTE — there is deliberately NO falsy-floor law here (the shape borrowed by the
 * error/thenable suites): `''`, `0`, `NaN`, `false` and `0n` are all legitimate
 * primitive values that the family predicates MUST admit. Rejecting falsy input is an
 * error-domain law, not a primitive-domain one.
 *
 * Throw-safety (that no predicate throws on hostile input) is the axis-3 concern —
 * see `throw-safety.test.js`, which also owns the marked-set completeness triple-lock.
 * This suite assumes both and asserts the relationships neither covers.
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
  primString,
  emptyString,
  boxedString,
  objectString,
  stringSubclass,
  primNumber,
  primNaN,
  primInfinity,
  primNegInfinity,
  primNegZero,
  boxedNumber,
  objectNumber,
  boxedNumberNaN,
  numberSubclass,
  primTrue,
  primFalse,
  boxedBooleanTrue,
  boxedBooleanFalse,
  objectBoolean,
  booleanSubclass,
  primSymbol,
  wellKnownSymbol,
  registeredSymbol,
  boxedSymbol,
  boxedRegisteredSymbol,
  primBigInt,
  bigintFromCall,
  boxedBigInt,
  nullValue,
  undefinedValue,
  plainObject,
  arrayValue,
  arrowFunction,
  foreignBoxedString,
  foreignBoxedNumber,
  foreignBoxedBoolean,
  foreignBoxedSymbol,
  foreignBoxedBigInt,
  foreignPrimString,
  foreignPrimNumber,
  tagSpoofString,
  tagSpoofNumber,
  tagSpoofBoolean,
  tagSpoofSymbol,
  tagSpoofBigInt,
  protoGraftString,
  protoGraftNumber,
  protoGraftBoolean,
  protoGraftSymbol,
  protoGraftBigInt,
  ctorNameSpoofString,
  descriptionShadowedBoxedSymbol,
  throwSafetyMatrix,
} from './__config.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The lattice under test
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The five families, each as its `[value, boxed, composite]` predicate triple —
 * the shape laws A, C and F quantify over.
 *
 * @type {Array<[string, (v: unknown) => boolean, (v: unknown) => boolean, (v: unknown) => boolean]>}
 */
const families = [
  ['String', isStringValue, isBoxedString, isString],
  ['Number', isNumberValue, isBoxedNumber, isNumber],
  ['Boolean', isBooleanValue, isBoxedBoolean, isBoolean],
  ['Symbol', isSymbolValue, isBoxedSymbol, isSymbol],
  ['BigInt', isBigIntValue, isBoxedBigInt, isBigInt],
];

/**
 * The complete 23-predicate public surface, used as the scoring vector for the
 * cross-realm symmetry law (G) and the determinism law (H).
 *
 * @type {Array<[string, (v: unknown) => boolean]>}
 */
const publicPredicates = [
  ['isStringValue', isStringValue],
  ['isBoxedString', isBoxedString],
  ['isString', isString],
  ['isNumberValue', isNumberValue],
  ['isBoxedNumber', isBoxedNumber],
  ['isNumber', isNumber],
  ['isBooleanValue', isBooleanValue],
  ['isBoxedBoolean', isBoxedBoolean],
  ['isBoolean', isBoolean],
  ['isSymbolValue', isSymbolValue],
  ['isBoxedSymbol', isBoxedSymbol],
  ['isSymbol', isSymbol],
  ['isBigIntValue', isBigIntValue],
  ['isBoxedBigInt', isBoxedBigInt],
  ['isBigInt', isBigInt],
  ['isNullishPrimitive', isNullishPrimitive],
  ['isBoxablePrimitive', isBoxablePrimitive],
  ['isPrimitiveValue', isPrimitiveValue],
  ['isBoxedPrimitive', isBoxedPrimitive],
  ['isFiniteNumberValue', isFiniteNumberValue],
  ['isIntegerValue', isIntegerValue],
  ['isSafeIntegerValue', isSafeIntegerValue],
  ['isRegisteredSymbol', isRegisteredSymbol],
];

// The full corpus — clean values across all five families and both tiers, the
// non-primitive floor, real foreign-realm values, the non-throwing adversarial
// spoofs/grafts, and the throwing hostile traps. Every relationship law must hold
// across ALL of them; a law that only holds for well-formed input is not a law.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['primString', primString],
  ['emptyString', emptyString],
  ['boxedString', boxedString],
  ['objectString', objectString],
  ['stringSubclass', stringSubclass],
  ['primNumber', primNumber],
  ['primNaN', primNaN],
  ['primInfinity', primInfinity],
  ['primNegInfinity', primNegInfinity],
  ['primNegZero', primNegZero],
  ['boxedNumber', boxedNumber],
  ['objectNumber', objectNumber],
  ['boxedNumberNaN', boxedNumberNaN],
  ['numberSubclass', numberSubclass],
  ['primTrue', primTrue],
  ['primFalse', primFalse],
  ['boxedBooleanTrue', boxedBooleanTrue],
  ['boxedBooleanFalse', boxedBooleanFalse],
  ['objectBoolean', objectBoolean],
  ['booleanSubclass', booleanSubclass],
  ['primSymbol', primSymbol],
  ['wellKnownSymbol', wellKnownSymbol],
  ['registeredSymbol', registeredSymbol],
  ['boxedSymbol', boxedSymbol],
  ['boxedRegisteredSymbol', boxedRegisteredSymbol],
  ['primBigInt', primBigInt],
  ['bigintFromCall', bigintFromCall],
  ['boxedBigInt', boxedBigInt],
  ['nullValue', nullValue],
  ['undefinedValue', undefinedValue],
  ['plainObject', plainObject],
  ['arrayValue', arrayValue],
  ['arrowFunction', arrowFunction],
  ['foreignBoxedString', foreignBoxedString],
  ['foreignBoxedNumber', foreignBoxedNumber],
  ['foreignBoxedBoolean', foreignBoxedBoolean],
  ['foreignBoxedSymbol', foreignBoxedSymbol],
  ['foreignBoxedBigInt', foreignBoxedBigInt],
  ['foreignPrimString', foreignPrimString],
  ['foreignPrimNumber', foreignPrimNumber],
  ['tagSpoofString', tagSpoofString],
  ['tagSpoofNumber', tagSpoofNumber],
  ['tagSpoofBoolean', tagSpoofBoolean],
  ['tagSpoofSymbol', tagSpoofSymbol],
  ['tagSpoofBigInt', tagSpoofBigInt],
  ['protoGraftString', protoGraftString],
  ['protoGraftNumber', protoGraftNumber],
  ['protoGraftBoolean', protoGraftBoolean],
  ['protoGraftSymbol', protoGraftSymbol],
  ['protoGraftBigInt', protoGraftBigInt],
  ['ctorNameSpoofString', ctorNameSpoofString],
  ['descriptionShadowedBoxedSymbol', descriptionShadowedBoxedSymbol],
  ...Object.entries(throwSafetyMatrix).map(
    /** @returns {[string, () => unknown]} the labelled hostile-value row */
    ([key, row]) => [`hostile:${key}`, row.make],
  ),
];

describe('primitive — structural invariants (A: two-tier composite — isX ≡ isXValue ∨ isBoxedX)', () => {
  for (const [family, isValue, isBoxed, isComposite] of families) {
    for (const [label, make] of corpus) {
      it(`${family}/${label}: is${family} === is${family}Value || isBoxed${family}`, () => {
        const v = make();
        expect(isComposite(v)).toBe(isValue(v) || isBoxed(v));
      });
    }
  }
});

describe('primitive — structural invariants (B: umbrella ≡ OR-of-boxed)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isBoxedPrimitive === the disjunction of the five boxed predicates`, () => {
      const v = make();
      // independent of isBoxedPrimitive's own machinery (isObject + ES3 hot paths +
      // alien tag dispatch) — the umbrella must agree with its parts either way.
      const anyBoxed = families.some(([, , isBoxed]) => isBoxed(v));
      expect(isBoxedPrimitive(v)).toBe(anyBoxed);
    });
  }
});

describe('primitive — structural invariants (C: family mutual-exclusivity)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: at most one family composite admits it`, () => {
      const v = make();
      const admitting = families
        .filter(([, , , isComposite]) => isComposite(v))
        .map(([family]) => family);
      expect(
        admitting.length,
        `admitted by ${admitting.join(' + ')}`,
      ).toBeLessThanOrEqual(1);
    });
  }
});

describe('primitive — structural invariants (D: the isPrimitiveValue partition)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isPrimitiveValue === isNullishPrimitive || isBoxablePrimitive`, () => {
      const v = make();
      expect(isPrimitiveValue(v)).toBe(isNullishPrimitive(v) || isBoxablePrimitive(v));
    });

    it(`${label}: the two arms are disjoint (nullish is never boxable)`, () => {
      const v = make();
      expect(isNullishPrimitive(v) && isBoxablePrimitive(v)).toBe(false);
    });
  }
});

describe('primitive — structural invariants (E: tier disjointness — boxed is never a value)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isBoxedPrimitive ⇒ !isPrimitiveValue`, () => {
      const v = make();
      expect(!isBoxedPrimitive(v) || !isPrimitiveValue(v)).toBe(true);
    });
  }
});

describe('primitive — structural invariants (F: refinement implications)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isXValue ⇒ isBoxablePrimitive, isBoxedX ⇒ isBoxedPrimitive`, () => {
      const v = make();
      for (const [family, isValue, isBoxed] of families) {
        expect(
          !isValue(v) || isBoxablePrimitive(v),
          `${family}: value tier but not boxable`,
        ).toBe(true);
        expect(
          !isBoxed(v) || isBoxedPrimitive(v),
          `${family}: boxed tier but not a boxed primitive`,
        ).toBe(true);
      }
    });

    it(`${label}: isRegisteredSymbol ⇒ isSymbolValue`, () => {
      const v = make();
      expect(!isRegisteredSymbol(v) || isSymbolValue(v)).toBe(true);
    });

    it(`${label}: the Number-static ladder (safe ⇒ integer ⇒ finite ⇒ number)`, () => {
      const v = make();
      expect(!isSafeIntegerValue(v) || isIntegerValue(v), 'safe but not integer').toBe(
        true,
      );
      expect(!isIntegerValue(v) || isFiniteNumberValue(v), 'integer but not finite').toBe(
        true,
      );
      expect(!isFiniteNumberValue(v) || isNumberValue(v), 'finite but not a number').toBe(
        true,
      );
    });
  }
});

describe('primitive — structural invariants (G: cross-realm verdict symmetry)', () => {
  // `#primitive` is realm-agnostic by design: primitives carry no realm identity, and
  // the boxed arm admits alien instances structurally (the tag + slot-probe path). So
  // an UNTAMPERED foreign value must score identically to its local twin across the
  // entire public surface — no verdict may turn on realm membership alone.
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const realmPairs = [
    ['boxed String', boxedString, foreignBoxedString],
    ['boxed Number', boxedNumber, foreignBoxedNumber],
    ['boxed Boolean', boxedBooleanTrue, foreignBoxedBoolean],
    ['boxed Symbol', boxedSymbol, foreignBoxedSymbol],
    ['boxed BigInt', boxedBigInt, foreignBoxedBigInt],
    ['primitive string', primString, foreignPrimString],
    ['primitive number', primNumber, foreignPrimNumber],
  ];

  /**
   * Score a value across the whole public surface.
   * @param {unknown} v - the value to score
   * @returns {Record<string, boolean>} predicate name → verdict
   */
  const scoreAll = (v) =>
    Object.fromEntries(publicPredicates.map(([name, predicate]) => [name, predicate(v)]));

  for (const [label, local, foreign] of realmPairs) {
    it(`${label}: the foreign value scores identically to the local twin (23 predicates)`, () => {
      expect(scoreAll(foreign())).toEqual(scoreAll(local()));
    });
  }
});

describe('primitive — structural invariants (H: determinism)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: every public predicate agrees with itself on a repeated call`, () => {
      const v = make();
      for (const [name, predicate] of publicPredicates) {
        expect(predicate(v), `${name} disagreed with itself`).toBe(predicate(v));
      }
    });
  }
});

describe('primitive — structural invariants (I: the lattice does not collapse)', () => {
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const witnesses = [
    ['String', primString, boxedString],
    ['Number', primNumber, boxedNumber],
    ['Boolean', primTrue, boxedBooleanTrue],
    ['Symbol', primSymbol, boxedSymbol],
    ['BigInt', primBigInt, boxedBigInt],
  ];

  for (const [family, makeValue, makeBoxed] of witnesses) {
    const [, isValue, isBoxed, isComposite] =
      /** @type {[string, (v: unknown) => boolean, (v: unknown) => boolean, (v: unknown) => boolean]} */ (
        families.find(([name]) => name === family)
      );

    it(`${family}: a value-tier-only witness exists`, () => {
      const v = makeValue();
      expect(isValue(v), 'value tier').toBe(true);
      expect(isBoxed(v), 'not the boxed tier').toBe(false);
      expect(isComposite(v), 'composite admits it').toBe(true);
    });

    it(`${family}: a boxed-tier-only witness exists`, () => {
      const v = makeBoxed();
      expect(isBoxed(v), 'boxed tier').toBe(true);
      expect(isValue(v), 'not the value tier').toBe(false);
      expect(isComposite(v), 'composite admits it').toBe(true);
    });

    it(`${family}: a neither-tier witness exists (a plain object)`, () => {
      const v = plainObject();
      expect(isComposite(v)).toBe(false);
    });
  }

  it('both partition arms are inhabited, and a value outside both exists', () => {
    expect(isNullishPrimitive(nullValue()), 'null inhabits the nullish arm').toBe(true);
    expect(isBoxablePrimitive(primString()), 'a string inhabits the boxable arm').toBe(
      true,
    );
    expect(isPrimitiveValue(plainObject()), 'a plain object is outside both').toBe(false);
  });

  it('explicit undefined is nullish, not boxable — the arms genuinely differ', () => {
    // the literal, not the corpus factory: an EXPLICIT `undefined` argument is
    // present (`args.length === 1`), so it must read as a primitive value — the
    // distinction #079's omitted-argument honesty turns on.
    expect(isNullishPrimitive(undefined)).toBe(true);
    expect(isBoxablePrimitive(undefined)).toBe(false);
    expect(isPrimitiveValue(undefined)).toBe(true);
  });
});
