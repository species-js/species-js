// @ts-check

/**
 * @module @species-js/type-detection/utility
 *
 * Cached prototype references and type-signature helpers.
 *
 * Used internally by the package's predicates and exposed via subpath for
 * downstream packages that need the same cross-realm-safe primitives.
 */

import {
  getOwnPropertyDescriptors,
  getOwnPropertyDescriptor,
  getPrototypeOf as nativeGetPrototypeOf,
  objectHasOwn,
  objectKeys,
  toObjectString,
  isSafeIntegerValue,
} from '@/config';

import { isStringValue, isSymbolValue, unguardedIsUnregisteredSymbol } from '@/primitive';
import { isCallable, isFunction, isNewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('./index').WeakKey} WeakKey */

/** @typedef {import('./index').DefinedConstructorAccessorOptions} DefinedConstructorAccessorOptions */

/** @typedef {import('./index').PropertyDescriptor} PropertyDescriptor */
/** @typedef {import('./index').ConstructorName} ConstructorName */
/** @typedef {import('./index').TypeSignature} TypeSignature */
/** @typedef {import('./index').TaggedType} TaggedType */
/** @typedef {import('./index').ResolvedType} ResolvedType */

/** @typedef {import('@/function').Callable} Callable */

/** @typedef {import('@/function').NewableFunction} NewableFunction */
/** @typedef {import('@/function').ES3Function} ES3Function */
/** @typedef {import('@/function').ClassConstructor} ClassConstructor */

/** @typedef {import('./index').PredicateFunction} PredicateFunction */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Weak-Key Validation
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const weakKeyTypeSignatures = new Set(['object', 'function']);

/**
 * Narrows a value to {@link WeakKey} — a value usable as a `WeakMap` / `WeakSet` key:
 * an object, a function, or (where the runtime supports it) an unregistered symbol.
 *
 * The implementation is selected once at module-load by the `createIsValidWeakKeyPredicate`
 * factory: it probes whether this realm admits symbols as weak keys (the ES2023 capability)
 * and only then enables the symbol branch — which additionally excludes registered symbols
 * (rejected by the engine) via {@link unguardedIsUnregisteredSymbol}. On engines without
 * the capability the predicate admits objects and functions only. `Symbol` is injected as
 * `SymbolFactory` so the probe is realm-explicit.
 *
 * @param {unknown} value - the value to test; omitted is
 *  treated as `undefined`, which is not a valid weak key
 * @returns {value is WeakKey}
 *  `true` when the value can be used as a weak key,
 *   narrowing to {@link WeakKey}; `false` otherwise
 */
export const isValidWeakKey = (function createIsValidWeakKeyPredicate(SymbolFactory) {
  const supportsSymbolAsWeakKey = (() => {
    try {
      new WeakSet().add(SymbolFactory());
      return true;
    } catch {
      return false;
    }
  })();

  if (supportsSymbolAsWeakKey) {
    weakKeyTypeSignatures.add('symbol');
  }
  return (
    supportsSymbolAsWeakKey
      ? {
          /**
           * @param {unknown} value - the value to test; omitted is
           *  treated as `undefined`, which is not a valid weak key
           * @returns {value is WeakKey}
           *  `true` when the value can be used as a weak key,
           *   narrowing to {@link WeakKey}; `false` otherwise
           */
          isValidWeakKey(value) {
            const keyType = typeof (value ?? void 0);
            return (
              weakKeyTypeSignatures.has(keyType) &&
              (keyType !== 'symbol' ||
                unguardedIsUnregisteredSymbol(/** @type {symbol} */ (value)))
            );
          },
        }
      : {
          /**
           * @param {unknown} value - the value to test; omitted is
           *  treated as `undefined`, which is not a valid weak key
           * @returns {value is WeakKey}
           *  `true` when the value can be used as a weak key,
           *   narrowing to {@link WeakKey}; `false` otherwise
           */
          isValidWeakKey(value) {
            return !!value && weakKeyTypeSignatures.has(typeof value);
          },
        }
  ).isValidWeakKey;
})(Symbol);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const prototypeRegistry = /** @type {WeakMap<WeakKey, object | Callable | null>} */ (
  new WeakMap()
);
const constructorRegistry =
  /** @type {WeakMap<WeakKey, Map<string, NewableFunction>>} */ (new WeakMap());
const constructorNameRegistry = /** @type {WeakMap<WeakKey, Map<string, string>>} */ (
  new WeakMap()
);

/**
 * @param {boolean} assumePrototype - predicate value which defines the returned key's value.
 * @returns {'proto' | 'default'}
 * @internal
 */
function whichConstructorStorageKey(assumePrototype) {
  return assumePrototype ? 'proto' : 'default';
}

/**
 * @param {unknown} key - always a non-nullish key-value
 * @param {object | Callable | null} value - the retrieved and to be registered `prototype`
 * @returns {WeakMap<WeakKey, object | Callable | null> | undefined}
 * @internal
 */
function registerPrototype(key, value) {
  // no other guard than the key predicate is needed.
  if (isValidWeakKey(key)) {
    return prototypeRegistry.set(key, value);
  }
  return void 0;
}
/**
 * @param {unknown} key - always a non-nullish key-value
 * @returns {object | Callable | null | undefined}
 * @internal
 */
function getRegisteredPrototype(key) {
  return prototypeRegistry.get(/** @type {WeakKey} */ (key));
}

/**
 * @param {unknown} key - always a non-nullish key-value
 * @param {NewableFunction} value - the retrieved and to be registered constructor function
 * @param {boolean} assumePrototype - whether `value` is going to be treated as a real
 *  prototype object; defaults to `false`
 * @returns {WeakMap<WeakKey, Map<string, NewableFunction>> | undefined}
 * @internal
 */
function registerConstructor(key, value, assumePrototype) {
  // no other guard than the key predicate is needed.
  if (isValidWeakKey(key)) {
    /** @type {Map<string, NewableFunction>} */ (
      constructorRegistry.get(key) ?? constructorRegistry.set(key, new Map()).get(key)
    ).set(whichConstructorStorageKey(assumePrototype), value);

    return constructorRegistry;
  }
  return void 0;
}
/**
 * @param {unknown} key
 * @param {boolean} assumePrototype
 * @returns {NewableFunction | undefined}
 * @internal
 */
function getRegisteredConstructor(key, assumePrototype) {
  return constructorRegistry
    .get(/** @type {WeakKey} */ (key))
    ?.get(whichConstructorStorageKey(assumePrototype));
}

/**
 * @param {unknown} key - always a non-nullish key-value
 * @param {string} value - the retrieved and to be registered constructor name
 * @param {boolean} assumePrototype - whether `value` is going to be treated as a real
 *  prototype object; defaults to `false`
 * @returns {WeakMap<WeakKey, Map<string, string>> | undefined}
 * @internal
 */
function registerConstructorName(key, value, assumePrototype) {
  // no other guard than the key predicate is needed.
  if (isValidWeakKey(key)) {
    /** @type {Map<string, string>} */ (
      constructorNameRegistry.get(key) ??
        constructorNameRegistry.set(key, new Map()).get(key)
    ).set(whichConstructorStorageKey(assumePrototype), value);

    return constructorNameRegistry;
  }
  return void 0;
}
/**
 * @param {unknown} key
 * @param {boolean} assumePrototype
 * @returns {string}
 * @internal
 */
function getRegisteredConstructorName(key, assumePrototype) {
  // ACCESSED internally only and ALWAYS GUARDED by `hasRegisteredConstructorName`
  return /** @type {string} */ (
    /** @type {Map<string, string>} */ (
      constructorNameRegistry.get(/** @type {WeakKey} */ (key))
    ).get(whichConstructorStorageKey(assumePrototype))
  );
}
/**
 * @param {unknown} key
 * @param {boolean} assumePrototype
 * @returns {boolean}
 * @internal
 */
function hasRegisteredConstructorName(key, assumePrototype) {
  return !!constructorNameRegistry
    .get(/** @type {WeakKey} */ (key))
    ?.has(whichConstructorStorageKey(assumePrototype));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Guarded/Inert Prototype Access
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Reads `getPrototypeOf(value)` throw-safely and memoized.
 *
 * Wraps the realm-fixed `getPrototypeOf` (`nativeGetPrototypeOf`) in a
 * `try/catch` so a hostile `getPrototypeOf` Proxy-trap yields `undefined`
 * rather than propagating, and caches the resolved prototype per value in the
 * module-scoped `prototypeRegistry` `WeakMap` (via `registerPrototype` /
 * `getRegisteredPrototype`). The cache assumes the value's `[[Prototype]]` is
 * structurally stable; a later `setPrototypeOf` is not reflected.
 *
 * @param {unknown} [value] - the value whose prototype to read; omitted/`null`
 *  yields `undefined`
 * @returns {object | Callable | null | undefined} the value's prototype (an
 *  object, a callable, or `null`); `undefined` for nullish input or when a
 *  hostile trap threw
 * @internal
 */
export function guardedGetPrototypeOf(value = null) {
  if (value === null) {
    return void 0;
  }
  const fastResult = getRegisteredPrototype(value);

  if (fastResult || fastResult === null) {
    return fastResult;
  }
  try {
    const result = nativeGetPrototypeOf(value);

    registerPrototype(value, result);

    return result;
  } catch {
    return void 0;
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Prototype-Property Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Detects whether the value carries an own `prototype` property.
 *
 * The test reads the descriptor directly, not the inheritance chain.
 * Inherited prototypes are deliberately excluded. An arrow function
 * whose `prototype` comes from `Function.prototype` is the canonical
 * example.
 *
 * Guards nullish input with `!!value` so no descriptor lookup runs on
 * `null` or `undefined`.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which has no own prototype
 * @returns {boolean} `true` when the value carries an own `prototype`
 *  property; `false` otherwise
 */
export function hasOwnPrototype(value) {
  return !!value && !!getOwnPropertyDescriptor(value, 'prototype');
}

/**
 * Detects whether the value carries an own `prototype` property whose
 * descriptor is `writable: true`.
 *
 * Uses the same nullish guard as {@link hasOwnPrototype}, plus a direct
 * read of the descriptor's `writable` field.
 *
 * This is the structural tell of an {@link ES3Function} versus a
 * {@link ClassConstructor}, whose own `prototype` is read-only.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which has no own prototype
 * @returns {boolean} `true` when the value's own `prototype` exists and is
 *  writable; `false` otherwise
 */
export function hasOwnWritablePrototype(value) {
  return !!value && getOwnPropertyDescriptor(value, 'prototype')?.writable === true;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Property-Key Utilities
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to `PropertyKey`.
 *
 * Composes {@link isStringValue}, {@link isSymbolValue}, and
 * {@link isSafeIntegerValue} — the last from `@/config`, capturing
 * `Number.isSafeInteger` with a polyfill fallback. The safe-integer
 * restriction means numeric property keys are limited to the range
 * `[-(2^53 - 1), 2^53 - 1]` where they round-trip losslessly.
 * Finite-but-non-integer numbers like `1.5` coerce to strings (`"1.5"`)
 * at runtime with lookup surprises. Integers beyond
 * `Number.MAX_SAFE_INTEGER` lose precision in the round-trip. Both are
 * excluded. `NaN` and `±Infinity` are also excluded. They fail the
 * finite check that underlies any safe-integer value.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a property key
 * @returns {value is PropertyKey} `true` when the value can be safely used
 *  as a property key; `false` otherwise
 */
export function isValidPropertyKey(value) {
  return isStringValue(value) || isSymbolValue(value) || isSafeIntegerValue(value);
}

/**
 * Returns the first {@link PropertyDescriptor} found while walking the
 * value's prototype-chain.
 *
 * Uses the parameter-default-to-`null` pattern so the `!== null` loop
 * guard narrows `value` through each guarded `getPrototypeOf` step. Each
 * iteration reads the own descriptor at the current level, then steps
 * up via `guardedGetPrototypeOf(value) ?? null`. The loop terminates on
 * the first descriptor hit or when the chain runs out.
 *
 * Accessor descriptors are returned as-is. The getter is never invoked.
 *
 * @param {unknown} value - the value whose descriptor chain should be
 *  inspected
 * @param {PropertyKey} key - the property key to resolve; invalid keys
 *  yield `undefined`
 * @returns {PropertyDescriptor | undefined} the first descriptor found
 *  while walking up the chain; `undefined` if none exists
 */
export function getNextAvailablePropertyDescriptor(value = null, key) {
  if (!isValidPropertyKey(key)) {
    return void 0;
  }
  /** @type {PropertyDescriptor | undefined} */
  let descriptor;

  while (!descriptor && value !== null) {
    descriptor = /** @type {PropertyDescriptor | undefined} */ (
      getOwnPropertyDescriptor(value, key)
    );
    value = guardedGetPrototypeOf(value) ?? null;
  }
  return descriptor;
}

/**
 * Returns the own string-keyed property names of a value, including
 * non-enumerable ones.
 *
 * Composes the cached `objectKeys` with `getOwnPropertyDescriptors`.
 * `getOwnPropertyDescriptors` writes every descriptor entry as enumerable
 * on its returned object, so `objectKeys` over that result surfaces every
 * own string-keyed name regardless of the source's enumerability.
 *
 * Symbol-keyed entries are excluded, since `objectKeys` reads strings only.
 *
 * The `value ?? !0` shorthand coerces nullish input to a boxed `true`,
 * which sidesteps the `TypeError` that `getOwnPropertyDescriptors(null)`
 * would raise.
 *
 * @param {unknown} [value] - the value whose own string-keyed property names
 *  should be returned; nullish (or omitted) yields `[]`
 * @returns {string[]} the array of own string-keyed property names
 * @example
 * const obj = Object.defineProperty({ a: 1 }, 'b', { value: 2 });
 * Object.keys(obj);                    // ['a']
 * getOwnPropertyDescriptorsKeys(obj);  // ['a', 'b']
 * getOwnPropertyDescriptorsKeys(null); // []
 */
export function getOwnPropertyDescriptorsKeys(value) {
  return objectKeys(getOwnPropertyDescriptors(value ?? !0));
}

/**
 * Returns the own string-keyed property names of a value as a `Set<string>`.
 *
 * Composes {@link getOwnPropertyDescriptorsKeys} with the `Set` constructor.
 *
 * The Set carries set-equality, subset, and superset semantics natively
 * and supports per-key membership checks (`.has(key)`) directly. This is
 * the right primitive for shape-comparison checks that read individual
 * key presence or absence rather than full-shape equality.
 *
 * Same key-coverage as {@link getOwnPropertyDescriptorsKeys}.
 * Non-enumerable own string keys are included. Symbol-keyed entries are
 * excluded. Nullish input (or an omitted call) yields an empty `Set`.
 *
 * @param {unknown} [value] - the value whose own string-keyed names should
 *  be returned as a Set; nullish (or omitted) yields an empty `Set`
 * @returns {Set<string>} a `Set` of the value's own string-keyed property
 *  names
 * @example
 * const obj = Object.defineProperty({ a: 1 }, 'b', { value: 2 });
 * getOwnPropertyDescriptorsKeySet(obj);   // Set { 'a', 'b' }
 * getOwnPropertyDescriptorsKeySet({});    // Set {}
 * getOwnPropertyDescriptorsKeySet(null);  // Set {}
 */
export function getOwnPropertyDescriptorsKeySet(value) {
  return new Set(getOwnPropertyDescriptorsKeys(value));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Guarded/Inert Property-Key Utilities
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Walks for the next available descriptor like
 * {@link getNextAvailablePropertyDescriptor}, but swallows any throw from a
 * hostile `getOwnPropertyDescriptor` / `getPrototypeOf` Proxy-trap and reports
 * `undefined` instead.
 *
 * The inert probes built on it ({@link hasInertMethod} and its siblings) are
 * type-guards: they must answer `true` / `false`, never propagate an exception
 * from an adversarial host object. This extends the spec-defined-accessor trust
 * boundary (decision #029) to the descriptor-walk reads — and
 * {@link getDefinedConstructor} routes through it too, so the whole
 * constructor-resolution layer is throw-safe (decision #056). The raw
 * {@link getNextAvailablePropertyDescriptor} remains for callers that supply
 * their own guarding (e.g. `getValidatedStandardConstructorAndPrototypeTuple`,
 * which wraps its walk in a `try/catch`).
 *
 * @param {unknown} type - the value to inspect
 * @param {PropertyKey} key - the property key to resolve
 * @returns {PropertyDescriptor | undefined} the first descriptor found while
 *  walking the chain; `undefined` if none exists or a trap threw
 */
export function getInertDescriptor(type, key) {
  try {
    return getNextAvailablePropertyDescriptor(type, key);
  } catch {
    return void 0;
  }
}

/**
 * Tests whether the value carries a callable data property at `key`,
 * reachable through its prototype-chain.
 *
 * The lookup walks the prototype-chain via own-descriptor reads at
 * each level, matching how ECMA-262 `Get(value, key)` resolves the
 * property at runtime. A `key` found anywhere along the chain — own
 * or inherited — satisfies the predicate, provided the descriptor is
 * a data descriptor whose value is callable.
 *
 * "Inert" refers to the inspect-without-invoke guarantee. The check
 * confirms callability via descriptor reads, never by accessing the
 * property directly. An accessor `get key()` would fire on access
 * regardless of whether the getter returns a callable. The predicate
 * rejects accessor descriptors, so the inspection itself remains inert.
 *
 * Throw-safe: the descriptor walk runs through {@link getInertDescriptor}, so
 * a value whose `getOwnPropertyDescriptor` / `getPrototypeOf` Proxy-trap throws,
 * yields `false` rather than propagating. And a type-guard must answer.
 * The sibling probes share this guarantee.
 *
 * Used by Promise-contract predicates to verify the spec-defined `then`,
 * `catch`, and `finally` methods of a _thenable_ or _promise-like_
 * type without triggering side effects. The helper is general-purpose:
 * any method-contract predicate that needs the inspect-without-invoke
 * guarantee should compose it.
 *
 * @param {unknown} type - the value to inspect
 * @param {PropertyKey} key - the property key to resolve through the
 *  value's prototype-chain
 * @returns {boolean} `true` when the value carries a callable data
 *  property at `key` in its prototype-chain; `false` otherwise
 * @example
 * hasInertMethod(Promise.resolve(), 'then');                   // true (inherited)
 * hasInertMethod({ then: () => {} }, 'then');                  // true (own)
 * hasInertMethod({}, 'then');                                  // false
 * hasInertMethod({ get then() { return () => {}; } }, 'then'); // false (accessor)
 * hasInertMethod(null, 'then');                                // false
 */
export function hasInertMethod(type = null, key) {
  return type !== null && isCallable(getInertDescriptor(type, key)?.value);
}

/**
 * Tests whether the value carries an accessor `get` at `key`, reachable
 * through its prototype-chain.
 *
 * Sibling of {@link hasInertMethod} for the accessor-getter case. The
 * descriptor walk returns the first descriptor found at any chain
 * level. If that descriptor's `get` field is callable, the predicate
 * returns `true`. Data descriptors yield `undefined` from `?.get` and
 * are rejected. The helper specifically tests for the accessor shape's
 * `get`.
 *
 * Fully inert. The descriptor is read without invocation. The `get`
 * function itself is referenced but never called.
 *
 * @param {unknown} type - the value to inspect
 * @param {PropertyKey} key - the property key to resolve through the
 *  value's prototype-chain
 * @returns {boolean} `true` when the value carries an accessor with a
 *  callable getter at `key` in its prototype-chain; `false` otherwise
 */
export function hasInertGetter(type = null, key) {
  return type !== null && isCallable(getInertDescriptor(type, key)?.get);
}

/**
 * Tests whether the value carries an accessor `set` at `key`, reachable
 * through its prototype-chain.
 *
 * Sibling of {@link hasInertGetter} for the setter case. Same
 * descriptor-walk and descriptor-shape discipline. Data descriptors
 * are rejected (their `set` field is undefined). Fully inert.
 *
 * @param {unknown} type - the value to inspect
 * @param {PropertyKey} key - the property key to resolve through the
 *  value's prototype-chain
 * @returns {boolean} `true` when the value carries an accessor with a
 *  callable setter at `key` in its prototype-chain; `false` otherwise
 */
export function hasInertSetter(type = null, key) {
  return type !== null && isCallable(getInertDescriptor(type, key)?.set);
}

/**
 * Tests whether the value carries a data property at `key`, reachable
 * through its prototype-chain.
 *
 * Sibling of {@link hasInertMethod} for the data-descriptor presence
 * case. Uses `objectHasOwn(descriptor, 'value')` rather than
 * `?.value !== undefined` because a data descriptor may legitimately
 * hold `undefined` as its value — both `{ value: undefined, writable:
 * true, … }` and "no descriptor" would otherwise be conflated. The
 * `objectHasOwn` check distinguishes "the descriptor IS a data
 * descriptor" from "the value is undefined" cleanly, matching
 * ECMA-262 §6.2.5.1 `IsDataDescriptor`.
 *
 * The `?? {}` fallback guards against `objectHasOwn(undefined, ...)`,
 * which throws per ECMA-262 §20.1.2.13 step 1 (ToObject).
 *
 * Fully inert. Use to discriminate data-vs-accessor descriptor shapes
 * along a prototype-chain without invoking either getters or stored
 * values.
 *
 * @param {unknown} type - the value to inspect
 * @param {PropertyKey} key - the property key to resolve through the
 *  value's prototype-chain
 * @returns {boolean} `true` when the value carries a data descriptor at
 *  `key` in its prototype-chain; `false` otherwise (including accessor
 *  descriptors and missing descriptors)
 */
export function hasInertValue(type = null, key) {
  return type !== null && objectHasOwn(getInertDescriptor(type, key) ?? {}, 'value');
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type-Signature Readers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Returns the value's internal `[[Class]]` signature.
 *
 * Reads the tag through the cached `Object.prototype.toString.call`, which
 * is the realm-independent read of a value's built-in type and is immune to
 * a missing or overridden instance `toString`.
 *
 * Uses `args.length` to distinguish an omitted call from one that explicitly
 * passed `undefined`. Explicit `undefined` yields `'[object Undefined]'`.
 * An omitted call yields `undefined`.
 *
 * Throw-safe: a value whose `Symbol.toStringTag` is an accessor that throws
 * on read yields `undefined` rather than propagating. The tag read is the
 * cross-realm `[[Class]]` probe behind several predicates, which must answer,
 * not raise. (Extends the spec-defined-accessor trust boundary, decision #029,
 * to the tag read.)
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value to
 *  read; presence is detected via `args.length` rather than `!== undefined`
 * @returns {TypeSignature | undefined} the `[object Tag]` string when an
 *  argument was provided; `undefined` when no argument was passed or a hostile
 *  `Symbol.toStringTag` getter threw
 * @example
 * getTypeSignature([]);                // '[object Array]'
 * getTypeSignature(null);              // '[object Null]'
 * getTypeSignature(Promise.resolve()); // '[object Promise]'
 * getTypeSignature();                  // undefined
 */
export function getTypeSignature(...args) {
  if (args.length === 0) {
    return void 0;
  }
  try {
    return /** @type {TypeSignature} */ (toObjectString.call(args[0]));
  } catch {
    return void 0;
  }
}

/**
 * Returns the tag portion of a value's type signature.
 *
 * Calls {@link getTypeSignature} and slices `[object ` and `]` off the
 * result. The `isStringValue` check short-circuits the no-argument case,
 * where `getTypeSignature` returned `undefined`.
 *
 * @param {...unknown} args - forwarded as-is to {@link getTypeSignature};
 *  presence is detected from its return value
 * @returns {TaggedType | undefined} the tag substring when an argument was
 *  provided; `undefined` when no argument was passed
 * @example
 * getTaggedType([]);                                 // 'Array'
 * getTaggedType(new Date());                         // 'Date'
 * getTaggedType({ [Symbol.toStringTag]: 'Custom' }); // 'Custom'
 * getTaggedType();                                   // undefined
 */
export function getTaggedType(...args) {
  const result = getTypeSignature(...args);

  return /** @type {TaggedType | undefined} */ (
    (isStringValue(result) && /** @type {TaggedType} */ result.slice(8, -1).trim()) ||
      /** @type {undefined} */ result
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Constructor Inspection
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Walks the value to its constructor function via inert descriptor
 * traversal.
 *
 * Pivot — callable values are walked from themselves (finding their
 * own constructor: `Function` for plain functions, `%GeneratorFunction%`
 * for generator functions, `%AsyncFunction%` for async functions, etc.);
 * non-callable values are walked from their `[[Prototype]]`. The
 * non-callable pivot deliberately bypasses the value's own `constructor`
 * data descriptor. User-supplied tampering on plain objects (e.g.,
 * `{ constructor: 'tampered' }`, `{ constructor: Array }`) cannot
 * influence the result. The result always reflects the structural type
 * via the prototype-chain.
 *
 * When the caller knows the input IS itself a real prototype object
 * (the result of `getPrototypeOf(instance)`, an `X.prototype` reference,
 * etc.), passing `{ assumePrototype: true }` skips the
 * walk-up-from-`[[Prototype]]` step and lets the descriptor-walk start
 * at the value itself. ECMA-262 §10.2.6 mandates an own `constructor`
 * data property on every function-created prototype, so this option
 * reads exactly that own descriptor (e.g.,
 * `getDefinedConstructor(Object.prototype, { assumePrototype: true })`
 * yields `Object`).
 *
 * Two-stage walk:
 *
 * 1. {@link getInertDescriptor} (the throw-safe descriptor walk) on the pivot
 *    finds the first `constructor` descriptor along its `[[Prototype]]` chain.
 *    For the common case, the descriptor's value is a function, returned
 *    directly.
 * 2. For the generator-function family, the first walk lands on a
 *    `constructor` descriptor whose value is itself an OBJECT, not a
 *    function — specifically `%GeneratorFunction.prototype%` or
 *    `%AsyncGeneratorFunction.prototype%`. The follow-up walk on that
 *    object recovers the actual function constructor
 *    (`%GeneratorFunction%`, `%AsyncGeneratorFunction%`).
 *
 * Fully inert — accessor getters are never invoked — and throw-safe: the
 * descriptor walk routes through {@link getInertDescriptor}, so a hostile
 * `getOwnPropertyDescriptor` / `getPrototypeOf` Proxy-trap yields `undefined`
 * (the contract's "no reachable constructor") rather than propagating
 * (decision #056). There are valid
 * cases where a reachable `constructor` reference is neither newable
 * nor a function at all. If such a descriptor-structure appears, it
 * gets resolved. The returned value is always either `undefined` or
 * a function asserted as {@link NewableFunction}. The `[[Construct]]`
 * slot cannot be probed without invoking, so the newable claim is
 * asserted rather than verified. Only callability is verified at each
 * stage, via {@link isFunction}.
 *
 * @param {unknown} [value] - the value whose constructor should be retrieved
 * @param {DefinedConstructorAccessorOptions} [options] - call-site hints.
 *  `assumePrototype: true` treats `value` as a real prototype object
 *  and walks from `value` itself rather than from `getPrototypeOf(value)`,
 *  matching ECMA-262 §10.2.6 for known prototypes.
 * @returns {NewableFunction | undefined} the constructor function when
 *  reachable; `undefined` otherwise (including when a hostile Proxy-trap
 *  throws during the descriptor walk)
 * @example
 * getDefinedConstructor([]);                                          // Array
 * getDefinedConstructor(new Date());                                  // Date
 * getDefinedConstructor(Object.create(null));                         // undefined
 * getDefinedConstructor((function* () {})());                         // GeneratorFunction
 * getDefinedConstructor({ constructor: 'tampered' });                 // Object (override bypassed)
 * getDefinedConstructor(Object.prototype, { assumePrototype: true }); // Object
 */
export function getDefinedConstructor(value = null, options) {
  if (value === null) {
    return void 0;
  }
  const { assumePrototype = false } =
    /** @type {DefinedConstructorAccessorOptions} */ (options) ?? {};

  const fastResult = getRegisteredConstructor(value, assumePrototype);

  if (fastResult) {
    return /** @type {NewableFunction} */ (fastResult);
  }
  const type =
    isCallable(value) || assumePrototype ? value : guardedGetPrototypeOf(value);

  const creator = getInertDescriptor(type, 'constructor')?.value ?? null;

  if (isFunction(creator)) {
    registerConstructor(value, /** @type {NewableFunction} */ (creator), assumePrototype);

    return /** @type {NewableFunction} */ (creator);
  } else if (creator !== null) {
    const constructor = getInertDescriptor(creator, 'constructor')?.value;

    if (isFunction(constructor)) {
      registerConstructor(
        value,
        /** @type {NewableFunction} */ (constructor),
        assumePrototype,
      );
      return /** @type {NewableFunction} */ (constructor);
    }
  }
  return void 0;
}

/**
 * Returns the constructor's `name` via its property descriptor.
 *
 * `name` is spec-defined as an own data descriptor on every function
 * (ECMA-262 §10.2.9 `SetFunctionName`), so reading via
 * `getOwnPropertyDescriptor(constructor, 'name').value` returns the data
 * value directly. An accessor on `name` leaves the descriptor's `value`
 * undefined and is therefore rejected by the {@link isStringValue} narrow
 * that follows. A malicious
 * `Object.defineProperty(Cls, 'name', { get: () => 'Spoofed' })` is the
 * canonical example. No direct-access fallback, because direct `.name`
 * access would invoke the accessor.
 *
 * Composes {@link getDefinedConstructor} as the upstream walk.
 *
 * Edge cases:
 *
 * - A non-string `name` (for example, a malicious replacement that
 *   overrides `name` with a non-string value) yields `undefined`
 *   rather than leaking through.
 * - An unnamed function returns the empty string `''`.
 * - A value with no reachable constructor returns `undefined`.
 *
 * @param {unknown} [value] - the value whose constructor name should be
 *  retrieved
 * @param {DefinedConstructorAccessorOptions} [options] - call-site hints.
 *  `assumePrototype: true` treats `value` as a real prototype object
 *  and walks from `value` itself rather than from `getPrototypeOf(value)`,
 *  matching ECMA-262 §10.2.6 for known prototypes.
 * @returns {ConstructorName | undefined} the constructor's `name` string
 *  when reachable; `undefined` otherwise
 * @example
 * getDefinedConstructorName([]);         // 'Array'
 * getDefinedConstructorName(new Date()); // 'Date'
 * getDefinedConstructorName(null);       // undefined
 */
export function getDefinedConstructorName(value, options) {
  const { assumePrototype = false } =
    /** @type {DefinedConstructorAccessorOptions} */ (options) ?? {};

  // fast result.
  if (hasRegisteredConstructorName(value, assumePrototype)) {
    return getRegisteredConstructorName(value, assumePrototype);
  }
  const constructor = getDefinedConstructor(value, options) ?? null;

  if (constructor === null) {
    return void 0;
  }
  const name = /** @type {unknown} */ (
    getOwnPropertyDescriptor(/** @type {object} */ (constructor), 'name')?.value
  );
  if (!isStringValue(name)) {
    return void 0;
  }
  registerConstructorName(value, name, assumePrototype);

  return name;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type Resolution
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const startsWithUpperCase = /^\p{Lu}/u;

/**
 * Resolves a value to its type-name.
 *
 * Prefers the constructor name when it is a real type identifier (a
 * Unicode uppercase-leading string per `\p{Lu}`). Otherwise, falls back
 * to the structural tag from {@link getTaggedType}, with one refinement:
 * a lowercase constructor name carries more information than the
 * uninformative `'Object'` tag, so it wins that specific conflict.
 *
 * The constructor-name read composes {@link getDefinedConstructorName},
 * whose underlying {@link getDefinedConstructor} walk is fully inert and
 * bypasses user-supplied `constructor` data descriptors.
 * The tag fallback therefore fires only for genuinely weak names
 * (anonymous functions, no reachable constructor) and for primitives
 * whose tag is the canonical answer (`'Null'`, `'Undefined'`).
 *
 * Works for every built-in. Custom types remain stable across
 * minification only if both the constructor's `name` descriptor
 * and the prototype's `Symbol.toStringTag` are frozen.
 *
 * Uses `args.length` to distinguish an omitted call from one that
 * explicitly passed `undefined`.
 *
 * @param {...unknown} args - the first argument (`args[0]`) is the value;
 *  presence is detected via `args.length`
 * @returns {ResolvedType | undefined} the resolved type-name when an
 *  argument was provided; `undefined` when no argument was passed
 * @example
 * resolveType([]);                         // 'Array'
 * resolveType(Promise.resolve());          // 'Promise'
 * resolveType(null);                       // 'Null'
 * resolveType(Object.create(null));        // 'Object'
 * resolveType(new (function foo () {})()); // 'foo'
 * resolveType(new (function () {})());     // 'Object'
 * resolveType();                           // undefined
 */
export function resolveType(...args) {
  const /** @type {unknown} */ value = args[0];

  if (args.length === 0) {
    return /** @type {undefined} */ (value);
  }
  const name = getDefinedConstructorName(value);

  if (name && startsWithUpperCase.test(name)) {
    return name;
  }
  const type = getTaggedType(value);

  return type === 'Object' && name ? name : type;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Standard-Constructor Validation
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Validates a standard built-in constructor and returns its realm-fixed
 * `[constructor, prototype]` tuple, or `[]` when validation fails.
 *
 * The single, throw-safe capture helper behind the per-module realm-fixed
 * intrinsic pairs (e.g. `Promise` for `@/thenable`). It confirms `constructor`
 * is newable via {@link isNewableFunction}, reads its own `prototype` descriptor
 * inertly (the raw walk, wrapped here in `try/catch`), and accepts the pair only
 * when the prototype satisfies both the injected `doesImplementFeatureContract`
 * predicate and reciprocally back-references the constructor
 * (`prototype.constructor === constructor`) — the tamper-resistant identity
 * check. Any throw (hostile descriptor/accessor) collapses to `[]`.
 *
 * @param {unknown} constructor - the candidate standard constructor; validated
 *  internally via {@link isNewableFunction}, so an untrusted value is accepted
 *  (a non-newable yields `[]`)
 * @param {PredicateFunction} doesImplementFeatureContract - the feature-contract
 *  gate applied to the constructor's `prototype`
 * @returns {[NewableFunction, object] | []} the validated
 *  `[constructor, prototype]` tuple, or `[]` when validation fails
 */
export function getValidatedStandardConstructorAndPrototypeTuple(
  constructor,
  doesImplementFeatureContract,
) {
  if (!isNewableFunction(constructor)) {
    return [];
  }
  try {
    const prototype = getNextAvailablePropertyDescriptor(constructor, 'prototype')?.value;

    return doesImplementFeatureContract(prototype) &&
      /** @type {{ constructor?: unknown } | undefined} */ (prototype)?.constructor ===
        constructor
      ? [constructor, /** @type {object} */ (prototype)]
      : [];
  } catch {
    return [];
  }
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
