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
 * with the global `Object`. The raw captures are `@internal` — importable by
 * downstream, hidden from the public API docs. The public half is the value-adds
 * a downstream package reaches for directly: the ten descriptor presets with
 * their paired `*Options` interfaces, `objectHasOwn`, `objectCreate`, and the
 * `Blank*` shape types.
 *
 * ## Descriptor presets
 *
 * Ten presets span the visible/hidden × writable × configurable grid. Each object
 * literal below carries an `@type` annotation naming its sibling interface, so the
 * flags stay literal `true` / `false` types instead of widening to `boolean` — an
 * unannotated literal widens, which is what the annotations exist to prevent.
 *
 * The naming follows `Object.seal` and `Object.freeze` rather than a private
 * vocabulary. `readOnly` is non-writable but still configurable, and claims only
 * what holds — a configurable property can be redefined back to writable.
 * `frozen` is `Object.freeze`'s pair, non-writable and non-configurable, and
 * exists for data descriptors only. `sealed` is `Object.seal`'s single effect,
 * `configurable: false`, and exists for accessors only.
 *
 * There is deliberately no frozen accessor. On an accessor the two operations
 * produce identical descriptors, and `configurable: false` says nothing about
 * mutability — that depends on whether a `set` was supplied, which a preset
 * cannot know.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('#config').DefaultDataDescriptorOptions} DefaultDataDescriptorOptions */
/** @typedef {import('#config').DefaultDataAccessorOptions} DefaultDataAccessorOptions */
/** @typedef {import('#config').DefaultEntryDescriptorOptions} DefaultEntryDescriptorOptions */
/** @typedef {import('#config').DefaultEntryAccessorOptions} DefaultEntryAccessorOptions */
/** @typedef {import('#config').ReadOnlyDataDescriptorOptions} ReadOnlyDataDescriptorOptions */
/** @typedef {import('#config').ReadOnlyEntryDescriptorOptions} ReadOnlyEntryDescriptorOptions */
/** @typedef {import('#config').FrozenDataDescriptorOptions} FrozenDataDescriptorOptions */
/** @typedef {import('#config').FrozenEntryDescriptorOptions} FrozenEntryDescriptorOptions */
/** @typedef {import('#config').SealedDataAccessorOptions} SealedDataAccessorOptions */
/** @typedef {import('#config').SealedEntryAccessorOptions} SealedEntryAccessorOptions */

/** @typedef {typeof import('#config').objectHasOwn} objectHasOwnProperty */
/** @typedef {typeof import('#config').objectCreate} createCustomType */

/** @typedef {import('#object').DictionaryObject} DictionaryObject */

/** @typedef {import('#config').BlankDictionary} BlankDictionary */

/** @typedef {typeof import('#config').INSTANCE_LESS_CONSTRUCTOR} NEVER_INVOKED_CONSTRUCTOR */

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

// CONFIGURABLE

// enumerable, configurable DESCRIPTOR and ACCESSOR

/**
 * Descriptor preset for a configurable, *visible-and-mutable*
 * data-property.
 *
 * The default shape for defining data-properties.
 *
 * @type {DefaultDataDescriptorOptions}
 */
export const defaultDataDescriptor = {
  enumerable: true, // explicit
  writable: true, // explicit
  configurable: true, // explicit
};

/**
 * Descriptor preset for a configurable and *visible*, accessor-backed
 * data-property.
 *
 * The default shape for defining accessor-backed data-properties.
 *
 * @type {DefaultDataAccessorOptions}
 */
export const defaultDataAccessor = {
  // 'writable' must be omitted
  enumerable: true, // explicit
  configurable: true, // explicit
};

// non-enumerable, configurable DESCRIPTOR and ACCESSOR

/**
 * Descriptor preset for a configurable, *hidden-but-mutable* entry.
 *
 * The default shape for defining (internal) key-value pairs that may
 * still be reassigned.
 *
 * @type {DefaultEntryDescriptorOptions}
 */
export const defaultEntryDescriptor = {
  enumerable: false,
  writable: true, // explicit
  configurable: true, // explicit
};

/**
 * Descriptor preset for a configurable but *hidden*, accessor-backed entry.
 *
 * The default shape for defining accessor-backed (internal) key-value pairs.
 *
 * @type {DefaultEntryAccessorOptions}
 */
export const defaultEntryAccessor = {
  // 'writable' must be omitted
  enumerable: false,
  configurable: true, // explicit
};

// non-writable, configurable DESCRIPTORS

/**
 * Descriptor preset for a still configurable *visible-but-read-only*
 * data-property.
 *
 * @type {ReadOnlyDataDescriptorOptions}
 */
export const readOnlyDataDescriptor = {
  enumerable: true, // explicit
  writable: false,
  configurable: true, // explicit
};

/**
 * Descriptor preset for a still configurable *hidden-and-read-only*
 * key-value pair.
 *
 * @type {ReadOnlyEntryDescriptorOptions}
 */
export const readOnlyEntryDescriptor = {
  enumerable: false,
  writable: false,
  configurable: true, // explicit
};

// NON-CONFIGURABLE

// non-configurable DESCRIPTORS

/**
 * Descriptor preset for a *visible-but-entirely-frozen* data-property.
 *
 * @type {FrozenDataDescriptorOptions}
 */
export const frozenDataDescriptor = {
  enumerable: true, // explicit
  writable: false,
  configurable: false,
};

/**
 * Descriptor preset for a *hidden-and-entirely-frozen* key-value pair.
 *
 * @type {FrozenEntryDescriptorOptions}
 */
export const frozenEntryDescriptor = {
  enumerable: false,
  writable: false,
  configurable: false,
};

// non-configurable ACCESSORS

/**
 * Descriptor preset for a *visible-but-non-configurable*, accessor-backed
 * data-property.
 *
 * @type {SealedDataAccessorOptions}
 */
export const sealedDataAccessor = {
  enumerable: true, // explicit
  configurable: false,
};

/**
 * Descriptor preset for a *hidden-and-non-configurable*, accessor-backed
 * entry.
 *
 * @type {SealedEntryAccessorOptions}
 */
export const sealedEntryAccessor = {
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
 * `Function.prototype.toString`, captured at module-load; the `.d.ts` retypes
 * it with `this: Callable`.
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
 * The native branch is gated by a function-type check so a non-function
 * `hasOwn` cannot slip through. The call shape is `objectHasOwn(target,
 * key)` either way.
 * @type {objectHasOwnProperty}
 */
export const objectHasOwn = typeof nativeHasOwn === 'function' ? nativeHasOwn : hasOwn;

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
 * `(o: unknown) => object | Callable | null` to close the `any`-return cascade
 * at consumer call sites — the `Callable` arm because a `[[Prototype]]` may
 * itself be a function (a class's parent, `Function.prototype`). The runtime
 * export is the unwrapped native method.
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
 * `objectCreate(null)` return ({@link DictionaryObject}) to {@link BlankDictionary}, since
 * the never-mutated form has no own key.
 *
 * Internal while its TYPE `BlankDictionary` is public — a deliberate split. This
 * instance carries no information beyond its own identity, so it is only useful
 * to code that compares against this very reference; the type, by contrast, is
 * shape vocabulary a downstream package may legitimately import.
 * @internal
 */
export const BLANK_DICTIONARY = /** @type {BlankDictionary} */ (objectCreate(null));

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
