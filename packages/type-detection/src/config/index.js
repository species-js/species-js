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

// Native `Object.hasOwn` when the runtime provides it (ES2022+), else `undefined`.
const nativeHasOwn = /** @type {objectHasOwnProperty | undefined} */ (
  /** @type {{ hasOwn?: objectHasOwnProperty }} */ (o).hasOwn
);

/**
 * Own-property test, ES2020-floor-safe.
 *
 * Prefers the native `Object.hasOwn` when the runtime provides it (Node 22
 * and later, modern browsers). Otherwise falls back to a closure over the
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
 * `Object.create`, realm-fixed at module-load.
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
