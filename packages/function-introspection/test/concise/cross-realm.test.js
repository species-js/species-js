// @ts-check

/**
 * @module test/concise/cross-realm
 *
 * Axis 2 — the same questions asked of values built in a foreign realm.
 *
 * The module claims no realm-fixed identity is consulted: classification rests
 * on `[[SourceText]]`, the spec-defined tags and an own-`prototype` read, all of
 * which travel across a realm boundary. A predicate reaching for
 * `instanceof Function` or for this realm's `GeneratorFunction` would pass every
 * same-realm vector and fail here.
 *
 * The first block is the one that matters most, and it is not about methods: it
 * proves the boundary is REAL. `foreignRealmEval` returning same-realm values
 * would make everything below true for the wrong reason — the classic vacuous
 * cross-realm suite.
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
  FOREIGN_CONCISE_VECTORS,
  materializeForeign,
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

describe('concise — cross-realm', () => {
  describe('the realm boundary is real', () => {
    it('a foreign method is not an instance of this realm intrinsics', () => {
      const foreign = materializeForeign('({ foo() {} }).foo');

      expect(typeof foreign).toBe('function');
      expect(foreign instanceof Function).toBe(false);
      expect(Object.getPrototypeOf(foreign)).not.toBe(Function.prototype);
    });

    it('a foreign generator method carries a foreign prototype chain too', () => {
      const foreign = materializeForeign('({ *foo() {} }).foo');
      const local = function* () {
        yield 1;
      };

      expect(Object.getPrototypeOf(foreign)).not.toBe(Object.getPrototypeOf(local));
    });

    it('the corpus actually exercises the boundary', () => {
      expect(FOREIGN_CONCISE_VECTORS.length).toBeGreaterThan(0);
    });
  });

  for (const [kind, description, source] of FOREIGN_CONCISE_VECTORS) {
    const expected = EXPECTATIONS[kind];

    describe(`${description} → ${kind}`, () => {
      for (const predicateName of predicateNames) {
        const want = expected?.[predicateName];

        it(`${predicateName} → ${String(want)}`, () => {
          const predicate = predicates[predicateName];
          if (!predicate || want === undefined) {
            throw new Error(`no predicate/expectation for "${predicateName}"`);
          }
          expect(predicate(materializeForeign(source))).toBe(want);
        });
      }
    });
  }

  describe('the tags survive the boundary', () => {
    it('a foreign generator method is admitted by the generator flavor alone', () => {
      const foreign = materializeForeign('({ *foo() {} }).foo');

      expect(isConciseGeneratorMethod(foreign)).toBe(true);
      expect(isPlainConciseMethod(foreign)).toBe(false);
      expect(isAnyConciseMethod(foreign)).toBe(true);
    });

    it('a foreign async generator method is not mistaken for either half', () => {
      const foreign = materializeForeign('({ async *foo() {} }).foo');

      expect(isConciseAsyncGeneratorMethod(foreign)).toBe(true);
      expect(isConciseAsyncMethod(foreign)).toBe(false);
      expect(isConciseGeneratorMethod(foreign)).toBe(false);
    });

    it('a foreign function expression is still refused', () => {
      const foreign = materializeForeign('(function () {})');

      expect(isAnyConciseMethod(foreign)).toBe(false);
    });
  });
});
