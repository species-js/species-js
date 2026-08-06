// @ts-check

/**
 * @module test/utility/throw-safety
 *
 * Axis 5 — the universal throw-safety invariant and its completeness oracle.
 * The module marks four exports `@@throw-safe` (ADRs #073/#076): each must
 * answer on EVERY hostile input of its declared type and never propagate a
 * throw.
 *
 * This suite triple-locks the oracle:
 *
 * 1. the `@@throw-safe` markers parsed out of BOTH `src/utility/index.js` and
 *    `src/utility/index.d.ts` === the canonical {@link THROW_SAFE_MARKED} list
 *    (catches SOURCE drift — a marker added or removed in either dialect
 *    without updating the oracle, and any drift BETWEEN the two files, which
 *    the spec's axis-5 table asserts as parity);
 * 2. the imported set scored below === {@link THROW_SAFE_MARKED} (catches TEST
 *    drift — a marked export left unscored);
 * 3. every marked export × every hostile row returns without throwing.
 *
 * Hostile values are of each export's DECLARED parameter type — hostile strings
 * for the `string | undefined` parameter, hostile CALLABLES for the `Callable` /
 * `VerifiedFunction` ones. The marker promises no throw within the declared
 * type; feeding arbitrary junk would test a contract the module never made, and
 * the compiler already forbids it at every real call site (`BOUND.spec.md` →
 * the marker's contract).
 *
 * Verdicts are pinned by `spec.test.js`. This suite asserts only what must hold
 * for every cell: the call returns rather than throws, and its result is within
 * the declared return type.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06) —
 * `## Throw-safety (axis 5) — completeness oracle`.
 */

import { describe, it, expect } from 'vitest';

import {
  doesMatchProxyConstructor,
  getCondensedFunctionSource,
  getFunctionSourceCondensate,
  hasProxyConstructorShape,
} from '#utility';

import { parseMarkedExports } from '../_marked-exports.js';

import { hostileCallables, hostileSources, THROW_SAFE_MARKED } from './__config.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */
/** @typedef {import('@species-js/type-detection').VerifiedFunction} VerifiedFunction */

/** @type {Record<string, (value: never) => unknown>} */
const markedCallableTaking = {
  doesMatchProxyConstructor,
  getCondensedFunctionSource,
  hasProxyConstructorShape,
};

const scored = [
  ...Object.keys(markedCallableTaking),
  'getFunctionSourceCondensate',
].sort();

describe('utility — throw-safety (axis 5)', () => {
  describe('completeness oracle', () => {
    it('the markers in src/utility/index.js === the four-name oracle', () => {
      expect(parseMarkedExports('utility/index.js')).toEqual(
        [...THROW_SAFE_MARKED].sort(),
      );
    });

    it('the markers in src/utility/index.d.ts === the four-name oracle', () => {
      expect(parseMarkedExports('utility/index.d.ts')).toEqual(
        [...THROW_SAFE_MARKED].sort(),
      );
    });

    it('the two dialects mark the same set — the spec asserts parity', () => {
      expect(parseMarkedExports('utility/index.js')).toEqual(
        parseMarkedExports('utility/index.d.ts'),
      );
    });

    it('the set scored by this suite === the oracle', () => {
      expect(scored).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the oracle is non-empty and free of duplicates', () => {
      expect(THROW_SAFE_MARKED.length).toBeGreaterThan(0);
      expect([...new Set(THROW_SAFE_MARKED)]).toHaveLength(THROW_SAFE_MARKED.length);
    });
  });

  describe('getFunctionSourceCondensate × hostile strings', () => {
    for (const [name, make] of Object.entries(hostileSources)) {
      it(`${name} — returns within the declared type, never throws`, () => {
        const source = make();
        /** @type {string | undefined} */
        let result;

        expect(() => {
          result = getFunctionSourceCondensate(source);
        }).not.toThrow();

        expect(result === undefined || typeof result === 'string').toBe(true);
      });
    }
  });

  describe('the callable-taking exports × hostile callables', () => {
    for (const [exportName, marked] of Object.entries(markedCallableTaking)) {
      describe(exportName, () => {
        for (const [name, make] of Object.entries(hostileCallables)) {
          it(`${name} — returns, never throws`, () => {
            const value = /** @type {never} */ (make());

            expect(() => marked(value)).not.toThrow();
          });
        }
      });
    }
  });

  it('every marked export is exercised against every hostile row', () => {
    const callableRows = Object.keys(hostileCallables).length;
    const stringRows = Object.keys(hostileSources).length;

    expect(callableRows).toBeGreaterThan(0);
    expect(stringRows).toBeGreaterThan(0);
    expect(Object.keys(markedCallableTaking)).toHaveLength(THROW_SAFE_MARKED.length - 1);
  });
});
