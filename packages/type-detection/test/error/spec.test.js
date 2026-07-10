// @ts-check

/**
 * @module test/error/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the `specMatrix` from
 * `__config.js`: every clean candidate scored against all four public predicates
 * (`isGenericError`, `isDOMException`, `isError`, `isAbortError`), plus the
 * cross-cutting rejection inputs. A completeness guard fails if any matrix row
 * omits a predicate column, so no assertion can silently go missing. If a test
 * here fails, the implementation is wrong, not the test.
 *
 * The matrix also pins the load-bearing partition invariant per row:
 * `isError ≡ isGenericError ⊎ isDOMException` (disjoint cover) and
 * `isAbortError ⊆ isError`.
 *
 * Grafts / spoofs / the Chrome stand-in live in `adversarial.test.js`;
 * foreign-realm in `cross-realm.test.js`; the hostile-input throw-safety matrix
 * in `throw-safety.test.js`; the `@internal` helpers in `_internal/helpers.test.js`.
 *
 * Mirrors `docs/spec/ERROR.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import { isGenericError, isDOMException, isError, isAbortError } from '@/index.js';

import { specMatrix, crossCuttingRejections } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { isGenericError, isDOMException, isError, isAbortError };
const predicateNames = Object.keys(predicates).sort();

describe('error — spec/contract matrix', () => {
  it('completeness: every matrix row scores every predicate', () => {
    for (const [key, row] of Object.entries(specMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(predicateNames);
    }
  });

  for (const [key, { description, make, expected, vectors }] of Object.entries(
    specMatrix,
  )) {
    describe(`${key} — ${description}`, () => {
      for (const [predName, want] of Object.entries(expected)) {
        it(`${predName} → ${String(want)}  [${vectors.join(', ')}]`, () => {
          const predicate = predicates[predName];
          if (!predicate) {
            throw new Error(`no predicate "${predName}"`);
          }
          expect(predicate(make())).toBe(want);
        });
      }

      // per-row partition invariant: isError is exactly the disjoint union of the
      // two arms, and isAbortError implies isError.
      it('partition: isError === isGenericError ⊎ isDOMException; isAbortError ⊆ isError', () => {
        const v = make();
        const gen = isGenericError(v);
        const dom = isDOMException(v);
        const err = isError(v);
        expect(gen && dom, 'disjoint').toBe(false);
        expect(err, 'cover').toBe(gen || dom);
        if (isAbortError(v)) {
          expect(err, 'abort ⊆ error').toBe(true);
        }
      });
    });
  }

  describe('cross-cutting rejections (all four predicates → false)', () => {
    for (const [group, inputs] of Object.entries(crossCuttingRejections)) {
      it(`CC/${group}`, () => {
        for (const input of inputs) {
          for (const [predName, predicate] of Object.entries(predicates)) {
            expect(predicate(input), `${predName}(${String(input)})`).toBe(false);
          }
        }
      });
    }
    it('CC/omitted-argument → false', () => {
      expect(isGenericError(), 'isGenericError').toBe(false);
      expect(isDOMException(), 'isDOMException').toBe(false);
      expect(isError(), 'isError').toBe(false);
      expect(isAbortError(), 'isAbortError').toBe(false);
    });
  });
});
