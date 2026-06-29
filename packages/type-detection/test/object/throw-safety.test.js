// @ts-check

/**
 * @module test/object/throw-safety
 *
 * Axis 3 — the universal throw-safety invariant, matrix-driven. Every public
 * predicate must answer a boolean on EVERY hostile input and never propagate a
 * throw (`docs/spec/README.md` → "Throw-safety — the universal invariant"; the
 * OBJECT.spec.md Module-contract _Throw-safety_ paragraph). Each cell of the
 * `hostile-input-class × predicate` matrix asserts BOTH that the call does not
 * throw AND the honest by-contract verdict. The invariant is met for the module
 * ⟺ every cell is filled — a completeness guard fails if any hostile row omits a
 * predicate column, so no cell can silently go missing.
 *
 * This replaces the former scattered per-input throw-safety boundary vectors
 * (the old `isPlainObject/B1`–`B3`, `isDictionaryObject/B1`,
 * `isPlainOrDictionaryObject/B1` IDs), now withdrawn in the spec in favor of this
 * single completeness-guarded matrix. The member-surface `ownKeys`-trap stays a
 * HELPER-level boundary (`dIOPC/B1`, in `_internal/helpers.test.js`) — like
 * thenable's `hPIS/B1` — because the predicate path fails marker 1 before the
 * member-surface marker 6 ever runs.
 */

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
} from '@/index.js';

import { throwSafetyMatrix } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
};
const predicateNames = Object.keys(predicates).sort();

describe('object — throw-safety invariant (hostile × predicate matrix)', () => {
  it('completeness: every hostile row scores every predicate', () => {
    for (const [key, row] of Object.entries(throwSafetyMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(predicateNames);
    }
  });

  for (const [, { surface, make, expected }] of Object.entries(throwSafetyMatrix)) {
    describe(surface, () => {
      for (const [predName, want] of Object.entries(expected)) {
        it(`${predName} → ${String(want)}, not thrown`, () => {
          const predicate = predicates[predName];
          if (!predicate) {
            throw new Error(`no predicate "${predName}"`);
          }
          // asserting the boolean IS the throw-safety proof: a propagated throw
          // surfaces here as a test error, not a `false`.
          let verdict;
          expect(() => {
            verdict = predicate(make());
          }, `${predName} threw`).not.toThrow();
          expect(verdict, `${predName} verdict`).toBe(want);
        });
      }
    });
  }
});
