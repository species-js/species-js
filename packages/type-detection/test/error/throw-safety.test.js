// @ts-check

/**
 * @module test/error/throw-safety
 *
 * Axis 3 + Axis 5 — the universal throw-safety invariant and its completeness
 * oracle.
 *
 * ## Axis 3 — `hostile-input-class × predicate` matrix
 *
 * Every public predicate must answer a boolean on EVERY hostile input and never
 * propagate a throw (`docs/spec/README.md` → "Throw-safety — the universal
 * invariant"; the ERROR.spec.md Module-contract _Throw-safety_ paragraph). Each
 * cell asserts BOTH that the call does not throw AND the honest by-contract verdict.
 * A completeness guard fails if any hostile row omits a predicate column.
 *
 * error's hostile set is re-derived from its own read surface: the `instanceof`
 * prototype-walk (`isCurrentRealm*Instance`), the alien-walk `getSafePrototypeOf` +
 * `getInertDescriptor`, the direct `name`/`message` reads
 * (`doesImplementMinimumErrorContract`), the captured stack getter
 * (`retrieveErrorStack`), and — DOMException-only — the inert getter-presence reads.
 *
 * ## Axis 5 — completeness oracle over the `@@throw-safe` markers
 *
 * The module marks 19 exports `@@throw-safe` (ADRs #073/#076; ERROR.spec.md
 * `## Throw-safety (axis 5)`): the 4 public predicates PLUS 15 of the 17 `@internal`
 * helpers (the two load-time value constants `errorStackMode` / `ERROR_STACK_CAPABLE`
 * carry no throw surface). This suite triple-locks that oracle:
 *   1. the `@@throw-safe` markers parsed out of `src/error.js` === the canonical
 *      {@link THROW_SAFE_MARKED} list (catches SOURCE drift) — the parse matches
 *      `export (function|const)`, because `retrieveErrorStack` and `isError` are
 *      `export const` bindings, not `export function`;
 *   2. the imported error set scored below === {@link THROW_SAFE_MARKED}
 *      (catches TEST drift);
 *   3. every marked export × every hostile-trap row returns without throwing.
 *
 * Several helpers gate on a threaded argument (`is*PrototypeEquivalent` on an
 * `isClass` constructor; the DOMException prototype contract on a receiver), so a
 * naive single-value call would short-circuit before the hostile value reached the
 * throwing read. Each probe routes the hostile value into the argument position that
 * triggers that export's characteristic read (`getTypeSignature`, the descriptor
 * walk, the member-surface `getOwnPropertyDescriptors`, the stack getter), so
 * non-propagation is genuinely exercised. The verdicts are non-uniform across the 19
 * heterogeneous exports, so axis 5 pins only the invariant that holds for every cell
 * — the call does not throw; the honest verdicts stay pinned in the axis-3 matrix and
 * `_internal/helpers.test.js`.
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  isGenericError,
  isDOMException,
  isError,
  isAbortError,
  retrieveErrorStack,
  hasReachableErrorStack,
  doesPassErrorGraftFilter,
  doesImplementMinimumErrorContract,
  doesImplementGenericErrorContract,
  doesImplementDOMExceptionContract,
  doesImplementGenericErrorPrototypeContract,
  doesImplementDOMExceptionPrototypeContract,
  isGenericErrorPrototypeEquivalent,
  isDOMExceptionPrototypeEquivalent,
  isAlienRealmGenericError,
  isAlienRealmDOMException,
  isCurrentRealmGenericErrorInstance,
  isCurrentRealmDOMExceptionInstance,
  isAnyError,
} from '#index';

import { throwSafetyMatrix, THROW_SAFE_MARKED } from './__config.js';

/** @typedef {import('#function').NewableFunction} NewableFunction */

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { isGenericError, isDOMException, isError, isAbortError };
const predicateNames = Object.keys(predicates).sort();

const markedSorted = [...THROW_SAFE_MARKED].sort();

/** The `@@throw-safe`-marked export names parsed straight out of the source. */
function markedNamesFromSource() {
  const source = readFileSync(new URL('../../src/error.js', import.meta.url), 'utf8');
  // each marker sits directly above its export; the lazy gap stops at the first
  // `export function` OR `export const` that follows, so marker ↔ export pairs
  // one-to-one (two marked exports — `retrieveErrorStack`, `isError` — are consts).
  return [...source.matchAll(/@@throw-safe[\s\S]*?export (?:function|const) (\w+)/g)].map(
    (match) => match[1],
  );
}

// Per-export probes: route the hostile value into the argument slot that fires the
// export's characteristic read, so non-propagation is exercised, not short-circuited.
// `Error` / `DOMException` are genuine newables so the `is*PrototypeEquivalent`
// `isClass` markers pass and the hostile prototype/member reads fire; `(h, h)` feeds
// the DOMException prototype contract a hostile prototype AND receiver.
/** @type {Record<string, (value?: unknown) => unknown>} */
const markedProbes = {
  retrieveErrorStack: (h) => retrieveErrorStack(/** @type {object} */ (h)),
  hasReachableErrorStack: (h) => hasReachableErrorStack(/** @type {object} */ (h)),
  doesPassErrorGraftFilter: (h) => doesPassErrorGraftFilter(/** @type {object} */ (h)),
  doesImplementMinimumErrorContract: (h) =>
    doesImplementMinimumErrorContract(
      /** @type {{ message?: unknown, name?: unknown }} */ (h),
    ),
  doesImplementGenericErrorContract: (h) =>
    doesImplementGenericErrorContract(/** @type {object} */ (h)),
  doesImplementDOMExceptionContract: (h) =>
    doesImplementDOMExceptionContract(/** @type {object} */ (h)),
  doesImplementGenericErrorPrototypeContract: (h) =>
    doesImplementGenericErrorPrototypeContract(/** @type {object} */ (h)),
  doesImplementDOMExceptionPrototypeContract: (h) =>
    doesImplementDOMExceptionPrototypeContract(
      /** @type {object} */ (h),
      /** @type {object} */ (h),
    ),
  isGenericErrorPrototypeEquivalent: (h) => isGenericErrorPrototypeEquivalent(h, Error),
  isDOMExceptionPrototypeEquivalent: (h) =>
    isDOMExceptionPrototypeEquivalent(
      /** @type {object} */ (h),
      /** @type {NewableFunction} */ (/** @type {unknown} */ (DOMException)),
      /** @type {object} */ (h),
    ),
  isAlienRealmGenericError: (h) => isAlienRealmGenericError(h),
  isAlienRealmDOMException: (h) => isAlienRealmDOMException(h),
  isCurrentRealmGenericErrorInstance: (h) => isCurrentRealmGenericErrorInstance(h),
  isCurrentRealmDOMExceptionInstance: (h) => isCurrentRealmDOMExceptionInstance(h),
  isGenericError: (h) => isGenericError(h),
  isDOMException: (h) => isDOMException(h),
  isAnyError: (h) => isAnyError(h),
  isError: (h) => isError(h),
  isAbortError: (h) => isAbortError(h),
};

describe('error — throw-safety invariant (axis 3, hostile × predicate matrix)', () => {
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

describe('error — throw-safety completeness oracle (axis 5, hostile × marked-export)', () => {
  it('completeness (source): the `@@throw-safe` markers in src/error.js === the 19-name oracle', () => {
    expect(markedNamesFromSource().sort()).toEqual(markedSorted);
  });

  it('completeness (test): the scored marked-export set === the 19-name oracle', () => {
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
          // the 19 exports, so its VALUE is not pinned here — only non-propagation.
          expect(() => probe(make()), `${name} threw`).not.toThrow();
        });
      }
    });
  }
});
