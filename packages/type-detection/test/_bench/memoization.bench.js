// @ts-check

/**
 * @module test/_bench/memoization
 *
 * Benchmark harness for the constructor/prototype memoization decision.
 *
 * The three registries (`prototypeRegistry`, `constructorRegistry`,
 * `constructorNameRegistry`) live entirely inside `guardedGetPrototypeOf`,
 * `getDefinedConstructor`, and `getDefinedConstructorName`. So the cleanest,
 * fairest memo-vs-no-memo comparison is at the RESOLVER level: the memoized
 * versions (imported from the barrel) head-to-head against faithful no-cache
 * re-implementations built from the same exported primitives. Everything
 * downstream (the predicates) just composes these, so the resolver result
 * generalizes.
 *
 * The decisive axis is distinct-objects (cache always misses — the dominant
 * "classify each value once" pattern) vs repeated-object (cache hits — the
 * re-detection pattern the consumer could memoize itself). A second group
 * baselines the public predicates (current impl) to show hot-path vs cold-path
 * magnitude and how much they even exercise the resolvers.
 *
 * Run: `npx vitest bench memoization` (NOT picked up by `test/**\/*.test.js`).
 */

import { bench, describe } from 'vitest';

import {
  guardedGetPrototypeOf,
  getDefinedConstructor,
  getDefinedConstructorName,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getInertDescriptor,
  isCallable,
  isFunction,
  isStringValue,
  isPromise,
  isThenable,
  isPromiseLike,
} from '@/index.js';

import { foreignRealmEval } from '../_cross-realm.js';

// ----- faithful no-memo variants (same algorithm, registries removed) -----

/** @param {unknown} value - the value whose prototype to read */
const getProtoPlain = (value) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  try {
    return getPrototypeOf(value);
  } catch {
    return undefined;
  }
};

/**
 * @param {unknown} value - the value whose constructor to resolve
 * @param {boolean} [assumePrototype] - treat `value` as a real prototype object
 */
const getCtorPlain = (value, assumePrototype = false) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const type = isCallable(value) || assumePrototype ? value : getProtoPlain(value);
  const creator = getInertDescriptor(type, 'constructor')?.value ?? null;

  if (isFunction(creator)) {
    return creator;
  } else if (creator !== null) {
    const constructor = getInertDescriptor(creator, 'constructor')?.value;

    if (isFunction(constructor)) {
      return constructor;
    }
  }
  return undefined;
};

/**
 * @param {unknown} value - the value whose constructor name to resolve
 * @param {boolean} [assumePrototype] - treat `value` as a real prototype object
 */
const getCtorNamePlain = (value, assumePrototype = false) => {
  const constructor = getCtorPlain(value, assumePrototype) ?? null;

  if (constructor === null) {
    return undefined;
  }
  const name = /** @type {unknown} */ (
    getOwnPropertyDescriptor(/** @type {object} */ (constructor), 'name')?.value
  );
  return isStringValue(name) ? name : undefined;
};

// ----- inputs -----

// repeated (cache-hit) fixtures — one shared identity reused every iteration.
const sharedObj = { x: 1 };
const sharedProto = Promise.prototype;
const sharedLocalPromise = Promise.resolve(1);
const sharedForeignPromise = foreignRealmEval('Promise.resolve(1)');

// distinct (cache-always-miss) fixtures allocate fresh inside each bench fn;
// the allocation cost is identical across memo/plain, so the relative delta
// within a group isolates the memoization.

const opts = { time: 500, warmupTime: 150 };

// ----- Group 1: resolver head-to-head (the decision) -----

describe('guardedGetPrototypeOf · distinct (cache misses)', () => {
  bench('memo ', () => void guardedGetPrototypeOf({}), opts);
  bench('plain', () => void getProtoPlain({}), opts);
});
describe('guardedGetPrototypeOf · repeated (cache hits)', () => {
  bench('memo ', () => void guardedGetPrototypeOf(sharedObj), opts);
  bench('plain', () => void getProtoPlain(sharedObj), opts);
});

describe('getDefinedConstructor · instance · distinct (cache misses)', () => {
  bench('memo ', () => void getDefinedConstructor({}), opts);
  bench('plain', () => void getCtorPlain({}), opts);
});
describe('getDefinedConstructor · instance · repeated (cache hits)', () => {
  bench('memo ', () => void getDefinedConstructor(sharedObj), opts);
  bench('plain', () => void getCtorPlain(sharedObj), opts);
});

describe('getDefinedConstructor · assumePrototype · repeated proto (recurring-prototype case)', () => {
  bench(
    'memo ',
    () => void getDefinedConstructor(sharedProto, { assumePrototype: true }),
    opts,
  );
  bench('plain', () => void getCtorPlain(sharedProto, true), opts);
});

describe('getDefinedConstructorName · instance · distinct (cache misses)', () => {
  bench('memo ', () => void getDefinedConstructorName({}), opts);
  bench('plain', () => void getCtorNamePlain({}), opts);
});
describe('getDefinedConstructorName · instance · repeated (cache hits)', () => {
  bench('memo ', () => void getDefinedConstructorName(sharedObj), opts);
  bench('plain', () => void getCtorNamePlain(sharedObj), opts);
});

// ----- Group 2: public-predicate baselines (current impl) -----

describe('isPromise · current impl', () => {
  bench('local repeated  (hot path)', () => void isPromise(sharedLocalPromise), opts);
  bench(
    'local distinct  (hot, fresh alloc)',
    () => void isPromise(Promise.resolve(1)),
    opts,
  );
  bench('foreign repeated (cold path)', () => void isPromise(sharedForeignPromise), opts);
});
describe('isThenable · current impl', () => {
  bench(
    'local repeated  (hot, WeakMap-free)',
    () => void isThenable(sharedLocalPromise),
    opts,
  );
  bench(
    'foreign repeated (structural)',
    () => void isThenable(sharedForeignPromise),
    opts,
  );
});
describe('isPromiseLike · current impl', () => {
  bench('local repeated  (hot path)', () => void isPromiseLike(sharedLocalPromise), opts);
  bench(
    'foreign repeated (structural)',
    () => void isPromiseLike(sharedForeignPromise),
    opts,
  );
});
