// @ts-check

/**
 * @module test/arrow/throw-safety
 *
 * Axis 5 — the completeness oracle for the `arrow` module's marked set.
 *
 * `invariants.test.js` already asserts no corpus value makes a predicate throw.
 * This suite asserts something a verdict cannot: that the marked set IS the set
 * being exercised. The two oracles are different questions over the same data —
 * one asks "is the answer right", the other "is anything unanswered" — and only
 * the second catches a new `@@throw-safe` export arriving with no vectors behind
 * it.
 *
 * The lock has three legs:
 *
 * 1. the markers parsed out of BOTH `src/arrow.js` and `src/arrow.d.ts` ===
 *    the canonical {@link THROW_SAFE_MARKED} list (source drift in either
 *    dialect, and any drift between them);
 * 2. the set scored below === {@link THROW_SAFE_MARKED} (test drift);
 * 3. every marked export × every hostile row returns without throwing.
 *
 * **Hostile values are fed BY DECLARED PARAMETER TYPE.** The three predicates
 * take `unknown`, so every value is in contract. The two helpers take `string`,
 * so their hostile set is hostile STRINGS — feeding one a number would exercise
 * a contract the module never made and report a defect that is not one.
 *
 * Mirrors `docs/spec/ARROW.spec.md` (FROZEN 2026-08-11) —
 * `## Throw-safety (axis 5) — completeness oracle`.
 */

import { describe, it, expect } from 'vitest';

import {
  isArrowFunction,
  isAsyncArrowFunction,
  isAnyArrowFunction,
  matchesStartSequencesOfArrowFunctionSource,
  matchesStartSequencesOfAsyncArrowFunctionSource,
} from '#index';

import { parseMarkedExports } from '../_marked-exports.js';

import { THROW_SAFE_MARKED, hostileCallables, hostileSources } from './__config.js';

/** The `unknown`-taking half of the marked set. */
const markedPredicates = { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction };

/** The `string`-taking half. */
const markedHelpers = {
  matchesStartSequencesOfArrowFunctionSource,
  matchesStartSequencesOfAsyncArrowFunctionSource,
};

const scored = [...Object.keys(markedPredicates), ...Object.keys(markedHelpers)].sort();

/**
 * Values outside every accept set, in contract for an `unknown` parameter.
 *
 * @type {Record<string, () => unknown>}
 */
const nonCallables = {
  undefined: () => undefined,
  null: () => null,
  number: () => 42,
  string: () => '(a) => a',
  object: () => ({}),
  array: () => [],
  symbol: () => Symbol('s'),
  bigint: () => 0n,
  boolean: () => true,
  nullPrototypeObject: () => /** @type {unknown} */ (Object.create(null)),
};

describe('arrow — throw-safety (axis 5)', () => {
  describe('completeness oracle', () => {
    it('the markers in src/arrow.js === the declared oracle', () => {
      expect(parseMarkedExports('arrow.js')).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the markers in src/arrow.d.ts === the declared oracle', () => {
      expect(parseMarkedExports('arrow.d.ts')).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the two dialects mark the same set — the spec asserts parity', () => {
      expect(parseMarkedExports('arrow.js')).toEqual(parseMarkedExports('arrow.d.ts'));
    });

    it('the set scored by this suite === the oracle', () => {
      expect(scored).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the oracle is non-empty and free of duplicates', () => {
      expect(THROW_SAFE_MARKED.length).toBeGreaterThan(0);
      expect([...new Set(THROW_SAFE_MARKED)]).toHaveLength(THROW_SAFE_MARKED.length);
    });

    it('both hostile sets are non-empty, so no export is scored vacuously', () => {
      expect(Object.keys(hostileCallables).length).toBeGreaterThan(0);
      expect(Object.keys(hostileSources).length).toBeGreaterThan(0);
      expect(Object.keys(nonCallables).length).toBeGreaterThan(0);
    });
  });

  describe('the `unknown`-taking predicates × every hostile value', () => {
    for (const [exportName, predicate] of Object.entries(markedPredicates)) {
      describe(exportName, () => {
        for (const [rowName, make] of Object.entries(hostileCallables)) {
          it(`${rowName} — a hostile callable`, () => {
            /** @type {boolean | undefined} */
            let result;

            expect(() => {
              result = predicate(make());
            }).not.toThrow();

            expect(typeof result).toBe('boolean');
          });
        }

        for (const [rowName, make] of Object.entries(nonCallables)) {
          it(`${rowName} — outside the accept set`, () => {
            /** @type {boolean | undefined} */
            let result;

            expect(() => {
              result = predicate(make());
            }).not.toThrow();

            expect(result).toBe(false);
          });
        }

        it('the omitted argument', () => {
          expect(() => predicate()).not.toThrow();
        });
      });
    }
  });

  describe('the `string`-taking helpers × every hostile source', () => {
    for (const [exportName, helper] of Object.entries(markedHelpers)) {
      describe(exportName, () => {
        for (const [rowName, make] of Object.entries(hostileSources)) {
          it(`${rowName} — a hostile string`, () => {
            /** @type {boolean | undefined} */
            let result;

            expect(() => {
              result = helper(make());
            }).not.toThrow();

            expect(typeof result).toBe('boolean');
          });
        }
      });
    }
  });
});
