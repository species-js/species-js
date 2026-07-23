// @ts-check

/**
 * @module test/utility/spec.test
 *
 * Axis-1 behavioral suite for the `utility` module, driven by the focused
 * matrices and tables in `./__config.js` and mirroring
 * `docs/spec/UTILITY.spec.md`. Each matrix loop asserts every cell AND guards
 * that every row scores every column (the completeness guard — no silent gaps).
 * The identity-return readers (`getSafePrototypeOf`, `getDefinedConstructor`,
 * the own-key readers, the descriptor walks) and the omitted-argument overloads
 * are hand-written below, since a live reference / a "no argument" call is not a
 * tabulable data value.
 */

import { describe, it, expect } from 'vitest';

import {
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  hasInertMethod,
  hasInertGetter,
  hasInertSetter,
  hasInertValue,
  isValidPropertyKey,
  isValidWeakKey,
  getTypeSignature,
  getTaggedType,
  getDefinedConstructor,
  getDefinedConstructorName,
  resolveType,
  getVerifiedOwnName,
  getSafePrototypeOf,
  getOwnPropertyKeys,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafeOwnPropertyKeys,
  getNextAvailablePropertyDescriptor,
  getNextAvailableSafeDescriptor,
  objectCreate,
} from '#index';

import {
  hasOwnMatrix,
  hasInertMatrix,
  validPropertyKeys,
  invalidPropertyKeys,
  validWeakKeys,
  invalidWeakKeys,
  typeReaderMatrix,
  verifiedOwnNameTable,
} from './__config.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  `hasOwn*` prototype-predicate matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('hasOwn* prototype predicates', () => {
  /** @type {Record<string, (value?: unknown) => boolean>} */
  const predicates = {
    hasOwnPrototype,
    hasOwnWritablePrototype,
    hasOwnNonWritablePrototype,
  };
  const columns = Object.keys(predicates).sort();

  for (const [rowName, row] of Object.entries(hasOwnMatrix)) {
    it(`${rowName}: ${row.description} [${row.vectors.join(', ')}]`, () => {
      // completeness guard: the row scores every predicate, no silent gap.
      expect(Object.keys(row.expected).sort()).toEqual(columns);
      const value = row.make();
      const expected = /** @type {Record<string, boolean>} */ (row.expected);
      for (const name of columns) {
        const fn = predicates[name];
        const want = expected[name];
        if (!fn || typeof want !== 'boolean') {
          throw new Error(`missing predicate or expectation for ${name}`);
        }
        expect(fn(value)).toBe(want);
      }
    });
  }

  it('rejects nullish for all three (CC/nullish-safe)', () => {
    for (const value of [null, undefined]) {
      expect(hasOwnPrototype(value)).toBe(false);
      expect(hasOwnWritablePrototype(value)).toBe(false);
      expect(hasOwnNonWritablePrototype(value)).toBe(false);
    }
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  `hasInert*` chain-probe matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('hasInert* chain probes', () => {
  /** @type {Record<string, (type: unknown, key: PropertyKey) => boolean>} */
  const predicates = {
    hasInertMethod,
    hasInertGetter,
    hasInertSetter,
    hasInertValue,
  };
  const columns = Object.keys(predicates).sort();

  for (const [rowName, row] of Object.entries(hasInertMatrix)) {
    it(`${rowName}: ${row.description} [${row.vectors.join(', ')}]`, () => {
      expect(Object.keys(row.expected).sort()).toEqual(columns);
      const value = row.make();
      const expected = /** @type {Record<string, boolean>} */ (row.expected);
      for (const name of columns) {
        const fn = predicates[name];
        const want = expected[name];
        if (!fn || typeof want !== 'boolean') {
          throw new Error(`missing predicate or expectation for ${name}`);
        }
        expect(fn(value, row.key)).toBe(want);
      }
    });
  }

  it('short-circuits `null` type for all four (hIM/R4, hIG/R3, hIS/R3, hIV/R3)', () => {
    expect(hasInertMethod(null, 'then')).toBe(false);
    expect(hasInertGetter(null, 'x')).toBe(false);
    expect(hasInertSetter(null, 'x')).toBe(false);
    expect(hasInertValue(null, 'x')).toBe(false);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Narrowing guards — accept / reject sets
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('isValidPropertyKey (finite-number contract, ADR #072)', () => {
  for (const [group, values] of Object.entries(validPropertyKeys)) {
    it(`accepts ${group}`, () => {
      for (const value of values) {
        expect(isValidPropertyKey(value)).toBe(true);
      }
    });
  }
  for (const [group, values] of Object.entries(invalidPropertyKeys)) {
    it(`rejects ${group}`, () => {
      for (const value of values) {
        expect(isValidPropertyKey(value)).toBe(false);
      }
    });
  }
});

describe('isValidWeakKey', () => {
  for (const [group, values] of Object.entries(validWeakKeys)) {
    it(`accepts ${group}`, () => {
      for (const value of values) {
        expect(isValidWeakKey(value)).toBe(true);
      }
    });
  }
  for (const [group, values] of Object.entries(invalidWeakKeys)) {
    it(`rejects ${group}`, () => {
      for (const value of values) {
        expect(isValidWeakKey(value)).toBe(false);
      }
    });
  }
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-name reader matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-name readers', () => {
  /** @type {Record<string, (value?: unknown) => string | undefined>} */
  const readers = {
    getTypeSignature,
    getTaggedType,
    getDefinedConstructorName,
    resolveType,
  };
  const columns = Object.keys(readers).sort();

  for (const [rowName, row] of Object.entries(typeReaderMatrix)) {
    it(`${rowName}: ${row.description} [${row.vectors.join(', ')}]`, () => {
      expect(Object.keys(row.expected).sort()).toEqual(columns);
      const value = row.make();
      const expected = /** @type {Record<string, string | undefined>} */ (row.expected);
      for (const name of columns) {
        const reader = readers[name];
        if (!reader) {
          throw new Error(`missing reader ${name}`);
        }
        expect(reader(value)).toBe(expected[name]);
      }
    });
  }
});

describe('getVerifiedOwnName', () => {
  for (const [rowName, row] of Object.entries(verifiedOwnNameTable)) {
    it(`${rowName}: ${row.description} [${row.vectors.join(', ')}]`, () => {
      expect(getVerifiedOwnName(row.make())).toBe(row.expected);
    });
  }
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Hand-written: identity-return readers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('getSafePrototypeOf (identity)', () => {
  it('returns the live prototype, or null / undefined', () => {
    expect(getSafePrototypeOf({})).toBe(Object.prototype); // gSPO/A1
    expect(getSafePrototypeOf([])).toBe(Array.prototype); // gSPO/A1
    expect(getSafePrototypeOf(objectCreate(null))).toBe(null); // gSPO/A1
    expect(getSafePrototypeOf(42)).toBe(Number.prototype); // gSPO/A2 (boxes)
    expect(getSafePrototypeOf(() => undefined)).toBe(Function.prototype); // gSPO/A3
    expect(getSafePrototypeOf(null)).toBe(undefined); // gSPO/R1
    expect(getSafePrototypeOf(undefined)).toBe(undefined); // gSPO/R1
  });
});

describe('getDefinedConstructor (identity)', () => {
  it('resolves the structural constructor, or undefined', () => {
    expect(getDefinedConstructor([])).toBe(Array); // gDC/A1
    expect(getDefinedConstructor(new Date())).toBe(Date); // gDC/A1
    expect(getDefinedConstructor({})).toBe(Object); // gDC/A1
    expect(getDefinedConstructor(objectCreate(null))).toBe(undefined); // gDC/R1
    expect(getDefinedConstructor(null)).toBe(undefined); // gDC/R2
    expect(getDefinedConstructor(Object.prototype, { assumePrototype: true })).toBe(
      Object,
    ); // gDC/A4
  });
});

describe('own-key readers (raw + throw-safe)', () => {
  it('getOwnPropertyKeys — string + symbol, incl. non-enumerable (gOPK/A1-A3, R1)', () => {
    const s = Symbol('s');
    const value = Object.defineProperty({ a: 1, [s]: 2 }, 'b', { value: 3 });
    expect(getOwnPropertyKeys(value)).toEqual(['a', 'b', s]);
    expect(getOwnPropertyKeys({})).toEqual([]);
    expect(getOwnPropertyKeys(objectCreate(null))).toEqual([]);
    expect(getOwnPropertyKeys(null)).toEqual([]); // ?? !0 dodges the throw
    expect(getOwnPropertyKeys(undefined)).toEqual([]);
  });

  it('getSafeOwnProperty{Names,Symbols,Keys} — same shape, nullish → [] (gSOPN/gSOPS/gSOPK)', () => {
    const s = Symbol('s');
    const value = { a: 1, [s]: 2 };
    expect(getSafeOwnPropertyNames(value)).toEqual(['a']);
    expect(getSafeOwnPropertySymbols(value)).toEqual([s]);
    expect(getSafeOwnPropertyKeys(value)).toEqual(['a', s]);
    for (const nullish of [null, undefined]) {
      expect(getSafeOwnPropertyNames(nullish)).toEqual([]);
      expect(getSafeOwnPropertySymbols(nullish)).toEqual([]);
      expect(getSafeOwnPropertyKeys(nullish)).toEqual([]);
    }
  });
});

describe('descriptor walks (raw + throw-safe)', () => {
  it('getNextAvailablePropertyDescriptor — own, inherited, accessor-inert, miss (gNAPD/A1-B1, R1-R3)', () => {
    expect(getNextAvailablePropertyDescriptor({ a: 1 }, 'a')?.value).toBe(1); // A1
    expect(typeof getNextAvailablePropertyDescriptor({}, 'toString')?.value).toBe(
      'function',
    ); // A2 (inherited)
    const throwingAccessor = {
      get x() {
        throw new Error('getter');
      },
    };
    const desc = getNextAvailablePropertyDescriptor(throwingAccessor, 'x'); // B1 — returned, not invoked
    expect(typeof desc?.get).toBe('function');
    expect(getNextAvailablePropertyDescriptor({}, 'nonexistent')).toBe(undefined); // R1
    expect(getNextAvailablePropertyDescriptor(null, 'x')).toBe(undefined); // R3
  });

  it('getNextAvailableSafeDescriptor — same accepts, and undefined on a miss (gNASD/A1, R1)', () => {
    expect(getNextAvailableSafeDescriptor({ a: 1 }, 'a')?.value).toBe(1);
    expect(getNextAvailableSafeDescriptor({}, 'nonexistent')).toBe(undefined);
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Hand-written: omitted-argument overloads (args.length, CC/omitted-vs-undefined)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('omitted-argument overloads', () => {
  it('an omitted call → undefined; an explicit `undefined` → the tag (gTS/B1, gTT/B1, rT/B1)', () => {
    // the no-argument overloads are typed `(): undefined`, which reads as a void
    // expression; alias to a `string | undefined` signature so the call carries a
    // value type (no-confusing-void-expression).
    /** @type {() => string | undefined} */
    const noArgSignature = getTypeSignature;
    /** @type {() => string | undefined} */
    const noArgTag = getTaggedType;
    /** @type {() => string | undefined} */
    const noArgType = resolveType;
    expect(noArgSignature()).toBe(undefined); // gTS/B1
    expect(noArgTag()).toBe(undefined); // gTT/B1
    expect(noArgType()).toBe(undefined); // rT/B1

    expect(getTypeSignature(undefined)).toBe('[object Undefined]'); // contrast — explicit
    expect(getTaggedType(undefined)).toBe('Undefined');
    expect(resolveType(undefined)).toBe('Undefined');
  });
});
