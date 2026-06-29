// @ts-check

/**
 * @module test/object/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the `specMatrix` from
 * `__config.js`: every clean candidate scored against all four predicates
 * (`isObject`, `isPlainObject`, `isDictionaryObject`,
 * `isPlainOrDictionaryObject`), plus the cross-cutting rejection inputs. A
 * completeness guard fails if any matrix row omits a predicate column, so no
 * assertion can silently go missing. If a test here fails, the implementation
 * is wrong, not the test.
 *
 * Spoof / tampered-constructor / accessor boundaries live in
 * `adversarial.test.js`; foreign-realm in `cross-realm.test.js`; the `@internal`
 * helpers in `_internal/helpers.test.js`.
 *
 * Mirrors `docs/spec/OBJECT.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
} from '@/index.js';

import { specMatrix, crossCuttingRejections } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
};
const predicateNames = Object.keys(predicates).sort();

describe('object — spec/contract matrix', () => {
  it('completeness: every matrix row scores every predicate', () => {
    for (const [key, row] of Object.entries(specMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(predicateNames);
    }
  });

  for (const [key, { description, make, expected, vectors }] of Object.entries(
    specMatrix,
  )) {
    describe(`${description} (${key})`, () => {
      for (const [predName, want] of Object.entries(expected)) {
        const vectorId = vectors.find((v) => v.startsWith(`${predName}/`)) ?? key;
        it(`${predName} → ${String(want)} [${vectorId}]`, () => {
          const predicate = predicates[predName];
          if (!predicate) {
            throw new Error(`no predicate "${predName}"`);
          }
          expect(predicate(make())).toBe(want);
        });
      }
    });
  }

  describe('cross-cutting rejections — all four predicates → false (incl. isObject/R1)', () => {
    for (const [group, values] of Object.entries(crossCuttingRejections)) {
      it(`CC/${group}`, () => {
        for (const value of values) {
          for (const predName of predicateNames) {
            const predicate = predicates[predName];
            if (!predicate) {
              throw new Error(`no predicate "${predName}"`);
            }
            expect(predicate(value), `${predName}(${String(value)})`).toBe(false);
          }
        }
      });
    }

    it('omitted argument → false', () => {
      expect(isObject()).toBe(false);
      expect(isPlainObject()).toBe(false);
      expect(isDictionaryObject()).toBe(false);
      expect(isPlainOrDictionaryObject()).toBe(false);
    });
  });
});
