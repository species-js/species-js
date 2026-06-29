// @ts-check

/**
 * @module test/thenable/__config
 *
 * Test configuration for the `thenable` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrix scoring each clean
 * candidate against the three chain predicates
 * (`isThenable` ⊇ `isPromiseLike` ⊇ `isPromise`). The matrix makes the
 * superset lattice and its strictness boundaries auditable at a glance.
 *
 * `spec.test.js` drives the matrix; the targeted axis suites (cross-realm,
 * adversarial, _internal) import the specific named factories they need. Spoof
 * and documented-admission candidates (accessor traps, tag-spoof, the #052
 * graft) are deliberately NOT in the matrix — their rationale belongs in
 * `adversarial.test.js` prose, not a silent data row.
 *
 * Mirrors `docs/spec/THENABLE.spec.md`.
 */

import { objectCreate } from '@/index.js';

import { foreignRealmEval, createForeignRealm } from '../_cross-realm.js';

// A non-empty no-op callable, used as the `then` / `catch` / `finally` member
// value (a callable data property is what the structural arms read).
export const noop = () => undefined;

// ----- candidate factories (fresh value per call) -----

// clean contract shapes (matrix-scored)
export const localPromise = () => Promise.resolve(1);
export const localPromiseViaConstructor = () =>
  new Promise(() => {
    // never settles — identity, not resolution, is what isPromise/A2 scores
  });
export const promiseSubclassInstance = () =>
  new (class extends Promise {})((resolve) => {
    resolve(undefined);
  });
export const ownThenable = () => ({ then: noop });
export const inheritedThenable = () => objectCreate({ then: noop });
export const callableThenable = () => Object.assign(() => undefined, { then: noop });
export const fullContract = () => ({ then: noop, catch: noop, finally: noop });
export const userlandPromiseLike = () => ({ then: noop, catch: noop, finally: noop });
export const nonCallableThen = () => ({ then: 'nope' });
export const thenCatchOnly = () => ({ then: noop, catch: noop });

// spoof / boundary shapes (targeted by adversarial.test.js)
export const accessorThen = () => ({
  get then() {
    return noop;
  },
});
export const accessorFinally = () => ({
  then: noop,
  catch: noop,
  get finally() {
    return noop;
  },
});
export const tagSpoofedPromise = () => ({
  [Symbol.toStringTag]: 'Promise',
  then: noop,
  catch: noop,
  finally: noop,
});
export const promisePrototypeGraft = () => objectCreate(Promise.prototype);

// foreign-realm shapes (targeted by cross-realm.test.js)
export const foreignPromise = () => foreignRealmEval('Promise.resolve(1)');
export const foreignPromiseSubclassInstance = () =>
  foreignRealmEval('new (class MyPromise extends Promise {})((r) => r())');

// matrix-scored edge shapes (added after the adversarial probe round)
export const classThen = () => ({
  then: class {
    run() {
      return 0;
    }
  },
});
export const nullProtoOwnThen = () => Object.assign(objectCreate(null), { then: noop });
export const ownNonCallableShadowsThen = () =>
  Object.assign(objectCreate({ then: noop }), { then: 'nope' });

// throw-safety / tamper probes (targeted by adversarial.test.js)
export const throwingGetterThen = () => ({
  get then() {
    throw new Error('then-getter');
  },
});
// callable own `then` data property, but `catch` is a throwing accessor — the
// isThenable/isPromiseLike divergence under a throwing LATER-method getter:
// isThenable finds the own `then` (true), isPromiseLike's contract read hits the
// `catch` accessor and rejects it inertly (false), neither invokes the getter.
export const throwingGetterCatchAfterThen = () => ({
  then: noop,
  get catch() {
    throw new Error('catch-getter');
  },
});
export const throwingDescTrapProxy = () =>
  new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error('desc-trap');
      },
    },
  );
export const throwingProtoTrapProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('proto-trap');
      },
    },
  );
export const throwingTagGetterWithContract = () => ({
  get [Symbol.toStringTag]() {
    throw new Error('tag-getter');
  },
  then: noop,
  catch: noop,
  finally: noop,
});
// own tag 'Promise' + own contract, but its `[[Prototype]]` is a Proxy whose
// `getOwnPropertyDescriptor` trap throws — so the constructor-walk
// (`getDefinedConstructor`) pivots INTO the hostile proto. Pre-#056 this made
// `isPromise` propagate the trap's throw; now the walk routes through
// `getInertDescriptor` → `undefined` → `isPromise` answers `false`.
export const taggedPromiseOverThrowingProtoTrap = () =>
  Object.assign(
    objectCreate(
      new Proxy(
        {},
        {
          getOwnPropertyDescriptor() {
            throw new Error('proto-desc-trap');
          },
          getPrototypeOf() {
            return null;
          },
        },
      ),
    ),
    { [Symbol.toStringTag]: 'Promise', then: noop, catch: noop, finally: noop },
  );
export const ownConstructorNamedPromise = () => ({
  [Symbol.toStringTag]: 'Promise',
  then: noop,
  catch: noop,
  finally: noop,
  constructor: function Promise() {
    return undefined;
  },
});
// A NULL-prototype tag-spoof carrying a full OWN contract. Distinct from
// `tagSpoofedPromise` (whose chain reaches `Object`): the constructor-walk pivots
// to the value's `[[Prototype]]` — here `null` — so the name resolves to
// `undefined`, exercising the null-`[[Prototype]]` branch of the cross-realm arm.
export const nullProtoTagSpoofedPromise = () =>
  Object.assign(objectCreate(null), {
    [Symbol.toStringTag]: 'Promise',
    then: noop,
    catch: noop,
    finally: noop,
  });

// ----- axis-4 helper-unit inputs (prototype objects + constructors) -----
// The `@internal` structural-equivalence helpers operate on PROTOTYPE objects
// and constructor pairs, not the value-universe the matrix scores.
//
// CONTAMINATION DISCIPLINE (decision #054): the constructor registries are
// value-keyed, so a no-option and an `{ assumePrototype: true }` resolution of
// the SAME object poison each other. To stay order-independent, each prototype
// object below is resolved under exactly ONE option-setting across the suite:
//   - `localPromisePrototype` / `foreignPromisePrototype`  → assumePrototype-only
//   - `isolatedForeignPromisePrototype`                    → no-option-only (fresh realm)
export const localPromisePrototype = () => Promise.prototype;
export const foreignPromisePrototype = () => foreignRealmEval('Promise.prototype');
export const foreignPromiseConstructor = () => foreignRealmEval('Promise');
// Fresh, isolated realm: its `Promise.prototype` is resolved ONLY no-option
// (hPIS/R1), so poisoning it cannot reach any `assumePrototype` vector.
export const isolatedForeignPromisePrototype = () =>
  createForeignRealm()('Promise.prototype');

// ----- axis-1 contract matrix -----
// Each row: a fresh-value factory + the expected outcome of all three chain
// predicates + the spec vector IDs the row covers. `spec.test.js` asserts every
// cell and guards that every row scores every predicate (no silent gaps).

/**
 * @typedef {object} SpecRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isThenable: boolean, isPromiseLike: boolean, isPromise: boolean }} expected - expected outcome of each chain predicate
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, SpecRow>} */
export const specMatrix = {
  localPromise: {
    description: 'a local Promise instance',
    make: localPromise,
    expected: { isThenable: true, isPromiseLike: true, isPromise: true },
    vectors: ['isThenable/A1', 'isPromiseLike/A1', 'isPromise/A1'],
  },
  localPromiseViaConstructor: {
    description: 'a local `new Promise(() => {})` instance',
    make: localPromiseViaConstructor,
    expected: { isThenable: true, isPromiseLike: true, isPromise: true },
    vectors: ['isPromise/A2'],
  },
  promiseSubclassInstance: {
    description: 'a local Promise subclass instance',
    make: promiseSubclassInstance,
    expected: { isThenable: true, isPromiseLike: true, isPromise: false },
    vectors: ['isThenable/A2', 'isPromiseLike/A2', 'isPromise/R1'],
  },
  ownThenable: {
    description: 'an object with an own callable `then`',
    make: ownThenable,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/A3', 'isPromiseLike/R1', 'isPromise/R5'],
  },
  inheritedThenable: {
    description: 'an object inheriting a callable `then`',
    make: inheritedThenable,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/A4'],
  },
  callableThenable: {
    description: 'a callable carrying a `then` data property',
    make: callableThenable,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/A6'],
  },
  fullContract: {
    description: 'an object with own then/catch/finally',
    make: fullContract,
    expected: { isThenable: true, isPromiseLike: true, isPromise: false },
    vectors: ['isPromiseLike/A3', 'isPromise/R4'],
  },
  userlandPromiseLike: {
    description: 'a userland Promise-like (three methods)',
    make: userlandPromiseLike,
    expected: { isThenable: true, isPromiseLike: true, isPromise: false },
    vectors: ['isPromiseLike/A5'],
  },
  nonCallableThen: {
    description: 'an object whose `then` is not callable',
    make: nonCallableThen,
    expected: { isThenable: false, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/R1'],
  },
  thenCatchOnly: {
    description: 'an object with then + catch but no finally',
    make: thenCatchOnly,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
    vectors: ['isPromiseLike/R2'],
  },
  empty: {
    description: 'a plain empty object',
    make: () => ({}),
    expected: { isThenable: false, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/R3'],
  },
  classThen: {
    description: '`then` is a class (callable)',
    make: classThen,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/A7'],
  },
  nullProtoOwnThen: {
    description: 'a null-prototype object with an own callable `then`',
    make: nullProtoOwnThen,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/A8'],
  },
  ownNonCallableShadowsThen: {
    description: 'an own non-callable `then` shadowing an inherited callable `then`',
    make: ownNonCallableShadowsThen,
    expected: { isThenable: false, isPromiseLike: false, isPromise: false },
    vectors: ['isThenable/R4'],
  },
};

// ----- cross-cutting rejection inputs (all three predicates → false) -----
export const crossCuttingRejections = {
  nullish: [null, undefined],
  falsyPrimitive: [0, '', false, NaN, 0n],
  truthyPrimitive: [42, 'x', true, 1n, Symbol('s')],
};

// ----- throw-safety matrix (axis 3): hostile-input-class × predicate -----
// The universal invariant (docs/spec/README.md → "Throw-safety — the universal
// invariant"; THENABLE.spec.md Module-contract Throw-safety paragraph): every
// predicate answers a boolean on EVERY hostile input and never propagates a
// throw. `throw-safety.test.js` asserts BOTH not-thrown AND the honest by-contract
// verdict for every cell; the invariant is met ⟺ every cell is filled. The
// throwing-tag and pivoted-proto values carry a real method contract, so the
// by-contract predicates (isThenable/isPromiseLike) admit them while isPromise
// (which reads the tag/constructor) rejects.

/**
 * @typedef {object} ThrowSafetyRow
 * @property {string} surface - the throw-surface class this row exercises
 * @property {() => unknown} make - fresh hostile-value factory
 * @property {{ isThenable: boolean, isPromiseLike: boolean, isPromise: boolean }} expected - honest verdict per predicate (all must NOT throw)
 */

/** @type {Record<string, ThrowSafetyRow>} */
export const throwSafetyMatrix = {
  accessorThrow: {
    surface: 'accessor-throw: `{ get then() { throw } }`',
    make: throwingGetterThen,
    expected: { isThenable: false, isPromiseLike: false, isPromise: false },
  },
  accessorThrowOnLaterMethod: {
    surface: 'accessor-throw on a later method: `{ then, get catch() { throw } }`',
    make: throwingGetterCatchAfterThen,
    expected: { isThenable: true, isPromiseLike: false, isPromise: false },
  },
  descriptorTrap: {
    surface: 'descriptor-trap: Proxy whose `getOwnPropertyDescriptor` throws',
    make: throwingDescTrapProxy,
    expected: { isThenable: false, isPromiseLike: false, isPromise: false },
  },
  prototypeTrap: {
    surface: 'prototype-trap: Proxy whose `getPrototypeOf` throws',
    make: throwingProtoTrapProxy,
    expected: { isThenable: false, isPromiseLike: false, isPromise: false },
  },
  tagGetterThrow: {
    surface: 'tag-getter-throw: throwing `Symbol.toStringTag` + full contract',
    make: throwingTagGetterWithContract,
    expected: { isThenable: true, isPromiseLike: true, isPromise: false },
  },
  pivotedProtoDescriptorTrap: {
    surface: 'descriptor-trap on pivoted `[[Prototype]]` + own tag/contract',
    make: taggedPromiseOverThrowingProtoTrap,
    expected: { isThenable: true, isPromiseLike: true, isPromise: false },
  },
};
