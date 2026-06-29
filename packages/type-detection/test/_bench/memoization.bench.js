// @ts-check

/**
 * @module test/_bench/memoization
 *
 * Benchmark harness for the constructor/prototype resolution cost questions.
 *
 * Originally built to decide the constructor/prototype memoization question. The three
 * registries it measured (`prototypeRegistry`, `constructorRegistry`,
 * `constructorNameRegistry`) were all REMOVED on these numbers — `prototypeRegistry`
 * (#057), the descriptor-batching/memo experiments (#058), and the two constructor
 * registries in favour of intra-call threading (#059). The harness is retained as the
 * standing cost instrument: the resolver-level groups compare the shipped (no-cache,
 * threaded) resolvers against memoized re-implementations built from the same exported
 * primitives, so any future "should this be cached?" question can be measured the same way.
 *
 * MAINTENANCE NOTE — the `registry`, `batched`, `memoized`, and `level-memo` arms are
 * deliberate inline RECONSTRUCTIONS of implementations DELETED from `src` (the constructor
 * / prototype registries, the descriptor-batching). They are neither live code nor dead
 * duplication: do NOT remove them as cruft. They exist so the ruled-out candidates stay
 * benchable against the shipped `current` arms after the candidate code itself is gone.
 * The trap they avoid: the pre-rework `memo` arm simply pointed at the shipped functions,
 * so once #057/#059 de-memoized those, it silently DEGENERATED — `memo` collapsed into the
 * no-cache `current`/`plain`/`threaded` code and the bench kept passing while measuring
 * nothing. A passing benchmark that lies about its comparison is worse than a failing one.
 * The module-load self-check (each structural candidate must equal the live
 * `isStructuralPromiseEquivalent`) is what keeps the reconstructions faithful — if it ever
 * throws, a reconstruction has drifted from shipped behavior.
 *
 * The decisive axis is distinct-objects (cache always misses — the dominant "classify each
 * value once" pattern) vs repeated-object (cache hits — the re-detection pattern the
 * consumer could memoize itself). A second group baselines the public predicates to show
 * hot-path vs cold-path magnitude and how much they even exercise the resolvers.
 *
 * Run: `npx vitest bench memoization` (NOT picked up by `test/**\/*.test.js`).
 */

import { bench, describe } from 'vitest';

import {
  getInertPrototypeOf,
  getDefinedConstructor,
  getDefinedConstructorName,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  objectHasOwn,
  getInertDescriptor,
  hasInertMethod,
  isCallable,
  isFunction,
  isStringValue,
  isValidWeakKey,
  getTypeSignature,
  objectCreate,
  doesImplementPromiseContract,
  isStructuralPromiseEquivalent,
  isPromise,
  isThenable,
  isPromiseLike,
} from '@/index.js';

import { foreignRealmEval } from '../_cross-realm.js';

/** @typedef {import('@/utility').PropertyDescriptor} PropertyDescriptor */
/** @typedef {import('@/utility').PropertyDescriptorMap} PropertyDescriptorMap */

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

// ----- Group 1: resolver head-to-head — current (no-cache) vs the dropped registry -----

describe('getInertPrototypeOf · distinct (registry miss)', () => {
  bench('registry', () => void getProtoMemo({}), opts);
  bench('current ', () => void getInertPrototypeOf({}), opts);
});
describe('getInertPrototypeOf · repeated (registry hit)', () => {
  bench('registry', () => void getProtoMemo(sharedObj), opts);
  bench('current ', () => void getInertPrototypeOf(sharedObj), opts);
});

describe('getDefinedConstructor · instance · distinct (registry miss)', () => {
  bench('registry', () => void getCtorMemo({}), opts);
  bench('current ', () => void getDefinedConstructor({}), opts);
});
describe('getDefinedConstructor · instance · repeated (registry hit)', () => {
  bench('registry', () => void getCtorMemo(sharedObj), opts);
  bench('current ', () => void getDefinedConstructor(sharedObj), opts);
});

describe('getDefinedConstructor · assumePrototype · repeated proto (registry hit)', () => {
  bench('registry', () => void getCtorMemo(sharedProto, true), opts);
  bench(
    'current ',
    () => void getDefinedConstructor(sharedProto, { assumePrototype: true }),
    opts,
  );
});

describe('getDefinedConstructorName · instance · distinct (registry miss)', () => {
  bench('registry', () => void getCtorNameMemo({}), opts);
  bench('current ', () => void getDefinedConstructorName({}), opts);
});
describe('getDefinedConstructorName · instance · repeated (registry hit)', () => {
  bench('registry', () => void getCtorNameMemo(sharedObj), opts);
  bench('current ', () => void getDefinedConstructorName(sharedObj), opts);
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

// ----- Group 3: full cold structural — current (shipped) vs registry vs threaded -----
//
// #059 dropped the two constructor registries; the shipped isStructuralPromiseEquivalent
// is now the threaded no-cache form. Three faithful shapes, self-checked to agree:
//   - registry : the pre-#059 form, resolving through the reconstructed memoized resolvers
//                (within-call dedup via cache + cross-call hits, at WeakMap cost).
//   - current  : the live shipped isStructuralPromiseEquivalent (threaded, no cache).
//   - threaded : the standalone no-cache threaded twin (resolve once, thread down).

const noop = () => undefined;

/** @param {unknown} ctor - the constructor whose `name` to read */
const nameOfCtor = (ctor) => {
  const name = /** @type {unknown} */ (
    getOwnPropertyDescriptor(/** @type {object} */ (ctor), 'name')?.value
  );
  return isStringValue(name) ? name : undefined;
};

/** @param {unknown} value - the candidate to test for structural Promise equivalence */
const threadedStructural = (value) => {
  const ctor = getCtorPlain(value);

  if (
    getTypeSignature(value) !== '[object Promise]' ||
    !ctor ||
    nameOfCtor(ctor) !== 'Promise' ||
    !doesImplementPromiseContract(value)
  ) {
    return false;
  }
  const proto = getProtoPlain(value);
  const protoCtor = getCtorPlain(proto, true);

  return (
    !!protoCtor &&
    getTypeSignature(proto) === '[object Promise]' &&
    nameOfCtor(protoCtor) === 'Promise' &&
    doesImplementPromiseContract(proto) &&
    protoCtor === ctor
  );
};

// ----- ruled-out registry candidates, reconstructed inline -----
//
// The shipped getDefinedConstructor / getDefinedConstructorName / getInertPrototypeOf are
// now NO-CACHE (#057 dropped prototypeRegistry, #059 dropped the two constructor
// registries). To bench current-vs-ruled-out directly, the dropped caches are rebuilt here:
// a per-value WeakMap, the constructor ones keyed (value, assumePrototype) via a nested
// `Map<'proto' | 'default', …>` (the #055 keying), guarded by `isValidWeakKey`.

/** @type {WeakMap<object, unknown>} */
const protoRegistry = new WeakMap();
/** @type {WeakMap<object, Map<string, unknown>>} */
const ctorRegistry = new WeakMap();
/** @type {WeakMap<object, Map<string, string | undefined>>} */
const ctorNameRegistry = new WeakMap();

/** @param {boolean} assumePrototype - the resolution interpretation */
const storageSlot = (assumePrototype) => (assumePrototype ? 'proto' : 'default');

/** @param {unknown} value - the value whose prototype to read (memoized) */
const getProtoMemo = (value) => {
  if (!isValidWeakKey(value)) {
    return getProtoPlain(value);
  }
  const key = /** @type {object} */ (value);

  if (protoRegistry.has(key)) {
    return protoRegistry.get(key);
  }
  const proto = getProtoPlain(value);
  protoRegistry.set(key, proto);
  return proto;
};

/**
 * @param {unknown} value - the value whose constructor to resolve (memoized)
 * @param {boolean} [assumePrototype] - treat `value` as a real prototype object
 */
const getCtorMemo = (value, assumePrototype = false) => {
  if (!isValidWeakKey(value)) {
    return getCtorPlain(value, assumePrototype);
  }
  const key = /** @type {object} */ (value);
  const slot = storageSlot(assumePrototype);
  const inner = ctorRegistry.get(key);

  if (inner?.has(slot)) {
    return inner.get(slot);
  }
  const ctor = getCtorPlain(value, assumePrototype);
  /** @type {Map<string, unknown>} */ (
    inner ?? ctorRegistry.set(key, new Map()).get(key)
  ).set(slot, ctor);
  return ctor;
};

/**
 * @param {unknown} value - the value whose constructor name to resolve (memoized)
 * @param {boolean} [assumePrototype] - treat `value` as a real prototype object
 */
const getCtorNameMemo = (value, assumePrototype = false) => {
  const slot = storageSlot(assumePrototype);
  const weak = isValidWeakKey(value);

  if (weak) {
    const cached = ctorNameRegistry.get(/** @type {object} */ (value));
    if (cached?.has(slot)) {
      return cached.get(slot);
    }
  }
  // faithful to the deleted getDefinedConstructorName: resolve via the (memoized) ctor,
  // so the constructor cache is populated as a side effect — the within-call dedup.
  const ctor = getCtorMemo(value, assumePrototype);
  const name = ctor ? nameOfCtor(ctor) : undefined;

  if (weak) {
    const key = /** @type {object} */ (value);
    /** @type {Map<string, string | undefined>} */ (
      ctorNameRegistry.get(key) ?? ctorNameRegistry.set(key, new Map()).get(key)
    ).set(slot, name);
  }
  return name;
};

// The pre-#059 isStructuralPromiseEquivalent: resolves through the memoized resolvers,
// so the value's constructor is resolved once and the second read hits the cache
// (within-call dedup), and repeated values hit across calls.
/** @param {unknown} value - the candidate to test for structural Promise equivalence */
const registryStructural = (value) => {
  if (
    getTypeSignature(value) !== '[object Promise]' ||
    getCtorNameMemo(value) !== 'Promise' ||
    !doesImplementPromiseContract(value)
  ) {
    return false;
  }
  const ctor = getCtorMemo(value);
  const proto = getProtoMemo(value);

  return (
    !!ctor &&
    getTypeSignature(proto) === '[object Promise]' &&
    getCtorNameMemo(proto, true) === 'Promise' &&
    doesImplementPromiseContract(proto) &&
    getCtorMemo(proto, true) === ctor
  );
};

// A fresh value driving the FULL cold structural path: own `Promise` tag +
// inherited contract + a prototype whose own `constructor` is named `Promise`,
// so both constructor resolutions run and both name checks pass. Distinct per
// call (fresh ctor + proto + instance) so the registries always miss — a faithful,
// cheap local proxy for a foreign Promise's cold-path cost.
const makeColdHit = () => {
  const PromiseCtor = function Promise() {
    return undefined;
  };
  const proto = {};
  Object.defineProperties(proto, {
    [Symbol.toStringTag]: { value: 'Promise' },
    constructor: { value: PromiseCtor },
    then: { value: noop },
    catch: { value: noop },
    finally: { value: noop },
  });
  return objectCreate(proto);
};

// self-check: the threaded prototype must agree with the live memoized impl.
for (const make of [
  makeColdHit,
  () => ({}),
  () => ({ [Symbol.toStringTag]: 'Promise', then: noop, catch: noop, finally: noop }),
]) {
  const v = make();
  const live = isStructuralPromiseEquivalent(v);

  if (threadedStructural(v) !== live || registryStructural(v) !== live) {
    throw new Error(
      'a structural candidate disagrees with isStructuralPromiseEquivalent',
    );
  }
}
const liveForeign = isStructuralPromiseEquivalent(sharedForeignPromise);
if (
  threadedStructural(sharedForeignPromise) !== liveForeign ||
  registryStructural(sharedForeignPromise) !== liveForeign
) {
  throw new Error('a structural candidate disagrees on a foreign Promise');
}

const sharedColdHit = makeColdHit();

describe('cold structural · distinct (registry miss)', () => {
  bench('registry', () => void registryStructural(makeColdHit()), opts);
  bench('current ', () => void isStructuralPromiseEquivalent(makeColdHit()), opts);
  bench('threaded', () => void threadedStructural(makeColdHit()), opts);
});
describe('cold structural · repeated synthetic (registry hit)', () => {
  bench('registry', () => void registryStructural(sharedColdHit), opts);
  bench('current ', () => void isStructuralPromiseEquivalent(sharedColdHit), opts);
  bench('threaded', () => void threadedStructural(sharedColdHit), opts);
});
describe('cold structural · repeated foreign Promise (registry hit)', () => {
  bench('registry', () => void registryStructural(sharedForeignPromise), opts);
  bench('current ', () => void isStructuralPromiseEquivalent(sharedForeignPromise), opts);
  bench('threaded', () => void threadedStructural(sharedForeignPromise), opts);
});

// ----- Group 4: contract-check variants (the unit isPromiseLike/isPromise burn) -----
//
// "value carries callable-data `then` + `catch` + `finally` in its chain" — the
// check `doesImplementPromiseContract` runs (and the evented contracts run with
// other keys). Three EQUIVALENT shapes, self-checked to agree:
//   - 3-walk    : the current form (three separate guarded chain walks).
//   - batched   : ONE walk, `getOwnPropertyDescriptors` per level (all own descs;
//                 the `doesMatchInertContract` / `getInertDescriptorsFor` approach).
//   - targeted  : ONE walk, targeted `getOwnPropertyDescriptor` per unfound key
//                 (no over-read).
// Reimplemented here (not imported) so the bench is self-contained and tests the
// approaches, independent of the in-progress `doesMatchInertContract` wiring.

const CONTRACT_KEYS = ['then', 'catch', 'finally'];

/** @param {PropertyDescriptor | undefined} descriptor - the resolved descriptor */
const isCallableMethod = (descriptor) => isCallable(descriptor?.value);

/** @param {unknown} value - the candidate to check for the Promise method contract */
const contract3Walk = (value) =>
  hasInertMethod(value, 'then') &&
  hasInertMethod(value, 'catch') &&
  hasInertMethod(value, 'finally');

/** @param {unknown} value - the candidate to check for the Promise method contract */
const contractBatched = (value) => {
  /** @type {Record<string, PropertyDescriptor | undefined>} */
  const found = { then: void 0, catch: void 0, finally: void 0 };
  const remaining = new Set(CONTRACT_KEYS);
  /** @type {unknown} */
  let level = value;

  try {
    while (remaining.size > 0 && level !== null && level !== void 0) {
      const descriptors = /** @type {PropertyDescriptorMap} */ (
        getOwnPropertyDescriptors(/** @type {object} */ (level))
      );

      for (const key of remaining) {
        if (objectHasOwn(descriptors, key)) {
          found[key] = descriptors[key];
          remaining.delete(key);
        }
      }
      level = getInertPrototypeOf(level) ?? null;
    }
  } catch {
    return false;
  }
  return (
    isCallableMethod(found.then) &&
    isCallableMethod(found.catch) &&
    isCallableMethod(found.finally)
  );
};

/** @param {unknown} value - the candidate to check for the Promise method contract */
const contractTargeted = (value) => {
  /** @type {Record<string, PropertyDescriptor | undefined>} */
  const found = { then: void 0, catch: void 0, finally: void 0 };
  const remaining = new Set(CONTRACT_KEYS);
  /** @type {unknown} */
  let level = value;

  try {
    while (remaining.size > 0 && level !== null && level !== void 0) {
      for (const key of remaining) {
        const descriptor = /** @type {PropertyDescriptor | undefined} */ (
          getOwnPropertyDescriptor(/** @type {object} */ (level), key)
        );

        if (descriptor) {
          found[key] = descriptor;
          remaining.delete(key);
        }
      }
      level = getInertPrototypeOf(level) ?? null;
    }
  } catch {
    return false;
  }
  return (
    isCallableMethod(found.then) &&
    isCallableMethod(found.catch) &&
    isCallableMethod(found.finally)
  );
};

//   - memoized  : the current 3-walk, but each per-key result is cached in a
//                 `WeakMap<object, Map<key, boolean>>`. Best case for the
//                 recurrence bet: caches a primitive boolean (cheapest storage,
//                 the whole walk is the recompute saved). Wins only when the same
//                 value recurs; pays WeakMap.get + nested-Map alloc/set on misses.

/** @type {WeakMap<object, Map<PropertyKey, boolean>>} */
const contractMemoCache = new WeakMap();

/**
 * @param {object} value - a weak-keyable candidate
 * @param {PropertyKey} key - the contract method name
 */
const memoHasInertMethod = (value, key) => {
  let perValue = contractMemoCache.get(value);
  if (perValue === void 0) {
    perValue = new Map();
    contractMemoCache.set(value, perValue);
  }
  let result = perValue.get(key);
  if (result === void 0) {
    result = hasInertMethod(value, key);
    perValue.set(key, result);
  }
  return result;
};

/** @param {unknown} value - the candidate to check for the Promise method contract */
const contractMemoized = (value) =>
  value !== null &&
  (typeof value === 'object' || typeof value === 'function') &&
  memoHasInertMethod(value, 'then') &&
  memoHasInertMethod(value, 'catch') &&
  memoHasInertMethod(value, 'finally');

//   - level-memo: the targeted walk, but the native `getOwnPropertyDescriptor` is
//                 cached keyed by the WALKED object (not the candidate) in a
//                 `WeakMap<object, Map<key, descriptor>>`. The hypothesis: distinct
//                 candidates share stable prototypes (`Promise.prototype`, …) that
//                 recur across every walk, so level-1+ hits even when level-0 (the
//                 candidate) is always distinct. Caches every level (faithful to a
//                 machine-room gOPD wrapper that can't tell candidate from proto);
//                 also avoids gOPD's per-call descriptor-object allocation on hits.

/** @type {WeakMap<object, Map<PropertyKey, PropertyDescriptor | undefined>>} */
const levelDescriptorCache = new WeakMap();

/**
 * @param {object} obj - the walked object (candidate or a prototype level)
 * @param {PropertyKey} key - the contract method name
 */
const memoGetOwnPropertyDescriptor = (obj, key) => {
  let perObject = levelDescriptorCache.get(obj);
  if (perObject === void 0) {
    perObject = new Map();
    levelDescriptorCache.set(obj, perObject);
  }
  // `has`, not `get`-vs-undefined: an absent descriptor (a miss) is a real,
  // cacheable answer at that level — remember it so the native call isn't repeated.
  if (perObject.has(key)) {
    return perObject.get(key);
  }
  const descriptor = /** @type {PropertyDescriptor | undefined} */ (
    getOwnPropertyDescriptor(obj, key)
  );
  perObject.set(key, descriptor);
  return descriptor;
};

/** @param {unknown} value - the candidate to check for the Promise method contract */
const contractLevelMemoized = (value) => {
  /** @type {Record<string, PropertyDescriptor | undefined>} */
  const found = { then: void 0, catch: void 0, finally: void 0 };
  const remaining = new Set(CONTRACT_KEYS);
  /** @type {unknown} */
  let level = value;

  try {
    while (remaining.size > 0 && level !== null && level !== void 0) {
      for (const key of remaining) {
        const descriptor = memoGetOwnPropertyDescriptor(
          /** @type {object} */ (level),
          key,
        );
        if (descriptor) {
          found[key] = descriptor;
          remaining.delete(key);
        }
      }
      level = getInertPrototypeOf(level) ?? null;
    }
  } catch {
    return false;
  }
  return (
    isCallableMethod(found.then) &&
    isCallableMethod(found.catch) &&
    isCallableMethod(found.finally)
  );
};

// self-check: all five contract shapes must agree.
for (const make of [
  makeColdHit,
  () => ({}),
  () => ({ then: noop, catch: noop, finally: noop }),
  () => Promise.resolve(1),
]) {
  const v = make();
  const a = contract3Walk(v);

  if (
    a !== contractBatched(v) ||
    a !== contractTargeted(v) ||
    a !== contractMemoized(v) ||
    a !== contractLevelMemoized(v)
  ) {
    throw new Error('contract variants disagree');
  }
}

// Distinct instances over a STABLE shared prototype — the machine-room hypothesis:
// the candidate (level 0) is always fresh, but `then/catch/finally` live one level
// up on a prototype that recurs across every walk.
const sharedContractProto = { then: noop, catch: noop, finally: noop };
const makeSharedProtoInstance = () => objectCreate(sharedContractProto);

let promiseSeed = 0;
// Distinct REAL promises: fresh instance each call, one real `Promise.prototype`.
const makeDistinctRealPromise = () => Promise.resolve((promiseSeed += 1));

const ownContract = { then: noop, catch: noop, finally: noop };

describe('contract · own then/catch/finally (level-0)', () => {
  bench('3-walk    ', () => void contract3Walk(ownContract), opts);
  bench('batched   ', () => void contractBatched(ownContract), opts);
  bench('targeted  ', () => void contractTargeted(ownContract), opts);
  bench('memoized  ', () => void contractMemoized(ownContract), opts);
  bench('level-memo', () => void contractLevelMemoized(ownContract), opts);
});
describe('contract · foreign Promise (1-level, repeated)', () => {
  bench('3-walk    ', () => void contract3Walk(sharedForeignPromise), opts);
  bench('batched   ', () => void contractBatched(sharedForeignPromise), opts);
  bench('targeted  ', () => void contractTargeted(sharedForeignPromise), opts);
  bench('memoized  ', () => void contractMemoized(sharedForeignPromise), opts);
  bench('level-memo', () => void contractLevelMemoized(sharedForeignPromise), opts);
});
describe('contract · fresh cold-hit, FRESH proto (1-level, distinct, no shared level)', () => {
  bench('3-walk    ', () => void contract3Walk(makeColdHit()), opts);
  bench('batched   ', () => void contractBatched(makeColdHit()), opts);
  bench('targeted  ', () => void contractTargeted(makeColdHit()), opts);
  bench('memoized  ', () => void contractMemoized(makeColdHit()), opts);
  bench('level-memo', () => void contractLevelMemoized(makeColdHit()), opts);
});
describe('contract · distinct instances, SHARED synthetic proto (the hypothesis)', () => {
  bench('3-walk    ', () => void contract3Walk(makeSharedProtoInstance()), opts);
  bench('targeted  ', () => void contractTargeted(makeSharedProtoInstance()), opts);
  bench('memoized  ', () => void contractMemoized(makeSharedProtoInstance()), opts);
  bench('level-memo', () => void contractLevelMemoized(makeSharedProtoInstance()), opts);
});
describe('contract · distinct REAL promises, shared Promise.prototype', () => {
  bench('3-walk    ', () => void contract3Walk(makeDistinctRealPromise()), opts);
  bench('targeted  ', () => void contractTargeted(makeDistinctRealPromise()), opts);
  bench('memoized  ', () => void contractMemoized(makeDistinctRealPromise()), opts);
  bench('level-memo', () => void contractLevelMemoized(makeDistinctRealPromise()), opts);
});
