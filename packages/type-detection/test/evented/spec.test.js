// @ts-check

/**
 * @module test/evented/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the `specMatrix` from
 * `__config.js`: every clean candidate scored against all four public predicates
 * (`isEventTargetLike`, `isEventTarget`, `isAbortSignalLike`, `isAbortSignal`),
 * plus the cross-cutting rejection inputs. A completeness guard fails if any
 * matrix row omits a predicate column, so no assertion can silently go missing.
 * If a test here fails, the implementation is wrong, not the test.
 *
 * Tag-spoof / `when`-bearing boundaries live in `adversarial.test.js`;
 * foreign-realm in `cross-realm.test.js`; the hostile-input throw-safety matrix
 * in `throw-safety.test.js`; the `@internal` helpers in `_internal/helpers.test.js`.
 *
 * Mirrors `docs/spec/EVENTED.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
} from '@/index.js';

import { specMatrix, crossCuttingRejections } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
};
const predicateNames = Object.keys(predicates).sort();

describe('evented — spec/contract matrix', () => {
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

  describe('cross-cutting rejections — all four predicates → false', () => {
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
      expect(isEventTargetLike()).toBe(false);
      expect(isEventTarget()).toBe(false);
      expect(isAbortSignalLike()).toBe(false);
      expect(isAbortSignal()).toBe(false);
    });
  });
});
