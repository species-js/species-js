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
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  getOwnPropertyNames,
  getPrototypeOf as nativeGetPrototypeOf,
  objectHasOwn,
  toObjectString,
} from '@/config';

import {
  isStringValue,
  isNumberValue,
  isSymbolValue,
  unguardedIsUnregisteredSymbol,
} from '@/primitive';

import { isCallable, isFunction, isNewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('./index').TRUSTED_DATA_CONFIRMATION} TRUSTED_DATA_CONFIRMATION_FLAG */
/** @typedef {import('./index').INSTANCE_LESS_CONSTRUCTOR} NEVER_INVOKED_CONSTRUCTOR */

/** @typedef {import('./index').WeakKey} WeakKey */
/** @typedef {import('./index').DefinedConstructorAccessorOptions} DefinedConstructorAccessorOptions */

/** @typedef {import('./index').PropertyDescriptorMap} PropertyDescriptorMap */
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

export const TRUSTED_DATA_CONFIRMATION = /** @type {TRUSTED_DATA_CONFIRMATION_FLAG} */ (
  true
);
export const INSTANCE_LESS_CONSTRUCTOR = /** @type {NEVER_INVOKED_CONSTRUCTOR} */ (
  function () {
    return void 0;
  }
);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether `value` is a member of the `Set` bound as `this`. A `this`-bound
 * membership predicate shaped for the array iteration callbacks
 * (`Array.prototype.some` / `every` / `filter`), called with the `Set` supplied
 * as the `thisArg`: `names.some(isValueOfBoundSet, someSet)`. Being a
 * module-level function that reads its `Set` from `this`, it tests each element
 * against a shared `Set` with NO per-call closure allocation — the allocation-free
 * alternative to `names.some((name) => someSet.has(name))` on hot paths.
 *
 * @param {unknown} value - the element to look up in the bound `Set`
 * @this {ReadonlySet<unknown>} the `Set` to test membership against,
 *  supplied as the iteration callback's `thisArg`
 * @returns {boolean} `true` when the bound `Set` contains `value`;
 *  `false` otherwise
 * @internal
 */
export function isValueOfBoundSet(value) {
  return this.has(value);
}

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
//
//  Inert Prototype Access
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Reads `getPrototypeOf(value)` throw-safely.
 *
 * Wraps the realm-fixed `getPrototypeOf` (`nativeGetPrototypeOf`) in a
 * `try/catch` so a hostile `getPrototypeOf` Proxy-trap yields `undefined`
 * rather than propagating — a structural read must answer, not raise
 * (decision #029 trust boundary, extended to the prototype read). No
 * memoization: `getPrototypeOf` is a trivial intrinsic, cheaper to call than
 * to cache (decision #057); per-value caching is the consumer's concern.
 *
 * @param {unknown} [value] - the value whose prototype to read; omitted/`null`
 *  yields `undefined`
 * @returns {object | Callable | null | undefined} the value's prototype (an
 *  object, a callable, or `null`); `undefined` for nullish input or when a
 *  hostile trap threw
 * @internal
 */
export function getInertPrototypeOf(value = null) {
  if (value === null) {
    return void 0;
  }
  try {
    return nativeGetPrototypeOf(value);
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
 * Narrows the value to a valid `PropertyKey`.
 *
 * Composes {@link isStringValue}, {@link isSymbolValue}, and
 * {@link isNumberValue}. The latter check is sufficient, since
 * every number value, including infinite number values and even
 * `NaN`, coerce to string primitives the very moment each gets
 * assigned as an object's property-key.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a property key
 * @returns {value is PropertyKey} `true` when the value can be safely used
 *  as a property key; `false` otherwise
 */
export function isValidPropertyKey(value) {
  return isStringValue(value) || isSymbolValue(value) || isNumberValue(value);
}

/**
 * Returns all own property keys of `value` — both string-named and
 * symbol-keyed, enumerable and non-enumerable — as a single array.
 *
 * Concatenates {@link getOwnPropertyNames} (own string keys, including
 * non-enumerable ones) with {@link getOwnPropertySymbols} (own symbol keys).
 * The `value ?? !0` shorthand coerces nullish input to the boxed `true`, which
 * sidesteps the `TypeError` that `Object.getOwnPropertyNames(null)` would raise
 * — so a nullish (or omitted) argument yields `[]` rather than throwing.
 *
 * This is the raw form; {@link getInertOwnPropertyKeys} is the throw-safe twin
 * that also absorbs a hostile `Proxy` `ownKeys` trap (the raw/inert pairing used
 * across this module, mirroring
 * {@link getNextAvailablePropertyDescriptor} / {@link getInertDescriptor}).
 *
 * @param {unknown} [value] - the value whose own keys to collect; nullish (or
 *  omitted) yields `[]`
 * @returns {(string | symbol)[]} the own string and symbol keys; an empty array
 *  when there are none
 */
export function getOwnPropertyKeys(value) {
  value = value ?? !0;

  return /** @type {(string | symbol)[]} */ (getOwnPropertyNames(value)).concat(
    getOwnPropertySymbols(value),
  );
}

/**
 * Returns the first {@link PropertyDescriptor} found while walking the
 * value's prototype-chain.
 *
 * Uses the parameter-default-to-`null` pattern so the `!== null` loop
 * guard narrows `value` through each guarded `getPrototypeOf` step. Each
 * iteration reads the own descriptor at the current level, then steps
 * up via `getInertPrototypeOf(value) ?? null`. The loop terminates on
 * the first descriptor hit or when the chain runs out.
 *
 * Accessor descriptors are returned as-is. The getter is never invoked.
 *
 * @param {unknown} value - the value whose descriptor chain should be
 *  inspected
 * @param {PropertyKey} key - the property key to resolve; invalid keys
 *  yield `undefined`
 * @param {TRUSTED_DATA_CONFIRMATION_FLAG} [trustedData] - call-site hint
 * @returns {PropertyDescriptor | undefined} the first descriptor found
 *  while walking up the chain; `undefined` if none exists
 * @throws {unknown} at a malicious `getOwnPropertyDescriptors` proxy-trap
 */
export function getNextAvailablePropertyDescriptor(value = null, key, trustedData) {
  if (trustedData !== true && !isValidPropertyKey(key)) {
    return void 0;
  }
  /** @type {PropertyDescriptor | undefined} */
  let descriptor;

  while (!descriptor && value !== null) {
    descriptor = /** @type {PropertyDescriptor | undefined} */ (
      getOwnPropertyDescriptor(value, key)
    );
    value = getInertPrototypeOf(value) ?? null;
  }
  return descriptor;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Inert Property-Key Utilities
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The throw-safe variant of {@link getOwnPropertyNames} — a value's own
 * string-keyed property names (enumerable and non-enumerable), or `[]` when
 * none are reachable.
 *
 * The `value ?? !0` shorthand coerces nullish input to the boxed `true`, which
 * sidesteps the `TypeError` that `Object.getOwnPropertyNames(null)` would raise;
 * the surrounding `try`/`catch` additionally swallows any throw from a hostile
 * `Proxy` `ownKeys` trap and reports `[]` instead — so this answers an array on
 * every input, the inert-probe discipline (decisions #029, #056).
 *
 * @param {unknown} [value] - the value whose own string-keyed names to read;
 *  nullish (or omitted) yields `[]`
 * @returns {string[]} the own string-keyed property names; `[]` when none are
 *  reachable or a trap threw
 * @internal
 */
export function getInertOwnPropertyNames(value) {
  try {
    return getOwnPropertyNames(value ?? !0);
  } catch {
    return [];
  }
}

/**
 * The throw-safe variant of {@link getOwnPropertySymbols} — a value's own
 * symbol-keyed properties, or `[]` when none are reachable.
 *
 * Same inert discipline as {@link getInertOwnPropertyNames}: the `value ?? !0`
 * guard sidesteps the nullish `TypeError`, and the `try`/`catch` swallows a
 * hostile `ownKeys` trap, reporting `[]`.
 *
 * @param {unknown} [value] - the value whose own symbol keys to read; nullish
 *  (or omitted) yields `[]`
 * @returns {symbol[]} the own symbol-keyed properties; `[]` when none are
 *  reachable or a trap threw
 * @internal
 */
export function getInertOwnPropertySymbols(value) {
  try {
    return getOwnPropertySymbols(value ?? !0);
  } catch {
    return [];
  }
}

/**
 * The throw-safe variant of {@link getOwnPropertyKeys} — all of a value's own
 * property keys, both string-named and symbol-keyed (enumerable and
 * non-enumerable), as a single array.
 *
 * Concatenates {@link getInertOwnPropertyNames} and
 * {@link getInertOwnPropertySymbols}, so it inherits their inert discipline:
 * nullish input and hostile traps yield `[]` rather than throwing.
 *
 * @param {unknown} [value] - the value whose own keys to collect; nullish (or
 *  omitted) yields `[]`
 * @returns {(string | symbol)[]} the own string and symbol keys; `[]` when none
 *  are reachable or a trap threw
 * @internal
 */
export function getInertOwnPropertyKeys(value) {
  return /** @type {(string | symbol)[]} */ (getInertOwnPropertyNames(value)).concat(
    getInertOwnPropertySymbols(value),
  );
}

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
 * @param {TRUSTED_DATA_CONFIRMATION_FLAG} [trustedData] - call-site hint
 * @returns {PropertyDescriptor | undefined} the first descriptor found
 *  while walking the chain; `undefined` if none exists or a trap threw
 */
export function getInertDescriptor(type, key, trustedData) {
  try {
    return getNextAvailablePropertyDescriptor(type, key, trustedData);
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
 * @param {TRUSTED_DATA_CONFIRMATION_FLAG} [trustedData] - call-site hint
 * @returns {boolean} `true` when the value carries a callable data
 *  property at `key` in its prototype-chain; `false` otherwise
 * @example
 * hasInertMethod(Promise.resolve(), 'then');                   // true (inherited)
 * hasInertMethod({ then: () => {} }, 'then');                  // true (own)
 * hasInertMethod({}, 'then');                                  // false
 * hasInertMethod({ get then() { return () => {}; } }, 'then'); // false (accessor)
 * hasInertMethod(null, 'then');                                // false
 */
export function hasInertMethod(type = null, key, trustedData) {
  return type !== null && isCallable(getInertDescriptor(type, key, trustedData)?.value);
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
 * @param {TRUSTED_DATA_CONFIRMATION_FLAG} [trustedData] - call-site hint
 * @returns {boolean} `true` when the value carries an accessor with a
 *  callable getter at `key` in its prototype-chain; `false` otherwise
 */
export function hasInertGetter(type = null, key, trustedData) {
  return type !== null && isCallable(getInertDescriptor(type, key, trustedData)?.get);
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
 * @param {TRUSTED_DATA_CONFIRMATION_FLAG} [trustedData] - call-site hint
 * @returns {boolean} `true` when the value carries an accessor with a
 *  callable setter at `key` in its prototype-chain; `false` otherwise
 */
export function hasInertSetter(type = null, key, trustedData) {
  return type !== null && isCallable(getInertDescriptor(type, key, trustedData)?.set);
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
 * @param {TRUSTED_DATA_CONFIRMATION_FLAG} [trustedData] - call-site hint
 * @returns {boolean} `true` when the value carries a data descriptor at
 *  `key` in its prototype-chain; `false` otherwise (including accessor
 *  descriptors and missing descriptors)
 */
export function hasInertValue(type = null, key, trustedData) {
  return (
    type !== null &&
    objectHasOwn(getInertDescriptor(type, key, trustedData) ?? {}, 'value')
  );
}

/**
 * The verified own `name` of a value — reads the value's OWN `name` property
 * descriptor and returns its data `value` only when that value is a string
 * primitive; `undefined` otherwise.
 *
 * Generic and constructor-agnostic: it takes any `value` and reports the string
 * `name` it declares as own data. Own-descriptor read only (no chain walk); the
 * chain-walking counterpart is reserved under the name `getVerifiedNextAvailableName`,
 * mirroring the `getOwnPropertyDescriptor` / {@link getNextAvailablePropertyDescriptor}
 * pair.
 *
 * Inert and throw-safe: an accessor on `name` leaves the descriptor's `value`
 * `undefined` and is rejected by the {@link isStringValue} narrow (the getter is
 * never invoked), and the own-descriptor read is wrapped so a nullish input or a
 * hostile `getOwnPropertyDescriptor` Proxy-trap yields `undefined` rather than
 * propagating.
 *
 * @param {unknown} [value] - the value whose own `name` to read
 * @returns {string | undefined} the own `name` value when present and a string
 *  primitive; `undefined` otherwise
 * @internal
 */
export function getVerifiedOwnName(value) {
  try {
    const name = /** @type {unknown} */ (
      getOwnPropertyDescriptor(/** @type {object} */ (value), 'name')?.value
    );
    return isStringValue(name) ? name : void 0;
  } catch {
    return void 0;
  }
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

  const type = isCallable(value) || assumePrototype ? value : getInertPrototypeOf(value);

  const creator =
    getInertDescriptor(type, 'constructor', TRUSTED_DATA_CONFIRMATION)?.value ?? null;

  if (isFunction(creator)) {
    return /** @type {NewableFunction} */ (creator);
  } else if (creator !== null) {
    const constructor = getInertDescriptor(
      creator,
      'constructor',
      TRUSTED_DATA_CONFIRMATION,
    )?.value;

    if (isFunction(constructor)) {
      return /** @type {NewableFunction} */ (constructor);
    }
  }
  return void 0;
}

/**
 * Returns the constructor's `name` via its property descriptor.
 *
 * Composes {@link getDefinedConstructor} (the throw-safe, tamper-resistant
 * constructor walk) with {@link getVerifiedOwnName} (the own `name` descriptor
 * read, narrowed to a string primitive). Reading `name` via its descriptor —
 * rather than direct `.name` access — keeps the read inert: an accessor `name`
 * (the canonical `Object.defineProperty(Cls, 'name', { get: () => 'Spoofed' })`)
 * leaves the descriptor's `value` undefined and is rejected, never invoked.
 *
 * `name` is spec-defined as an own data descriptor on every function
 * (ECMA-262 §10.2.9 `SetFunctionName`), so the own read suffices.
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
  return getVerifiedOwnName(getDefinedConstructor(value, options));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Type Resolution
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const regXStartsWithUpperCase = /^\p{Lu}/u;

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

  if (name && regXStartsWithUpperCase.test(name)) {
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
    const prototype = getNextAvailablePropertyDescriptor(
      constructor,
      'prototype',
      TRUSTED_DATA_CONFIRMATION,
    )?.value;

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
