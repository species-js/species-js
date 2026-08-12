/**
 * @module @species-js/function-introspection/utility
 *
 * Shared internals behind the package's predicates — the function-source
 * readers and the `Proxy` constructor recognizers.
 *
 * Published as its own subpath, and inlined by the bundler into the entries
 * that consume it as well. `getCondensedFunctionSource` is the one
 * consumer-facing export; everything else here is `@internal`.
 */

import type { Callable, VerifiedFunction } from '@species-js/type-detection';

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
export const CONDENSED_NATIVE_SOURCE_FOUNDATION: 'function(){[native code]}';

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
 * @param source - the raw function source
 * @returns the condensed source; falsy input is returned unchanged
 *
 * @internal
 */
export function getFunctionSourceCondensate(
  source: string | undefined,
): string | undefined;

/* @@throw-safe */
/**
 * Reads a callable's source through the realm-fixed
 * `Function.prototype.toString` and returns it condensed.
 *
 * Whitespace next to `(`, `)`, `{`, `}`, `[` and `]` is removed; every other
 * run is preserved. That collapses the engine-specific spellings of the
 * `NativeFunction` grammar onto one comparable form. The space inside
 * `[native code]` survives — it is the part ordinary source cannot reproduce.
 *
 * Never throws: a source the reader cannot produce is reported as `undefined`.
 *
 * @param value - the callable whose source to read
 * @returns the condensed source; `undefined` when the source cannot be read
 *
 * @example
 * ```ts
 * getCondensedFunctionSource(Proxy.bind()); // 'function(){[native code]}'
 * getCondensedFunctionSource(Proxy); // 'function Proxy(){[native code]}'
 * getCondensedFunctionSource((a) => a); // '(a)=> a'
 * ```
 */
export function getCondensedFunctionSource(value: Callable): string | undefined;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the value carries the own-descriptor shape of a `Proxy`
 * constructor — an own `name` of `'Proxy'`, either an own `length` of `2` or a
 * callable own `revocable`, and the named native source form.
 *
 * Structural rather than nominal, so it recognizes the constructor of any
 * realm, including one whose intrinsics were never captured here.
 *
 * @param value - the callable to test
 * @returns `true` when every marker of the constructor is present
 *
 * @internal
 */
export function hasProxyConstructorShape(value: VerifiedFunction): boolean;

/* @@throw-safe */
/**
 * Reports whether the value is a `Proxy` constructor — this realm's capture by
 * identity, then {@link hasProxyConstructorShape} for every other realm.
 *
 * @param value - the callable to test
 * @returns `true` when the value is a `Proxy` constructor
 *
 * @internal
 */
export function doesMatchProxyConstructor(value: VerifiedFunction): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
