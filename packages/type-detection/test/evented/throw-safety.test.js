// @ts-check

/**
 * @module test/evented/throw-safety
 *
 * Axis 3 + Axis 5 — the universal throw-safety invariant and its completeness
 * oracle.
 *
 * ## Axis 3 — `hostile-input-class × predicate` matrix
 *
 * Every public predicate must answer a boolean on EVERY hostile input and never
 * propagate a throw (`docs/spec/README.md` → "Throw-safety — the universal
 * invariant"). Each cell asserts BOTH that the call does not throw AND the honest
 * by-contract verdict — including the ASYMMETRIC `aborted-getter-throw` row, where
 * `isEventTargetLike` admits (it never reads `aborted`) while the AbortSignal tier
 * rejects. A completeness guard fails if any hostile row omits a predicate column.
 *
 * evented's hostile set is re-derived from its own read surface — the `instanceof`
 * prototype-walk (`isCurrentRealm*Instance`), the strict-tier `getSafePrototypeOf`
 * resolve, the constructor-walk descriptor reads, and — AbortSignal-only — the
 * `aborted` getter.
 *
 * ## Axis 5 — completeness oracle over the `@@throw-safe` markers
 *
 * The module marks 18 exports `@@throw-safe` (ADRs #073/#076; EVENTED.spec.md
 * `## Throw-safety (axis 5)`) — the entire public + `@internal` surface (4 public
 * predicates + 14 helpers, seven per family). This suite triple-locks that oracle:
 *   1. the `@@throw-safe` markers parsed out of `src/evented.js` === the canonical
 *      {@link THROW_SAFE_MARKED} list (catches SOURCE drift);
 *   2. the imported evented set scored below === {@link THROW_SAFE_MARKED}
 *      (catches TEST drift);
 *   3. every marked export × every hostile-trap row returns without throwing.
 *
 * Several helpers gate on a threaded argument (`has*IdentitySignal` on a matching
 * `name`; `is*PrototypeEquivalent` on an `isClass` constructor; the AbortSignal
 * prototype contract on a receiver), so a naive single-value call would
 * short-circuit before the hostile value reached the throwing read. Each probe
 * therefore routes the hostile value into the argument position that triggers that
 * export's characteristic read (`getTypeSignature`, `getSafePrototypeOf`, the
 * constructor walk, the member-surface `getOwnPropertyDescriptors`, the `aborted`
 * getter), so non-propagation is genuinely exercised. The verdicts are non-uniform
 * across the 18 heterogeneous exports, so axis 5 pins only the invariant that holds
 * for every cell — the call does not throw; the honest verdicts stay pinned in the
 * axis-3 matrix and `_internal/helpers.test.js` (`dIETPC/R2`, `dIASPC/R4`).
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
  isCurrentRealmEventTargetInstance,
  hasEventTargetIdentitySignal,
  doesNotShadowEventTargetContract,
  doesImplementEventTargetContract,
  doesImplementEventTargetPrototypeContract,
  isEventTargetPrototypeEquivalent,
  isAlienRealmEventTarget,
  isCurrentRealmAbortSignalInstance,
  hasAbortSignalIdentitySignal,
  doesNotShadowAbortSignalContract,
  doesImplementAbortSignalContract,
  doesImplementAbortSignalPrototypeContract,
  isAbortSignalPrototypeEquivalent,
  isAlienRealmAbortSignal,
} from '#index';

import { throwSafetyMatrix, THROW_SAFE_MARKED } from './__config.js';

/** @typedef {import('#function').NewableFunction} NewableFunction */

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
};
const predicateNames = Object.keys(predicates).sort();

const markedSorted = [...THROW_SAFE_MARKED].sort();

/** The `@@throw-safe`-marked export names parsed straight out of the source. */
function markedNamesFromSource() {
  const source = readFileSync(new URL('../../src/evented.js', import.meta.url), 'utf8');
  // each marker sits directly above its export; the lazy gap stops at the first
  // `export function` that follows, so marker ↔ export pairs one-to-one.
  return [...source.matchAll(/@@throw-safe[\s\S]*?export function (\w+)/g)].map(
    (match) => match[1],
  );
}

// Per-export probes: route the hostile value into the argument slot that fires the
// export's characteristic read, so non-propagation is exercised, not short-circuited.
// `EventTarget` / `AbortSignal` are genuine newables so the `is*PrototypeEquivalent`
// `isClass` markers pass and the hostile prototype/member reads fire; the matching
// `name` makes the identity signal reach `getTypeSignature`; `(h, h)` feeds the alien
// seams a hostile value AND prototype (and the AbortSignal prototype contract a hostile
// receiver).
/** @type {Record<string, (value?: unknown) => unknown>} */
const markedProbes = {
  isCurrentRealmEventTargetInstance: (h) => isCurrentRealmEventTargetInstance(h),
  hasEventTargetIdentitySignal: (h) =>
    hasEventTargetIdentitySignal(/** @type {object} */ (h), 'EventTarget'),
  doesNotShadowEventTargetContract: (h) =>
    doesNotShadowEventTargetContract(/** @type {object} */ (h)),
  doesImplementEventTargetContract: (h) => doesImplementEventTargetContract(h),
  doesImplementEventTargetPrototypeContract: (h) =>
    doesImplementEventTargetPrototypeContract(/** @type {object} */ (h)),
  isEventTargetPrototypeEquivalent: (h) =>
    isEventTargetPrototypeEquivalent(
      /** @type {object} */ (h),
      /** @type {NewableFunction} */ (/** @type {unknown} */ (EventTarget)),
    ),
  isAlienRealmEventTarget: (h) =>
    isAlienRealmEventTarget(/** @type {object} */ (h), /** @type {object} */ (h)),
  isEventTargetLike: (h) => isEventTargetLike(h),
  isEventTarget: (h) => isEventTarget(h),
  isCurrentRealmAbortSignalInstance: (h) => isCurrentRealmAbortSignalInstance(h),
  hasAbortSignalIdentitySignal: (h) =>
    hasAbortSignalIdentitySignal(/** @type {object} */ (h), 'AbortSignal'),
  doesNotShadowAbortSignalContract: (h) =>
    doesNotShadowAbortSignalContract(/** @type {object} */ (h)),
  doesImplementAbortSignalContract: (h) => doesImplementAbortSignalContract(h),
  doesImplementAbortSignalPrototypeContract: (h) =>
    doesImplementAbortSignalPrototypeContract(
      /** @type {object} */ (h),
      /** @type {object} */ (h),
    ),
  isAbortSignalPrototypeEquivalent: (h) =>
    isAbortSignalPrototypeEquivalent(
      /** @type {object} */ (h),
      /** @type {NewableFunction} */ (/** @type {unknown} */ (AbortSignal)),
      /** @type {object} */ (h),
    ),
  isAlienRealmAbortSignal: (h) =>
    isAlienRealmAbortSignal(/** @type {object} */ (h), /** @type {object} */ (h)),
  isAbortSignalLike: (h) => isAbortSignalLike(h),
  isAbortSignal: (h) => isAbortSignal(h),
};

describe('evented — throw-safety invariant (axis 3, hostile × predicate matrix)', () => {
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

describe('evented — throw-safety completeness oracle (axis 5, hostile × marked-export)', () => {
  it('completeness (source): the `@@throw-safe` markers in src/evented.js === the 18-name oracle', () => {
    expect(markedNamesFromSource().sort()).toEqual(markedSorted);
  });

  it('completeness (test): the scored marked-export set === the 18-name oracle', () => {
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
          // the 18 exports, so its VALUE is not pinned here — only non-propagation.
          expect(() => probe(make()), `${name} threw`).not.toThrow();
        });
      }
    });
  }
});
