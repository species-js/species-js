// @ts-check

/**
 * @module @species-js/type-detection/config
 *
 * Realm-fixed references and descriptor presets used by this package's
 * predicates.
 *
 * Capturing `Object` and `Function.prototype` members once at module-load,
 * rather than reaching for `Object.x` at each call site, fixes their
 * identity to this realm and shields the predicates from later tampering
 * with the global `Object`. Every export is an internal primitive that is
 * also surfaced for downstream packages needing the same cross-realm-safe
 * building blocks.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

import { isCallable } from '#function';
import { isNumberValue } from '#primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {typeof import('./index').objectHasOwn} objectHasOwnProperty */
/** @typedef {typeof import('./index').objectCreate} createCustomType */

/** @typedef {import('#object').DictionaryObject} DictionaryObject */

/** @typedef {import('./index').BlankDictionary} BlankDictionary */
/** @typedef {import('./index').BlankType} BlankType */

/** @typedef {typeof import('./index').INSTANCE_LESS_CONSTRUCTOR} NEVER_INVOKED_CONSTRUCTOR */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The realm's global object, captured once at module-load.
 *
 * `globalThis` (ES2020 — the package floor) is the single
 * standardized handle to the global object across Node,
 * browsers, workers, and UMD bundles, so a bare reference
 * resolves on every target the package ships to. Consumers
 * read members through this capture (`globalContext.DOMException`)
 * rather than as bare intrinsic references — some module
 * runners (vitest's among them) fail to resolve a bare
 * `DOMException` within a project-module's scope even
 * though `globalThis.DOMException` is present. Reading
 * through the capture sidesteps that, and fixes the
 * global's identity to this realm.
 * @internal
 */
export const globalContext = globalThis;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Property Descriptor Options
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Descriptor preset for a hidden-but-mutable property.
 *
 * The default shape for defining internal properties that may still be
 * reassigned.
 * @type {{ enumerable: false, writable: true, configurable: true }}
 * @internal
 */
export const defaultDescriptorOptions = {
  enumerable: false,
  writable: true,
  configurable: true,
};

/**
 * Descriptor preset for a hidden read-only property.
 *
 * Configurable despite being non-writable, so the property can still be
 * redefined or deleted.
 * @type {{ enumerable: false, writable: false, configurable: true }}
 * @internal
 */
export const restrictedDescriptorOptions = {
  enumerable: false,
  writable: false,
  configurable: true,
};

/**
 * Descriptor preset for a hidden accessor (get/set) property.
 *
 * Omits `writable`, which is invalid on accessor descriptors.
 * @type {{ enumerable: false, configurable: true }}
 * @internal
 */
export const restrictedAccessorOptions = {
  enumerable: false,
  configurable: true,
};

/**
 * Descriptor preset for a sealed property.
 *
 * Non-configurable, so the property can be neither redefined nor deleted
 * once set.
 * @type {{ enumerable: false, configurable: false }}
 * @internal
 */
export const sealedDescriptorOptions = {
  enumerable: false,
  configurable: false,
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype Methods (for cross-realm type detection)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * `Object.prototype`, realm-fixed at module-load.
 *
 * Captured once so consumer comparisons like `getPrototypeOf(value)
 * === objectPrototype` are immune to a post-load reassignment of the
 * global `Object`. `Object.prototype` itself is non-writable and
 * non-configurable per ECMA-262 §20.1.2.1, but `globalThis.Object` is
 * neither — reaching for `Object.prototype` at each call site would
 * resolve through whatever `Object` happens to reference at that
 * moment, which the capture forecloses.
 *
 * Used as the local-realm fast-path target in `#object`'s
 * `isPlainObject` and `isPlainOrDictionaryObject`, and as the root
 * from which {@link toObjectString} and the module-local
 * `hasOwnProperty` chain are extracted.
 * @internal
 */
export const objectPrototype = globalContext.Object.prototype;

const hasOwnProperty = objectPrototype.hasOwnProperty;

/**
 * `Object.prototype.toString`, captured for `.call(value)` use.
 *
 * Returns the internal `[[Class]]` tag, such as `'[object Array]'`.
 *
 * This is the realm-independent read of a value's built-in type, and is
 * immune to a missing or overridden instance `toString`.
 * @internal
 */
export const toObjectString = objectPrototype.toString;

/**
 * `Function.prototype.toString`, captured at module-load and retyped
 * with `this: Callable`.
 *
 * The retyping encodes the spec-required constraint: calling
 * `Function.prototype.toString` on a non-callable receiver throws
 * `TypeError`.
 *
 * Used as `toFunctionString.call(fn)` to read a function's source
 * regardless of a tampered instance `toString`. The source read is
 * load-bearing for telling native code from user-authored code and
 * for detecting class syntax.
 * @internal
 */
export const toFunctionString = globalContext.Function.prototype.toString;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const o = globalContext.Object;

const nativeHasOwn = /** @type {objectHasOwnProperty | undefined} */ (
  /** @type {{ hasOwn?: objectHasOwnProperty }} */ (o).hasOwn
);

/**
 * The explicit `Object.prototype.hasOwnProperty`-based polyfill behind
 * {@link objectHasOwn}, exported so the fallback path can be unit-tested in
 * isolation — even on runtimes where native `Object.hasOwn` is present and
 * {@link objectHasOwn} would otherwise select it. Consuming code should reach
 * for {@link objectHasOwn}, which prefers native when available.
 *
 * @param {object} target - the value whose own property is tested
 * @param {PropertyKey} key - the property key to probe
 * @returns {boolean} `true` when `target` carries `key` as an own property;
 *  `false` otherwise
 * @internal
 */
export function hasOwn(target, key) {
  return hasOwnProperty.call(target, key);
}

/**
 * Own-property test, ES2020-floor-safe.
 *
 * Uses the native `Object.hasOwn` when the runtime provides it (Node
 * 16.9 and later, browsers since late 2021). Otherwise, falls back to the
 * {@link hasOwn} polyfill over the captured `Object.prototype.hasOwnProperty`.
 *
 * The native branch is gated by {@link isCallable} so a non-function
 * `hasOwn` cannot slip through. The call shape is `objectHasOwn(target,
 * key)` either way.
 * @type {objectHasOwnProperty}
 * @internal
 */
export const objectHasOwn = isCallable(nativeHasOwn) ? nativeHasOwn : hasOwn;

/**
 * `Object.assign`, realm-fixed at module-load.
 * @internal
 */
export const objectAssign = o.assign;

/**
 * `Object.is`, realm-fixed at module-load.
 *
 * Used in preference to `===` when NaN-equality (`Object.is(NaN, NaN) === true`)
 * or strict ±0 distinction (`Object.is(+0, -0) === false`) matters — most
 * notably in the boxed-primitive value-equality check for `BoxedNumber`.
 * @internal
 */
export const objectIs = o.is;

/**
 * `Object.create`, realm-fixed at module-load.
 *
 * Retyped at capture — via the same overload set the `.d.ts` declares —
 * from the lib's `any` return to overload-precise return types:
 * {@link DictionaryObject} on the `null`-prototype variant, `object`
 * otherwise. The inline `@type` cast (rather than `@param`/`@returns` JSDoc,
 * which TS does not apply to a function alias) lets in-file callers — e.g.
 * `BLANK_DICTIONARY` below — inherit the precise return instead of `any`. That
 * closes the `@typescript-eslint/no-unsafe-assignment` cascade here as well as
 * at external consumer sites. The runtime export is the unwrapped native method.
 * @type {createCustomType}
 * @internal
 */
export const objectCreate = o.create;

/**
 * `Object.freeze`, realm-fixed at module-load.
 * @internal
 */
export const objectFreeze = o.freeze;

/**
 * `Object.seal`, realm-fixed at module-load.
 * @internal
 */
export const objectSeal = o.seal;

/**
 * `Object.keys`, realm-fixed at module-load.
 * @internal
 */
export const objectKeys = o.keys;

/**
 * `Object.values`, realm-fixed at module-load.
 * @internal
 */
export const objectValues = o.values;

/**
 * `Object.entries`, realm-fixed at module-load.
 * @internal
 */
export const objectEntries = o.entries;

/**
 * `Object.fromEntries`, realm-fixed at module-load.
 * @internal
 */
export const objectFromEntries = o.fromEntries;

/**
 * `Object.getOwnPropertyNames`, realm-fixed at module-load.
 * @internal
 */
export const getOwnPropertyNames = o.getOwnPropertyNames;

/**
 * `Object.getOwnPropertySymbols`, realm-fixed at module-load.
 * @internal
 */
export const getOwnPropertySymbols = o.getOwnPropertySymbols;

/**
 * `Object.getPrototypeOf`, realm-fixed at module-load.
 *
 * The `.d.ts` retypes the lib's `(o: any) => any` to
 * `(o: unknown) => object | null` to close the `any`-return cascade at
 * consumer call sites. The runtime export is the unwrapped native method.
 * @internal
 */
export const getPrototypeOf = o.getPrototypeOf;

/**
 * `Object.setPrototypeOf`, realm-fixed at module-load.
 * @internal
 */
export const setPrototypeOf = o.setPrototypeOf;

/**
 * `Object.defineProperty`, realm-fixed at module-load.
 * @internal
 */
export const defineProperty = o.defineProperty;

/**
 * `Object.defineProperties`, realm-fixed at module-load.
 * @internal
 */
export const defineProperties = o.defineProperties;

/**
 * `Object.getOwnPropertyDescriptor`, realm-fixed at module-load.
 * @internal
 */
export const getOwnPropertyDescriptor = o.getOwnPropertyDescriptor;

/**
 * `Object.getOwnPropertyDescriptors`, realm-fixed at module-load.
 * @internal
 */
export const getOwnPropertyDescriptors = o.getOwnPropertyDescriptors;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object- & Function-Shape Constants
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The realm-fixed blank dictionary — `objectCreate(null)` captured once at
 * module load and never mutated: prototype-less, constructor-less, and empty.
 * It is the shared sentinel for an absent-global prototype capture (a runtime
 * without `EventTarget` / `AbortSignal`, decision #060) and for the failure
 * surrogate of `getValidatedStandardConstructorAndPrototypeTuple`, compared by
 * identity and never read for keys. The inline cast narrows the
 * `objectCreate(null)` return (`DictionaryObject`) to `BlankDictionary`, since
 * the never-mutated form has no own key.
 * @internal
 */
export const BLANK_DICTIONARY = /** @type {BlankDictionary} */ (objectCreate(null));

/**
 * The realm-fixed blank object — an empty `Object` literal captured once at
 * module load and never mutated: a real `Object` carrying `Object.prototype` and
 * the `Object` constructor, but no own property key. It is surfaced as a
 * downstream-facing primitive alongside `BLANK_DICTIONARY`, from which it differs
 * by having a prototype-chain. The inline cast types it `BlankType` (the empty
 * literal's own surface carries no reachable key).
 * @internal
 */
export const BLANK_TYPE = /** @type {BlankType} */ ({});

/**
 * A never-invoked, never-newed function statement — the inert stand-in for an
 * absent standard constructor. It backs the failure surrogate of
 * `getValidatedStandardConstructorAndPrototypeTuple` and the module-load fallback
 * when a realm lacks a global intrinsic (`Promise`, `EventTarget`, `AbortSignal`;
 * decision #060). Because its `prototype` is never touched,
 * `value instanceof INSTANCE_LESS_CONSTRUCTOR` is uniformly `false` without
 * throwing, so callers run `instanceof` against the realm-fixed reference
 * unguarded. It is cast to `NewableFunction` (the `#config` `.d.ts` surface) so
 * the plain function statement is accepted where a constructor reference is
 * expected.
 * @internal
 */
export const INSTANCE_LESS_CONSTRUCTOR = /** @type {NEVER_INVOKED_CONSTRUCTOR} */ (
  function () {
    return void 0;
  }
);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Number Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const nativeIsFinite = globalContext.isFinite;

const n = globalContext.Number;
const m = globalContext.Math;

const mathAbs = m.abs;
const mathFloor = m.floor;

const { MAX_SAFE_INTEGER } = n;

/**
 * The explicit polyfill behind {@link isFiniteNumberValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes the
 * {@link isNumberValue} typeof guard with the captured global `isFinite`,
 * reproducing `Number.isFinite` semantics — the leading typeof guard is what
 * suppresses the coercion the bare global `isFinite` applies (`isFinite('5')`
 * is `true`, but `isFiniteNumber('5')` is `false`).
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is a finite number;
 *  `false` otherwise
 * @internal
 */
export function isFiniteNumber(value) {
  return isNumberValue(value) && nativeIsFinite(value);
}

/**
 * `Number.isFinite`, realm-fixed at module-load with a polyfill fallback
 * for runtimes lacking it.
 *
 * The `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing at
 * consumer call sites. The runtime export is the native method when
 * callable; otherwise it falls back to the {@link isFiniteNumber} polyfill.
 *
 * @internal
 */
export const isFiniteNumberValue = isCallable(n.isFinite) ? n.isFinite : isFiniteNumber;

/**
 * The explicit polyfill behind {@link isIntegerValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes
 * {@link isFiniteNumberValue} with a `Math.floor(value) === value`
 * whole-number check.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is an integer (finite
 *  number with no fractional part); `false` otherwise
 * @internal
 */
export function isInteger(value) {
  return isFiniteNumberValue(value) && mathFloor(/** @type {number} */ (value)) === value;
}

/**
 * `Number.isInteger`, realm-fixed at module-load with a polyfill fallback
 * for runtimes lacking it.
 *
 * The `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing at
 * consumer call sites. The runtime export is the native method when
 * callable; otherwise it falls back to the {@link isInteger} polyfill.
 *
 * @internal
 */
export const isIntegerValue = isCallable(n.isInteger) ? n.isInteger : isInteger;

/**
 * The explicit polyfill behind {@link isSafeIntegerValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes
 * {@link isIntegerValue} with the absolute-value bound against
 * `Number.MAX_SAFE_INTEGER`.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is a safe integer
 *  (integer in the lossless-round-trip range `[-(2^53 - 1), 2^53 - 1]`);
 *  `false` otherwise
 * @internal
 */
export function isSafeInteger(value) {
  return (
    isIntegerValue(value) && mathAbs(/** @type {number} */ (value)) <= MAX_SAFE_INTEGER
  );
}

/**
 * `Number.isSafeInteger`, realm-fixed at module-load with a polyfill
 * fallback for runtimes lacking it.
 *
 * Tests whether `value` is an integer in the range
 * `[-(2^53 - 1), 2^53 - 1]`, where round-tripping is lossless. The
 * `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing. The runtime
 * export is the native method when callable; otherwise it falls back to the
 * {@link isSafeInteger} polyfill.
 *
 * @internal
 */
export const isSafeIntegerValue = isCallable(n.isSafeInteger)
  ? n.isSafeInteger
  : isSafeInteger;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
