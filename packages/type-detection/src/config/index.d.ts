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
 * Used as the local-realm fast-path target in `@/object`'s
 * `isPlainObject` and `isPlainOrDictionaryObject`, and as the root
 * from which {@link toObjectString} and the module-local
 * `hasOwnProperty` chain are extracted.
 * @internal
 */
export declare const objectPrototype: typeof Object.prototype;

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
export declare const toFunctionString: (this: Callable) => string;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The explicit `Object.prototype.hasOwnProperty`-based polyfill behind
 * {@link objectHasOwn}, exported so the fallback path can be unit-tested in
 * isolation even on runtimes where the native `Object.hasOwn` is present.
 * Consuming code should reach for {@link objectHasOwn}, which prefers native
 * when available.
 *
 * @param target - the value whose own property is tested
 * @param key - the property key to probe
 * @returns `true` when `target` carries `key` as an own property; `false`
 *  otherwise
 * @internal
 */
export declare function hasOwn(target: object, key: PropertyKey): boolean;

/**
 * Own-property test, ES2020-floor-safe.
 *
 * Uses the native `Object.hasOwn` when the runtime provides it (Node
 * 16.9 and later, browsers since late 2021). Otherwise, falls back to the
 * {@link hasOwn} polyfill over the captured `Object.prototype.hasOwnProperty`.
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
 * `Object.is`, realm-fixed at module-load.
 *
 * Used in preference to `===` when NaN-equality (`Object.is(NaN, NaN) === true`)
 * or strict ±0 distinction (`Object.is(+0, -0) === false`) matters — most
 * notably in the boxed-primitive value-equality check for `BoxedNumber`.
 * @internal
 */
export declare const objectIs: typeof Object.is;

/**
 * `Object.create`, realm-fixed at module-load with overload-precise
 * return types replacing the lib's `any`.
 *
 * Retyped from `typeof Object.create`, which returns `any` on both
 * overloads per `lib.es5.d.ts`, to a three-variant call signature:
 *
 * - `objectCreate(null)` returns `Record<PropertyKey, never>` — the
 *   prototype-less floor `BlankType` in `@/utility` carries. Static
 *   keys are unreachable, mirroring the runtime characteristic that no
 *   prototype-chain exists to inherit from.
 * - `objectCreate(prototype)` returns `object` — an instance whose
 *   `[[Prototype]]` is `prototype`.
 * - `objectCreate(prototype, properties)` returns `object` — same
 *   `[[Prototype]]` plus the mixed-in property descriptors.
 *
 * The lib's `any` return forces an `@typescript-eslint/no-unsafe-assignment`
 * cascade at every consumer that captures the result of
 * `Object.create(null)` for a sentinel or lookup-table object. The
 * spec-precise return closes the cascade once, here, so consumers
 * inherit honest typing for free. Same lib-gap pattern as
 * {@link getPrototypeOf} and {@link toFunctionString}.
 *
 * `ThisType<unknown>` replaces lib's `ThisType<any>` on the
 * property-bearing overload, matching the package's `unknown`-over-`any`
 * discipline for the inferred `this` context inside descriptor methods.
 * @internal
 */
export declare const objectCreate: {
  (o: null): Record<PropertyKey, never>;
  (o: object): object;
  (o: object | null, properties: PropertyDescriptorMap & ThisType<unknown>): object;
};

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
 * `Object.fromEntries`, realm-fixed at module-load.
 * @internal
 */
export declare const objectFromEntries: typeof Object.fromEntries;

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
 * every consumer. The spec-precise return is `object | null`, the
 * `[[Prototype]]` slot of any non-nullish object.
 *
 * The `unknown` parameter accepts what callers actually pass. The runtime
 * throw for `null` and `undefined` is a precondition not modeled in the
 * type, consistent with TypeScript's not modeling thrown errors elsewhere.
 * Same lib-gap pattern as {@link toFunctionString} above.
 * @internal
 */
export declare const getPrototypeOf: (o: unknown) => object | Callable | null;

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

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Number Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The explicit polyfill behind {@link isFiniteNumberValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes the `isNumberValue`
 * typeof guard with the captured global `isFinite`, reproducing
 * `Number.isFinite` semantics — the leading typeof guard suppresses the
 * coercion the bare global `isFinite` applies.
 *
 * @param value - the value to inspect
 * @returns `true` when the value is a finite number; `false` otherwise
 * @internal
 */
export declare function isFiniteNumber(value: unknown): value is number;

/**
 * `Number.isFinite`, realm-fixed at module-load with a polyfill fallback
 * for runtimes lacking it.
 *
 * Retyped from `typeof Number.isFinite`, which is
 * `(number: unknown) => boolean` per `lib.es2015.core.d.ts`, to
 * `(value: unknown) => value is number`. The lib's plain-boolean return
 * does not propagate narrowing at the call site; the retyped signature
 * carries the narrow. The runtime export is the native method when callable;
 * otherwise it falls back to the {@link isFiniteNumber} polyfill.
 * @internal
 */
export declare const isFiniteNumberValue: (value: unknown) => value is number;

/**
 * The explicit polyfill behind {@link isIntegerValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes
 * {@link isFiniteNumberValue} with a `Math.floor(value) === value`
 * whole-number check.
 *
 * @param value - the value to inspect
 * @returns `true` when the value is an integer; `false` otherwise
 * @internal
 */
export declare function isInteger(value: unknown): value is number;

/**
 * `Number.isInteger`, realm-fixed at module-load with a polyfill fallback
 * for runtimes lacking it.
 *
 * Retyped to `(value: unknown) => value is number` for the same lib-gap
 * reason as {@link isFiniteNumberValue} above. The runtime export is the
 * native method when callable; otherwise it falls back to the
 * {@link isInteger} polyfill.
 * @internal
 */
export declare const isIntegerValue: (value: unknown) => value is number;

/**
 * The explicit polyfill behind {@link isSafeIntegerValue}, exported so the
 * fallback path can be unit-tested in isolation. Composes
 * {@link isIntegerValue} with the absolute-value bound against
 * `Number.MAX_SAFE_INTEGER`.
 *
 * @param value - the value to inspect
 * @returns `true` when the value is a safe integer (integer in the
 *  lossless-round-trip range `[-(2^53 - 1), 2^53 - 1]`); `false` otherwise
 * @internal
 */
export declare function isSafeInteger(value: unknown): value is number;

/**
 * `Number.isSafeInteger`, realm-fixed at module-load with a polyfill
 * fallback for runtimes lacking it.
 *
 * Tests whether `value` is an integer in the range
 * `[-(2^53 - 1), 2^53 - 1]`, where round-tripping through JavaScript's
 * `number` representation is lossless. Retyped to
 * `(value: unknown) => value is number` for the same lib-gap reason as
 * {@link isFiniteNumberValue} above. The runtime export is the native method
 * when callable; otherwise it falls back to the {@link isSafeInteger}
 * polyfill.
 * @internal
 */
export declare const isSafeIntegerValue: (value: unknown) => value is number;
