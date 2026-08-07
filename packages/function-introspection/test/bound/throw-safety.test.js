// @ts-check

/**
 * @module test/bound/throw-safety
 *
 * Axis 5 — the completeness oracle for the `bound` module's marked set.
 *
 * `adversarial.test.js` already drives the hostile matrix and asserts the
 * VERDICT of each cell. This suite asserts something the verdicts cannot: that
 * the marked set is the set actually being exercised. The two oracles are
 * different questions over the same data — one asks "is the answer right", the
 * other "is anything unanswered" — and only the second catches a NEW
 * `@@throw-safe` export arriving with no vectors behind it.
 *
 * The lock has three legs:
 *
 * 1. the markers parsed out of BOTH `src/bound.js` and `src/bound.d.ts` ===
 *    the canonical {@link THROW_SAFE_MARKED} list (source drift in either
 *    dialect, and any drift between them);
 * 2. the set scored below === {@link THROW_SAFE_MARKED} (test drift);
 * 3. every marked export × every hostile row returns without throwing.
 *
 * Both predicates take `unknown`, so every hostile value is in contract and the
 * marker's promise covers all of them.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06 · AMENDED 2026-08-07) —
 * `## Throw-safety (axis 5) — completeness oracle`.
 */

import { describe, it, expect } from 'vitest';

import { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction } from '#index';

import { parseMarkedExports } from '../_marked-exports.js';

import {
  crossCuttingRejections,
  THROW_SAFE_MARKED,
  throwSafetyMatrix,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const marked = { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction };
const scored = Object.keys(marked).sort();

describe('bound — throw-safety (axis 5)', () => {
  describe('completeness oracle', () => {
    it('the markers in src/bound.js === the declared oracle', () => {
      expect(parseMarkedExports('bound.js')).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the markers in src/bound.d.ts === the declared oracle', () => {
      expect(parseMarkedExports('bound.d.ts')).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the two dialects mark the same set — the spec asserts parity', () => {
      expect(parseMarkedExports('bound.js')).toEqual(parseMarkedExports('bound.d.ts'));
    });

    it('the set scored by this suite === the oracle', () => {
      expect(scored).toEqual([...THROW_SAFE_MARKED].sort());
    });

    it('the oracle is non-empty and free of duplicates', () => {
      expect(THROW_SAFE_MARKED.length).toBeGreaterThan(0);
      expect([...new Set(THROW_SAFE_MARKED)]).toHaveLength(THROW_SAFE_MARKED.length);
    });
  });

  describe('every marked export × every hostile row returns', () => {
    for (const [exportName, predicate] of Object.entries(marked)) {
      describe(exportName, () => {
        for (const [rowName, { surface, make }] of Object.entries(throwSafetyMatrix)) {
          it(`${rowName} — ${surface}`, () => {
            /** @type {boolean | undefined} */
            let result;

            expect(() => {
              result = predicate(make());
            }).not.toThrow();

            expect(typeof result).toBe('boolean');
          });
        }

        for (const [rowName, make] of Object.entries(crossCuttingRejections)) {
          it(`${rowName} — an entrance-level value`, () => {
            expect(() => predicate(make())).not.toThrow();
          });
        }

        it('the omitted argument', () => {
          expect(() => predicate()).not.toThrow();
        });
      });
    }
  });
});
