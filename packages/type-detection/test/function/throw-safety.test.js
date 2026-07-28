// @ts-check

/**
 * @module test/function/throw-safety
 *
 * Axis 5 — the universal throw-safety invariant, matrix-driven, and its
 * completeness oracle. The module marks 24 exports `@@throw-safe` (ADRs
 * #073/#076): each must answer a sentinel (`false` / `undefined`) on EVERY
 * hostile input and never propagate a throw. The marked set is the completeness
 * oracle (spec `## Throw-safety (axis 5)`, Open item #1) — the 12 public
 * predicates PLUS the 12 `@internal` helpers.
 *
 * This suite triple-locks that oracle:
 *   1. the `@@throw-safe` markers parsed out of `src/function.js` === the
 *      canonical {@link THROW_SAFE_MARKED} list (catches SOURCE drift — a marker
 *      added or removed without updating the oracle);
 *   2. the imported function set scored below === {@link THROW_SAFE_MARKED}
 *      (catches TEST drift — a marked export left unscored);
 *   3. every marked export × every hostile-trap row returns without throwing.
 *
 * function's verdicts are NON-UNIFORM — unlike `primitive`, a CALLABLE hostile
 * `Proxy` answers `isCallable === true` because `typeof` is unspoofable and fires
 * no trap, and the same-realm `instanceof` arms can answer `true` on a get-trap
 * Proxy. So the matrix asserts only the invariant that holds for every cell: the
 * call does not throw. The specific hostile verdicts that ARE pinned
 * (`isFunction/B1 → false`, the `iCR<Species>FI/B1 → true` isolation results,
 * `isClass/B1 → false`) live in `adversarial.test.js` and
 * `_internal/helpers.test.js` where the individual arms are exercised white-box.
 *
 * The hostile set is re-derived from function's own read surface — the trap
 * classes a marked export could route a throw through: the `get` trap (the
 * `.bind`/`.call`/`.apply` reads in `isFunction`), `getPrototypeOf` (the
 * `instanceof` arms + the alien arms' `getSafePrototypeOf`),
 * `getOwnPropertyDescriptor` (`hasOwnNonWritablePrototype` in `isClass`),
 * `ownKeys` (the proto-surface key-set reads), a throwing `Symbol.toStringTag`
 * getter (`getTypeSignature`), and a fully-revoked `Proxy` (`getFunctionSource`).
 */

import { readFileSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  getFunctionSource,
  isCallable,
  isFunction,
  hasConstructSlot,
  isNewableFunction,
  isES3Function,
  isClass,
  isCustomClass,
  isBuiltInClass,
  hasAsyncFunctionIdentitySignal,
  hasAsyncFunctionPrototypeSurface,
  isAlienRealmAsyncFunction,
  isCurrentRealmAsyncFunctionInstance,
  isAsyncFunction,
  hasGeneratorFunctionIdentitySignal,
  hasAsyncGeneratorFunctionIdentitySignal,
  hasAnyGeneratorFunctionPrototypeSurface,
  isAlienRealmGeneratorFunction,
  isAlienRealmAsyncGeneratorFunction,
  isCurrentRealmGeneratorFunctionInstance,
  isCurrentRealmAsyncGeneratorFunctionInstance,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isAnyGeneratorFunction,
} from '#index';

import { throwSafetyMatrix, THROW_SAFE_MARKED } from './__config.js';

// The 24 marked exports, keyed by name. The heterogeneous surface (a
// `Callable`-param source-reader alongside boolean predicates) is coerced through
// `unknown` to one probe signature — every marked export IS callable with any
// value; the invariant under test is "does not throw", not a shared return type.
const markedFns = /** @type {Record<string, (value?: unknown) => unknown>} */ (
  /** @type {unknown} */ ({
    getFunctionSource,
    isCallable,
    isFunction,
    hasConstructSlot,
    isNewableFunction,
    isES3Function,
    isClass,
    isCustomClass,
    isBuiltInClass,
    hasAsyncFunctionIdentitySignal,
    hasAsyncFunctionPrototypeSurface,
    isAlienRealmAsyncFunction,
    isCurrentRealmAsyncFunctionInstance,
    isAsyncFunction,
    hasGeneratorFunctionIdentitySignal,
    hasAsyncGeneratorFunctionIdentitySignal,
    hasAnyGeneratorFunctionPrototypeSurface,
    isAlienRealmGeneratorFunction,
    isAlienRealmAsyncGeneratorFunction,
    isCurrentRealmGeneratorFunctionInstance,
    isCurrentRealmAsyncGeneratorFunctionInstance,
    isGeneratorFunction,
    isAsyncGeneratorFunction,
    isAnyGeneratorFunction,
  })
);

const markedSorted = [...THROW_SAFE_MARKED].sort();

/** The `@@throw-safe`-marked export names parsed straight out of the source. */
function markedNamesFromSource() {
  const source = readFileSync(new URL('../../src/function.js', import.meta.url), 'utf8');
  // each marker sits directly above its export; the lazy gap stops at the first
  // `export function` that follows, so marker ↔ export pairs one-to-one.
  return [...source.matchAll(/@@throw-safe[\s\S]*?export function (\w+)/g)].map(
    (match) => match[1],
  );
}

describe('function — throw-safety invariant (axis 5, hostile × marked-export matrix)', () => {
  it('completeness (source): the `@@throw-safe` markers in src/function.js === the 24-name oracle', () => {
    expect(markedNamesFromSource().sort()).toEqual(markedSorted);
  });

  it('completeness (test): the scored function set === the 24-name oracle', () => {
    expect(Object.keys(markedFns).sort()).toEqual(markedSorted);
  });

  for (const [, { surface, make }] of Object.entries(throwSafetyMatrix)) {
    describe(surface, () => {
      for (const name of THROW_SAFE_MARKED) {
        it(`${name} → a sentinel, not thrown`, () => {
          const fn = markedFns[name];
          if (!fn) {
            throw new Error(`no marked export "${name}"`);
          }
          // asserting the call returns IS the throw-safety proof: a propagated
          // throw surfaces here as a test error. The verdict is non-uniform, so
          // its TYPE is not pinned — the honest verdicts are pinned elsewhere.
          expect(() => fn(make()), `${name} threw`).not.toThrow();
        });
      }
    });
  }
});
