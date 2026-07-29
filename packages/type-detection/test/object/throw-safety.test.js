// @ts-check

/**
 * @module test/object/throw-safety
 *
 * Axis 3 + Axis 5 — the universal throw-safety invariant and its completeness
 * oracle.
 *
 * ## Axis 3 — `hostile-input-class × predicate` matrix
 *
 * Every public predicate must answer a boolean on EVERY hostile input and never
 * propagate a throw (`docs/spec/README.md` → "Throw-safety — the universal
 * invariant"; the OBJECT.spec.md Module-contract _Throw-safety_ paragraph). Each
 * cell asserts BOTH that the call does not throw AND the honest by-contract verdict
 * (the `isObject` floor admits an object-typed hostile `Proxy`; a throwing-tag plain
 * object splits by realm — local fast-path admits, foreign structural arm rejects).
 * A completeness guard fails if any hostile row omits a predicate column. This
 * replaces the former scattered per-input boundary vectors (the old
 * `isPlainObject/B1`–`B3`, `isDictionaryObject/B1`, `isPlainOrDictionaryObject/B1`).
 *
 * ## Axis 5 — completeness oracle over the `@@throw-safe` markers
 *
 * The module marks 9 exports `@@throw-safe` (ADRs #073/#076; OBJECT.spec.md
 * `## Throw-safety (axis 5)`): the 4 public predicates PLUS the 5 exported
 * `@internal` helpers. This suite triple-locks that oracle:
 *   1. the `@@throw-safe` markers parsed out of `src/object.js` === the canonical
 *      {@link THROW_SAFE_MARKED} list (catches SOURCE drift);
 *   2. the imported object set scored below === {@link THROW_SAFE_MARKED}
 *      (catches TEST drift);
 *   3. every marked export × every hostile-trap row returns without throwing.
 *
 * Several helpers gate on a threaded argument (`hasPlainObjectIdentitySignal` on a
 * matching `name`; `isObjectPrototypeEquivalent` on an `isClass` constructor), so a
 * naive single-value call would short-circuit before the hostile value reached the
 * throwing read — a trivial pass. Each probe therefore routes the hostile value
 * into the argument position that triggers that export's characteristic read
 * (`getTypeSignature`, `getSafePrototypeOf`, the constructor walk, the member-surface
 * `getOwnPropertyDescriptors`), so non-propagation is genuinely exercised. The
 * verdicts are non-uniform across the 9 heterogeneous exports, so axis 5 pins only
 * the invariant that holds for every cell — the call does not throw; the specific
 * honest verdicts stay pinned in the axis-3 matrix and `_internal/helpers.test.js`
 * (`dIOPC/B1`, `iOPE/B1`).
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
  doesImplementObjectPrototypeContract,
  hasPlainObjectIdentitySignal,
  hasDictionaryObjectIdentitySignal,
  isObjectPrototypeEquivalent,
  isAlienRealmPlainObject,
} from '#index';

import { throwSafetyMatrix, THROW_SAFE_MARKED } from './__config.js';

/** @typedef {import('#function').NewableFunction} NewableFunction */

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
};
const predicateNames = Object.keys(predicates).sort();

const markedSorted = [...THROW_SAFE_MARKED].sort();

/** The `@@throw-safe`-marked export names parsed straight out of the source. */
function markedNamesFromSource() {
  const source = readFileSync(new URL('../../src/object.js', import.meta.url), 'utf8');
  // each marker sits directly above its export; the lazy gap stops at the first
  // `export function` that follows, so marker ↔ export pairs one-to-one.
  return [...source.matchAll(/@@throw-safe[\s\S]*?export function (\w+)/g)].map(
    (match) => match[1],
  );
}

// Per-export probes: route the hostile value into the argument slot that fires the
// export's characteristic read, so non-propagation is exercised, not short-circuited.
// `Object` is a genuine newable so `isObjectPrototypeEquivalent`'s `isClass` marker
// passes and the hostile prototype/member reads fire; `'Object'` makes the identity
// signal reach `getTypeSignature`; `(h, h)` feeds the alien seam a hostile value AND
// prototype (the seam resolves the constructor/name from the hostile prototype).
/** @type {Record<string, (value?: unknown) => unknown>} */
const markedProbes = {
  isObject: (h) => isObject(h),
  doesImplementObjectPrototypeContract: (h) => doesImplementObjectPrototypeContract(h),
  hasPlainObjectIdentitySignal: (h) => hasPlainObjectIdentitySignal(h, 'Object'),
  hasDictionaryObjectIdentitySignal: (h) => hasDictionaryObjectIdentitySignal(h),
  isObjectPrototypeEquivalent: (h) =>
    isObjectPrototypeEquivalent(
      /** @type {object} */ (h),
      /** @type {NewableFunction} */ (Object),
      'Object',
    ),
  isAlienRealmPlainObject: (h) =>
    isAlienRealmPlainObject(/** @type {object} */ (h), /** @type {object} */ (h)),
  isPlainObject: (h) => isPlainObject(h),
  isDictionaryObject: (h) => isDictionaryObject(h),
  isPlainOrDictionaryObject: (h) => isPlainOrDictionaryObject(h),
};

describe('object — throw-safety invariant (axis 3, hostile × predicate matrix)', () => {
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

describe('object — throw-safety completeness oracle (axis 5, hostile × marked-export)', () => {
  it('completeness (source): the `@@throw-safe` markers in src/object.js === the 9-name oracle', () => {
    expect(markedNamesFromSource().sort()).toEqual(markedSorted);
  });

  it('completeness (test): the scored marked-export set === the 9-name oracle', () => {
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
          // the 9 exports, so its VALUE is not pinned here — only non-propagation.
          expect(() => probe(make()), `${name} threw`).not.toThrow();
        });
      }
    });
  }
});
