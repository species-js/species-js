// @ts-check

/**
 * @module test/error/throw-safety
 *
 * Axis 3 — the universal throw-safety invariant, matrix-driven. Every public
 * predicate must answer a boolean on EVERY hostile input and never propagate a
 * throw (`docs/spec/README.md` → "Throw-safety — the universal invariant"; the
 * ERROR.spec.md Module-contract _Throw-safety_ paragraph). Each cell of the
 * `hostile-input-class × predicate` matrix asserts BOTH that the call does not
 * throw AND the honest by-contract verdict. The invariant is met for the module
 * ⟺ every cell is filled — a completeness guard fails if any hostile row omits a
 * predicate column.
 *
 * error's hostile set is re-derived from its own read surface. The PUBLIC-reachable
 * throw-surfaces:
 *   - prototype-trap — a `getPrototypeOf` Proxy-trap that throws (hits both the
 *     `instanceof` walk in isCurrentRealm*Instance and the alien `getInertPrototypeOf`).
 *   - descriptor-trap — a value over a `[[Prototype]]` whose
 *     `getOwnPropertyDescriptor` throws (the alien-walk constructor read + the
 *     DOMException `hasInertGetter` reads).
 *   - accessor-throw — a genuine Error whose own `name` / `message` getter throws:
 *     reaches `doesImplementMinimumErrorContract`'s direct read → try/catch → false.
 *     (error-specific — the analog of evented's aborted-getter-throw.)
 *
 * The `tag-getter-throw` and `ownKeys`-trap classes stay HELPER-level boundaries
 * (`dIGEPC`/`dIDEPC` in `_internal/helpers.test.js`) — the graft-filter /
 * getter-presence gates fail before the walk reaches `getTypeSignature` /
 * `getOwnPropertyDescriptors`.
 */

import { describe, it, expect } from 'vitest';

import { isGenericError, isDOMException, isError, isAbortError } from '@/index.js';

import { throwSafetyMatrix } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { isGenericError, isDOMException, isError, isAbortError };
const predicateNames = Object.keys(predicates).sort();

describe('error — throw-safety invariant (hostile × predicate matrix)', () => {
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
