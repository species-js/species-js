// @ts-check

/**
 * @module test/bound/__config
 *
 * Test configuration for the `bound` module: the candidate value-universe
 * (fresh-value factories) plus the axis-1 contract matrix scoring each
 * candidate against both predicates.
 *
 * The two predicates share an entrance-level and read the same three marks,
 * differing only in whether ANY or EVERY mark is required. The matrix therefore
 * scores both in one row, which makes the subset law
 * (`doesStronglyIndicateBoundFunction ⟹ doesIndicateBoundFunction`) and the
 * four-value disagreement set auditable at a glance rather than asserted in
 * prose.
 *
 * `spec.test.js` drives the matrix; the targeted axis suites (cross-realm,
 * adversarial, invariants) import the specific named factories they need.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06).
 */

import { objectCreate } from '@species-js/type-detection';

import { foreignRealmEval } from '../_cross-realm.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */

// ----- shared bind targets -----

/**
 * A plain two-parameter function — owns a writable `prototype`.
 *
 * @param {unknown} a - first parameter; arity is what partial application trims
 * @param {unknown} b - second parameter
 * @returns {unknown[]} both parameters
 */
export function plainTarget(a, b) {
  return [a, b];
}

/** A class — owns a non-writable `prototype`, keeps `[[Construct]]`. */
export class ClassTarget {
  /** @param {unknown} a - stored so the class is not constructor-only */
  constructor(a) {
    this.a = a;
  }

  /** @returns {unknown} the stored value */
  read() {
    return this.a;
  }
}

const methodHost = {
  concise() {
    return 1;
  },
  *generator() {
    yield 1;
  },
};

/**
 * Redefines a function's own `name`. `name` is `configurable: true` on every
 * function, which is exactly what makes mark 3 forgeable.
 *
 * @param {Callable} target - the function to rename
 * @param {string} name - the name to report
 * @returns {Callable} the same function, renamed
 */
export function renamed(target, name) {
  return /** @type {Callable} */ (
    Object.defineProperty(target, 'name', { value: name, configurable: true })
  );
}

/**
 * A `Proxy` whose traps report a forged own `name` while everything else
 * forwards. The only shape that satisfies every mark without being bound.
 *
 * @param {Callable} target - the proxied callable
 * @param {string} name - the name the traps report
 * @returns {Callable} the proxy
 */
export function nameTrappingProxy(target, name) {
  return /** @type {Callable} */ (
    new Proxy(target, {
      get: (t, key, receiver) =>
        key === 'name' ? name : /** @type {unknown} */ (Reflect.get(t, key, receiver)),
      getOwnPropertyDescriptor: (t, key) =>
        key === 'name'
          ? { value: name, writable: false, enumerable: false, configurable: true }
          : Reflect.getOwnPropertyDescriptor(t, key),
    })
  );
}

// ----- candidate factories (fresh value per call) -----

// bound forms — every one carries at least one mark
export const boundPlain = () => plainTarget.bind(null);
export const boundPlainPartial = () => plainTarget.bind(null, 1);
export const boundClass = () => ClassTarget.bind(null);
export const boundArrow = () => (() => undefined).bind(null);
export const boundConcise = () => methodHost.concise.bind(null);
export const boundGenerator = () => methodHost.generator.bind(null);
export const boundNativeNonConstructable = () => Math.max.bind(null);
export const boundNativeConstructable = () => Array.bind(null);
export const boundProxyConstructor = () => Proxy.bind(null);
export const doubleBound = () => plainTarget.bind(null).bind(null);

// unbound forms — rejected at the entrance-level or by carrying no mark
export const plainFunction = () => plainTarget;
export const classConstructor = () => ClassTarget;
export const arrowFunction = () => () => undefined;
export const conciseMethod = () => methodHost.concise;
export const generatorFunction = () => methodHost.generator;
export const namedNativeNonConstructable = () => Math.max;
export const namedNativeGlobal = () => parseInt;
export const nativeConstructable = () => Array;
export const webIdlConstructable = () => URL;
export const proxyConstructor = () => Proxy;

// documented boundaries — admitted by the cascade, three of them closed by the
// conjunction (BOUND.spec.md → the disagreement set)
export const functionPrototype = () => Function.prototype;
export const bareProxyOverArrow = () =>
  /** @type {Callable} */ (new Proxy(() => undefined, {}));
export const bareProxyOverClass = () =>
  /** @type {Callable} */ (/** @type {unknown} */ (new Proxy(ClassTarget, {})));
export const renamedBoundFunction = () => renamed(plainTarget.bind(null), 'innocent');
export const renamedArrow = () => renamed(() => undefined, 'bound plainTarget');
export const renamedPlainFunction = () =>
  renamed(function unbound() {
    return undefined;
  }, 'bound plainTarget');
export const nameTrappingProxyOverArrow = () =>
  nameTrappingProxy(() => undefined, 'bound x');

// forgery attempt that needs no exotic object — the condenser preserves the
// space inside `[native code]`, so an identifier can never impersonate the
// marker. The string-level proof is `gFSC/R2` in the utility suite.
const nativecode = 0;
export const conciseMethodWithMarkerLikeBody = () =>
  ({
    m() {
      return [nativecode];
    },
  }).m;

// cross-realm (axis 2) — the `Proxy` subtraction must recognise a foreign
// constructor structurally, having no identity match to fall back on
export const foreignBoundFunction = () =>
  /** @type {Callable} */ (foreignRealmEval('(function f(a){ return a; }).bind(null)'));
export const foreignProxyConstructor = () =>
  /** @type {Callable} */ (foreignRealmEval('Proxy'));
export const foreignBoundProxyConstructor = () =>
  /** @type {Callable} */ (foreignRealmEval('Proxy.bind(null)'));

// non-callables (entrance-level)
export const revokedCallableProxy = () => {
  const revocable = Proxy.revocable(() => undefined, {});
  revocable.revoke();
  return revocable.proxy;
};

// ----- axis-1 contract matrix -----

/**
 * @typedef {object} SpecRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ doesIndicateBoundFunction: boolean, doesStronglyIndicateBoundFunction: boolean }} expected - expected outcome of each predicate
 * @property {string[]} vectors - spec vector IDs this row covers
 */

const BOTH = { doesIndicateBoundFunction: true, doesStronglyIndicateBoundFunction: true };
const NEITHER = {
  doesIndicateBoundFunction: false,
  doesStronglyIndicateBoundFunction: false,
};
const CASCADE_ONLY = {
  doesIndicateBoundFunction: true,
  doesStronglyIndicateBoundFunction: false,
};

/** @type {Record<string, SpecRow>} */
export const specMatrix = {
  boundPlain: {
    description: 'a bound plain function',
    make: boundPlain,
    expected: BOTH,
    vectors: ['dIBF/A1', 'dSIBF/A1'],
  },
  boundPlainPartial: {
    description: 'a bound plain function with a partially applied argument',
    make: boundPlainPartial,
    expected: BOTH,
    vectors: ['dIBF/A2'],
  },
  boundClass: {
    description: 'a bound class — keeps `[[Construct]]`',
    make: boundClass,
    expected: BOTH,
    vectors: ['dIBF/A3'],
  },
  boundArrow: {
    description: 'a bound arrow — never had `[[Construct]]`',
    make: boundArrow,
    expected: BOTH,
    vectors: ['dIBF/A4'],
  },
  boundConcise: {
    description: 'a bound concise method',
    make: boundConcise,
    expected: BOTH,
    vectors: ['dIBF/A5'],
  },
  boundGenerator: {
    description: 'a bound generator function',
    make: boundGenerator,
    expected: BOTH,
    vectors: ['dIBF/A6'],
  },
  boundNativeNonConstructable: {
    description: 'a bound built-in without `[[Construct]]` (`Math.max`)',
    make: boundNativeNonConstructable,
    expected: BOTH,
    vectors: ['dIBF/A7'],
  },
  boundNativeConstructable: {
    description: 'a bound native constructor (`Array`)',
    make: boundNativeConstructable,
    expected: BOTH,
    vectors: ['dIBF/A8'],
  },
  boundProxyConstructor: {
    description: 'a bound `Proxy` — named `bound Proxy`, so not subtracted',
    make: boundProxyConstructor,
    expected: BOTH,
    vectors: ['dIBF/A9'],
  },
  doubleBound: {
    description: 'a double-bound function — `name` is `bound bound plainTarget`',
    make: doubleBound,
    expected: BOTH,
    vectors: ['dIBF/A10'],
  },
  foreignBoundFunction: {
    description: 'a cross-realm bound function',
    make: foreignBoundFunction,
    expected: BOTH,
    vectors: ['dIBF/A12', 'dSIBF/A11'],
  },
  foreignBoundProxyConstructor: {
    description: 'a cross-realm bound `Proxy`',
    make: foreignBoundProxyConstructor,
    expected: BOTH,
    vectors: ['dIBF/A12', 'dSIBF/A11'],
  },

  // --- the four-value disagreement set (BOUND.spec.md → Relationship) ---
  functionPrototype: {
    description: '`Function.prototype` — anonymous and native, but unnamed',
    make: functionPrototype,
    expected: CASCADE_ONLY,
    vectors: ['dIBF/B1', 'dSIBF/R10'],
  },
  bareProxyOverArrow: {
    description: 'a bare `Proxy` over an arrow — no `[[SourceText]]`, forwarded `name`',
    make: bareProxyOverArrow,
    expected: CASCADE_ONLY,
    vectors: ['dIBF/B2', 'dSIBF/R13'],
  },
  renamedArrow: {
    description: 'an arrow renamed to look bound — mark 3 forged, mark 2 intact',
    make: renamedArrow,
    expected: CASCADE_ONLY,
    vectors: ['dIBF/B3', 'dSIBF/R11'],
  },
  renamedBoundFunction: {
    description: 'a genuine bound function whose `name` was overwritten',
    make: renamedBoundFunction,
    expected: CASCADE_ONLY,
    vectors: ['dIBF/A11', 'dSIBF/R12'],
  },

  // --- rejected by both ---
  plainFunction: {
    description: 'a plain function — owns a `prototype`',
    make: plainFunction,
    expected: NEITHER,
    vectors: ['bound/X3', 'dIBF/R1'],
  },
  classConstructor: {
    description: 'a class — owns a `prototype`',
    make: classConstructor,
    expected: NEITHER,
    vectors: ['bound/X3', 'dIBF/R1'],
  },
  generatorFunction: {
    description: 'a generator function — owns a `prototype`',
    make: generatorFunction,
    expected: NEITHER,
    vectors: ['bound/X3', 'dIBF/R1'],
  },
  arrowFunction: {
    description: 'an arrow — prototype-less, but carries no mark',
    make: arrowFunction,
    expected: NEITHER,
    vectors: ['dIBF/R2'],
  },
  conciseMethod: {
    description: 'a concise method — prototype-less, but carries no mark',
    make: conciseMethod,
    expected: NEITHER,
    vectors: ['dIBF/R2'],
  },
  namedNativeNonConstructable: {
    description: '`Math.max` — native but named, so not the anonymous form',
    make: namedNativeNonConstructable,
    expected: NEITHER,
    vectors: ['dIBF/R3'],
  },
  namedNativeGlobal: {
    description: '`parseInt` — native but named',
    make: namedNativeGlobal,
    expected: NEITHER,
    vectors: ['dIBF/R3'],
  },
  nativeConstructable: {
    description: '`Array` — owns a `prototype`',
    make: nativeConstructable,
    expected: NEITHER,
    vectors: ['dIBF/R4'],
  },
  webIdlConstructable: {
    description: '`URL` — owns a `prototype`',
    make: webIdlConstructable,
    expected: NEITHER,
    vectors: ['dIBF/R4'],
  },
  proxyConstructor: {
    description: 'the `Proxy` constructor — constructable with no own `prototype`',
    make: proxyConstructor,
    expected: NEITHER,
    vectors: ['dIBF/R5'],
  },
  foreignProxyConstructor: {
    description: 'a cross-realm `Proxy` constructor — subtracted structurally',
    make: foreignProxyConstructor,
    expected: NEITHER,
    vectors: ['dIBF/R6'],
  },
  renamedPlainFunction: {
    description: 'a plain function renamed to look bound — owns a `prototype`',
    make: renamedPlainFunction,
    expected: NEITHER,
    vectors: ['dIBF/R7'],
  },
  conciseMethodWithMarkerLikeBody: {
    description: 'a concise method whose body is an identifier-in-brackets literal',
    make: conciseMethodWithMarkerLikeBody,
    expected: NEITHER,
    vectors: ['dIBF/R8'],
  },
  bareProxyOverClass: {
    description: 'a bare `Proxy` over a class — forwards the own `prototype`',
    make: bareProxyOverClass,
    expected: NEITHER,
    vectors: ['dIBF/R9'],
  },
  revokedCallableProxy: {
    description: 'a revoked callable `Proxy` — `isFunction` fails on the revoked traps',
    make: revokedCallableProxy,
    expected: NEITHER,
    vectors: ['bound/X4'],
  },

  // --- the boundary the conjunction does NOT close ---
  nameTrappingProxyOverArrow: {
    description: 'a `Proxy` that also traps `name` — satisfies every mark',
    make: nameTrappingProxyOverArrow,
    expected: BOTH,
    vectors: ['dSIBF/B1'],
  },
};

// ----- cross-cutting entrance-level rejections (`bound/X1`) -----

/** @type {Record<string, () => unknown>} */
export const crossCuttingRejections = {
  undefinedValue: () => undefined,
  nullValue: () => null,
  numberValue: () => 42,
  stringValue: () => 'x',
  plainObject: () => ({}),
  arrayValue: () => [],
  symbolValue: () => Symbol('s'),
  bigintValue: () => 0n,
  booleanValue: () => true,
  nullPrototypeObject: () => objectCreate(null),
};

// ----- throw-safety (axis 5) — this module's marked set -----

/**
 * The `@@throw-safe` markers carried by `src/bound.js` and `src/bound.d.ts`.
 * `throw-safety.test.js` cross-checks this list BOTH against the markers parsed
 * out of the source (source drift) AND against the imported bound set (test
 * drift), then routes hostile values into each export and asserts
 * non-propagation.
 *
 * `#utility`'s four marked exports are scored by `test/utility/__config.js`;
 * each module owns its own oracle.
 */
export const THROW_SAFE_MARKED = [
  'doesIndicateBoundFunction',
  'doesStronglyIndicateBoundFunction',
];

// ----- throw-safety matrix (axis 3): hostile-input class × predicate -----
// Both predicates take `unknown`, so every value below is IN CONTRACT and the
// marker's promise applies to all of them (BOUND.spec.md → the marker's
// contract). Each cell asserts BOTH not-thrown AND the honest verdict.

/**
 * @typedef {object} ThrowSafetyRow
 * @property {string} surface - the throw-surface class this row exercises
 * @property {() => unknown} make - fresh hostile-value factory
 * @property {{ doesIndicateBoundFunction: boolean, doesStronglyIndicateBoundFunction: boolean }} expected - honest verdict per predicate (neither may throw)
 */

/** @type {Record<string, ThrowSafetyRow>} */
export const throwSafetyMatrix = {
  revokedProxy: {
    surface: 'revoked callable `Proxy` — every trap throws',
    make: revokedCallableProxy,
    expected: NEITHER,
  },
  // These two proxy an ARROW, so they are also the documented `Proxy` boundary:
  // a proxy has no `[[SourceText]]`, so mark 2 is satisfied honestly and the
  // cascade admits them. The trap makes `hasOwnPrototype` fail closed to `false`,
  // which passes the entrance-level rather than blocking it. Stated explicitly so
  // the verdict is not later mistaken for a leak and "fixed".
  throwingDescriptorTrap: {
    surface: 'throwing `getOwnPropertyDescriptor` trap',
    make: () =>
      new Proxy(() => undefined, {
        getOwnPropertyDescriptor() {
          throw new Error('hostile descriptor trap');
        },
      }),
    expected: CASCADE_ONLY,
  },
  throwingGetTrap: {
    surface: 'throwing `get` trap',
    make: () =>
      new Proxy(() => undefined, {
        get() {
          throw new Error('hostile get trap');
        },
      }),
    expected: NEITHER,
  },
  throwingOwnKeysTrap: {
    surface: 'throwing `ownKeys` trap',
    make: () =>
      new Proxy(() => undefined, {
        ownKeys() {
          throw new Error('hostile ownKeys trap');
        },
      }),
    expected: CASCADE_ONLY,
  },
  throwingNameAccessor: {
    surface: 'own accessor `name` whose getter throws',
    make: () =>
      Object.defineProperty(
        function named() {
          return undefined;
        },
        'name',
        {
          get() {
            throw new Error('hostile name accessor');
          },
          configurable: true,
        },
      ),
    expected: NEITHER,
  },
  nullPrototypeObject: {
    surface: 'prototype-less object — no inherited anything',
    make: () => objectCreate(null),
    expected: NEITHER,
  },
};
