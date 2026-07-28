// @ts-check

/**
 * @module test/function/throw-safety
 *
 * Axis 3 — the universal throw-safety invariant, matrix-driven. Every public
 * predicate must answer a boolean on EVERY hostile input and never propagate a
 * throw (`docs/spec/README.md` → "Throw-safety — the universal invariant"; the
 * 24 `@@throw-safe` markers in `function.{js,d.ts}` are the completeness oracle).
 *
 * function's verdicts are NON-UNIFORM — unlike `primitive`, a CALLABLE hostile
 * `Proxy` answers `isCallable === true` because `typeof` is unspoofable and fires
 * no trap. So this matrix asserts only the invariant that holds for every cell:
 * the call RETURNS a boolean rather than throwing. The specific hostile verdicts
 * that ARE pinned (`isFunction/B1 → false`, the `iCR<Species>FI/B1 → true` isolation
 * results, `isClass/B1 → false`) live in `adversarial.test.js` and
 * `_internal/helpers.test.js` where the individual arms are exercised white-box.
 *
 * The hostile set is re-derived from function's own read surface — the trap
 * classes a predicate could route a throw through: the `get` trap (the
 * `.bind`/`.call`/`.apply` reads in `isFunction`), `getPrototypeOf` (the
 * `instanceof` arms + the alien arms' `getSafePrototypeOf`),
 * `getOwnPropertyDescriptor` (`hasOwnNonWritablePrototype` in `isClass`),
 * `ownKeys` (the proto-surface key-set reads), a throwing `Symbol.toStringTag`
 * getter (`getTypeSignature`), and a fully-revoked `Proxy` (`getFunctionSource`).
 */

import { describe, it, expect } from 'vitest';

import {
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

import { throwSafetyMatrix, PUBLIC_PREDICATE_NAMES } from './__config.js';

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

const predicateNames = [...PUBLIC_PREDICATE_NAMES].sort();

describe('function — throw-safety invariant (hostile × predicate matrix)', () => {
  it('completeness: the predicates table exposes exactly the public surface', () => {
    expect(Object.keys(predicates).sort()).toEqual(predicateNames);
  });

  for (const [, { surface, make }] of Object.entries(throwSafetyMatrix)) {
    describe(surface, () => {
      for (const name of PUBLIC_PREDICATE_NAMES) {
        it(`${name} → a boolean, not thrown`, () => {
          const predicate = predicates[name];
          if (!predicate) {
            throw new Error(`no predicate "${name}"`);
          }
          // asserting a boolean IS the throw-safety proof: a propagated throw
          // surfaces here as a test error, not a verdict. The verdict itself is
          // non-uniform (a callable Proxy is isCallable-true), so we assert its
          // TYPE, not a fixed value — the honest verdicts are pinned elsewhere.
          let verdict;
          expect(() => {
            verdict = predicate(make());
          }, `${name} threw`).not.toThrow();
          expect(typeof verdict, `${name} returned a non-boolean`).toBe('boolean');
        });
      }
    });
  }
});
