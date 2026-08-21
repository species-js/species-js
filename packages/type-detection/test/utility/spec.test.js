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
  canOwnPropertyBeShaped,
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
  shapeabilityTable,
} from './__config.js';

import { foreignRealmEval } from '../_cross-realm.js';

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

  it('hIM/R5: an invalid key (a non-`PropertyKey`) → false (undefined descriptor)', () => {
    // the invalid key fails `isValidPropertyKey` in the walk → undefined descriptor →
    // `isCallable(undefined?.value)` → false.
    expect(
      hasInertMethod(
        {
          then() {
            return undefined;
          },
        },
        /** @type {PropertyKey} */ (/** @type {unknown} */ ({})),
      ),
    ).toBe(false);
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
//  `canOwnPropertyBeShaped` — shapeability, NOT own-ness
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('canOwnPropertyBeShaped', () => {
  for (const [rowName, row] of Object.entries(shapeabilityTable)) {
    it(`${rowName}: ${row.description} [${row.vectors.join(', ')}]`, () => {
      expect(canOwnPropertyBeShaped(row.make(), row.key)).toBe(row.expected);
    });
  }

  it('cOPBS/R4: a nullish value → false (guard)', () => {
    expect(canOwnPropertyBeShaped(null, 'k'), 'null').toBe(false);
    expect(canOwnPropertyBeShaped(undefined, 'k'), 'undefined').toBe(false);
    expect(canOwnPropertyBeShaped(), 'omitted').toBe(false);
  });

  // cOPBS/R5 is WITHDRAWN — it pinned a key-validation that denied definitions which
  // actually work. A6 is the corrected claim.
  it('cOPBS/A6: a non-PropertyKey key coerces and defines → true', () => {
    /** @type {[string, unknown][]} */
    const keys = [
      ['{}', {}],
      ['[]', []],
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['1n', 1n],
      ['true', true],
      ['null', null],
      ['undefined', undefined],
    ];
    for (const [label, key] of keys) {
      expect(canOwnPropertyBeShaped({}, key), label).toBe(true);
    }
    // the omitted key is the `undefined` case, and coerces to 'undefined'
    expect(canOwnPropertyBeShaped({ k: 1 }), 'omitted key').toBe(true);
  });

  it('cOPBS/R6: a non-object target → false, matching defineProperty', () => {
    /** @type {[string, unknown][]} */
    const primitives = [
      ['5', 5],
      ['0', 0],
      ["'s'", 's'],
      ["''", ''],
      ['true', true],
      ['false', false],
      ['1n', 1n],
      ['symbol', Symbol('t')],
    ];
    for (const [label, value] of primitives) {
      expect(canOwnPropertyBeShaped(value, 'k'), label).toBe(false);
    }
  });

  it('cOPBS/B3: a key whose ToPropertyKey throws → false, not thrown', () => {
    const hostileKey = {
      [Symbol.toPrimitive]() {
        throw new TypeError('boom');
      },
    };
    let got;
    expect(() => {
      got = canOwnPropertyBeShaped({}, hostileKey);
    }, 'must absorb').not.toThrow();
    expect(got).toBe(false);
    expect(() =>
      Object.defineProperty(
        {},
        /** @type {PropertyKey} */ (/** @type {unknown} */ (hostileKey)),
        { value: 1 },
      ),
    ).toThrow();
  });

  it('cOPBS/B4: a Proxy trapping defineProperty → true, yet the define throws', () => {
    const make = () =>
      new Proxy(
        {},
        {
          defineProperty() {
            throw new TypeError('refused');
          },
        },
      );
    expect(canOwnPropertyBeShaped(make(), 'k'), 'optimistic').toBe(true);
    expect(() => Object.defineProperty(make(), 'k', { value: 1 })).toThrow(TypeError);
  });

  it('cOPBS/B1: the desc-trap answer is CONSERVATIVE — the define would have succeeded', () => {
    const make = () =>
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new TypeError('unreadable');
          },
        },
      );
    expect(canOwnPropertyBeShaped(make(), 'k'), 'absorbed to false').toBe(false);
    expect(() =>
      Object.defineProperty(make(), 'k', { value: 1, configurable: true }),
    ).not.toThrow();
  });

  // cOPBS/B2 is WITHDRAWN — it pinned the optimism of a single-descriptor read on a
  // non-extensible target. The extensibility arm removed it; cOPBS/A7 and cOPBS/A8
  // are the corrected claims and are driven from the table.

  // B5 is the whole of what a `false` still permits, in three rows. `configurable:
  // false` freezes a property's SHAPE, not its value, so some defines still land —
  // but only the third row is a capability a caller actually loses.
  it('cOPBS/B5: a `false` forbids RESHAPING only — three kinds of define still land', () => {
    const writable = () =>
      Object.defineProperty({}, 'k', {
        value: 1,
        writable: true,
        enumerable: false,
        configurable: false,
      });
    const readOnly = () =>
      Object.defineProperty({}, 'k', {
        value: 1,
        writable: false,
        enumerable: false,
        configurable: false,
      });

    expect(canOwnPropertyBeShaped(writable(), 'k'), 'writable row').toBe(false);
    expect(canOwnPropertyBeShaped(readOnly(), 'k'), 'read-only row').toBe(false);

    // Row 1 — a no-op define. Nothing observable changes, so nothing is forbidden.
    // Legal even on a frozen property.
    expect(() => Object.defineProperty(readOnly(), 'k', {})).not.toThrow();
    expect(() => Object.defineProperty(readOnly(), 'k', { value: 1 })).not.toThrow();
    expect(() =>
      Object.defineProperty(readOnly(), 'k', { enumerable: false }),
    ).not.toThrow();

    // ...and the no-op rule is SameValue, not `===`, so both float cases invert.
    const zero = () =>
      Object.defineProperty({}, 'k', { value: 0, writable: false, configurable: false });
    expect(() => Object.defineProperty(zero(), 'k', { value: 0 })).not.toThrow();
    expect(
      () => Object.defineProperty(zero(), 'k', { value: -0 }),
      '-0 is not SameValue as +0',
    ).toThrow(TypeError);
    const nan = () =>
      Object.defineProperty({}, 'k', {
        value: NaN,
        writable: false,
        configurable: false,
      });
    expect(
      () => Object.defineProperty(nan(), 'k', { value: NaN }),
      'NaN IS SameValue as NaN',
    ).not.toThrow();

    // Row 2 — a value write plain assignment could also perform. No capability lost.
    expect(() => Object.defineProperty(writable(), 'k', { value: 2 })).not.toThrow();
    const viaAssignment = /** @type {{ k: number }} */ (writable());
    viaAssignment.k = 2;
    expect(viaAssignment.k, 'assignment reaches the same state').toBe(2);

    // Row 3 — the one-way `writable: true → false` tightening. THE capability a
    // caller gives up by trusting the `false`; no assignment can do this.
    expect(() =>
      Object.defineProperty(writable(), 'k', { value: 2, writable: false }),
    ).not.toThrow();

    // Everything that would RESHAPE the slot is refused, which is what `false` means.
    expect(
      () => Object.defineProperty(writable(), 'k', { value: 2, configurable: true }),
      'restoring configurable',
    ).toThrow(TypeError);
    expect(
      () => Object.defineProperty(writable(), 'k', { value: 2, enumerable: true }),
      'flipping enumerable',
    ).toThrow(TypeError);
    expect(
      () =>
        Object.defineProperty(writable(), 'k', {
          get() {
            return 2;
          },
        }),
      'converting data to accessor',
    ).toThrow(TypeError);
  });

  // Completeness: the suite must cover every vector the spec section defines.
  it('covers every `cOPBS/*` vector in UTILITY.spec.md', () => {
    const covered = new Set(
      Object.values(shapeabilityTable).flatMap((row) => row.vectors),
    );
    ['cOPBS/R4', 'cOPBS/A6', 'cOPBS/R6', 'cOPBS/B3', 'cOPBS/B4', 'cOPBS/B5'].forEach(
      (id) => covered.add(id),
    );

    const expected = [
      'cOPBS/A1',
      'cOPBS/A2',
      'cOPBS/A3',
      'cOPBS/A4',
      'cOPBS/A5',
      'cOPBS/R1',
      'cOPBS/R2',
      'cOPBS/R3',
      'cOPBS/A6',
      'cOPBS/A7',
      'cOPBS/A8',
      'cOPBS/R4',
      'cOPBS/R6',
      'cOPBS/R7',
      'cOPBS/B1',
      'cOPBS/B3',
      'cOPBS/B4',
      'cOPBS/B5',
    ];
    expect([...covered].sort()).toEqual(expected.sort());
  });
});

describe('type-reader reject / edge composition', () => {
  it('gDCN/R1: a constructor whose `name` is an accessor → undefined (never invoked)', () => {
    class Named {
      m() {
        return true;
      }
    }
    Object.defineProperty(Named, 'name', { get: () => 'Spoofed', configurable: true });
    // getDefinedConstructor resolves `Named`; getVerifiedOwnName reads the own `name`
    // DESCRIPTOR, whose accessor carries no data `value` → rejected, getter never fires.
    expect(getDefinedConstructorName(new Named())).toBe(undefined);
  });

  it('gDCN/R2: a constructor whose `name` is a non-string → undefined', () => {
    class Named {
      m() {
        return true;
      }
    }
    Object.defineProperty(Named, 'name', { value: 123, configurable: true });
    expect(getDefinedConstructorName(new Named())).toBe(undefined);
  });

  it('rT/B2: no reachable constructor AND a throwing `Symbol.toStringTag` → undefined', () => {
    // the constructor-name path yields undefined (null prototype), so resolveType
    // falls through to the tag — whose throwing getter the getTypeSignature try/catch
    // absorbs → undefined. (The complement of throw-safety.test.js's tagTrap row,
    // where a reachable `Object` short-circuits resolveType before the tag.)
    const value = objectCreate(null);
    Object.defineProperty(value, Symbol.toStringTag, {
      get() {
        throw new Error('tag');
      },
    });
    expect(resolveType(value)).toBe(undefined);
  });
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

  it('gDC/A2: a callable pivots from itself to its own family constructor', () => {
    const asyncFn = async () => {
      await Promise.resolve();
    };
    // `.constructor` on a typed function value is `Function` (not the `any` that
    // `Object.getPrototypeOf` would yield) — the %AsyncFunction% intrinsic capture.
    const AsyncFunction = asyncFn.constructor;
    expect(
      getDefinedConstructor(function () {
        return undefined;
      }),
    ).toBe(Function);
    expect(getDefinedConstructor(asyncFn)).toBe(AsyncFunction);
  });

  it('gDC/A3: a Generator INSTANCE — the two-stage walk recovers %GeneratorFunction%', () => {
    // the first walk lands on a `constructor` whose value is the OBJECT
    // %GeneratorFunction.prototype%; the follow-up walk recovers the function.
    const GeneratorFunction = function* () {
      yield undefined;
    }.constructor;
    expect(
      getDefinedConstructor(
        (function* () {
          yield undefined;
        })(),
      ),
    ).toBe(GeneratorFunction);
  });
});

describe('own-key readers (raw + throw-safe)', () => {
  it('getOwnPropertyKeys — string + symbol, incl. non-enumerable (gOPK/A1, gOPK/A2, gOPK/A3, gOPK/R1)', () => {
    const s = Symbol('s');
    const value = Object.defineProperty({ a: 1, [s]: 2 }, 'b', { value: 3 });
    expect(getOwnPropertyKeys(value)).toEqual(['a', 'b', s]);
    expect(getOwnPropertyKeys({})).toEqual([]);
    expect(getOwnPropertyKeys(objectCreate(null))).toEqual([]);
    expect(getOwnPropertyKeys(null)).toEqual([]); // ?? !0 dodges the throw
    expect(getOwnPropertyKeys(undefined)).toEqual([]);
  });

  it('getSafeOwnProperty{Names,Symbols,Keys} — same shape, nullish → [] (gSOPN/A1, gSOPS/A1, gSOPK/A1)', () => {
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
  it('getNextAvailablePropertyDescriptor — own, inherited, accessor-inert, miss (gNAPD/A1, gNAPD/A2, gNAPD/A3, gNAPD/B1, gNAPD/R1, gNAPD/R2, gNAPD/R3)', () => {
    expect(getNextAvailablePropertyDescriptor({ a: 1 }, 'a')?.value).toBe(1); // A1
    expect(typeof getNextAvailablePropertyDescriptor({}, 'toString')?.value).toBe(
      'function',
    ); // A2 (inherited)
    expect(getNextAvailablePropertyDescriptor([], 'length')?.value).toBe(0); // A3 (own data)
    const throwingAccessor = {
      get x() {
        throw new Error('getter');
      },
    };
    const desc = getNextAvailablePropertyDescriptor(throwingAccessor, 'x'); // B1 — returned, not invoked
    expect(typeof desc?.get).toBe('function');
    expect(getNextAvailablePropertyDescriptor({}, 'nonexistent')).toBe(undefined); // R1
    // R2 — an invalid key (a non-`PropertyKey` object) fails the `isValidPropertyKey`
    // guard → undefined. (`1.5` is a VALID key post-ADR #072 — finite number — so it
    // resolves via chain-exhaustion, not the guard; asserted here to pin that seam.)
    expect(
      getNextAvailablePropertyDescriptor(
        { a: 1 },
        /** @type {PropertyKey} */ (/** @type {unknown} */ ({})),
      ),
    ).toBe(undefined); // R2 (invalid key → guard)
    expect(getNextAvailablePropertyDescriptor({ a: 1 }, 1.5)).toBe(undefined); // R2 (valid-but-absent, #072)
    expect(getNextAvailablePropertyDescriptor(null, 'x')).toBe(undefined); // R3
  });

  it('getNextAvailableSafeDescriptor — same accepts, and undefined on a miss (gNASD/A1, gNASD/R1)', () => {
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

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Realm-agnosticism (axis 2) — utilities read own-realm structural facts
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// utility does not carry a standalone cross-realm suite: its functions are
// structural BY DESIGN — descriptor reads, `Symbol.toStringTag` brands, and the
// prototype→constructor walk, none of which depend on LOCAL intrinsic identity —
// so a foreign-realm value yields the SAME answer as a local one. The realm-
// relative comparison that DOES differ across realms (e.g. `isPlainObject`
// true-local / false-foreign) is a DOMAIN-predicate concern, tested in those
// modules' cross-realm suites. These vectors PIN the agnosticism as a positive
// guarantee — most sharply, `getDefinedConstructor` returns the value's OWN
// (foreign) constructor, never substituting or comparing against this realm's.

describe('realm-agnosticism (axis 2)', () => {
  it('getDefinedConstructor returns the FOREIGN constructor — not undefined, not the local one', () => {
    const foreignArray = foreignRealmEval('[1, 2, 3]');
    const foreignArrayCtor = foreignRealmEval('Array');
    const ctor = getDefinedConstructor(foreignArray);
    expect(ctor).toBe(foreignArrayCtor); // the value's own-realm `Array`…
    expect(ctor).not.toBe(Array); // …faithfully, never this realm's
  });

  it('getTaggedType / getTypeSignature read the realm-agnostic `[[Class]]` brand', () => {
    expect(getTaggedType(foreignRealmEval('new Date()'))).toBe('Date');
    expect(getTypeSignature(foreignRealmEval('Promise.resolve(1)'))).toBe(
      '[object Promise]',
    );
  });

  it('the own-`prototype` predicates read a foreign function structurally', () => {
    const foreignFn = foreignRealmEval('(function foo() {})');
    expect(hasOwnPrototype(foreignFn)).toBe(true);
    expect(hasOwnWritablePrototype(foreignFn)).toBe(true); // ES3 function — writable own `prototype`
    expect(hasOwnNonWritablePrototype(foreignFn)).toBe(false);
  });

  it('resolveType / getDefinedConstructorName resolve the foreign type-name', () => {
    expect(resolveType(foreignRealmEval('[1]'))).toBe('Array');
    expect(getDefinedConstructorName(foreignRealmEval('new Error("x")'))).toBe('Error');
  });
});
