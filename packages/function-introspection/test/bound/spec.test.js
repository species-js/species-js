// @ts-check

/**
 * @module test/bound/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the `specMatrix` from
 * `__config.js`: every candidate scored against both predicates, plus the
 * cross-cutting entrance-level rejections. A completeness guard fails if any
 * matrix row omits a predicate column, so no assertion can silently go missing.
 * If a test here fails, the implementation is wrong, not the test.
 *
 * Two matrix-level guards go beyond scoring individual rows. The subset law
 * (`doesStronglyIndicateBoundFunction ⟹ doesIndicateBoundFunction`) is checked
 * against the DECLARED expectations, so a row that contradicts the law is
 * caught as bad data before it is ever compared to the implementation — the
 * implementation-side law over a wider corpus belongs to `invariants.test.js`.
 * And the disagreement set is pinned by name: the two predicates may differ on
 * exactly five candidates, and any change to that set surfaces here with the
 * offending row named rather than as an anonymous count.
 *
 * Foreign-realm vectors live in `cross-realm.test.js`; the forgery shapes and
 * documented boundaries in `adversarial.test.js`; the `@internal` helpers in
 * `../utility/`.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06 · AMENDED 2026-08-07).
 */

import { describe, it, expect } from 'vitest';

import { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction } from '#index';

import { specMatrix, crossCuttingRejections } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction };
const predicateNames = Object.keys(predicates).sort();

/** The five candidates on which the two predicates are specified to differ. */
const DISAGREEMENT_SET = [
  'bareProxyOverArrow',
  'foreignNamedNativeRenamed',
  'functionPrototype',
  'renamedArrow',
  'renamedBoundFunction',
];

describe('bound — spec/contract matrix', () => {
  it('completeness: every matrix row scores every predicate', () => {
    for (const [key, row] of Object.entries(specMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(predicateNames);
    }
  });

  it('the declared expectations never contradict the subset law', () => {
    for (const [key, { expected }] of Object.entries(specMatrix)) {
      if (expected.doesStronglyIndicateBoundFunction) {
        expect(
          expected.doesIndicateBoundFunction,
          `row "${key}" claims strong ⊄ cascade`,
        ).toBe(true);
      }
    }
  });

  it('the two predicates disagree on exactly the specified five candidates', () => {
    const declared = Object.entries(specMatrix)
      .filter(
        ([, { expected }]) =>
          expected.doesIndicateBoundFunction !==
          expected.doesStronglyIndicateBoundFunction,
      )
      .map(([key]) => key)
      .sort();

    expect(declared).toEqual(DISAGREEMENT_SET);

    const observed = Object.entries(specMatrix)
      .filter(([, { make }]) => {
        const value = make();
        return (
          doesIndicateBoundFunction(value) !== doesStronglyIndicateBoundFunction(value)
        );
      })
      .map(([key]) => key)
      .sort();

    expect(observed).toEqual(DISAGREEMENT_SET);
  });

  for (const [key, { description, make, expected, vectors }] of Object.entries(
    specMatrix,
  )) {
    describe(`${description} (${key})`, () => {
      for (const [predicateName, want] of Object.entries(expected)) {
        const vectorId = vectors[0] ?? key;
        it(`${predicateName} → ${String(want)} [${vectorId}]`, () => {
          const predicate = predicates[predicateName];
          if (!predicate) {
            throw new Error(`no predicate "${predicateName}"`);
          }
          expect(predicate(make())).toBe(want);
        });
      }
    });
  }

  describe('cross-cutting entrance-level rejections (both predicates → false) [bound/X1]', () => {
    for (const [group, make] of Object.entries(crossCuttingRejections)) {
      it(group, () => {
        const value = make();
        for (const predicateName of predicateNames) {
          const predicate = predicates[predicateName];
          if (!predicate) {
            throw new Error(`no predicate "${predicateName}"`);
          }
          expect(predicate(value), `${predicateName}(${group})`).toBe(false);
        }
      });
    }

    it('omitted argument → false [bound/X2]', () => {
      expect(doesIndicateBoundFunction()).toBe(false);
      expect(doesStronglyIndicateBoundFunction()).toBe(false);
    });
  });
});
