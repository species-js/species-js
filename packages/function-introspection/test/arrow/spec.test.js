// @ts-check

/**
 * @module test/arrow/spec
 *
 * Axis 1 — spec/contract, corpus-driven. Every candidate in `__config.js` is
 * scored against all three predicates, and the expected triple is DERIVED from
 * the row's single kind label rather than written per row. One label per row is
 * what keeps a row from contradicting itself; deriving the triple is what keeps
 * a reject row from quietly asserting only two of the three verdicts.
 *
 * Three completeness guards run before the rows, because a corpus-driven suite
 * fails open: an unrecognized label, a kind with no rows behind it, or an
 * expectation table missing a predicate column would each shrink the assertion
 * set silently rather than turn anything red.
 *
 * Foreign-realm vectors live in `cross-realm.test.js`; the forgery shapes and
 * the `async(` collision in `adversarial.test.js`; the relationship laws in
 * `invariants.test.js`; the marked-set oracle in `throw-safety.test.js`.
 *
 * Mirrors `docs/spec/ARROW.spec.md` (FROZEN 2026-08-11).
 */

import { describe, it, expect } from 'vitest';

import { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction } from '#index';

import {
  ARROW,
  ASYNC_ARROW,
  NOT_ARROW,
  ARROW_VECTORS,
  illegalHeaders,
  materialize,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction };
const predicateNames = Object.keys(predicates).sort();

/**
 * The verdict triple each kind stands for — the whole contract in one table.
 *
 * `isAnyArrowFunction` is written out rather than computed from the other two,
 * so this table states the union law as an EXPECTATION. `invariants.test.js`
 * then asserts the implementation satisfies it; if the table itself were
 * derived, the law would be true by construction and prove nothing.
 *
 * @type {Record<string, Record<string, boolean>>}
 */
const EXPECTATIONS = {
  [ARROW]: {
    isArrowFunction: true,
    isAsyncArrowFunction: false,
    isAnyArrowFunction: true,
  },
  [ASYNC_ARROW]: {
    isArrowFunction: false,
    isAsyncArrowFunction: true,
    isAnyArrowFunction: true,
  },
  [NOT_ARROW]: {
    isArrowFunction: false,
    isAsyncArrowFunction: false,
    isAnyArrowFunction: false,
  },
};

describe('arrow — spec/contract corpus', () => {
  describe('completeness guards', () => {
    it('every expectation row covers every predicate', () => {
      for (const [kind, expected] of Object.entries(EXPECTATIONS)) {
        expect(Object.keys(expected).sort(), `kind "${kind}"`).toEqual(predicateNames);
      }
    });

    it('every corpus row carries a recognized kind', () => {
      const unknown = ARROW_VECTORS.filter(([kind]) => !(kind in EXPECTATIONS)).map(
        ([kind, description]) => `${description} → "${kind}"`,
      );

      expect(unknown).toEqual([]);
    });

    it('every kind is represented, so no verdict class is vacuous', () => {
      for (const kind of Object.keys(EXPECTATIONS)) {
        const count = ARROW_VECTORS.filter(([rowKind]) => rowKind === kind).length;
        expect(count, `kind "${kind}" has no rows`).toBeGreaterThan(0);
      }
    });

    it('the corpus keeps both an admit and a reject majority-class', () => {
      const admits = ARROW_VECTORS.filter(([kind]) => kind !== NOT_ARROW).length;
      const rejects = ARROW_VECTORS.filter(([kind]) => kind === NOT_ARROW).length;

      expect(admits).toBeGreaterThan(0);
      expect(rejects).toBeGreaterThan(0);
    });
  });

  for (const [kind, description, source] of ARROW_VECTORS) {
    const expected = EXPECTATIONS[kind];

    describe(`${description} → ${kind}`, () => {
      for (const predicateName of predicateNames) {
        const want = expected?.[predicateName];

        it(`${predicateName} → ${String(want)}`, () => {
          const predicate = predicates[predicateName];
          if (!predicate || want === undefined) {
            throw new Error(`no predicate/expectation for "${predicateName}"`);
          }
          expect(predicate(materialize(source))).toBe(want);
        });
      }
    });
  }

  describe('the entrance-level [arrow/X2]', () => {
    it('an omitted argument is refused by all three', () => {
      expect(isArrowFunction()).toBe(false);
      expect(isAsyncArrowFunction()).toBe(false);
      expect(isAnyArrowFunction()).toBe(false);
    });
  });

  describe('grammar bounds — the illegal headers [arrow/G1..G4]', () => {
    it('the set is non-empty, so this block cannot pass vacuously', () => {
      expect(Object.keys(illegalHeaders).length).toBeGreaterThan(0);
    });

    for (const [name, source] of Object.entries(illegalHeaders)) {
      it(`${name} is a SyntaxError`, () => {
        expect(() => materialize(source)).toThrow(SyntaxError);
      });
    }
  });
});
