/**
 * @module @species-js/type-detection/config
 *
 * Realm-fixed references and descriptor presets used by this package's
 * predicates.
 *
 * Capturing `Object` and `Function.prototype` members once at module-load,
 * rather than reaching for `Object.x` at each call site, fixes their
 * identity to this realm and shields the predicates from later tampering
 * with the global `Object`. The documented surface is a small set of public
 * building blocks — the descriptor presets, `objectHasOwn`, `objectCreate`, and
 * the `Blank*` shape types; the remaining realm-fixed primitives are `@internal`
 * (importable by downstream, but omitted from these docs).
 */

import type { Callable, NewableFunction } from '#function';
import type { DictionaryObject } from '#object';

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
export declare const globalContext: typeof globalThis;

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
 */
export declare const restrictedAccessorOptions: {
  enumerable: false;
  configurable: true;
};

/**
 * Descriptor preset for a sealed property.
 *
 * Non-configurable, so the property can be neither redefined nor deleted
 * once set. Omits `writable` so the preset fits both data and accessor
 * properties; on a data property `writable` then defaults to `false`, so a
 * sealed data property is also read-only.
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
 * Used as the local-realm fast-path target in `#object`'s
 * `isPlainObject` and `isPlainOrDictionaryObject`, and as the root
 * from which `toObjectString` and the module-local
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
//  Object-Shape Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A real `Object` instance carrying no own property key — the empty ordinary
 * object `{}` / `new Object()`. Modeled as `Record<PropertyKey, never>`, which
 * makes every key statically unreachable.
 *
 * Distinct from {@link DictionaryObject} and {@link BlankDictionary}: a
 * `BlankType` value is a full-fledged `Object`, so it DOES have a
 * prototype-chain (`Object.prototype`) and the `Object` constructor — it is
 * merely empty. The `Record<PropertyKey, never>` surface expresses the
 * empty-keys fact; the real prototype and constructor are runtime facts the
 * empty-record idiom cannot carry (it types even `constructor` as `never`),
 * documented here rather than modeled.
 */
export type BlankType = Record<PropertyKey, never>;

/**
 * A prototype-less (`[[Prototype]] === null`), constructor-less (`constructor`
 * reads `undefined`) object that ALSO carries no own property key — the
 * intersection of {@link DictionaryObject} (prototype-less) and
 * {@link BlankType} (empty): the never-mutated `Object.create(null)`. The
 * realm-fixed carrier is `BLANK_DICTIONARY`.
 *
 * `BlankType & { constructor?: never }` composes the empty own-key surface with
 * the prototype-less discriminator. As with its siblings, the prototype-less-ness
 * itself is a runtime characteristic TypeScript cannot express; the
 * `constructor?: never` marker is the closest structural proxy, shared with
 * {@link DictionaryObject}.
 */
export type BlankDictionary = BlankType & { constructor?: never };

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
 * `hasOwn` polyfill over the captured `Object.prototype.hasOwnProperty`.
 *
 * The call shape is `objectHasOwn(target, key)`. The reference is
 * realm-fixed at module-load.
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
 * - `objectCreate(null)` returns {@link DictionaryObject} — a prototype-less,
 *   constructor-less object whose own keys are open, mirroring the runtime
 *   characteristic that no prototype-chain exists to inherit from. The
 *   never-mutated singleton `BLANK_DICTIONARY` narrows this to
 *   {@link BlankDictionary}.
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
 * `getPrototypeOf` and `toFunctionString`.
 *
 * `ThisType<unknown>` replaces lib's `ThisType<any>` on the
 * property-bearing overload, matching the package's `unknown`-over-`any`
 * discipline for the inferred `this` context inside descriptor methods.
 */
export declare const objectCreate: {
  (o: null): DictionaryObject;
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
 * per `lib.es5.d.ts`, to `(o: unknown) => object | Callable | null`. The lib's
 * `any` return forces an `@typescript-eslint/no-unsafe-assignment` cascade at
 * every consumer. The spec-precise return is `object | Callable | null` — the
 * `[[Prototype]]` slot of any non-nullish object, which may itself be callable
 * (a class's parent constructor, or `Function.prototype`), so the `Callable`
 * arm lets a caller narrow-and-invoke it instead of collapsing to a bare
 * `object`.
 *
 * The `unknown` parameter accepts what callers actually pass. The runtime
 * throw for `null` and `undefined` is a precondition not modeled in the
 * type, consistent with TypeScript's not modeling thrown errors elsewhere.
 * Same lib-gap pattern as `toFunctionString` above.
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
 * `Object.defineProperties`, realm-fixed at module-load.
 * @internal
 */
export declare const defineProperties: typeof Object.defineProperties;

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
//  Object- & Function-Shape Constants
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The realm-fixed blank dictionary — a never-mutated `Object.create(null)`
 * captured once at module load, typed {@link BlankDictionary} (the narrowest of
 * the three prototype-shape carriers): prototype-less, constructor-less, and
 * empty. It is the shared sentinel for an absent-global prototype capture (a
 * runtime without `EventTarget` / `AbortSignal`, decision #060) and for the
 * failure surrogate of `getValidatedStandardConstructorAndPrototypeTuple`,
 * compared by identity and never read for keys.
 * @internal
 */
export declare const BLANK_DICTIONARY: BlankDictionary;

/**
 * A never-invoked, never-newed function statement used as the inert stand-in for
 * an absent standard constructor — the failure surrogate of
 * `getValidatedStandardConstructorAndPrototypeTuple` and the module-load
 * fallback when a realm lacks a global intrinsic (`Promise`, `EventTarget`,
 * `AbortSignal`; decision #060). Its untouched `prototype` makes
 * `value instanceof INSTANCE_LESS_CONSTRUCTOR` uniformly `false` without
 * throwing, so callers run `instanceof` against the realm-fixed reference
 * unguarded.
 * @internal
 */
export declare const INSTANCE_LESS_CONSTRUCTOR: NewableFunction;
