// @ts-check

/**
 * @module test/utility/spec
 *
 * Axis 1/4 — the helper contracts, matrix-driven. Drives the three matrices
 * from `__config.js`: the condensed-source readers and the two `Proxy`
 * recognizers. If a test here fails, the implementation is wrong, not the test.
 *
 * These helpers are exercised transitively by the `bound` suites, but only
 * along the paths the two predicates happen to take. Three things are reachable
 * nowhere else and are the reason this suite exists:
 *
 * 1. the engine-specific NativeFunction forms — `getFunctionSourceCondensate`
 *    takes a SOURCE precisely so that the JavaScriptCore / SpiderMonkey and
 *    tab-separated shapes can be fed under a single-engine runner (`gFSC/A2`,
 *    `gFSC/A3`);
 * 2. the falsy-input guard (`gFSC/X1`), which the composition never reaches in
 *    Node because `Function.prototype.toString` returns a String or throws;
 * 3. `hasProxyConstructorShape`'s `try`/`catch`, reached only by a callable
 *    whose own `name` descriptor is absent.
 *
 * Beyond scoring rows, the suite pins two structural laws. The identity arm of
 * `doesMatchProxyConstructor` is a pure optimization — it must change no
 * verdict, so the two recognizers agree on every candidate. And the module's
 * public surface is exactly one export: the barrel rule (ADR #085) asserted at
 * runtime rather than only by the static `surface:check` gate.
 *
 * Mirrors `docs/spec/UTILITY.spec.md` (FROZEN 2026-08-11) — the per-export vector
 * sections. They lived in `BOUND.spec.md` until `concise` became a second consumer.
 */

import { describe, it, expect } from 'vitest';

import {
  doesMatchProxyConstructor,
  getCondensedFunctionSource,
  getFunctionSourceCondensate,
  hasProxyConstructorShape,
} from '#utility';

import {
  CANONICAL_CONDENSED_SOURCE,
  condensedSourceMatrix,
  falsySourceInputs,
  proxyConstructorMatrix,
  sourceCondensateMatrix,
} from './__config.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */
/** @typedef {import('@species-js/type-detection').VerifiedFunction} VerifiedFunction */

/**
 * Retypes a matrix candidate for the readers. The matrices carry `unknown`
 * because one row is deliberately out of contract — `gCFS/A4` is a specified
 * vector, and the cast is where that is acknowledged rather than hidden.
 *
 * @param {unknown} value - a candidate produced by the matrix
 * @returns {Callable} the same value, retyped
 */
const asCallable = (value) => /** @type {Callable} */ (value);

/**
 * Retypes a matrix candidate for the two `Proxy` recognizers.
 *
 * @param {unknown} value - a candidate produced by the matrix
 * @returns {VerifiedFunction} the same value, retyped
 */
const asVerifiedFunction = (value) => /** @type {VerifiedFunction} */ (value);

/** @type {Record<string, (value: VerifiedFunction) => boolean>} */
const recognizers = { doesMatchProxyConstructor, hasProxyConstructorShape };
const recognizerNames = Object.keys(recognizers).sort();

describe('utility — helper specification (axis 4)', () => {
  describe('getCondensedFunctionSource', () => {
    for (const [key, { description, make, expected, vector }] of Object.entries(
      condensedSourceMatrix,
    )) {
      it(`${description} (${key}) [${vector}]`, () => {
        expect(getCondensedFunctionSource(asCallable(make()))).toBe(expected);
      });
    }
  });

  describe('getFunctionSourceCondensate', () => {
    it('completeness: the matrix pins both a canonical and a non-canonical outcome', () => {
      const outcomes = Object.values(sourceCondensateMatrix).map(
        ({ isCanonical }) => isCanonical,
      );

      expect(outcomes).toContain(true);
      expect(outcomes).toContain(false);
    });

    for (const [
      key,
      { description, source, expected, isCanonical, vector },
    ] of Object.entries(sourceCondensateMatrix)) {
      describe(`${description} (${key})`, () => {
        it(`condenses to the specified form [${vector}]`, () => {
          expect(getFunctionSourceCondensate(source)).toBe(expected);
        });

        it(`${isCanonical ? 'is' : 'is not'} the anonymous native form [${vector}]`, () => {
          expect(getFunctionSourceCondensate(source) === CANONICAL_CONDENSED_SOURCE).toBe(
            isCanonical,
          );
        });
      });
    }

    describe('falsy input is returned unchanged', () => {
      for (const [key, { source, vector }] of Object.entries(falsySourceInputs)) {
        it(`${key} [${vector}]`, () => {
          expect(getFunctionSourceCondensate(source)).toBe(source);
        });
      }
    });

    it('condensing is idempotent over every matrix source', () => {
      for (const [key, { source }] of Object.entries(sourceCondensateMatrix)) {
        const once = getFunctionSourceCondensate(source);

        expect(getFunctionSourceCondensate(once), `row "${key}"`).toBe(once);
      }
    });
  });

  describe('the two `Proxy` recognizers', () => {
    it('completeness: every matrix row scores every recognizer', () => {
      for (const [key, row] of Object.entries(proxyConstructorMatrix)) {
        expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(recognizerNames);
      }
    });

    for (const [key, { description, make, expected, vectors }] of Object.entries(
      proxyConstructorMatrix,
    )) {
      describe(`${description} (${key})`, () => {
        for (const [recognizerName, want] of Object.entries(expected)) {
          const vectorId = vectors[0] ?? key;
          it(`${recognizerName} → ${String(want)} [${vectorId}]`, () => {
            const recognizer = recognizers[recognizerName];
            if (!recognizer) {
              throw new Error(`no recognizer "${recognizerName}"`);
            }
            expect(recognizer(asVerifiedFunction(make()))).toBe(want);
          });
        }
      });
    }

    it('the identity arm changes no verdict — the two agree on every candidate', () => {
      for (const [key, { make }] of Object.entries(proxyConstructorMatrix)) {
        const value = asVerifiedFunction(make());

        expect(doesMatchProxyConstructor(value), `row "${key}"`).toBe(
          hasProxyConstructorShape(value),
        );
      }
    });
  });

  describe('the module surface (ADR #085 — the barrel names what escapes)', () => {
    it('exports exactly one name through the root barrel', async () => {
      const barrel = await import('#index');
      const utilityExports = [
        'CONDENSED_NATIVE_SOURCE_FOUNDATION',
        'doesMatchProxyConstructor',
        'getCondensedFunctionSource',
        'getFunctionSourceCondensate',
        'hasProxyConstructorShape',
      ];

      expect(
        utilityExports.filter((name) => name in barrel),
        'only the public helper may reach the root barrel',
      ).toEqual(['getCondensedFunctionSource']);
    });

    it('the escaping export is the same function object the module defines', async () => {
      const barrel = /** @type {Record<string, unknown>} */ (await import('#index'));

      expect(barrel.getCondensedFunctionSource).toBe(getCondensedFunctionSource);
    });
  });
});
