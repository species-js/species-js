// @ts-check

/**
 * @module test/function/spec
 *
 * Axis 1 — spec/contract, matrix-driven. Drives the four family matrices from
 * `__config.js` — {@link callableFloorMatrix} (× {isCallable, isFunction}),
 * {@link newableMatrix} (× the six newable-side predicates), {@link asyncMatrix}
 * (× {isAsyncFunction}), and {@link generatorMatrix} (× the three generator
 * predicates) — each clean candidate scored against its region's predicate set,
 * every matrix guarded by a completeness check so no predicate column can
 * silently go missing. `function` is a single conceptual LATTICE, not disjoint
 * families, so the cross-region rejections live INSIDE each matrix as explicit
 * `false` rows (an `async function` scored by the newable predicates, a
 * `function*` scored by `isAsyncFunction`, …); the sweep here then adds the
 * cross-cutting `typeof !== 'function'` rejections (nullish / primitive /
 * non-callable-object → every predicate false) and the omitted-argument
 * invariant. If a test here fails, the implementation is wrong, not the test.
 *
 * Spoofs / grafts / source-tampering live in `adversarial.test.js`; foreign-realm
 * in `cross-realm.test.js`; the hostile-input throw-safety matrix in
 * `throw-safety.test.js`; the `@internal` realm arms in `_internal/helpers.test.js`.
 *
 * Mirrors `docs/spec/FUNCTION.spec.md`.
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  doesUnboundNewableSourceMatchEitherClassSignature,
  doesUnboundNewableSourceMatchNeitherClassSignature,
  isCallable,
  isFunction,
  hasConstructSlot,
  isNewableFunction,
  isES3Function,
  isClass,
  isCustomClass,
  isBuiltInClass,
  isAsyncFunction,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isAnyGeneratorFunction,
} from '#index';

import {
  familyMatrices,
  crossCuttingRejections,
  CALLABLE_PREDICATES,
  NEWABLE_PREDICATES,
  ASYNC_PREDICATES,
  GENERATOR_PREDICATES,
  PUBLIC_PREDICATE_NAMES,
  sourceSignatureMatrix,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isCallable,
  isFunction,
  hasConstructSlot,
  isNewableFunction,
  isES3Function,
  isClass,
  isCustomClass,
  isBuiltInClass,
  isAsyncFunction,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isAnyGeneratorFunction,
};

/** Region → predicate-name set (the completeness oracle per family matrix). */
const FAMILY_PREDICATES = {
  Callable: CALLABLE_PREDICATES,
  Newable: NEWABLE_PREDICATES,
  Async: ASYNC_PREDICATES,
  Generator: GENERATOR_PREDICATES,
};

/**
 * Look up a predicate by name, failing loudly (never vacuously) if absent.
 * @param {string} name - the predicate name
 * @returns {(value?: unknown) => boolean} the predicate function
 */
function predicateByName(name) {
  const predicate = predicates[name];
  if (!predicate) {
    throw new Error(`no predicate "${name}"`);
  }
  return predicate;
}

/**
 * Drive one family matrix: a completeness guard (every row scores exactly
 * `names`) plus a per-cell assertion for every row.
 * @param {Record<string, { description: string, make: () => unknown, expected: Record<string, boolean>, vectors: string[] }>} matrix - the matrix to drive
 * @param {string[]} names - the predicate-name set every row must score
 * @returns {void}
 */
function driveMatrix(matrix, names) {
  const sortedNames = [...names].sort();

  it('completeness: every matrix row scores every predicate', () => {
    for (const [key, row] of Object.entries(matrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(sortedNames);
    }
  });

  for (const [key, { description, make, expected, vectors }] of Object.entries(matrix)) {
    describe(`${key} — ${description}`, () => {
      for (const [predName, want] of Object.entries(expected)) {
        it(`${predName} → ${String(want)}  [${vectors.join(', ')}]`, () => {
          expect(predicateByName(predName)(make())).toBe(want);
        });
      }
    });
  }
}

describe('function — spec/contract matrices', () => {
  const families = /** @type {Array<keyof typeof familyMatrices>} */ (
    Object.keys(familyMatrices)
  );
  for (const family of families) {
    const matrix = familyMatrices[family];
    const names = FAMILY_PREDICATES[family];
    describe(`${family} region — ${names.join(', ')}`, () => {
      driveMatrix(matrix, names);
    });
  }

  // CC/nullish, CC/primitive, CC/non-callable-object — every `typeof !== 'function'`
  // candidate is rejected by ALL 12 public predicates (the 11 narrowing predicates
  // gate on isCallable / isFunction; hasConstructSlot has no callable to probe).
  describe('CC — typeof !== "function" rejected by every predicate', () => {
    for (const [key, { description, make, vectors }] of Object.entries(
      crossCuttingRejections,
    )) {
      it(`${key} (${description}) rejected by all 12  [${vectors.join(', ')}]`, () => {
        const value = make();
        for (const name of PUBLIC_PREDICATE_NAMES) {
          expect(predicateByName(name)(value), name).toBe(false);
        }
      });
    }
  });

  // CC/nullish — the OMITTED call: no value is supplied to classify, so every
  // predicate answers false (no function predicate admits `undefined`, unlike the
  // primitive nullish floor). Distinct data point from an explicit nullish above.
  describe('CC/nullish — omitted argument rejected by every predicate', () => {
    it('every public predicate → false when called with no argument', () => {
      for (const name of PUBLIC_PREDICATE_NAMES) {
        expect(predicateByName(name)(), `${name}()`).toBe(false);
      }
    });
  });
});

/** The vector IDs this block exercises outside the matrix rows. */
const SOURCE_SIGNATURE_EXTRA_VECTORS = ['dUNSMECS/B2', 'dUNSMNCS/L1'];

/**
 * Every `dUNSMECS/*` and `dUNSMNCS/*` ID the spec names.
 * @returns {string[]} the sorted, de-duplicated IDs
 */
function sourceSignatureVectorsFromSpec() {
  const spec = readFileSync(
    new URL('../../docs/spec/FUNCTION.spec.md', import.meta.url),
    'utf8',
  );
  return [
    ...new Set(
      [...spec.matchAll(/`(dUNSM[EN]CS\/[A-Z]\d+)`/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]],
      ),
    ),
  ].sort();
}

describe('function — the source-signature predicates (dUNSMECS / dUNSMNCS)', () => {
  it('completeness: the suite exercises exactly the vectors the spec names', () => {
    const cited = new Set(SOURCE_SIGNATURE_EXTRA_VECTORS);
    for (const { vectors } of Object.values(sourceSignatureMatrix)) {
      for (const vector of vectors) {
        cited.add(vector);
      }
    }
    const fromSpec = sourceSignatureVectorsFromSpec();
    // positive control: the parser must find the IDs it is checking against
    expect(fromSpec.length, 'no dNSM* vector parsed from the spec').toBeGreaterThan(0);
    expect([...cited].sort()).toEqual(fromSpec);
  });

  for (const [key, { description, source, expected, vectors }] of Object.entries(
    sourceSignatureMatrix,
  )) {
    describe(`${key} — ${description}`, () => {
      it(`either → ${String(expected)}  [${vectors.join(', ')}]`, () => {
        expect(doesUnboundNewableSourceMatchEitherClassSignature(source)).toBe(expected);
      });

      it('neither → the exact negation  [dUNSMNCS/L1]', () => {
        expect(doesUnboundNewableSourceMatchNeitherClassSignature(source)).toBe(
          !expected,
        );
      });
    });
  }

  // dUNSMECS/B2 — a long source that fails LATE is answered in linear time. A
  // catastrophically backtracking pattern takes seconds at this length; the
  // budget is two orders of magnitude above what a linear read needs.
  it('a 100 000-character source failing late is answered in linear time  [dUNSMECS/B2]', () => {
    const body = '{ x; }'.repeat(16_667);
    const source = `function f() {${body}\n// { [native code]\n}`;
    expect(source.length).toBeGreaterThanOrEqual(100_000);

    const start = performance.now();
    const answer = doesUnboundNewableSourceMatchEitherClassSignature(source);
    const elapsed = performance.now() - start;

    expect(answer).toBe(false);
    expect(elapsed, `${elapsed.toFixed(1)} ms`).toBeLessThan(250);
  });
});
