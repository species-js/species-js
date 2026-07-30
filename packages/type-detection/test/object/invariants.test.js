// @ts-check

/**
 * @module test/object/invariants
 *
 * Standing structural-invariant oracle — the spec-free RELATIONSHIP laws of the
 * object lattice, asserted over a broad value corpus. Promoted from the
 * back-sweep's ephemeral hostile-probe into a committed, always-run suite
 * (Phase 2): these laws are genuinely NEW coverage the absolute-value matrices in
 * `spec.test.js` do not assert — the matrices pin each value's verdict QUAD; this
 * suite pins the CROSS-PREDICATE relationships that must hold for EVERY value,
 * hostile ones included.
 *
 * ```
 * AnyObject                 (isObject)                    — non-null, non-function object
 *   ├── PlainObject         (isPlainObject)               — constructor === Object
 *   └── DictionaryObject    (isDictionaryObject)          — no prototype-chain
 * PlainOrDictionaryObject   (isPlainOrDictionaryObject)   — the fused union
 * ```
 *
 * The laws:
 *   A. Refinement — each of `isPlainObject` / `isDictionaryObject` /
 *      `isPlainOrDictionaryObject` implies `isObject`.
 *   B. Union equivalence — `isPlainOrDictionaryObject(v)` === `isPlainObject(v) ||
 *      isDictionaryObject(v)` for EVERY `v`. The headline law: the FUSED predicate
 *      (one shared gate + prototype read + dispatch) must agree with the naive
 *      disjunction it optimizes. A violation means the fusion changed semantics.
 *   C. Mutual exclusivity — no value is both a PlainObject and a DictionaryObject
 *      (proto === Object.prototype vs. proto === null are disjoint states).
 *   D. Cross-realm verdict symmetry — an UNTAMPERED shape reads identically local vs
 *      foreign. The deliberately-asymmetric tampered-tag plain object (admitted
 *      locally by the identity fast-path, rejected cross-realm by the structural
 *      arm) is excluded by design and asserted AS asymmetric, pinning the boundary.
 *   E. Falsy floor — every predicate rejects every falsy input (the `isObject` gate).
 *   F. Determinism — repeated calls on the same instance agree (no hidden state).
 *   G. Strictness witnesses — the lattice does not collapse: a PlainObject-not-Dict,
 *      a Dict-not-Plain, and an AnyObject-that-is-neither all exist.
 *
 * Throw-safety (that no predicate throws on hostile input) is the axis-5 concern —
 * see `throw-safety.test.js`; this suite assumes it and asserts relationships.
 */

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
} from '#index';

import {
  emptyObject,
  objectWithProps,
  newObject,
  objectCreateObjectProto,
  nullProtoObject,
  nulledProtoObject,
  nullProtoWithConstructorKey,
  objectPrototypeValue,
  array,
  dateInstance,
  mapInstance,
  regExp,
  classInstance,
  boxedString,
  boxedNumber,
  objectCreatePlainProto,
  tagSpoofedNullProto,
  localTagSpoofedPlainObject,
  tamperedConstructorPlainObject,
  classExtendsNullRenamedObject,
  fullMemberSurfaceProto,
  wrongShapeMemberSurfaceProto,
  throwingOwnKeysProto,
  throwingProtoTrapProxy,
  valueOverThrowingProtoDescTrap,
  valueWithSurgicalHostileConstructor,
  valueWithBlanketHostileConstructor,
  localTagThrowPlainObject,
  foreignPlainObject,
  foreignNewObject,
  foreignArray,
  foreignDate,
  foreignClassInstance,
  foreignTagSpoofedPlainObject,
  foreignTagThrowPlainObject,
} from './__config.js';

// The full value corpus — clean shapes, spoof/graft boundaries, hostile traps, and
// foreign-realm values. The relationship laws must hold across ALL of them.
/** @type {Array<[string, () => unknown]>} */
const corpus = [
  ['emptyObject', emptyObject],
  ['objectWithProps', objectWithProps],
  ['newObject', newObject],
  ['objectCreateObjectProto', objectCreateObjectProto],
  ['nullProtoObject', nullProtoObject],
  ['nulledProtoObject', nulledProtoObject],
  ['nullProtoWithConstructorKey', nullProtoWithConstructorKey],
  ['objectPrototypeValue', objectPrototypeValue],
  ['array', array],
  ['dateInstance', dateInstance],
  ['mapInstance', mapInstance],
  ['regExp', regExp],
  ['classInstance', classInstance],
  ['boxedString', boxedString],
  ['boxedNumber', boxedNumber],
  ['objectCreatePlainProto', objectCreatePlainProto],
  ['tagSpoofedNullProto', tagSpoofedNullProto],
  ['localTagSpoofedPlainObject', localTagSpoofedPlainObject],
  ['tamperedConstructorPlainObject', tamperedConstructorPlainObject],
  ['classExtendsNullRenamedObject', classExtendsNullRenamedObject],
  ['fullMemberSurfaceProto', fullMemberSurfaceProto],
  ['wrongShapeMemberSurfaceProto', wrongShapeMemberSurfaceProto],
  ['throwingOwnKeysProto', throwingOwnKeysProto],
  ['throwingProtoTrapProxy', throwingProtoTrapProxy],
  ['valueOverThrowingProtoDescTrap', valueOverThrowingProtoDescTrap],
  ['valueWithSurgicalHostileConstructor', valueWithSurgicalHostileConstructor],
  ['valueWithBlanketHostileConstructor', valueWithBlanketHostileConstructor],
  ['localTagThrowPlainObject', localTagThrowPlainObject],
  ['foreignPlainObject', foreignPlainObject],
  ['foreignNewObject', foreignNewObject],
  ['foreignArray', foreignArray],
  ['foreignDate', foreignDate],
  ['foreignClassInstance', foreignClassInstance],
];

const falsyFloor = [null, undefined, 0, '', false, NaN, 0n];

describe('object — structural invariants (A: refinement — each strict form implies isObject)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isPlainObject/isDictionaryObject/isPlainOrDictionaryObject ⇒ isObject`, () => {
      const v = make();
      const any = isObject(v);
      expect(!isPlainObject(v) || any, `${label}: plain but not object`).toBe(true);
      expect(!isDictionaryObject(v) || any, `${label}: dictionary but not object`).toBe(
        true,
      );
      expect(
        !isPlainOrDictionaryObject(v) || any,
        `${label}: plainOrDictionary but not object`,
      ).toBe(true);
    });
  }
});

describe('object — structural invariants (B: union equivalence — the fused form === the disjunction)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: isPlainOrDictionaryObject === isPlainObject || isDictionaryObject`, () => {
      const v = make();
      expect(isPlainOrDictionaryObject(v)).toBe(
        isPlainObject(v) || isDictionaryObject(v),
      );
    });
  }
});

describe('object — structural invariants (C: mutual exclusivity — never both plain and dictionary)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: !(isPlainObject && isDictionaryObject)`, () => {
      const v = make();
      expect(isPlainObject(v) && isDictionaryObject(v)).toBe(false);
    });
  }
});

describe('object — structural invariants (D: cross-realm verdict symmetry)', () => {
  // UNTAMPERED shapes read identically across realms — no verdict depends on realm
  // membership alone.
  /** @type {Array<[string, () => unknown, () => unknown]>} */
  const untamperedPairs = [
    ['plain object', emptyObject, foreignPlainObject],
    ['new Object()', newObject, foreignNewObject],
    ['array', array, foreignArray],
    ['Date instance', dateInstance, foreignDate],
    ['class instance', classInstance, foreignClassInstance],
  ];

  for (const [label, local, foreign] of untamperedPairs) {
    it(`${label}: [isObject, isPlainObject, isDictionaryObject, isPlainOrDictionaryObject] is realm-independent`, () => {
      /** @param {unknown} v - the value to score across the four predicates */
      const quad = (v) => [
        isObject(v),
        isPlainObject(v),
        isDictionaryObject(v),
        isPlainOrDictionaryObject(v),
      ];
      expect(quad(foreign()), `${label}: foreign ≠ local`).toEqual(quad(local()));
    });
  }

  it('the tampered cosmetic-tag plain object is DELIBERATELY asymmetric (the #044 residual)', () => {
    // the boundary of law D: a spoofed-tag plain object is admitted by the tag-blind
    // LOCAL identity fast-path (it genuinely has Object.prototype) but rejected by the
    // tag-reading cross-realm structural arm — same shape, opposite plain-object
    // verdict by realm, by design.
    expect(isPlainObject(localTagSpoofedPlainObject()), 'local admit').toBe(true);
    expect(isPlainObject(foreignTagSpoofedPlainObject()), 'foreign reject').toBe(false);
    // the throwing-tag counterpart splits the same way.
    expect(isPlainObject(localTagThrowPlainObject()), 'local throwing-tag admit').toBe(
      true,
    );
    expect(
      isPlainObject(foreignTagThrowPlainObject()),
      'foreign throwing-tag reject',
    ).toBe(false);
  });
});

describe('object — structural invariants (E: falsy floor)', () => {
  for (const value of falsyFloor) {
    it(`${String(value)}: all four predicates reject`, () => {
      expect(isObject(value), 'isObject').toBe(false);
      expect(isPlainObject(value), 'isPlainObject').toBe(false);
      expect(isDictionaryObject(value), 'isDictionaryObject').toBe(false);
      expect(isPlainOrDictionaryObject(value), 'isPlainOrDictionaryObject').toBe(false);
    });
  }
});

describe('object — structural invariants (F: determinism)', () => {
  for (const [label, make] of corpus) {
    it(`${label}: repeated calls on the same instance agree`, () => {
      const v = make();
      expect(isObject(v)).toBe(isObject(v));
      expect(isPlainObject(v)).toBe(isPlainObject(v));
      expect(isDictionaryObject(v)).toBe(isDictionaryObject(v));
      expect(isPlainOrDictionaryObject(v)).toBe(isPlainOrDictionaryObject(v));
    });
  }
});

describe('object — structural invariants (G: the lattice does not collapse)', () => {
  it('a PlainObject that is NOT a DictionaryObject exists (`{}`)', () => {
    const v = emptyObject();
    expect(isPlainObject(v)).toBe(true);
    expect(isDictionaryObject(v)).toBe(false);
  });

  it('a DictionaryObject that is NOT a PlainObject exists (`Object.create(null)`)', () => {
    const v = nullProtoObject();
    expect(isDictionaryObject(v)).toBe(true);
    expect(isPlainObject(v)).toBe(false);
  });

  it('an AnyObject that is NEITHER plain nor dictionary exists (`[]`)', () => {
    const v = /** @type {unknown} */ (array());
    expect(isObject(v)).toBe(true);
    expect(isPlainObject(v)).toBe(false);
    expect(isDictionaryObject(v)).toBe(false);
    expect(isPlainOrDictionaryObject(v)).toBe(false);
  });
});
