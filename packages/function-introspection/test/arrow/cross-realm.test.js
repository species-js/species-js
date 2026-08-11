// @ts-check

/**
 * @module test/arrow/cross-realm
 *
 * Axis 2 — the same questions asked of values built in a foreign realm, whose
 * intrinsics this realm never captured.
 *
 * The module claims no realm-fixed identity is consulted: classification rests
 * on `[[SourceText]]` and the spec-defined async tag, both of which travel
 * across a realm boundary. A predicate that reached for `instanceof Function`
 * or for this realm's `Function.prototype` would pass every same-realm vector
 * and fail here.
 *
 * The first test is the one that matters most, and it is not about arrows: it
 * proves the realm boundary is REAL. `foreignRealmEval` returning same-realm
 * values would make every assertion below true for the wrong reason — the
 * classic vacuous cross-realm suite.
 *
 * Mirrors `docs/spec/ARROW.spec.md` (FROZEN 2026-08-11) — the `iAF/A8`,
 * `iAF/R14` and `iAAF/A8` vectors.
 */

import { describe, it, expect } from 'vitest';

import { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction } from '#index';

import {
  ARROW,
  ASYNC_ARROW,
  NOT_ARROW,
  FOREIGN_ARROW_VECTORS,
  materializeForeign,
} from './__config.js';

/** @type {Record<string, Record<string, boolean>>} */
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

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction };

describe('arrow — cross-realm', () => {
  describe('the realm boundary is real', () => {
    it('a foreign arrow is not an instance of this realm intrinsics', () => {
      const foreign = materializeForeign('(a) => a');

      expect(typeof foreign).toBe('function');
      expect(foreign instanceof Function).toBe(false);
      expect(Object.getPrototypeOf(foreign)).not.toBe(Function.prototype);
    });

    it('a foreign async arrow carries a foreign constructor too', () => {
      const foreign = /** @type {{ constructor: unknown }} */ (
        materializeForeign('async (a) => a')
      );

      expect(foreign.constructor).not.toBe(Function);
    });

    it('the corpus actually exercises the boundary', () => {
      expect(FOREIGN_ARROW_VECTORS.length).toBeGreaterThan(0);
    });
  });

  for (const [kind, description, source] of FOREIGN_ARROW_VECTORS) {
    const expected = EXPECTATIONS[kind];

    describe(`${description} → ${kind}`, () => {
      for (const [predicateName, predicate] of Object.entries(predicates)) {
        const want = expected?.[predicateName];

        it(`${predicateName} → ${String(want)}`, () => {
          if (want === undefined) {
            throw new Error(`no expectation for "${predicateName}"`);
          }
          expect(predicate(materializeForeign(source))).toBe(want);
        });
      }
    });
  }

  describe('the async tag survives the boundary', () => {
    it('a foreign async arrow is admitted only by the async flavor', () => {
      const foreign = materializeForeign('async (a) => a');

      expect(isAsyncArrowFunction(foreign)).toBe(true);
      expect(isArrowFunction(foreign)).toBe(false);
      expect(isAnyArrowFunction(foreign)).toBe(true);
    });

    it('a foreign method named `async` is still refused — the collision holds across realms', () => {
      const foreign = materializeForeign('({ async() {} }).async');

      expect(isAsyncArrowFunction(foreign)).toBe(false);
      expect(isAnyArrowFunction(foreign)).toBe(false);
    });
  });
});
