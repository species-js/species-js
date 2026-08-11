// @ts-check

/**
 * @module test/concise/spec
 *
 * Axis 1 — spec/contract, corpus-driven. Every candidate is scored against all
 * five predicates, and the expected quintuple is DERIVED from the row's single
 * kind label rather than written per row. One label per row is what keeps a row
 * from contradicting itself; deriving the rest is what stops a reject row from
 * quietly asserting only some of the five verdicts.
 *
 * Three vector sets run here, and the second and third are the interesting
 * pair. {@link ACCESSOR_SYNTAX_VECTORS} are functions created BY accessor
 * syntax and are always refused — a rejection that only the source pattern can
 * make, since an accessor has no own `prototype` and reports
 * `[object Function]`. {@link ACCESSOR_SLOT_VECTORS} are ordinary methods
 * INSTALLED INTO an accessor slot, and each keeps the flavor it was written as.
 * Running both in one suite is what makes the ruling visible: the syntax is
 * rejected, the role is ignored.
 *
 * Completeness guards run before the rows, because a corpus-driven suite fails
 * open — an unrecognized label or a kind with no rows behind it would shrink
 * the assertion set silently rather than turn anything red.
 *
 * Mirrors `docs/spec/CONCISE.spec.md` (FROZEN 2026-08-11).
 */

import { describe, it, expect } from 'vitest';

import {
  isPlainConciseMethod,
  isConciseAsyncMethod,
  isConciseGeneratorMethod,
  isConciseAsyncGeneratorMethod,
  isAnyConciseMethod,
} from '#index';

import {
  CONCISE_PLAIN,
  CONCISE_ASYNC,
  CONCISE_GENERATOR,
  CONCISE_ASYNC_GENERATOR,
  NOT_CONCISE,
  CONCISE_VECTORS,
  ACCESSOR_SYNTAX_VECTORS,
  ACCESSOR_SLOT_VECTORS,
  illegalHeaders,
  materialize,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isPlainConciseMethod,
  isConciseAsyncMethod,
  isConciseGeneratorMethod,
  isConciseAsyncGeneratorMethod,
  isAnyConciseMethod,
};
const predicateNames = Object.keys(predicates).sort();

/**
 * The verdict each kind stands for. `isAnyConciseMethod` is written out rather
 * than computed, so this table states the union law as an EXPECTATION;
 * `invariants.test.js` then asserts the implementation satisfies it. Derived,
 * the law would hold by construction and prove nothing.
 *
 * @param {string} flavor - the predicate name this kind admits, or `''`
 * @returns {Record<string, boolean>} the full quintuple
 */
const only = (flavor) =>
  Object.fromEntries(
    predicateNames.map((name) => [
      name,
      name === flavor || (flavor !== '' && name === 'isAnyConciseMethod'),
    ]),
  );

/** @type {Record<string, Record<string, boolean>>} */
const EXPECTATIONS = {
  [CONCISE_PLAIN]: only('isPlainConciseMethod'),
  [CONCISE_ASYNC]: only('isConciseAsyncMethod'),
  [CONCISE_GENERATOR]: only('isConciseGeneratorMethod'),
  [CONCISE_ASYNC_GENERATOR]: only('isConciseAsyncGeneratorMethod'),
  [NOT_CONCISE]: only(''),
};

/** @type {[string, [string, string, string][]][]} */
const VECTOR_SETS = [
  ['core', CONCISE_VECTORS],
  ['accessor syntax — always refused', ACCESSOR_SYNTAX_VECTORS],
  ['accessor slot — classified on its own merits', ACCESSOR_SLOT_VECTORS],
];

describe('concise — spec/contract corpus', () => {
  describe('completeness guards', () => {
    it('every expectation row covers every predicate', () => {
      for (const [kind, expected] of Object.entries(EXPECTATIONS)) {
        expect(Object.keys(expected).sort(), `kind "${kind}"`).toEqual(predicateNames);
      }
    });

    it('the expectation table admits exactly one flavor per admitting kind', () => {
      for (const [kind, expected] of Object.entries(EXPECTATIONS)) {
        const flavors = predicateNames.filter(
          (name) => name !== 'isAnyConciseMethod' && expected[name],
        );

        expect(flavors.length, `kind "${kind}"`).toBe(kind === NOT_CONCISE ? 0 : 1);
      }
    });

    it('every corpus row carries a recognized kind', () => {
      const unknown = VECTOR_SETS.flatMap(([setName, rows]) =>
        rows
          .filter(([kind]) => !(kind in EXPECTATIONS))
          .map(([kind, description]) => `${setName}: ${description} → "${kind}"`),
      );

      expect(unknown).toEqual([]);
    });

    it('every kind is represented, so no verdict class is vacuous', () => {
      const all = VECTOR_SETS.flatMap(([, rows]) => rows);

      for (const kind of Object.keys(EXPECTATIONS)) {
        const count = all.filter(([rowKind]) => rowKind === kind).length;
        expect(count, `kind "${kind}" has no rows`).toBeGreaterThan(0);
      }
    });

    it('the accessor-syntax set is entirely rejections — that is its point', () => {
      const admitted = ACCESSOR_SYNTAX_VECTORS.filter(([kind]) => kind !== NOT_CONCISE);

      expect(admitted).toEqual([]);
      expect(ACCESSOR_SYNTAX_VECTORS.length).toBeGreaterThan(0);
    });

    it('the accessor-slot set is NOT entirely rejections — that is its point', () => {
      const admitted = ACCESSOR_SLOT_VECTORS.filter(([kind]) => kind !== NOT_CONCISE);

      expect(admitted.length).toBeGreaterThan(0);
    });
  });

  for (const [setName, rows] of VECTOR_SETS) {
    describe(setName, () => {
      for (const [kind, description, source] of rows) {
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
    });
  }

  describe('the entrance-level [concise/X2]', () => {
    it('an omitted argument is refused by all five', () => {
      for (const [name, predicate] of Object.entries(predicates)) {
        expect(predicate(), name).toBe(false);
      }
    });
  });

  describe('grammar bounds — the illegal headers [concise/G1..G3]', () => {
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
