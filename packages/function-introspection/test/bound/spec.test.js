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
 * And the disagreement set is pinned by NAME rather than by count, so any
 * change surfaces with the offending row identified. On this runtime the two
 * predicates differ on exactly three candidates — the set is engine-relative,
 * and this suite pins the one that holds wherever a bound function renders
 * anonymously. Where an engine renders the target's name instead there are
 * four, and `BOUND.spec.md`'s table carries both columns.
 *
 * Foreign-realm vectors live in `cross-realm.test.js`; the forgery shapes and
 * documented boundaries in `adversarial.test.js`; the `@internal` helpers in
 * `../utility/`.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06 · AMENDED 2026-08-07).
 */

import { describe, it, expect } from 'vitest';

import {
  doesIndicateBoundFunction,
  doesStronglyIndicateBoundFunction,
  hasJavaScriptCoreBindBehavior,
  createExpectedJSCSpecificFunctionSourceFromBoundName,
  doesStronglyIndicateJSCSpecificBoundFunction,
  doesStronglyIndicateNonJSCBoundFunction,
} from '#index';

import { specMatrix, crossCuttingRejections, reconstructionMatrix } from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction };
const predicateNames = Object.keys(predicates).sort();

/**
 * The candidates on which the two predicates are specified to differ.
 *
 * Two are forgeries the cascade admits and the conjunction refuses; the third
 * is a bound constructable whose name was erased, which only the construct-slot
 * mark still reaches. Two candidates LEFT this set when the cascade stopped
 * reading the function source (ADR #100) — a bare `Proxy` and
 * `Function.prototype` are now refused by both.
 */
const DISAGREEMENT_SET = [
  'foreignNamedNativeRenamed',
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

  it('the two predicates disagree on exactly the specified candidates', () => {
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

  describe('createExpectedJSCSpecificFunctionSourceFromBoundName [cEJSC/*]', () => {
    it('the matrix is non-empty, so this block cannot pass vacuously', () => {
      expect(Object.keys(reconstructionMatrix).length).toBeGreaterThan(0);
    });

    for (const [name, { description, boundName, expected, vector }] of Object.entries(
      reconstructionMatrix,
    )) {
      it(`${name} — ${description} [${vector}]`, () => {
        expect(createExpectedJSCSpecificFunctionSourceFromBoundName(boundName)).toBe(
          expected,
        );
      });
    }

    it('strips exactly ONE prefix, never all of them [cEJSC/A3]', () => {
      const once =
        createExpectedJSCSpecificFunctionSourceFromBoundName('bound bound bound f');

      expect(once).toBe('function bound bound f(){[native code]}');
    });
  });

  describe('the two engine-specific readings [dSIBF/E*]', () => {
    it('this realm is not a name-rendering one, so V8 selects the non-JSC reading', () => {
      expect(hasJavaScriptCoreBindBehavior()).toBe(false);
    });

    it('the public conjunction IS the non-JSC reading here, over the whole corpus', () => {
      const values = Object.values(specMatrix).map((row) => row.make());

      expect(values.length).toBeGreaterThan(0);

      for (const value of values) {
        expect(doesStronglyIndicateBoundFunction(value)).toBe(
          doesStronglyIndicateNonJSCBoundFunction(value),
        );
      }
    });

    it('the JSC reading refuses what no engine may admit, on this engine too', () => {
      // mark 3 is a PRECONDITION there, so these fail before any source is read
      // — engine-independent, and therefore assertable on V8
      expect(doesStronglyIndicateJSCSpecificBoundFunction(undefined)).toBe(false);
      expect(doesStronglyIndicateJSCSpecificBoundFunction(42)).toBe(false);
      expect(doesStronglyIndicateJSCSpecificBoundFunction(() => undefined)).toBe(false);
      expect(doesStronglyIndicateJSCSpecificBoundFunction(Function.prototype)).toBe(
        false,
      );
    });

    it('an arrow renamed to look bound is refused by BOTH readings [dSIBF/R11]', () => {
      const forged = Object.defineProperty(() => undefined, 'name', {
        value: 'bound plainTarget',
        configurable: true,
      });

      expect(doesStronglyIndicateNonJSCBoundFunction(forged)).toBe(false);
      // its own source is no native form, so the reconstruction cannot match
      // either — the one forgery neither reading admits on any engine
      expect(doesStronglyIndicateJSCSpecificBoundFunction(forged)).toBe(false);
    });
  });
});
