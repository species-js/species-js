// @ts-check

/**
 * @module test/function/__config
 *
 * Test configuration for the `function` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrices. `function` is a
 * single conceptual LATTICE (not disjoint families like `primitive`), so the
 * axis-1 surface is carried as FOUR family matrices — one per lattice region —
 * each scoring only its region's predicate columns; a cross-family rejection
 * sweep then asserts every region's predicates reject the other regions'
 * representatives. This mirrors the spec's `## <predicate>` organization while
 * keeping the four regions auditable at a glance:
 *
 *   Callable floor:
 *     {@link callableFloorMatrix} — candidates × {isCallable, isFunction}
 *   Newable side:
 *     {@link newableMatrix} — candidates ×
 *       {hasConstructSlot, isNewableFunction, isES3Function, isClass, isCustomClass, isBuiltInClass}
 *   Async species:
 *     {@link asyncMatrix} — candidates × {isAsyncFunction}
 *   Generator species:
 *     {@link generatorMatrix} — candidates × {isGeneratorFunction, isAsyncGeneratorFunction, isAnyGeneratorFunction}
 *
 * `spec.test.js` drives the matrices + the cross-family + cross-cutting rejection
 * sweeps; the targeted axis suites (cross-realm, adversarial, throw-safety,
 * _internal) import the specific named factories they need. Spoof / graft /
 * hostile candidates are deliberately NOT in the clean matrices — their rationale
 * belongs in `adversarial.test.js` / `throw-safety.test.js` prose, not a silent
 * data row.
 *
 * Throw-safety note (function-specific): a CALLABLE hostile `Proxy` answers
 * `isCallable === true` (`typeof` is unspoofable and fires no trap), so the
 * throw-safety verdicts are NOT uniform the way `primitive`'s are. The
 * throw-safety matrix therefore asserts only NON-PROPAGATION (no predicate
 * throws); the specific hostile verdicts are pinned as targeted vectors
 * (`isFunction/B1`, `iCRAFI/B1`, `iCRAFI/B2`) in the adversarial / spec suites.
 *
 * Mirrors `docs/spec/FUNCTION.spec.md`.
 */

import { objectCreate } from '#index';

import { foreignRealmEval } from '../_cross-realm.js';

const T = true;
const F = false;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Predicate-name groups (the completeness-guard oracles)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

export const CALLABLE_PREDICATES = ['isCallable', 'isFunction'];

export const NEWABLE_PREDICATES = [
  'hasConstructSlot',
  'isNewableFunction',
  'isES3Function',
  'isClass',
  'isCustomClass',
  'isBuiltInClass',
];

export const ASYNC_PREDICATES = ['isAsyncFunction'];

export const GENERATOR_PREDICATES = [
  'isGeneratorFunction',
  'isAsyncGeneratorFunction',
  'isAnyGeneratorFunction',
];

/**
 * Every public predicate — the throw-safety completeness oracle (12 total: the
 * 11 narrowing predicates + the non-narrowing `hasConstructSlot`). The `@internal`
 * arms/sub-helpers carry their own throw-safety coverage in `_internal/`.
 */
export const PUBLIC_PREDICATE_NAMES = [
  ...CALLABLE_PREDICATES,
  ...NEWABLE_PREDICATES,
  ...ASYNC_PREDICATES,
  ...GENERATOR_PREDICATES,
];

/** The 11 NARROWING predicates (drop `hasConstructSlot`) — the CC rejection oracle. */
export const NARROWING_PREDICATE_NAMES = PUBLIC_PREDICATE_NAMES.filter(
  (name) => name !== 'hasConstructSlot',
);

/**
 * The 24 `@@throw-safe`-marked exports — the axis-5 completeness oracle (spec
 * `## Throw-safety (axis 5)`, Open item #1; ADRs #073/#076). The 12 public
 * predicates PLUS the 12 `@internal` helpers, in the spec's enumeration order.
 * `throw-safety.test.js` cross-checks this list BOTH against the markers parsed
 * out of `src/function.js` (source drift) AND against the imported function set
 * (test drift), then scores every one against the hostile-trap matrix.
 */
export const THROW_SAFE_MARKED = [
  'getFunctionSource',
  'isCallable',
  'isFunction',
  'hasConstructSlot',
  'isNewableFunction',
  'isES3Function',
  'isClass',
  'isCustomClass',
  'isBuiltInClass',
  'hasAsyncFunctionIdentitySignal',
  'hasAsyncFunctionPrototypeSurface',
  'isAlienRealmAsyncFunction',
  'isCurrentRealmAsyncFunctionInstance',
  'isAsyncFunction',
  'hasGeneratorFunctionIdentitySignal',
  'hasAsyncGeneratorFunctionIdentitySignal',
  'hasAnyGeneratorFunctionPrototypeSurface',
  'isAlienRealmGeneratorFunction',
  'isAlienRealmAsyncGeneratorFunction',
  'isCurrentRealmGeneratorFunctionInstance',
  'isCurrentRealmAsyncGeneratorFunctionInstance',
  'isGeneratorFunction',
  'isAsyncGeneratorFunction',
  'isAnyGeneratorFunction',
];

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Candidate factories (fresh, genuine value per call)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Fixture bodies carry a non-empty statement (`return undefined` / `yield
// undefined` / a real `await Promise.resolve()`) — an empty body trips
// `no-empty-function`, a no-await async trips `require-await`, and a class with
// no member trips `no-extraneous-class` (lint/type gotchas).

// --- Callable floor ---
export const plainFunction = () =>
  function () {
    return undefined;
  };
export const namedFunction = () =>
  function named() {
    return undefined;
  };
export const functionExpression = () =>
  /** @type {() => undefined} */ (
    function () {
      return undefined;
    }
  );
export const arrowFunction = () => () => undefined;
export const conciseMethod = () =>
  ({
    m() {
      return undefined;
    },
  }).m;
export const boundPlain = () =>
  function () {
    return undefined;
  }.bind(null);

// --- Newable: classes ---
export const customClass = () =>
  class C {
    m() {
      return undefined;
    }
  };
export const customSubclass = () =>
  class Foo extends Array {
    m() {
      return undefined;
    }
  };
export const arrayCtor = () => Array;
export const mapCtor = () => Map;
export const dateCtor = () => Date;
export const numberCtor = () => Number;
export const objectCtor = () => Object;
export const errorCtor = () => Error;
export const boundClass = () =>
  class C {
    m() {
      return undefined;
    }
  }.bind(null);

// --- Newable: the built-in factories with a throwing `[[Construct]]` slot ---
// `Symbol` / `BigInt` are `typeof === 'function'`, carry a `[[Construct]]` slot
// (a Proxy can wrap them as a constructor) AND a readonly own `prototype`, so
// they classify as BUILT-IN CLASSES by structure — the throw-on-`new` is
// orthogonal (spec `hCS/A4`, `isClass/A3`, `isBuiltInClass/A2`).
export const symbolCtor = () => Symbol;
export const bigintCtor = () => BigInt;

// --- Callable-but-not-newable built-ins (no `[[Construct]]` slot at all) ---
export const mathMax = () => Math.max;
export const parseIntFn = () => parseInt;

// --- Async species ---
export const asyncFunction = () =>
  async function () {
    await Promise.resolve();
  };
export const asyncArrow = () => async () => {
  await Promise.resolve();
};
export const asyncMethod = () =>
  ({
    async m() {
      await Promise.resolve();
    },
  }).m;
export const boundAsync = () =>
  (async () => {
    await Promise.resolve();
  }).bind(null);
export const promiseReturningArrow = () => () => Promise.resolve(undefined);

// --- Generator species (sync) ---
export const generatorFunction = () =>
  function* () {
    yield undefined;
  };
export const generatorMethod = () =>
  ({
    *m() {
      yield undefined;
    },
  }).m;
export const boundGenerator = () =>
  function* () {
    yield undefined;
  }.bind(null);

// --- Generator species (async) ---
export const asyncGeneratorFunction = () =>
  async function* () {
    await Promise.resolve();
    yield undefined;
  };
export const asyncGeneratorMethod = () =>
  ({
    async *m() {
      await Promise.resolve();
      yield undefined;
    },
  }).m;
export const boundAsyncGenerator = () =>
  async function* () {
    await Promise.resolve();
    yield undefined;
  }.bind(null);

// --- Cross-cutting rejections (typeof !== 'function') ---
export const nullValue = () => null;
export const undefinedValue = () => undefined;
export const primString = () => 'x';
export const primNumber = () => 42;
export const primBoolean = () => true;
export const primSymbol = () => Symbol('x');
export const primBigInt = () => 1n;
export const plainObject = () => ({});
export const arrayValue = () => [];
export const dateInstance = () => new Date();
export const regExp = () => /re/;
export const nullProtoObject = () => objectCreate(null);
// a non-callable object that merely OWNS the three method names — `isFunction`
// gates on `isCallable` first, so `typeof !== 'function'` rejects it (isFunction/R1).
export const nonCallableWithMethods = () => ({
  bind() {
    return undefined;
  },
  call() {
    return undefined;
  },
  apply() {
    return undefined;
  },
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 Callable-floor matrix — candidates × {isCallable, isFunction}
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} CallableRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isCallable: boolean, isFunction: boolean }} expected - outcome of the two floor predicates
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, CallableRow>} */
export const callableFloorMatrix = {
  plainFunction: {
    description: 'a `function () {}`',
    make: plainFunction,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A1', 'isFunction/A1'],
  },
  arrowFunction: {
    description: 'an arrow `() => {}`',
    make: arrowFunction,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A2', 'isFunction/A1'],
  },
  conciseMethod: {
    description: 'a concise method `({ m() {} }).m`',
    make: conciseMethod,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A2', 'isFunction/A1'],
  },
  customClass: {
    description: 'a `class C {}` (carries `[[Call]]`, inherits the three methods)',
    make: customClass,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A3', 'isFunction/A2'],
  },
  arrayCtor: {
    description: 'the built-in class `Array`',
    make: arrayCtor,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A3', 'isFunction/A2'],
  },
  asyncFunction: {
    description: 'an `async function () {}`',
    make: asyncFunction,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A4', 'isFunction/A3'],
  },
  generatorFunction: {
    description: 'a `function* () {}`',
    make: generatorFunction,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A4', 'isFunction/A3'],
  },
  asyncGeneratorFunction: {
    description: 'an `async function* () {}`',
    make: asyncGeneratorFunction,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A4', 'isFunction/A3'],
  },
  boundPlain: {
    description: 'a bound `(function () {}).bind(null)`',
    make: boundPlain,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A5', 'isFunction/A3'],
  },
  symbolCtor: {
    description: 'the built-in `Symbol` factory',
    make: symbolCtor,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A6', 'isFunction/A4'],
  },
  mathMax: {
    description: 'the built-in `Math.max` (callable, not newable)',
    make: mathMax,
    expected: { isCallable: T, isFunction: T },
    vectors: ['isCallable/A6', 'isFunction/A4'],
  },
  nonCallableWithMethods: {
    description: 'a non-callable object owning `bind`/`call`/`apply`',
    make: nonCallableWithMethods,
    expected: { isCallable: F, isFunction: F },
    vectors: ['isFunction/R1'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 Newable matrix — candidates × the six newable-side predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} NewableRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ hasConstructSlot: boolean, isNewableFunction: boolean, isES3Function: boolean, isClass: boolean, isCustomClass: boolean, isBuiltInClass: boolean }} expected - outcome of the six newable predicates
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, NewableRow>} */
export const newableMatrix = {
  plainFunction: {
    description: 'a `function () {}` — the ES3 shape (own writable `prototype`)',
    make: plainFunction,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: T,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/A1', 'isNewableFunction/A1', 'isES3Function/A1', 'isClass/R1'],
  },
  customClass: {
    description: 'a `class C {}` — custom class (own readonly `prototype`)',
    make: customClass,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: T,
      isCustomClass: T,
      isBuiltInClass: F,
    },
    vectors: [
      'hCS/A1',
      'isNewableFunction/A2',
      'isClass/A1',
      'isCustomClass/A1',
      'isBuiltInClass/R1',
    ],
  },
  customSubclass: {
    description: 'a `class Foo extends Array {}` — still custom (source starts `class`)',
    make: customSubclass,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: T,
      isCustomClass: T,
      isBuiltInClass: F,
    },
    vectors: ['isClass/A1', 'isCustomClass/A1'],
  },
  arrayCtor: {
    description: 'the built-in class `Array`',
    make: arrayCtor,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: T,
      isCustomClass: F,
      isBuiltInClass: T,
    },
    vectors: [
      'hCS/A2',
      'isNewableFunction/A2',
      'isClass/A2',
      'isCustomClass/R1',
      'isBuiltInClass/A1',
    ],
  },
  errorCtor: {
    description: 'the built-in class `Error`',
    make: errorCtor,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: T,
      isCustomClass: F,
      isBuiltInClass: T,
    },
    vectors: ['isBuiltInClass/A1'],
  },
  symbolCtor: {
    description:
      'the `Symbol` factory — newable-by-structure built-in class (throwing `[[Construct]]`)',
    make: symbolCtor,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: T,
      isCustomClass: F,
      isBuiltInClass: T,
    },
    vectors: [
      'hCS/A4',
      'isNewableFunction/A4',
      'isES3Function/R5',
      'isClass/A3',
      'isBuiltInClass/A2',
    ],
  },
  bigintCtor: {
    description:
      'the `BigInt` factory — newable-by-structure built-in class (throwing `[[Construct]]`)',
    make: bigintCtor,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: T,
      isCustomClass: F,
      isBuiltInClass: T,
    },
    vectors: ['hCS/A4', 'isNewableFunction/A4', 'isClass/A3', 'isBuiltInClass/A2'],
  },
  boundPlain: {
    description:
      'a bound `(function () {}).bind(null)` — newable, but own `prototype` stripped `[Q.002]`',
    make: boundPlain,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/A3', 'isNewableFunction/A3', 'isES3Function/R2', 'isClass/R2'],
  },
  boundClass: {
    description:
      'a bound `(class C {}).bind(null)` — newable, own `prototype` stripped `[Q.002]`',
    make: boundClass,
    expected: {
      hasConstructSlot: T,
      isNewableFunction: T,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['isNewableFunction/A3', 'isClass/R2'],
  },
  arrowFunction: {
    description: 'an arrow `() => {}` — no `[[Construct]]`',
    make: arrowFunction,
    expected: {
      hasConstructSlot: F,
      isNewableFunction: F,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/R1', 'isNewableFunction/R1', 'isES3Function/R3', 'isClass/R3'],
  },
  asyncFunction: {
    description: 'an `async function () {}` — non-newable species',
    make: asyncFunction,
    expected: {
      hasConstructSlot: F,
      isNewableFunction: F,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/R2', 'isNewableFunction/R2', 'isES3Function/R4', 'isClass/R3'],
  },
  generatorFunction: {
    description: 'a `function* () {}` — non-newable species',
    make: generatorFunction,
    expected: {
      hasConstructSlot: F,
      isNewableFunction: F,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/R2', 'isNewableFunction/R2', 'isES3Function/R4'],
  },
  mathMax: {
    description: 'the built-in `Math.max` — callable, genuinely no `[[Construct]]` slot',
    make: mathMax,
    expected: {
      hasConstructSlot: F,
      isNewableFunction: F,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/R3', 'isNewableFunction/R3', 'isClass/R4'],
  },
  parseIntFn: {
    description: 'the built-in `parseInt` — callable, no `[[Construct]]` slot',
    make: parseIntFn,
    expected: {
      hasConstructSlot: F,
      isNewableFunction: F,
      isES3Function: F,
      isClass: F,
      isCustomClass: F,
      isBuiltInClass: F,
    },
    vectors: ['hCS/R3', 'isNewableFunction/R3', 'isClass/R4'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 Async matrix — candidates × {isAsyncFunction}
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} AsyncRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isAsyncFunction: boolean }} expected - outcome of isAsyncFunction
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, AsyncRow>} */
export const asyncMatrix = {
  asyncFunction: {
    description: 'an `async function () {}`',
    make: asyncFunction,
    expected: { isAsyncFunction: T },
    vectors: ['isAsyncFunction/A1'],
  },
  asyncArrow: {
    description: 'an async arrow `async () => {}`',
    make: asyncArrow,
    expected: { isAsyncFunction: T },
    vectors: ['isAsyncFunction/A2'],
  },
  asyncMethod: {
    description: 'an async concise method `({ async m() {} }).m`',
    make: asyncMethod,
    expected: { isAsyncFunction: T },
    vectors: ['isAsyncFunction/A2'],
  },
  boundAsync: {
    description: 'a bound `(async () => {}).bind(null)` `[Q.002]`',
    make: boundAsync,
    expected: { isAsyncFunction: T },
    vectors: ['isAsyncFunction/A3'],
  },
  promiseReturningArrow: {
    description:
      'a `() => Promise.resolve()` — returns a Promise but is not tagged AsyncFunction',
    make: promiseReturningArrow,
    expected: { isAsyncFunction: F },
    vectors: ['isAsyncFunction/R2'],
  },
  asyncGeneratorFunction: {
    description:
      'an `async function* () {}` — generator-family intrinsic, not async-family',
    make: asyncGeneratorFunction,
    expected: { isAsyncFunction: F },
    vectors: ['isAsyncFunction/R3'],
  },
  plainFunction: {
    description: 'a plain `function () {}`',
    make: plainFunction,
    expected: { isAsyncFunction: F },
    vectors: ['isAsyncFunction/R1'],
  },
  generatorFunction: {
    description: 'a `function* () {}`',
    make: generatorFunction,
    expected: { isAsyncFunction: F },
    vectors: ['isAsyncFunction/R4'],
  },
  customClass: {
    description: 'a `class C {}`',
    make: customClass,
    expected: { isAsyncFunction: F },
    vectors: ['isAsyncFunction/R4'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis-1 Generator matrix — candidates × the three generator-family predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} GeneratorRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ isGeneratorFunction: boolean, isAsyncGeneratorFunction: boolean, isAnyGeneratorFunction: boolean }} expected - outcome of the three generator predicates
 * @property {string[]} vectors - spec vector IDs this row covers
 */

/** @type {Record<string, GeneratorRow>} */
export const generatorMatrix = {
  generatorFunction: {
    description: 'a `function* () {}` — sync generator',
    make: generatorFunction,
    expected: {
      isGeneratorFunction: T,
      isAsyncGeneratorFunction: F,
      isAnyGeneratorFunction: T,
    },
    vectors: ['isGeneratorFunction/A1', 'isAnyGeneratorFunction/A1'],
  },
  generatorMethod: {
    description: 'a concise generator method `({ *m() {} }).m`',
    make: generatorMethod,
    expected: {
      isGeneratorFunction: T,
      isAsyncGeneratorFunction: F,
      isAnyGeneratorFunction: T,
    },
    vectors: ['isGeneratorFunction/A2'],
  },
  boundGenerator: {
    description: 'a bound `(function* () {}).bind(null)` `[Q.002]`',
    make: boundGenerator,
    expected: {
      isGeneratorFunction: T,
      isAsyncGeneratorFunction: F,
      isAnyGeneratorFunction: T,
    },
    vectors: ['isGeneratorFunction/A3', 'isAnyGeneratorFunction/A3'],
  },
  asyncGeneratorFunction: {
    description: 'an `async function* () {}` — async generator',
    make: asyncGeneratorFunction,
    expected: {
      isGeneratorFunction: F,
      isAsyncGeneratorFunction: T,
      isAnyGeneratorFunction: T,
    },
    vectors: [
      'isAsyncGeneratorFunction/A1',
      'isAnyGeneratorFunction/A2',
      'isGeneratorFunction/R1',
    ],
  },
  asyncGeneratorMethod: {
    description: 'an async concise generator method `({ async *m() {} }).m`',
    make: asyncGeneratorMethod,
    expected: {
      isGeneratorFunction: F,
      isAsyncGeneratorFunction: T,
      isAnyGeneratorFunction: T,
    },
    vectors: ['isAsyncGeneratorFunction/A2'],
  },
  boundAsyncGenerator: {
    description: 'a bound `(async function* () {}).bind(null)` `[Q.002]`',
    make: boundAsyncGenerator,
    expected: {
      isGeneratorFunction: F,
      isAsyncGeneratorFunction: T,
      isAnyGeneratorFunction: T,
    },
    vectors: ['isAsyncGeneratorFunction/A3', 'isAnyGeneratorFunction/A3'],
  },
  asyncFunction: {
    description: 'an `async function () {}` — async-function family, not generator',
    make: asyncFunction,
    expected: {
      isGeneratorFunction: F,
      isAsyncGeneratorFunction: F,
      isAnyGeneratorFunction: F,
    },
    vectors: ['isAsyncGeneratorFunction/R2', 'isAnyGeneratorFunction/R1'],
  },
  plainFunction: {
    description: 'a plain `function () {}`',
    make: plainFunction,
    expected: {
      isGeneratorFunction: F,
      isAsyncGeneratorFunction: F,
      isAnyGeneratorFunction: F,
    },
    vectors: ['isGeneratorFunction/R2', 'isAnyGeneratorFunction/R2'],
  },
  customClass: {
    description: 'a `class C {}`',
    make: customClass,
    expected: {
      isGeneratorFunction: F,
      isAsyncGeneratorFunction: F,
      isAnyGeneratorFunction: F,
    },
    vectors: ['isGeneratorFunction/R3', 'isAnyGeneratorFunction/R2'],
  },
};

/** The four family matrices, keyed by region (for the spec.test.js loop). */
export const familyMatrices = {
  Callable: callableFloorMatrix,
  Newable: newableMatrix,
  Async: asyncMatrix,
  Generator: generatorMatrix,
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Cross-cutting rejection inputs (CC/nullish, CC/primitive, CC/non-callable-object)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// Every one is `typeof !== 'function'` → rejected by ALL 11 narrowing predicates
// (the `isCallable` / `isFunction` gate) AND by `hasConstructSlot`. spec.test.js
// sweeps each against the full public surface.

/** @type {Record<string, { description: string, make: () => unknown, vectors: string[] }>} */
export const crossCuttingRejections = {
  nullValue: { description: '`null`', make: nullValue, vectors: ['CC/nullish'] },
  undefinedValue: {
    description: '`undefined`',
    make: undefinedValue,
    vectors: ['CC/nullish'],
  },
  primString: {
    description: "the primitive `'x'`",
    make: primString,
    vectors: ['CC/primitive'],
  },
  primNumber: {
    description: 'the primitive `42`',
    make: primNumber,
    vectors: ['CC/primitive'],
  },
  primBoolean: {
    description: 'the primitive `true`',
    make: primBoolean,
    vectors: ['CC/primitive'],
  },
  primSymbol: {
    description: "a symbol value `Symbol('x')`",
    make: primSymbol,
    vectors: ['CC/primitive'],
  },
  primBigInt: {
    description: 'the literal `1n`',
    make: primBigInt,
    vectors: ['CC/primitive'],
  },
  plainObject: {
    description: 'a plain `{}`',
    make: plainObject,
    vectors: ['CC/non-callable-object'],
  },
  arrayValue: {
    description: 'an array `[]`',
    make: arrayValue,
    vectors: ['CC/non-callable-object'],
  },
  dateInstance: {
    description: 'a `new Date()`',
    make: dateInstance,
    vectors: ['CC/non-callable-object'],
  },
  regExp: { description: 'a `/re/`', make: regExp, vectors: ['CC/non-callable-object'] },
  nullProtoObject: {
    description: 'an `Object.create(null)`',
    make: nullProtoObject,
    vectors: ['CC/non-callable-object'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Foreign-realm factories (targeted by cross-realm.test.js)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// `%AsyncFunction%` / `%GeneratorFunction%` / `%AsyncGeneratorFunction%` ARE
// ECMAScript intrinsics, so a genuine foreign async/generator function is
// constructible in the vm realm — its `instanceof` against THIS realm's intrinsic
// fails, so it exercises the cross-realm structural (alien) arm (spec
// `isAsyncFunction/A4`, `isGeneratorFunction/A4`, `isAsyncGeneratorFunction/A4`).
// A foreign plain function / class checks the realm-independent newable side.

export const foreignAsyncFunction = () => foreignRealmEval('(async () => {})');
export const foreignGeneratorFunction = () => foreignRealmEval('(function* () {})');
export const foreignAsyncGeneratorFunction = () =>
  foreignRealmEval('(async function* () {})');
export const foreignPlainFunction = () => foreignRealmEval('(function () {})');
export const foreignArrowFunction = () => foreignRealmEval('(() => {})');
export const foreignClass = () => foreignRealmEval('(class C {})');

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Adversarial factories (targeted by adversarial.test.js — NON-throwing)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

// tag-spoof: a NON-callable object that merely claims the AsyncFunction tag —
// rejected at the `isCallable` floor (`typeof !== 'function'`), never reaching
// the identity signal. Proves the species predicates gate on callability first.
export const tagSpoofAsyncFunction = () => ({ [Symbol.toStringTag]: 'AsyncFunction' });
export const tagSpoofGeneratorFunction = () => ({
  [Symbol.toStringTag]: 'GeneratorFunction',
});

// arrow with a spoofed own `prototype` — still no `[[Construct]]`, so the newable
// chain rejects it before the own-`prototype` writable tell is ever read.
export const arrowWithSpoofedPrototype = () =>
  Object.assign(() => undefined, { prototype: { constructor: undefined } });

// isFunction spoof: a real function whose own `bind` is shadowed with a
// non-callable → `isCallable(value.bind)` fails (spec `isFunction/R2`).
export const shadowedBindFunction = () => {
  const fn = function () {
    return undefined;
  };
  Object.defineProperty(fn, 'bind', { value: 123, configurable: true });
  return fn;
};

// a source-tampered class: a `class` whose stringified source still begins
// `class`, so `isCustomClass` admits it — the source prefix is spec-defined and
// read through the realm-fixed capture, immune to instance `toString` tampering.
export const classWithTamperedInstanceToString = () => {
  const C = class C {
    m() {
      return undefined;
    }
  };
  Object.defineProperty(C, 'toString', {
    value: () => 'function C(){}',
    configurable: true,
  });
  return C;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Throw-safety matrix (hostile-input-class × predicate — the THROWING surface)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
// function's re-derived hostile set. Because a CALLABLE hostile `Proxy` answers
// `isCallable === true` (typeof fires no trap), the verdicts are NON-UNIFORM —
// so this matrix asserts only NON-PROPAGATION: for every hostile row, EVERY
// public predicate must return (never throw). The specific verdicts are pinned
// as targeted vectors elsewhere:
//   - get-trap → `isFunction === false` (isFunction/B1) — the guarantee every
//     downstream `@@throw-safe` marker rests on (the `.bind`/`.call`/`.apply`
//     reads are try/catch-wrapped).
//   - get-trap over a genuine local species → `isCurrentRealm*Instance === true`
//     in isolation (iCRAFI/B1) — `instanceof` walks `[[GetPrototypeOf]]`, never
//     firing the `get` trap; the orchestrator still returns false via the
//     isFunction gate.
//   - getPrototypeOf-trap → `isCurrentRealm*Instance === false` (iCRAFI/B2) — the
//     `instanceof` is wrapped; and the alien arms' `getSafePrototypeOf` absorbs it.
//   - getOwnPropertyDescriptor-trap on a newable → `isClass === false` (isClass/B1)
//     — routed through the throw-safe `hasOwnNonWritablePrototype`.

/**
 * @typedef {object} ThrowSafetyRow
 * @property {string} surface - the throw-surface class this row exercises
 * @property {() => unknown} make - fresh hostile-value factory
 */

/** @type {Record<string, ThrowSafetyRow>} */
export const throwSafetyMatrix = {
  getTrap: {
    surface:
      'get-trap: a callable `Proxy` whose `get` trap throws (reads of `.bind` etc.)',
    make: () =>
      new Proxy(
        function () {
          return undefined;
        },
        {
          get() {
            throw new Error('get-trap');
          },
        },
      ),
  },
  getPrototypeOfTrap: {
    surface: 'getPrototypeOf-trap: a callable `Proxy` whose `getPrototypeOf` throws',
    make: () =>
      new Proxy(
        function () {
          return undefined;
        },
        {
          getPrototypeOf() {
            throw new Error('getPrototypeOf-trap');
          },
        },
      ),
  },
  getOwnPropertyDescriptorTrap: {
    surface:
      'getOwnPropertyDescriptor-trap: a newable `Proxy` whose `getOwnPropertyDescriptor` throws',
    make: () =>
      new Proxy(
        class C {
          m() {
            return undefined;
          }
        },
        {
          getOwnPropertyDescriptor() {
            throw new Error('getOwnPropertyDescriptor-trap');
          },
        },
      ),
  },
  ownKeysTrap: {
    surface:
      'ownKeys-trap: a callable `Proxy` whose `ownKeys` throws (proto-surface reads)',
    make: () =>
      new Proxy(
        function () {
          return undefined;
        },
        {
          ownKeys() {
            throw new Error('ownKeys-trap');
          },
        },
      ),
  },
  tagGetterThrow: {
    surface: 'tag-getter-throw: a callable whose `Symbol.toStringTag` getter throws',
    make: () => {
      const fn = function () {
        return undefined;
      };
      Object.defineProperty(fn, Symbol.toStringTag, {
        get() {
          throw new Error('tag-trap');
        },
        configurable: true,
      });
      return fn;
    },
  },
  revokedCallableProxy: {
    surface:
      'revoked callable `Proxy`: every operation throws (the `getFunctionSource` capture)',
    make: () => {
      const { proxy, revoke } = Proxy.revocable(function () {
        return undefined;
      }, {});
      revoke();
      return proxy;
    },
  },
};
