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

import type { Callable } from '@/function';

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
 * @internal
 */
export declare const defaultDescriptorOptions: {
  enumerable: false;
  writable: true;
  configurable: true;
};

/**
 * Descriptor preset for a hidden read-only property.
 *
 * Configurable despite being non-writable, so the property can still be
 * redefined or deleted.
 * @internal
 */
export declare const restrictedDescriptorOptions: {
  enumerable: false;
  writable: false;
  configurable: true;
};

/**
 * Descriptor preset for a hidden accessor (get/set) property.
 *
 * Omits `writable`, which is invalid on accessor descriptors.
 * @internal
 */
export declare const restrictedAccessorOptions: {
  enumerable: false;
  configurable: true;
};

/**
 * Descriptor preset for a sealed property.
 *
 * Non-configurable, so the property can be neither redefined nor deleted
 * once set.
 * @internal
 */
export declare const sealedDescriptorOptions: {
  enumerable: false;
  configurable: false;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype Methods (for cross-realm type detection)
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * `Object.prototype.toString`, captured for `.call(value)` use.
 *
 * Returns the internal `[[Class]]` tag, such as `'[object Array]'`.
 *
 * This is the realm-independent read of a value's built-in type, and is
 * immune to a missing or overridden instance `toString`.
 * @internal
 */
export declare const toObjectString: typeof Object.prototype.toString;

/**
 * `Function.prototype.toString`, captured at module-load and retyped with
 * `this: Callable`.
 *
 * The retyping encodes the spec-required constraint: calling
 * `Function.prototype.toString` on a non-callable receiver throws
 * `TypeError`.
 *
 * Used as `toFunctionString.call(fn)` to read a function's source
 * regardless of a tampered instance `toString`. The source read is
 * load-bearing for telling native code from user-authored code and for
 * detecting class syntax.
 * @internal
 */
export declare const toFunctionString: (this: Callable) => string;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Own-property test, ES2020-floor-safe.
 *
 * Uses the native `Object.hasOwn` when the runtime provides it (Node 22
 * and later, modern browsers). Otherwise falls back to a closure over
 * the captured `Object.prototype.hasOwnProperty`.
 *
 * The call shape is `objectHasOwn(target, key)`. The reference is
 * realm-fixed at module-load.
 * @internal
 */
export declare const objectHasOwn: (o: object, v: PropertyKey) => boolean;

/**
 * `Object.assign`, realm-fixed at module-load.
 * @internal
 */
export declare const objectAssign: typeof Object.assign;

/**
 * `Object.create`, realm-fixed at module-load.
 * @internal
 */
export declare const objectCreate: typeof Object.create;

/**
 * `Object.freeze`, realm-fixed at module-load.
 * @internal
 */
export declare const objectFreeze: typeof Object.freeze;

/**
 * `Object.seal`, realm-fixed at module-load.
 * @internal
 */
export declare const objectSeal: typeof Object.seal;

/**
 * `Object.keys`, realm-fixed at module-load.
 * @internal
 */
export declare const objectKeys: typeof Object.keys;

/**
 * `Object.values`, realm-fixed at module-load.
 * @internal
 */
export declare const objectValues: typeof Object.values;

/**
 * `Object.entries`, realm-fixed at module-load.
 * @internal
 */
export declare const objectEntries: typeof Object.entries;

/**
 * `Object.getOwnPropertyNames`, realm-fixed at module-load.
 * @internal
 */
export declare const getOwnPropertyNames: typeof Object.getOwnPropertyNames;

/**
 * `Object.getOwnPropertySymbols`, realm-fixed at module-load.
 * @internal
 */
export declare const getOwnPropertySymbols: typeof Object.getOwnPropertySymbols;

/**
 * `Object.getPrototypeOf`, realm-fixed at module-load.
 *
 * Retyped from `typeof Object.getPrototypeOf`, which is `(o: any) => any`
 * per `lib.es5.d.ts`, to `(o: unknown) => object | null`. The lib's `any`
 * return forces an `@typescript-eslint/no-unsafe-assignment` cascade at
 * every consumer; the spec-precise return is `object | null`, the
 * `[[Prototype]]` slot of any non-nullish object.
 *
 * The `unknown` parameter accepts what callers actually pass. The runtime
 * throw for `null` and `undefined` is a precondition not modeled in the
 * type, consistent with TypeScript's not modeling thrown errors elsewhere.
 * Same lib-gap pattern as `toFunctionString` above.
 * @internal
 */
export declare const getPrototypeOf: (o: unknown) => object | null;

/**
 * `Object.setPrototypeOf`, realm-fixed at module-load.
 * @internal
 */
export declare const setPrototypeOf: typeof Object.setPrototypeOf;

/**
 * `Object.defineProperty`, realm-fixed at module-load.
 * @internal
 */
export declare const defineProperty: typeof Object.defineProperty;

/**
 * `Object.getOwnPropertyDescriptor`, realm-fixed at module-load.
 * @internal
 */
export declare const getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor;

/**
 * `Object.getOwnPropertyDescriptors`, realm-fixed at module-load.
 * @internal
 */
export declare const getOwnPropertyDescriptors: typeof Object.getOwnPropertyDescriptors;
