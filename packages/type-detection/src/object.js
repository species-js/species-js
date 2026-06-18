// @ts-check

/**
 * @module @species-js/type-detection/object
 *
 * Object-shape discrimination.
 *
 * Four predicates compose: {@link isObject} (the structural floor),
 * {@link isPlainObject} (strict subtype: constructor === Object),
 * {@link isDictionaryObject} (strict subtype: no prototype-chain),
 * and {@link isPlainOrDictionaryObject} (the union of the two strict
 * forms — the lodash-equivalent permissive semantic). The strict
 * predicates use cross-realm-safe machinery (`getPrototypeOf`,
 * `getOwnPropertyDescriptor`, and the realm-fixed `objectPrototype`
 * reference from `@/config`; `getTypeSignature`, `getDefinedConstructor`,
 * `getDefinedConstructorName` from `@/utility`; `isClass` from
 * `@/function`) — they discriminate the constructor identity
 * realm-independently rather than via local `instanceof Object` which
 * would miss cross-realm Plain Objects.
 *
 * See the sibling `.d.ts` for type definitions and the per-predicate
 * specification. This `.js` carries the runtime implementation with
 * parallel JSDoc.
 */

import { getOwnPropertyDescriptor, getPrototypeOf, objectPrototype } from '@/config';
import {
  getTypeSignature,
  getDefinedConstructor,
  getDefinedConstructorName,
} from '@/utility';

import { isClass } from '@/function.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @typedef {import('@/object').AnyObject} AnyObject */
/** @typedef {import('@/object').PlainObject} PlainObject */
/** @typedef {import('@/object').DictionaryObject} DictionaryObject */
/** @typedef {import('@/object').PlainOrDictionaryObject} PlainOrDictionaryObject */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link AnyObject} — any non-null, non-function
 * object — via `!!value && typeof value === 'object'`.
 *
 * The truthiness gate (`!!value`) rejects `null`, `undefined`, and all
 * falsy primitives (`0`, `''`, `false`, `NaN`, `0n`) in O(1). The
 * `typeof === 'object'` gate rejects truthy primitives (`'foo'`, `42`,
 * `true`, etc.) and functions in O(1). What remains is the set of
 * non-null non-function objects: plain objects, arrays, dates, maps,
 * class instances, prototype-less objects, and boxed primitives.
 *
 * Realm-independent — `typeof` reads identically in every realm, and
 * truthiness is spec-defined.
 *
 * Generic in `T` per the family-pattern (decisions #031, #039). The
 * narrow returns `T & AnyObject`; `T = unknown` collapses to
 * `AnyObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not an object
 * @returns {value is T & AnyObject} `true` when the value is a
 *  non-null non-function object, narrowing `value` to `T & AnyObject`;
 *  `false` otherwise
 * @example
 * isObject({});                  // true
 * isObject([]);                  // true (arrays are objects)
 * isObject(new Date());          // true
 * isObject(Object.create(null)); // true (prototype-less objects qualify)
 * isObject(new String('x'));     // true (boxed primitives qualify)
 * isObject('x');                 // false (primitive string)
 * isObject(42);                  // false (primitive number)
 * isObject(() => {});            // false (function)
 * isObject(null);                // false
 * isObject(undefined);           // false
 */
export function isObject(value) {
  return !!value && typeof value === 'object';
}

/**
 * Probes the two inexpensive string-shape markers that suggest a value
 * is a plain `Object` instance — the `[[Class]]` tag
 * (`'[object Object]'`) and the constructor name (`'Object'` via the
 * four-source walk). Both markers are cross-realm safe via the
 * realm-fixed `toObjectString.call` capture and the constructor-walk's
 * descriptor-discipline.
 *
 * Used as the inexpensive front-half of the cross-realm Plain Object
 * fallback in {@link isPlainObject}: if either marker fails, the more
 * expensive {@link hasPlainObjectPrototypeContract} walk is skipped.
 * Also reused by the fused {@link isPlainOrDictionaryObject} dispatch
 * on its cross-realm branch.
 *
 * @param {unknown} [value] - the value whose string-shape signal to
 *  probe
 * @returns {boolean} `true` when both string-shape markers match
 *  `Object`'s signature; `false` otherwise
 * @internal
 */
export function hasPlainObjectIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object Object]' &&
    getDefinedConstructorName(value) === 'Object'
  );
}

/**
 * Verifies the structural anchor for cross-realm Plain Object
 * discrimination: a five-marker chain that walks from `value` to its
 * prototype and the prototype's constructor, then verifies the
 * spec-mechanic invariants that `Object` carries in every realm.
 *
 * Markers, short-circuited in cost-order:
 *
 * 1. `isClass(constructor)` — the constructor reached via
 *    `getDefinedConstructor(prototype)` is a built-in or
 *    `class`-syntax newable (rejects fake-constructor pointers that
 *    aren't even functions).
 * 2. `getTypeSignature(prototype) === '[object Object]'` — the
 *    prototype's own `[[Class]]` tag matches.
 * 3. The constructor's own `name` data property reads `'Object'`
 *    via `getOwnPropertyDescriptor(...).value` — accessor-form
 *    definitions yield `undefined` and fail the check.
 * 4. The constructor's own `prototype` data property points back to
 *    the prototype walked from `value` — round-trip identity, same
 *    descriptor discipline.
 * 5. `getPrototypeOf(prototype) === null` — chain-depth check: the
 *    prototype is a top-level (no further `[[Prototype]]`), which
 *    every realm's `Object.prototype` satisfies and which class
 *    instances and built-in container instances do not.
 *
 * The descriptor-via-`.value` discipline (markers 3, 4) is deliberate:
 * any accessor-form property definition (`get`/`set`) yields `undefined`
 * from `?.value`, closing the lying-accessor spoof surface where a
 * getter returns one value during the check and a different value
 * to later observers.
 *
 * @param {unknown} [value] - the candidate plain object whose
 *  prototype contract to verify
 * @returns {boolean} `true` when all five markers hold; `false`
 *  otherwise
 * @internal
 */
export function hasPlainObjectPrototypeContract(value) {
  const prototype = getPrototypeOf(value);
  // `assumePrototype: true` — the prototype walked from `value` IS a
  // real prototype object; its own `constructor` descriptor is the
  // spec-mandated source (ECMA-262 §10.2.6). Without this hint,
  // `getDefinedConstructor` would walk one level further up and read
  // `Object.prototype`'s own constructor (i.e. `Object`) for EVERY
  // plain object's prototype, including `Object.prototype` itself
  // — which would overshoot, yielding `undefined` for the canonical
  // local-realm case.
  const constructor =
    isObject(prototype) && getDefinedConstructor(prototype, { assumePrototype: true });

  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object Object]' &&
    getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object' &&
    getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype &&
    getPrototypeOf(prototype) === null
  );
}

/**
 * Narrows a value to {@link PlainObject} — an AnyObject whose direct
 * constructor is the built-in `Object`.
 *
 * Composes two complementary checks: the local-realm fast-path
 * `getPrototypeOf(value) === Object.prototype` (an O(1) reference
 * comparison) and a cross-realm-safe structural anchor formed by
 * {@link hasPlainObjectIdentitySignal} (two inexpensive string-shape
 * signal markers) AND {@link hasPlainObjectPrototypeContract} (the
 * five-marker prototype contract):
 *
 * - Signal markers (inexpensive, front-loaded): `[[Class]]` tag
 *   `'[object Object]'` and constructor name `'Object'`.
 * - Prototype contract (load-bearing structural anchor): the
 *   constructor reached via `getDefinedConstructor(prototype)` is a
 *   newable class shape (`isClass`), the prototype's own
 *   `[[Class]]` tag is `'[object Object]'`, the constructor's own
 *   `name` and `prototype` properties read via
 *   `getOwnPropertyDescriptor(...).value` (skipping accessors), the
 *   `prototype` value round-trips back to the prototype walked from
 *   `value`, and `getPrototypeOf(prototype) === null` confirms the
 *   chain-depth invariant that every realm's `Object.prototype`
 *   carries.
 *
 * The round-trip identity marker — verifying that the constructor's
 * own `prototype` data property points back to the prototype walked
 * from `value`. This closes the spoof surface where `value.constructor`
 * (own or inherited) is tampered to point at the global `Object`
 * without the prototype actually owning `value`'s `[[Prototype]]`.
 *
 * The descriptor-via-`.value` discipline on the constructor's own
 * `name` and `prototype` reads closes the lying-accessor variant of
 * the same spoof: an accessor-form definition yields `undefined` from
 * `?.value` and fails the check. The chain-depth check rules out class
 * instances and built-in container instances by structural shape
 * rather than by string fingerprint.
 *
 * Short-circuit `&&` runs the `isObject` gate first (rejects null,
 * primitives, undefined, functions in O(1)). Inside the gate, the
 * fast-path reference check runs first. The structural anchor fires
 * only on miss, with signal markers gating the more expensive
 * contract walk.
 *
 * Cross-realm safe by construction. The fast-path matches local-realm
 * `Object.prototype` identity. The fallback uses realm-fixed captures
 * (`toObjectString.call` via `getTypeSignature`, `getPrototypeOf` and
 * `getOwnPropertyDescriptor` from `@/config`) and the four-source
 * constructor walk (via `getDefinedConstructor` /
 * `getDefinedConstructorName`). Cross-realm Plain Objects (from
 * iframes, workers, vm contexts) pass via the fallback: the local
 * `Object.prototype` reference does not match their prototype, but
 * their structural contract matches in every realm.
 *
 * ## Strictness vs. lodash `_.isPlainObject`
 *
 * Lodash's permissive form admits prototype-less objects too. This
 * predicate is strict — it rejects prototype-less objects
 * (`Object.create(null)`), which have their own dedicated predicate,
 * {@link isDictionaryObject}. To match lodash's set, use
 * {@link isPlainOrDictionaryObject}, which composes
 * `isPlainObject(v) || isDictionaryObject(v)` under one name.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & PlainObject`; `T = unknown` collapses to `PlainObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a plain object
 * @returns {value is T & PlainObject} `true` when the value is a
 *  non-null object whose direct constructor is the built-in `Object`
 *  (in any realm), narrowing `value` to `T & PlainObject`; `false`
 *  otherwise
 * @example
 * isPlainObject({});                  // true
 * isPlainObject({ a: 1 });            // true
 * isPlainObject(new Object());        // true
 * isPlainObject(Object.create(Object.prototype)); // true
 * isPlainObject([]);                  // false (constructor is Array)
 * isPlainObject(new Date());          // false (constructor is Date)
 * isPlainObject(new (class Foo {})()); // false (custom class)
 * isPlainObject(Object.create(null)); // false (no constructor — use isDictionaryObject)
 * isPlainObject(null);                // false
 */
export function isPlainObject(value) {
  return (
    isObject(value) &&
    (getPrototypeOf(value) === objectPrototype ||
      (hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value)))
  );
}

/**
 * Narrows a value to {@link DictionaryObject} — an AnyObject with no
 * prototype-chain. Typically created via `Object.create(null)` for
 * use as a hashmap.
 *
 * Composes four markers via short-circuit `&&`: the `isObject` gate,
 * the prototype check `getPrototypeOf(value) === null`, the
 * constructor-absence check `getDefinedConstructor(value) === undefined`,
 * and the tag-signature cross-validator
 * `getTypeSignature(value) === '[object Object]'`. The three non-gate
 * markers are independent cross-validators:
 *
 * - `getPrototypeOf === null` is the spec-correct test for "no
 *   prototype-chain." `Object.create(null)` is the canonical way to
 *   reach this state, but any object whose prototype was later set
 *   to `null` via `Object.setPrototypeOf(obj, null)` also passes.
 * - `getDefinedConstructor === undefined` is the structural
 *   cross-validator: the four-source constructor walk resolves no real
 *   constructor. The walk deliberately ignores an own `constructor` data
 *   property (decision #047), so a prototype-less hashmap carrying a
 *   user-supplied `constructor` key is still admitted — the key is data,
 *   not a reachable constructor. With no prototype-chain to resolve a
 *   real constructor through, the walk returns `undefined`; the marker
 *   pairs with the `getPrototypeOf === null` check as defense-in-depth.
 * - `getTypeSignature === '[object Object]'` is the tag cross-validator
 *   closing the rare surface where a prototype-less object has been
 *   hand-decorated with an own `Symbol.toStringTag` to lie about its
 *   [[Class]]. For the hashmap semantic this type targets, a tag
 *   would never be set legitimately.
 *
 * Realm-independent. The prototype-less state is realm-orthogonal
 * (no constructor identity is involved), and both the
 * `getDefinedConstructor` walk and the `getTypeSignature` capture
 * are cross-realm safe.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & DictionaryObject`; `T = unknown` collapses to `DictionaryObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a dictionary object
 * @returns {value is T & DictionaryObject} `true` when the value is a
 *  non-null object with no prototype-chain and no reachable
 *  constructor, narrowing `value` to `T & DictionaryObject`; `false`
 *  otherwise
 * @example
 * isDictionaryObject(Object.create(null));     // true
 * isDictionaryObject({});                      // false (has Object.prototype)
 * isDictionaryObject([]);                      // false
 * isDictionaryObject(null);                    // false
 * isDictionaryObject(Object.create({ a: 1 })); // false (has a non-null prototype)
 */
export function isDictionaryObject(value) {
  return (
    isObject(value) &&
    getPrototypeOf(value) === null &&
    getDefinedConstructor(value) === undefined &&
    getTypeSignature(value) === '[object Object]'
  );
}

/**
 * Narrows a value to {@link PlainOrDictionaryObject} — either a
 * {@link PlainObject} (prototype-bearing, constructor === Object) or a
 * {@link DictionaryObject} (prototype-less).
 *
 * Fused implementation: shares one `isObject` gate and one
 * `getPrototypeOf` read across both branches, then dispatches by
 * prototype value:
 *
 * - `prototype === Object.prototype` → local-realm `PlainObject`,
 *   accept immediately (fast-path).
 * - `prototype === null` → `DictionaryObject` candidate, verify the
 *   two non-prototype cross-validators (`getDefinedConstructor ===
 *   undefined` and `getTypeSignature === '[object Object]'`).
 * - otherwise → cross-realm `PlainObject` fallback via
 *   {@link hasPlainObjectIdentitySignal} + the prototype-contract walk.
 *
 * The fused form avoids the redundant gate, prototype-read, tag-computation,
 * and constructor-walk that a naive `isPlainObject(v) || isDictionaryObject(v)`
 * composition would perform — especially in the `DictionaryObject` input case,
 * where the strict predicate runs its signal + contract checks before failing.
 *
 * This is the lodash-equivalent semantic — `_.isPlainObject` from
 * lodash admits both forms in one predicate. Use this when lodash
 * compatibility is wanted. Use {@link isPlainObject} or
 * {@link isDictionaryObject} alone when the distinction between
 * prototype-bearing and prototype-less is meaningful to the caller
 * (lookup-table-vs-instance vs. hashmap-vs-instance is the typical
 * reason).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & PlainOrDictionaryObject`; `T = unknown` collapses to
 * `PlainOrDictionaryObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is neither form
 * @returns {value is T & PlainOrDictionaryObject} `true` when the value
 *  is either a `PlainObject` or a `DictionaryObject`, narrowing `value`
 *  to `T & PlainOrDictionaryObject`; `false` otherwise
 * @example
 * isPlainOrDictionaryObject({});                  // true (PlainObject)
 * isPlainOrDictionaryObject(Object.create(null)); // true (DictionaryObject)
 * isPlainOrDictionaryObject(new Object());        // true
 * isPlainOrDictionaryObject([]);                  // false (constructor is Array)
 * isPlainOrDictionaryObject(new Date());          // false
 * isPlainOrDictionaryObject(new (class Foo {})()); // false (custom class)
 * isPlainOrDictionaryObject(null);                // false
 */
export function isPlainOrDictionaryObject(value) {
  if (!isObject(value)) {
    return false;
  }
  const prototype = getPrototypeOf(value);

  // PlainObject — local-realm fast-path
  if (prototype === objectPrototype) {
    return true;
  }

  // DictionaryObject — prototype-less form, two cross-validators remain
  if (prototype === null) {
    return (
      getDefinedConstructor(value) === undefined &&
      getTypeSignature(value) === '[object Object]'
    );
  }

  // PlainObject — cross-realm fallback
  return hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
