// @ts-check

/**
 * @module test/utility/throw-safety
 *
 * Axis 3 — the universal throw-safety invariant, matrix-driven
 * (`docs/spec/README.md` → "Throw-safety — the universal invariant"). Every
 * `@@throw-safe` PUBLIC function must answer on EVERY hostile input and never
 * propagate a throw. Each cell of the `hostile-mechanism × function` matrix
 * asserts BOTH that the call does not throw AND the honest by-contract value; a
 * completeness guard fails if any hostile row omits a function column, so all four
 * mechanisms score all twenty functions.
 *
 * utility's hostile set is re-derived from its OWN read surface, which fans out
 * into FOUR DISJOINT mechanisms (wider than any prior module — utility is the
 * primitive layer every read routes through): a throwing `getPrototypeOf` trap, a
 * throwing `getOwnPropertyDescriptor` trap, a throwing `ownKeys` trap, and a
 * throwing `Symbol.toStringTag` getter. The `__config.js` matrix header documents
 * which functions each mechanism reaches, and the headline asymmetry: the
 * constructor walk reads the REAL prototype chain, so `getDefinedConstructor`
 * still resolves `Object` under three of the four traps, and `resolveType` returns
 * `'Object'` in every row. The invariant is "never throw", not "always the null
 * answer".
 *
 * The two RAW twins (`getOwnPropertyKeys`, `getNextAvailablePropertyDescriptor`)
 * carry no `@@throw-safe` marker and are deliberately excluded — their
 * throw-propagating contract is asserted against the Safe twins in
 * `adversarial.test.js` (the raw/throw-safe pairing).
 *
 * Spec traceability: the per-function throw-safety `B` vectors of
 * `UTILITY.spec.md` are driven collectively by this mechanism matrix rather than
 * one-by-one — each row's `vectors` array names the spec IDs it absorbs (the
 * `getSafePrototypeOf` `gSPO/B1`, `hasOwnPrototype` `hOP/B1`, … cells).
 */

import { describe, it, expect } from 'vitest';

import {
  isValidWeakKey,
  isValidPropertyKey,
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  getSafePrototypeOf,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafeOwnPropertyKeys,
  getNextAvailableSafeDescriptor,
  hasInertMethod,
  hasInertGetter,
  hasInertSetter,
  hasInertValue,
  getVerifiedOwnName,
  canOwnPropertyBeShaped,
  getTypeSignature,
  getTaggedType,
  getDefinedConstructor,
  getDefinedConstructorName,
  resolveType,
} from '#index';

import { throwSafetyMatrix, TS_SENTINEL } from './__config.js';

// The throw-safe PUBLIC oracle — every function carrying `/* @@throw-safe */` in
// `src/utility/index.js`, minus the `@internal` pair (tested in
// `_internal/helpers.test.js`). Split by call-shape rather than forced under one
// signature: the readers take a single value, the chain-probes take `(type, key)`
// with a mandatory `PropertyKey`. Two typed maps model the two real shapes without
// an `any`-typed catch-all.

/** @type {Record<string, (value?: unknown) => unknown>} */
const valueReaders = {
  isValidWeakKey,
  isValidPropertyKey,
  hasOwnPrototype,
  hasOwnWritablePrototype,
  hasOwnNonWritablePrototype,
  getSafePrototypeOf,
  getSafeOwnPropertyNames,
  getSafeOwnPropertySymbols,
  getSafeOwnPropertyKeys,
  getVerifiedOwnName,
  getTypeSignature,
  getTaggedType,
  getDefinedConstructor,
  getDefinedConstructorName,
  resolveType,
};

/** @type {Record<string, (type: unknown, key: PropertyKey) => unknown>} */
const chainProbeFns = {
  getNextAvailableSafeDescriptor,
  canOwnPropertyBeShaped,
  hasInertMethod,
  hasInertGetter,
  hasInertSetter,
  hasInertValue,
};

const functionNames = [
  ...Object.keys(valueReaders),
  ...Object.keys(chainProbeFns),
].sort();

// `'then'` is an arbitrary reachable-nowhere probe key for the chain-probes.
const PROBE_KEY = 'then';

/**
 * Asserts `got` against the matrix's expected cell — a `TS_SENTINEL` token for the
 * non-primitive honest values, an identity `toBe` for everything else.
 *
 * @param {unknown} got - the value the throw-safe function returned
 * @param {unknown} want - the expected cell value, or a `TS_SENTINEL` token
 * @param {string} label - assertion label surfaced on failure
 */
function assertCell(got, want, label) {
  if (want === TS_SENTINEL.UNDEF) {
    expect(got, label).toBe(undefined);
  } else if (want === TS_SENTINEL.EMPTY) {
    expect(Array.isArray(got), `${label} — array`).toBe(true);
    expect(/** @type {unknown[]} */ (got).length, `${label} — empty`).toBe(0);
  } else if (want === TS_SENTINEL.PROTOTYPE) {
    expect(
      got !== null && (typeof got === 'object' || typeof got === 'function'),
      label,
    ).toBe(true);
  } else {
    expect(got, label).toBe(want);
  }
}

describe('utility — throw-safety invariant (hostile × function matrix)', () => {
  it('completeness: every hostile row scores every throw-safe function', () => {
    for (const [key, row] of Object.entries(throwSafetyMatrix)) {
      expect(Object.keys(row.expected).sort(), `row "${key}"`).toEqual(functionNames);
    }
  });

  for (const [, { surface, make, expected, vectors }] of Object.entries(
    throwSafetyMatrix,
  )) {
    describe(`${surface} [${vectors.join(', ')}]`, () => {
      for (const [fnName, want] of Object.entries(expected)) {
        it(`${fnName} → ${String(want)}, not thrown`, () => {
          // a propagated throw surfaces HERE as a test error, not as a wrong
          // value — so the `not.toThrow` IS the throw-safety proof, and the
          // value assertion pins the honest by-contract answer on top of it.
          let got;
          const chainProbe = chainProbeFns[fnName];
          if (chainProbe) {
            expect(() => {
              got = chainProbe(make(), PROBE_KEY);
            }, `${fnName} threw`).not.toThrow();
          } else {
            const reader = valueReaders[fnName];
            if (!reader) {
              throw new Error(`no throw-safe function "${fnName}"`);
            }
            expect(() => {
              got = reader(make());
            }, `${fnName} threw`).not.toThrow();
          }
          assertCell(got, want, `${fnName} value`);
        });
      }
    });
  }
});
