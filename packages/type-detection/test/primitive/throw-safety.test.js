// @ts-check

/**
 * @module test/primitive/throw-safety
 *
 * Axis 3 — the universal throw-safety invariant, matrix-driven. Every public
 * predicate must answer a boolean on EVERY hostile input and never propagate a
 * throw (`docs/spec/README.md` → "Throw-safety — the universal invariant"). Each
 * cell of the `hostile-input-class × predicate` matrix asserts BOTH that the call
 * does not throw AND the honest by-contract verdict. The invariant is met ⟺ every
 * cell is filled — the completeness guard fails if a hostile row omits a predicate.
 *
 * primitive's hostile set is re-derived from its own read surface. Only the BOXED
 * predicates read anything off the value; the value / floor-`typeof` /
 * Number-static predicates are pure `typeof` / arithmetic and cannot throw. The
 * boxed predicates' PUBLIC-reachable throw-surfaces:
 *   - prototype-trap — a `getPrototypeOf` Proxy-trap that throws, hitting the
 *     `try/catch`-wrapped `instanceof` in isCurrentRealmNative*Instance and the
 *     direct `getPrototypeOf`.
 *   - tag-getter-throw — a throwing `Symbol.toStringTag` getter, absorbed by
 *     `getTypeSignature`'s `toObjectString.call` try/catch.
 *   - descriptor-trap — a value over a `[[Prototype]]` whose
 *     `getOwnPropertyDescriptor` throws, absorbed by the constructor walk's inert
 *     descriptor read (`getDefinedConstructorName`).
 *
 * Every hostile input is a non-primitive object, so EVERY public predicate answers
 * `false` — the completeness set is the full 23-predicate public surface.
 */

import { describe, it, expect } from 'vitest';

import {
  isStringValue,
  isBoxedString,
  isString,
  isNumberValue,
  isBoxedNumber,
  isNumber,
  isBooleanValue,
  isBoxedBoolean,
  isBoolean,
  isSymbolValue,
  isBoxedSymbol,
  isSymbol,
  isBigIntValue,
  isBoxedBigInt,
  isBigInt,
  isNullishPrimitive,
  isBoxablePrimitive,
  isPrimitiveValue,
  isBoxedPrimitive,
  isFiniteNumberValue,
  isIntegerValue,
  isSafeIntegerValue,
  isRegisteredSymbol,
} from '#index';

import {
  throwSafetyMatrix,
  throwSafetyExpected,
  PUBLIC_PREDICATE_NAMES,
} from './__config.js';

/** @type {Record<string, (value?: unknown) => boolean>} */
const predicates = {
  isStringValue,
  isBoxedString,
  isString,
  isNumberValue,
  isBoxedNumber,
  isNumber,
  isBooleanValue,
  isBoxedBoolean,
  isBoolean,
  isSymbolValue,
  isBoxedSymbol,
  isSymbol,
  isBigIntValue,
  isBoxedBigInt,
  isBigInt,
  isNullishPrimitive,
  isBoxablePrimitive,
  isPrimitiveValue,
  isBoxedPrimitive,
  isFiniteNumberValue,
  isIntegerValue,
  isSafeIntegerValue,
  isRegisteredSymbol,
};

const predicateNames = [...PUBLIC_PREDICATE_NAMES].sort();

describe('primitive — throw-safety invariant (hostile × predicate matrix)', () => {
  it('completeness: the shared expectation scores every public predicate', () => {
    expect(Object.keys(throwSafetyExpected).sort()).toEqual(predicateNames);
    // and the `predicates` table must expose exactly the public surface, so no
    // predicate is silently missing from the matrix loop.
    expect(Object.keys(predicates).sort()).toEqual(predicateNames);
  });

  for (const [, { surface, make }] of Object.entries(throwSafetyMatrix)) {
    describe(surface, () => {
      for (const [predName, want] of Object.entries(throwSafetyExpected)) {
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
