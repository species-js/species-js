// @ts-check

/**
 * @module test/utility/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). utility exports exactly two `@internal`
 * helpers for testability (ADR #053), neither on the public surface:
 *
 *   getValidatedStandardConstructorAndPrototypeTuple — the realm-fixed
 *     intrinsic-pair capture behind each family's `Promise`-style constructor
 *     lock. It is also `@@throw-safe`; because it is `@internal` its throw-safety
 *     boundary (`gVSC/B1`) lives HERE, not in `throw-safety.test.js`.
 *   isValueOfBoundSet — the `this`-bound `Set`-membership callback for the
 *     `Array.prototype.some`/`every`/`filter` denylist walks.
 *
 * Run on LOCAL values (the capture is realm-safe by construction — it binds the
 * real intrinsic at module-load; `docs/spec/UTILITY.spec.md` → "Cross-realm
 * (axis 2): realm-safe"). The injected `doesPassAsConstructorPrototype` predicate
 * is a stub here — the white-box target is the helper's OWN gate chain (newable →
 * injected-predicate → reciprocal `constructor` back-reference), not the injected
 * predicate's logic.
 *
 * Mirrors the "Exported `@internal` helpers (axis 4)" section of
 * `docs/spec/UTILITY.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  getValidatedStandardConstructorAndPrototypeTuple,
  isValueOfBoundSet,
  INSTANCE_LESS_CONSTRUCTOR,
  BLANK_DICTIONARY,
} from '#index';

/** @typedef {import('#utility').PredicateFunction} PredicateFunction */

// injected prototype-gate stubs — the helper's own chain is the unit under test.
/** @type {PredicateFunction} */
const accept = () => true;
/** @type {PredicateFunction} */
const reject = () => false;

/**
 * Asserts a result is the total inert surrogate tuple — identity against the same
 * module-level constants the helper returns, so the check is exact.
 *
 * @param {readonly [unknown, unknown]} result - the returned `[constructor, prototype]` tuple
 * @param {string} label - assertion label surfaced on failure
 */
function expectSurrogate(result, label) {
  expect(result[0], `${label} — constructor slot`).toBe(INSTANCE_LESS_CONSTRUCTOR);
  expect(result[1], `${label} — prototype slot`).toBe(BLANK_DICTIONARY);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  getValidatedStandardConstructorAndPrototypeTuple
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] getValidatedStandardConstructorAndPrototypeTuple (constructor, predicate)', () => {
  it('gVSC/A1: `(Promise, accept)` → `[Promise, Promise.prototype]` (valid pair, reciprocal `constructor`)', () => {
    const [constructor, prototype] = getValidatedStandardConstructorAndPrototypeTuple(
      Promise,
      accept,
    );
    expect(constructor, 'constructor slot').toBe(Promise);
    expect(prototype, 'prototype slot').toBe(Promise.prototype);
  });

  it('gVSC/R1: `(nonNewable, accept)` → surrogate (an arrow function has no [[Construct]])', () => {
    const nonNewable = () => undefined;
    expectSurrogate(
      getValidatedStandardConstructorAndPrototypeTuple(nonNewable, accept),
      'non-newable',
    );
  });

  it('gVSC/R2: `(Promise, reject)` → surrogate (prototype fails the injected predicate)', () => {
    expectSurrogate(
      getValidatedStandardConstructorAndPrototypeTuple(Promise, reject),
      'rejected prototype',
    );
  });

  it('gVSC/R3: broken back-reference (`prototype.constructor !== Ctor`) → surrogate', () => {
    function BrokenCtor() {
      return undefined;
    }
    // replace the prototype so its `constructor` no longer back-references BrokenCtor;
    // the reciprocal marker fails while the newable + injected-predicate gates pass.
    BrokenCtor.prototype = { constructor: Array };
    expectSurrogate(
      getValidatedStandardConstructorAndPrototypeTuple(BrokenCtor, accept),
      'broken back-reference',
    );
  });

  it('gVSC/B1: a hostile `getOwnPropertyDescriptor` trap throws during the walk → surrogate, not thrown', () => {
    // newable gate passes (isFunction reads `.bind`/`.call`/`.apply` via the `get`
    // trap; the construct probe wraps a construct-trap proxy) — the trap fires only
    // inside the guarded `prototype`-descriptor walk, which the helper's try/catch
    // collapses to the surrogate.
    const hostileConstructor = new Proxy(
      function C() {
        return undefined;
      },
      {
        getOwnPropertyDescriptor() {
          throw new Error('desc-trap');
        },
      },
    );
    /** @type {[unknown, unknown]} */
    let result = [null, null];
    expect(() => {
      result = getValidatedStandardConstructorAndPrototypeTuple(
        hostileConstructor,
        accept,
      );
    }, 'threw').not.toThrow();
    expectSurrogate(result, 'hostile descriptor');
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  isValueOfBoundSet
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('[Internal] isValueOfBoundSet (this: Set, value)', () => {
  it('iVOBS/A1: bound to `new Set(["a", "b"])` — `"a"` → true, `"c"` → false', () => {
    const set = new Set(['a', 'b']);
    expect(isValueOfBoundSet.call(set, 'a'), 'member').toBe(true);
    expect(isValueOfBoundSet.call(set, 'c'), 'non-member').toBe(false);
  });
});
