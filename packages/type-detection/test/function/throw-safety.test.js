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
 * The hostile set has two halves. The GENERATED half (2026-10-03) is one throwing
 * `Proxy` per handler trap of ECMA-262's closed set of thirteen, over an extensible
 * and a frozen ES3 function and class — it does not depend on which reads the code
 * makes, so a read added later meets every trap; the corpus and liveness checks
 * below prove all thirteen are present and every one actually fires. It exists
 * because the curated half missed a regression: an `Object.isFrozen` gate fired
 * `isExtensible` first, which no curated row threw from, and all 146 tests passed
 * while two predicates threw. The CURATED half was re-derived from function's own
 * read surface — the trap classes a marked export could route a throw through: the
 * `get` trap (the
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

import {
  throwSafetyMatrix,
  THROW_SAFE_MARKED,
  HANDLER_TRAPS,
  TRAP_TARGETS,
} from './__config.js';

/**
 * The operation that fires each handler trap on a `Proxy`, so a generated row
 * can be shown to be LIVE — a row whose trap never fired would make every
 * throw-safety assertion over it pass vacuously.
 *
 * Each entry only FIRES its trap, so none returns the operation's result.
 *
 * @type {Record<string, (proxy: object) => void>}
 */
const FIRE_TRAP = {
  getPrototypeOf: (p) => void Reflect.getPrototypeOf(p),
  setPrototypeOf: (p) => void Reflect.setPrototypeOf(p, null),
  isExtensible: (p) => void Reflect.isExtensible(p),
  preventExtensions: (p) => void Reflect.preventExtensions(p),
  getOwnPropertyDescriptor: (p) => void Reflect.getOwnPropertyDescriptor(p, 'prototype'),
  defineProperty: (p) => void Reflect.defineProperty(p, 'x', { value: 1 }),
  has: (p) => void Reflect.has(p, 'x'),
  get: (p) => void Reflect.get(p, 'x'),
  set: (p) => void Reflect.set(p, 'x', 1),
  deleteProperty: (p) => void Reflect.deleteProperty(p, 'x'),
  ownKeys: (p) => void Reflect.ownKeys(p),
  apply: (p) =>
    void Reflect.apply(/** @type {(...args: unknown[]) => unknown} */ (p), undefined, []),
  construct: (p) =>
    void Reflect.construct(/** @type {new (...args: unknown[]) => unknown} */ (p), []),
};

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

  it('completeness (corpus): every one of the 13 handler traps, over every target', () => {
    expect(HANDLER_TRAPS.length).toBe(13);
    expect(Object.keys(FIRE_TRAP).sort()).toEqual([...HANDLER_TRAPS].sort());

    const generated = Object.keys(throwSafetyMatrix).filter((key) =>
      key.startsWith('trap:'),
    );
    expect(generated.length).toBe(
      HANDLER_TRAPS.length * Object.keys(TRAP_TARGETS).length,
    );
  });

  it('liveness: every generated row throws when its own trap fires', () => {
    let fired = 0;
    for (const [key, row] of Object.entries(throwSafetyMatrix)) {
      if (!key.startsWith('trap:')) {
        continue;
      }
      const trap = key.split(':')[1] ?? '';
      const fire = FIRE_TRAP[trap];
      if (!fire) {
        throw new Error(`no firing operation for trap "${trap}"`);
      }
      expect(() => {
        fire(/** @type {object} */ (row.make()));
      }, key).toThrow(`${trap}-trap`);
      fired += 1;
    }
    expect(fired).toBe(HANDLER_TRAPS.length * Object.keys(TRAP_TARGETS).length);
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
