// @ts-check

/**
 * @module @species-js/function-introspection/utility
 *
 * Shared internals behind the package's predicates — the function-source
 * readers and the `Proxy` constructor recognizers.
 *
 * Not a published subpath; the bundler inlines this module into the entries
 * that consume it. `getCondensedFunctionSource` is the one consumer-facing
 * export and reaches the surface by name through the root barrel; everything
 * else is `@internal`.
 */

import { getFunctionSource, isFunction } from '@species-js/type-detection';

import { getOwnPropertyDescriptors, globalContext } from '#config';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@species-js/type-detection').Callable} Callable */
/** @typedef {import('@species-js/type-detection').VerifiedFunction} VerifiedFunction */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The condensed source every bound function normalizes to — the anonymous
 * `NativeFunction` grammar of ECMA-262 §20.2.3.5 with punctuation-adjacent
 * whitespace removed.
 *
 * The anonymity is the discriminator. A built-in keeps its name in the same
 * grammar (`function max(){[native code]}`), so an exact comparison against
 * this string separates a bound function from the native it was bound from.
 *
 * @internal
 */
export const CONDENSED_NATIVE_SOURCE_FOUNDATION = 'function(){[native code]}';

/* @@throw-safe */
/**
 * Removes the whitespace that sits next to `(`, `)`, `{`, `}`, `[` or `]`,
 * leaving every other run intact.
 *
 * Engines disagree on the whitespace of the NativeFunction grammar — V8 emits
 * a single line where JavaScriptCore and SpiderMonkey break it across three —
 * so comparing a raw source is engine-specific. Condensing around punctuation
 * collapses those forms onto {@link CONDENSED_NATIVE_SOURCE_FOUNDATION}.
 *
 * Interior whitespace survives deliberately. The space inside `[native code]`
 * cannot occur in real source — it would parse as two identifiers — so keeping
 * it leaves the marker unforgeable. Condensing every run instead would fuse it
 * into `[nativecode]`, a legal array literal that a concise method can carry.
 *
 * Takes the source rather than the callable so that the engine-specific forms
 * can be exercised directly under a single-engine test runner;
 * {@link getCondensedFunctionSource} is the callable-taking composition.
 *
 * @param {string | undefined} source - the raw function source
 * @returns {string | undefined} the condensed source; falsy input is returned
 *  unchanged
 *
 * @internal
 */
export function getFunctionSourceCondensate(source) {
  return !source
    ? // '' | undefined
      source
    : // condensed function-source string-value
      source.replace(/\s+([(){}[\]])/g, '$1').replace(/([(){}[\]])\s+/g, '$1');
}

/* @@throw-safe */
/**
 * Reads a callable's source through the realm-fixed
 * `Function.prototype.toString` and returns it condensed.
 *
 * Composes type-detection's throw-safe `getFunctionSource` with
 * {@link getFunctionSourceCondensate}, so a source the reader cannot produce
 * arrives as `undefined` and passes through untouched.
 *
 * The one export of this module that is consumer surface; it reaches the
 * package's public API by name through the root barrel rather than by living
 * in a subpath of its own.
 *
 * @param {Callable} value - the callable whose source to read
 * @returns {string | undefined} the condensed source; `undefined` when the
 *  source cannot be read
 *
 * @example
 * ```js
 * getCondensedFunctionSource(Proxy.bind());  // 'function(){[native code]}'
 * getCondensedFunctionSource(Proxy);         // 'function Proxy(){[native code]}'
 * getCondensedFunctionSource((a) => a);      // '(a)=> a'
 * ```
 */
export function getCondensedFunctionSource(value) {
  return getFunctionSourceCondensate(getFunctionSource(value));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** The condensed source a `Proxy` constructor stringifies to. */
const proxyConstructorSource = 'function Proxy(){[native code]}';

/** This realm's `Proxy`, captured once at module-load. */
const ProxyConstructor = globalContext.Proxy;

/* @@throw-safe */
/**
 * Reports whether the value carries the own-descriptor shape of a `Proxy`
 * constructor — an own `name` of `'Proxy'`, either an own `length` of `2` or a
 * callable own `revocable`, and the named native source form.
 *
 * Structural rather than nominal, so it recognizes the constructor of a realm
 * whose intrinsics this module never captured. The descriptor bag is read once
 * and destructured; an absent `name` or `length` makes the property access
 * throw, which the `try`/`catch` answers `false` rather than propagating.
 *
 * @param {VerifiedFunction} value - the callable to test
 * @returns {boolean} `true` when every marker of the constructor is present
 *
 * @internal
 */
export function hasProxyConstructorShape(value) {
  try {
    const { name, length, revocable } = getOwnPropertyDescriptors(value);

    return (
      name.value === 'Proxy' &&
      (length.value === 2 || isFunction(revocable?.value)) &&
      getCondensedFunctionSource(value) === proxyConstructorSource
    );
  } catch {
    return false;
  }
}

/* @@throw-safe */
/**
 * Reports whether the value is a `Proxy` constructor — this realm's capture by
 * identity, then {@link hasProxyConstructorShape} for every other realm.
 *
 * Identity runs first because it is a single reference compare; the descriptor
 * walk only pays for values that are not the local intrinsic. The `unknown`
 * cast acknowledges that the captured intrinsic and the parameter have no
 * declared overlap, which is what the comparison is there to decide.
 *
 * @param {VerifiedFunction} value - the callable to test
 * @returns {boolean} `true` when the value is a `Proxy` constructor
 *
 * @internal
 */
export function doesMatchProxyConstructor(value) {
  return (
    value === /** @type {unknown} */ (ProxyConstructor) || hasProxyConstructorShape(value)
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
