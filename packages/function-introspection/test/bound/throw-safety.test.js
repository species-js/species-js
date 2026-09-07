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
 * Four of the five marked exports take `unknown`, so every hostile value is in
 * contract and the marker's promise covers all of them. The fifth declares a
 * `string` and is scored against a string-only hostile set: the marker promises
 * totality within the DECLARED parameter type, so feeding it a non-string would
 * test nothing about the marker and report a defect that is not one
 * (BOUND.spec.md → Resolved item 1).
 *
 * Two of the four are the engine-specific implementations behind
 * {@link doesStronglyIndicateBoundFunction}. On any single engine that binding
 * IS one of them, so one implementation is exercised twice and the other only
 * here — which is the point: the reading this engine did not select still has
 * to be total, because another engine selects it.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06 · AMENDED 2026-08-07) —
 * `## Throw-safety (axis 5) — completeness oracle`.
 */

import { describe, it, expect } from 'vitest';

import {
  createExpectedJSCSpecificFunctionSourceFromBoundName,
  doesIndicateBoundFunction,
  doesStronglyIndicateBoundFunction,
  doesStronglyIndicateNonJSCBoundFunction,
  doesStronglyIndicateJSCSpecificBoundFunction,
} from '#index';

import { parseMarkedExports } from '../_marked-exports.js';

import {
  crossCuttingRejections,
  narrowedStringHostiles,
  THROW_SAFE_MARKED,
  throwSafetyMatrix,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const marked = {
  doesIndicateBoundFunction,
  doesStronglyIndicateBoundFunction,
  doesStronglyIndicateNonJSCBoundFunction,
  doesStronglyIndicateJSCSpecificBoundFunction,
};

/** @type {Record<string, (boundName: string) => string>} */
const markedNarrowed = { createExpectedJSCSpecificFunctionSourceFromBoundName };

const scored = [...Object.keys(marked), ...Object.keys(markedNarrowed)].sort();

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

  describe('the narrowed-parameter export × every hostile string returns', () => {
    for (const [exportName, assemble] of Object.entries(markedNarrowed)) {
      describe(exportName, () => {
        for (const [rowName, make] of Object.entries(narrowedStringHostiles)) {
          it(`${rowName} — a hostile value of the declared type`, () => {
            /** @type {string | undefined} */
            let result;

            expect(() => {
              result = assemble(make());
            }).not.toThrow();

            expect(typeof result).toBe('string');
          });
        }

        // The positive control. Every row above asserts only "a string came
        // back", which a function stubbed to return `''` would satisfy — so one
        // row pins the actual assembly against a name the engine really renders.
        it('a well-formed bound name assembles the engine form', () => {
          expect(assemble('bound plain')).toBe('function plain(){[native code]}');
        });
      });
    }
  });
});
