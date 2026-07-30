// @ts-check

/**
 * @module test/thenable/throw-safety
 *
 * Axis 3 + Axis 5 — the universal throw-safety invariant and its completeness
 * oracle.
 *
 * ## Axis 3 — `hostile-input-class × predicate` matrix
 *
 * Every public predicate must answer a boolean on EVERY hostile input and never
 * propagate a throw (`docs/spec/README.md` → "Throw-safety — the universal
 * invariant"; the THENABLE.spec.md Module-contract _Throw-safety_ paragraph). Each
 * cell of the matrix asserts BOTH that the call does not throw AND the honest
 * by-contract verdict (a throwing-tag / pivoted-proto value carrying a real method
 * contract is admitted by `isThenable` / `isPromiseLike`, rejected by `isPromise`).
 * A completeness guard fails if any hostile row omits a predicate column, so no
 * cell can silently go missing. This replaces the former scattered per-input
 * boundary vectors (the old `B4`–`B6` / `B3`–`B5` IDs).
 *
 * ## Axis 5 — completeness oracle over the `@@throw-safe` markers
 *
 * The module marks 10 exports `@@throw-safe` (ADRs #073/#076; THENABLE.spec.md
 * `## Throw-safety (axis 5)`): the 7 `@internal` helpers PLUS the 3 public
 * predicates. This suite triple-locks that oracle:
 *   1. the `@@throw-safe` markers parsed out of `src/thenable.js` === the canonical
 *      {@link THROW_SAFE_MARKED} list (catches SOURCE drift — a marker added or
 *      removed without updating the oracle);
 *   2. the imported thenable set scored below === {@link THROW_SAFE_MARKED}
 *      (catches TEST drift — a marked export left unscored);
 *   3. every marked export × every hostile-trap row returns without throwing.
 *
 * Several helpers gate on their FIRST argument (`hasPromiseIdentitySignal` needs a
 * matching `name`, `isPromisePrototypeEquivalent` an `isClass` constructor), so a
 * naive single-value call would short-circuit before the hostile value reached the
 * throwing read — a trivial pass. Each probe therefore routes the hostile value
 * into the argument position that triggers that export's characteristic read
 * (`getTypeSignature`, the descriptor walk, `getOwnPropertyNames`, `instanceof`),
 * so non-propagation is genuinely exercised, not short-circuited. The verdicts are
 * non-uniform across the 10 heterogeneous exports, so axis 5 pins only the
 * invariant that holds for every cell — the call does not throw; the specific
 * honest verdicts stay pinned in the axis-3 matrix and `_internal/helpers.test.js`.
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  isThenable,
  isPromiseLike,
  isPromise,
  doesNotShadowPromiseContract,
  doesImplementPromiseContract,
  doesImplementPromisePrototypeContract,
  isPromisePrototypeEquivalent,
  hasPromiseIdentitySignal,
  isAlienRealmPromise,
  isCurrentRealmPromiseInstance,
} from '#index';

import { throwSafetyMatrix, THROW_SAFE_MARKED } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { isThenable, isPromiseLike, isPromise };
const predicateNames = Object.keys(predicates).sort();

const markedSorted = [...THROW_SAFE_MARKED].sort();

/** The `@@throw-safe`-marked export names parsed straight out of the source. */
function markedNamesFromSource() {
  const source = readFileSync(new URL('../../src/thenable.js', import.meta.url), 'utf8');
  // each marker sits directly above its export; the lazy gap stops at the first
  // `export function` that follows, so marker ↔ export pairs one-to-one.
  return [...source.matchAll(/@@throw-safe[\s\S]*?export function (\w+)/g)].map(
    (match) => match[1],
  );
}

// Per-export probes: route the hostile value into the argument slot that fires the
// export's characteristic read, so non-propagation is exercised, not short-circuited.
// `Promise` is a genuine newable so `isPromisePrototypeEquivalent`'s `isClass` marker
// passes and the hostile prototype read fires; `'Promise'` makes the identity signal
// reach `getTypeSignature`; `(h, h)` feeds the alien seam a hostile value AND prototype.
/** @type {Record<string, (value?: unknown) => unknown>} */
const markedProbes = {
  doesNotShadowPromiseContract: (h) =>
    doesNotShadowPromiseContract(/** @type {object} */ (h)),
  doesImplementPromiseContract: (h) => doesImplementPromiseContract(h),
  doesImplementPromisePrototypeContract: (h) => doesImplementPromisePrototypeContract(h),
  isPromisePrototypeEquivalent: (h) => isPromisePrototypeEquivalent(h, Promise),
  hasPromiseIdentitySignal: (h) => hasPromiseIdentitySignal(h, 'Promise'),
  isAlienRealmPromise: (h) =>
    isAlienRealmPromise(/** @type {object} */ (h), /** @type {object} */ (h)),
  isCurrentRealmPromiseInstance: (h) => isCurrentRealmPromiseInstance(h),
  isPromiseLike: (h) => isPromiseLike(h),
  isPromise: (h) => isPromise(h),
  isThenable: (h) => isThenable(h),
};

describe('thenable — throw-safety invariant (axis 3, hostile × predicate matrix)', () => {
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

describe('thenable — throw-safety completeness oracle (axis 5, hostile × marked-export)', () => {
  it('completeness (source): the `@@throw-safe` markers in src/thenable.js === the 10-name oracle', () => {
    expect(markedNamesFromSource().sort()).toEqual(markedSorted);
  });

  it('completeness (test): the scored marked-export set === the 10-name oracle', () => {
    expect(Object.keys(markedProbes).sort()).toEqual(markedSorted);
  });

  for (const [, { surface, make }] of Object.entries(throwSafetyMatrix)) {
    describe(surface, () => {
      for (const name of THROW_SAFE_MARKED) {
        it(`${name} → a sentinel, not thrown`, () => {
          const probe = markedProbes[name];
          if (!probe) {
            throw new Error(`no marked export "${name}"`);
          }
          // asserting the probe returns IS the throw-safety proof: a propagated
          // throw surfaces here as a test error. The verdict is non-uniform across
          // the 10 exports, so its VALUE is not pinned here — only non-propagation.
          expect(() => probe(make()), `${name} threw`).not.toThrow();
        });
      }
    });
  }
});
