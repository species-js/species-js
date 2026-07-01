// @ts-check

/**
 * @module test/evented/throw-safety
 *
 * Axis 3 — the universal throw-safety invariant, matrix-driven. Every public
 * predicate must answer a boolean on EVERY hostile input and never propagate a
 * throw (`docs/spec/README.md` → "Throw-safety — the universal invariant"). Each
 * cell of the `hostile-input-class × predicate` matrix asserts BOTH that the call
 * does not throw AND the honest by-contract verdict. The invariant is met for the
 * module ⟺ every cell is filled — a completeness guard fails if any hostile row
 * omits a predicate column, so no cell can silently go missing.
 *
 * evented's hostile set is re-derived from its own read surface (it differs from
 * object's — evented reaches the `instanceof` prototype-walk, the strict-tier
 * `getInertPrototypeOf` resolve, the constructor-walk descriptor reads, and —
 * AbortSignal-only — the `aborted` getter):
 *   - prototype-trap — a `getPrototypeOf` Proxy-trap that throws (hits both the
 *     Like-tier `instanceof` walk and the strict-tier prototype resolve).
 *   - descriptor-trap — a value over a `[[Prototype]]` whose
 *     `getOwnPropertyDescriptor` throws (the constructor-walk / method-walk).
 *   - aborted-getter-throw — a userland EventTarget whose `aborted` getter throws:
 *     the honest ASYMMETRIC row, `isEventTargetLike` admits (true — it never reads
 *     `aborted`) while the AbortSignal tier rejects (false). The invariant is
 *     "never throw", not "always false".
 *
 * The member-surface `ownKeys`-trap stays a HELPER-level boundary (`dIETPC/R2`,
 * `dIASPC/R4`, in `_internal/helpers.test.js`) — the public path fails the tag +
 * constructor-name signal gate before the prototype-contract walk runs.
 */

import { describe, it, expect } from 'vitest';

import {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
} from '@/index.js';

import { throwSafetyMatrix } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
};
const predicateNames = Object.keys(predicates).sort();

describe('evented — throw-safety invariant (hostile × predicate matrix)', () => {
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
