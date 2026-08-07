// @ts-check

/**
 * @module test/utility/__config
 *
 * Test configuration for the `utility` module: the axis-4 helper vectors frozen
 * in `BOUND.spec.md`, the hostile sets the `@@throw-safe` markers promise over,
 * and this module's marked-set oracle.
 *
 * `getFunctionSourceCondensate` takes a SOURCE rather than a callable, and that
 * is the whole reason it exists as a separate export. The JavaScriptCore /
 * SpiderMonkey and tab-separated forms of the NativeFunction grammar cannot be
 * produced by any real function under a single-engine runner, so they are
 * reachable only by feeding the condenser directly — `gFSC/A2` and `gFSC/A3`
 * exist nowhere else in the package's suites.
 *
 * The two `Proxy` recognizers are scored in ONE matrix because
 * `doesMatchProxyConstructor` is defined as `identity || hasProxyConstructorShape`
 * and the local `Proxy` satisfies the shape arm as well. The two are therefore
 * extensionally equal, and the shared matrix makes that auditable at a glance
 * rather than asserted in prose; `spec.test.js` pins it as a law.
 *
 * The canonical condensed form is written out as a literal here rather than
 * imported from `CONDENSED_NATIVE_SOURCE_FOUNDATION`. An oracle that imports the
 * value it checks cannot detect a change to that value.
 *
 * Mirrors `docs/spec/BOUND.spec.md` (FROZEN 2026-08-06 · AMENDED 2026-08-07) — the
 * `## Helper specification (axis 4)` section.
 */

import { foreignRealmEval } from '../_cross-realm.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */

/**
 * The condensed anonymous NativeFunction form, restated independently of the
 * module under test.
 */
export const CANONICAL_CONDENSED_SOURCE = 'function(){[native code]}';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Shared Callables
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A plain two-parameter function.
 *
 * @param {unknown} a - first parameter
 * @param {unknown} b - second parameter
 * @returns {unknown[]} both parameters
 */
export function plainTarget(a, b) {
  return [a, b];
}

/**
 * An arrow whose condensed source the spec pins exactly.
 *
 * Declared at module scope with its JSDoc ABOVE the declaration rather than
 * written inline in the matrix. An inline JSDoc type annotation on the
 * parameter would become part of the arrow's `[[SourceText]]` and change the
 * very string this vector measures.
 *
 * @param {unknown} a - returned unchanged
 * @returns {unknown} the parameter
 */
export const identityArrow = (a) => a;

/**
 * A callable whose own `name` has been deleted. `name` is `configurable: true`
 * on every function, so the deletion is legal — and it leaves the own-descriptor
 * bag without a `name` entry, which makes `hasProxyConstructorShape`'s
 * destructured `name.value` read throw. The `try`/`catch` is specified to answer
 * `false` rather than propagate, so this value is the one that exercises it.
 *
 * @returns {Callable} a function with no own `name`
 */
export const nameDeletedFunction = () => {
  const target = /** @type {Callable & { name?: unknown }} */ (
    function named() {
      return undefined;
    }
  );
  delete target.name;

  return target;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  getCondensedFunctionSource (gCFS)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} CondensedSourceRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {string | undefined} expected - the condensed source expected back
 * @property {string} vector - the spec vector ID this row covers
 */

/** @type {Record<string, CondensedSourceRow>} */
export const condensedSourceMatrix = {
  boundFunction: {
    description: 'a bound function — the anonymous native form',
    make: () => plainTarget.bind(null),
    expected: CANONICAL_CONDENSED_SOURCE,
    vector: 'gCFS/A1',
  },
  proxyConstructor: {
    description: 'the `Proxy` constructor — a built-in keeps its name',
    make: () => Proxy,
    expected: 'function Proxy(){[native code]}',
    vector: 'gCFS/A2',
  },
  arrowFunction: {
    description: 'an arrow — the space after `=>` survives, the one before it does not',
    make: () => identityArrow,
    expected: '(a)=> a',
    vector: 'gCFS/A3',
  },
  nonCallable: {
    description: 'a non-callable — `getFunctionSource` absorbs the `TypeError`',
    make: () => ({}),
    expected: undefined,
    vector: 'gCFS/A4',
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  getFunctionSourceCondensate (gFSC)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} SourceCondensateRow
 * @property {string} description - human-readable input description
 * @property {string | undefined} source - the raw source fed to the condenser
 * @property {string | undefined} expected - the condensed result
 * @property {boolean} isCanonical - whether the result is the anonymous native form
 * @property {string} vector - the spec vector ID this row covers
 */

/** @type {Record<string, SourceCondensateRow>} */
export const sourceCondensateMatrix = {
  v8Form: {
    description: 'the V8 single-line form',
    source: 'function () { [native code] }',
    expected: CANONICAL_CONDENSED_SOURCE,
    isCanonical: true,
    vector: 'gFSC/A1',
  },
  multiLineForm: {
    description: 'the JavaScriptCore / SpiderMonkey three-line form',
    source: 'function () {\n    [native code]\n}',
    expected: CANONICAL_CONDENSED_SOURCE,
    isCanonical: true,
    vector: 'gFSC/A2',
  },
  tabSeparatedForm: {
    description: 'a tab-separated form',
    source: 'function\t()\t{\t[native code]\t}',
    expected: CANONICAL_CONDENSED_SOURCE,
    isCanonical: true,
    vector: 'gFSC/A3',
  },
  alreadyCondensed: {
    description: 'the canonical form itself — idempotent',
    source: CANONICAL_CONDENSED_SOURCE,
    expected: CANONICAL_CONDENSED_SOURCE,
    isCanonical: true,
    vector: 'gFSC/A4',
  },
  namedNativeForm: {
    description: 'a NAMED native form — the name survives condensing',
    source: 'function max() { [native code] }',
    expected: 'function max(){[native code]}',
    isCanonical: false,
    vector: 'gFSC/R1',
  },
  markerLikeIdentifier: {
    description: 'a concise method carrying `[nativecode]` — no interior space to fuse',
    source: 'm() { [nativecode] }',
    expected: 'm(){[nativecode]}',
    isCanonical: false,
    vector: 'gFSC/R2',
  },
};

/**
 * Falsy input is returned unchanged rather than condensed — the guard that
 * lets the composition absorb an unreadable source.
 *
 * @type {Record<string, { source: string | undefined, vector: string }>}
 */
export const falsySourceInputs = {
  undefinedSource: { source: undefined, vector: 'gFSC/X1' },
  emptySource: { source: '', vector: 'gFSC/X1' },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  hasProxyConstructorShape (hPCS) + doesMatchProxyConstructor (dMPC)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} ProxyConstructorRow
 * @property {string} description - human-readable candidate description
 * @property {() => unknown} make - fresh-value factory
 * @property {{ hasProxyConstructorShape: boolean, doesMatchProxyConstructor: boolean }} expected - expected outcome of each recognizer
 * @property {string[]} vectors - spec vector IDs this row covers
 */

const BOTH = { hasProxyConstructorShape: true, doesMatchProxyConstructor: true };
const NEITHER = { hasProxyConstructorShape: false, doesMatchProxyConstructor: false };

/** @type {Record<string, ProxyConstructorRow>} */
export const proxyConstructorMatrix = {
  localProxyConstructor: {
    description: 'the local `Proxy` — the identity arm, and the shape arm too',
    make: () => Proxy,
    expected: BOTH,
    vectors: ['hPCS/A1', 'dMPC/A1'],
  },
  foreignProxyConstructor: {
    description: 'a cross-realm `Proxy` — recognized structurally, no identity to match',
    make: () => foreignRealmEval('Proxy'),
    expected: BOTH,
    vectors: ['hPCS/A2', 'dMPC/A2'],
  },
  boundProxyConstructor: {
    description: 'a bound `Proxy` — `name` is `bound Proxy`',
    make: () => Proxy.bind(null),
    expected: NEITHER,
    vectors: ['hPCS/R1', 'dMPC/R1'],
  },
  plainFunction: {
    description: 'a plain function',
    make: () => plainTarget,
    expected: NEITHER,
    vectors: ['hPCS/R2', 'dMPC/R1'],
  },
  arrowFunction: {
    description: 'an arrow',
    make: () => () => undefined,
    expected: NEITHER,
    vectors: ['hPCS/R2'],
  },
  namedNative: {
    description: '`Math.max` — native and named, but not `Proxy`',
    make: () => Math.max,
    expected: NEITHER,
    vectors: ['hPCS/R2'],
  },
  nameDeletedFunction: {
    description: 'a callable with no own `name` — the descriptor read throws',
    make: nameDeletedFunction,
    expected: NEITHER,
    vectors: ['hPCS/R2'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Throw-safety (axis 5)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The `@@throw-safe` markers carried by `src/utility/index.js` and
 * `src/utility/index.d.ts`.
 *
 * `throw-safety.test.js` cross-checks this list BOTH against the markers parsed
 * out of the source (source drift) AND against the imported set it scores (test
 * drift), then routes hostile values into each export and asserts
 * non-propagation. `#bound`'s two marked exports are scored by
 * `test/bound/__config.js`; each module owns its own oracle.
 */
export const THROW_SAFE_MARKED = [
  'doesMatchProxyConstructor',
  'getCondensedFunctionSource',
  'getFunctionSourceCondensate',
  'hasProxyConstructorShape',
];

/**
 * Hostile values for the `string | undefined` parameter of
 * `getFunctionSourceCondensate`.
 *
 * The marker promises no throw within the DECLARED type, so this set is hostile
 * STRINGS rather than arbitrary junk — a non-string here would test out of
 * contract, which the declared type already prevents at the compiler
 * (`BOUND.spec.md` → the marker's contract).
 *
 * @type {Record<string, () => string | undefined>}
 */
export const hostileSources = {
  emptyString: () => '',
  whitespaceOnly: () => ' \t\n\r  ',
  punctuationSoup: () => '((({{{[[[)))}}}]]]',
  loneSurrogate: () => '\ud800',
  combiningMarks: () => 'e\u0301\u0302\u0303(){}',
  embeddedNul: () => 'function\u0000(){\u0000[native code]}',
  rtlOverride: () => 'function\u202e(){[native code]}',
  emoji: () => '\u{1f600}(){}\u{1f4a5}',
  veryLongString: () => `function (${' '.repeat(1_000_000)}) { [native code] }`,
};

/**
 * Hostile callables for the `Callable` / `VerifiedFunction` parameters of the
 * other three marked exports.
 *
 * Every entry is genuinely callable. A non-callable here would exercise the
 * exports OUTSIDE their declared type, which the compiler already prevents at
 * every real call site — the declared type is the enforcement, so a hostile set
 * that ignores it tests a contract the module never made. The one specified
 * non-callable case (`gCFS/A4`) is an axis-4 vector in `condensedSourceMatrix`,
 * not a throw-safety row.
 *
 * @type {Record<string, () => unknown>}
 */
export const hostileCallables = {
  revokedProxy: () => {
    const revocable = Proxy.revocable(() => undefined, {});
    revocable.revoke();

    return revocable.proxy;
  },
  throwingGetTrap: () =>
    new Proxy(() => undefined, {
      get() {
        throw new Error('hostile get trap');
      },
    }),
  throwingDescriptorTrap: () =>
    new Proxy(() => undefined, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor trap');
      },
    }),
  throwingOwnKeysTrap: () =>
    new Proxy(() => undefined, {
      ownKeys() {
        throw new Error('hostile ownKeys trap');
      },
    }),
  throwingNameAccessor: () =>
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
  nameDeletedFunction,
  nullPrototypeFunction: () => {
    const bare = function named() {
      return undefined;
    };
    Object.setPrototypeOf(bare, null);

    return bare;
  },
};
