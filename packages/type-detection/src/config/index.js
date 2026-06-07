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

import { isCallable } from '@/function';
import { isNumberValue } from '@/primitive';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {typeof import('./index').objectHasOwn} objectHasOwnProperty */

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

const objectPrototype = Object.prototype;

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
 * `Function.prototype.toString`, captured for `.call(fn)` use.
 *
 * Returns the function's source text.
 *
 * Used to tell native code from user-authored code and to detect class
 * syntax, regardless of a tampered instance `toString`.
 * @internal
 */
export const toFunctionString = Function.prototype.toString;

// /**
//  * Reference to `Error.prototype.toString` for error-name inspection.
//  * Used with `.call(error)` to get an error type's name-value.
//  * @internal
//  */
// export const toErrorString = Error.prototype.toString;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const o = Object;

const nativeHasOwn = /** @type {objectHasOwnProperty | undefined} */ (
  /** @type {{ hasOwn?: objectHasOwnProperty }} */ (o).hasOwn
);

/**
 * Own-property test, ES2020-floor-safe.
 *
 * Uses the native `Object.hasOwn` when the runtime provides it (Node 22
 * and later, modern browsers). Otherwise, falls back to a closure over the
 * captured `Object.prototype.hasOwnProperty`.
 *
 * The native branch is gated by {@link isCallable} so a non-function
 * `hasOwn` cannot slip through. The call shape is `objectHasOwn(target,
 * key)` either way.
 * @type {objectHasOwnProperty}
 * @internal
 */
export const objectHasOwn = isCallable(nativeHasOwn)
  ? nativeHasOwn
  : (/** @type {object} */ target, /** @type {PropertyKey} */ key) =>
      hasOwnProperty.call(target, key);

/**
 * `Object.assign`, realm-fixed at module-load.
 * @internal
 */
export const objectAssign = o.assign;

/**
 * `Object.is`, realm-fixed at module-load.
 * @internal
 */
export const objectIs = o.is;

/**
 * `Object.create`, realm-fixed at module-load.
 *
 * The `.d.ts` retypes the lib's `any` return on both overloads to
 * overload-precise return types — `Record<PropertyKey, never>` on the
 * `null`-prototype variant, `object` otherwise — closing the
 * `any`-assignment cascade at consumer sites. The runtime export is the
 * unwrapped native method.
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
//  Number Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const nativeIsFinite = isFinite;

const n = Number;
const m = Math;

const mathAbs = m.abs;
const mathFloor = m.floor;

const MAX_SAFE_INTEGER = n.MAX_SAFE_INTEGER;

/**
 * `Number.isFinite`, realm-fixed at module-load with a polyfill
 * fallback for runtimes lacking it.
 *
 * The `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing at
 * consumer call sites. The runtime export is the native method when
 * callable; otherwise the polyfill checks `typeof === 'number'` against
 * the global `isFinite` for spec equivalence.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is a finite number;
 *  `false` otherwise
 * @internal
 */
export const isFiniteNumberValue = isCallable(n.isFinite)
  ? n.isFinite
  : (/** @type {unknown} */ value) => isNumberValue(value) && nativeIsFinite(value);

/**
 * `Number.isInteger`, realm-fixed at module-load with a polyfill
 * fallback for runtimes lacking it.
 *
 * The `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing at
 * consumer call sites. The polyfill composes `isFiniteNumberValue`
 * with a `Math.floor(value) === value` integer check.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is an integer
 *  (finite number with no fractional part); `false` otherwise
 * @internal
 */
export const isIntegerValue = isCallable(n.isInteger)
  ? n.isInteger
  : (/** @type {unknown} */ value) =>
      isFiniteNumberValue(value) && mathFloor(/** @type {number} */ (value)) === value;

/**
 * `Number.isSafeInteger`, realm-fixed at module-load with a polyfill
 * fallback for runtimes lacking it.
 *
 * Tests whether `value` is an integer in the range
 * `[-(2^53 - 1), 2^53 - 1]`, where round-tripping is lossless. The
 * `.d.ts` retypes the lib's plain-boolean return to the type-guard
 * `(value: unknown) => value is number` to propagate narrowing. The
 * polyfill composes `isIntegerValue` with the absolute-value bound
 * against `Number.MAX_SAFE_INTEGER`.
 *
 * @param {unknown} value - the value to inspect
 * @returns {value is number} `true` when the value is a safe integer
 *  (integer in the lossless-round-trip range); `false` otherwise
 * @internal
 */
export const isSafeIntegerValue = isCallable(n.isSafeInteger)
  ? n.isSafeInteger
  : (/** @type {unknown} */ value) =>
      isIntegerValue(value) && mathAbs(/** @type {number} */ (value)) <= MAX_SAFE_INTEGER;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
