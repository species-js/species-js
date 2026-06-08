// @ts-check

/**
 * @module @species-js/type-detection/object
 *
 * Object-shape discrimination.
 *
 * Four predicates compose: {@link isObject} (the structural floor),
 * {@link isPlainObject} (strict subtype: constructor === Object),
 * {@link isDictionaryObject} (strict subtype: no prototype chain),
 * and {@link isPlainOrDictionaryObject} (the union of the two strict
 * forms — the lodash-equivalent permissive semantic). The strict
 * predicates use cross-realm-safe machinery (`getPrototypeOf` from
 * `@/config`; `getTypeSignature`, `getDefinedConstructor`,
 * `getDefinedConstructorName` from `@/utility`) — they discriminate
 * the constructor identity realm-independently rather than via local
 * `instanceof Object` which would miss cross-realm Plain Objects.
 *
 * See the sibling `.d.ts` for type definitions and the per-predicate
 * specification; this `.js` carries the runtime implementation with
 * parallel JSDoc.
 */

import { getOwnPropertyDescriptor, getPrototypeOf } from '@/config';
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
 * Probes the two inexpensive string-shape markers that suggest a value is
 * a plain `Object` instance — the `[[Class]]` tag (`'[object Object]'`)
 * and the constructor name (`'Object'` via the four-source walk).
 * Both markers are cross-realm safe via the realm-fixed
 * `toObjectString.call` capture and the constructor walk's
 * descriptor-discipline.
 *
 * Used as the inexpensive front-half of the cross-realm Plain Object
 * fallback in {@link isPlainObject}: if either marker fails, the
 * more expensive {@link hasPlainObjectPrototypeContract} walk is skipped.
 * Reusable in callers that need the signal check alone — e.g., the
 * fused {@link isPlainOrDictionaryObject} dispatch.
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
 * Markers, short-circuited in cost order:
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
 * 4. The constructor's own `prototype` data property points back
 *    to the prototype walked from `value` — round-trip identity,
 *    same descriptor discipline.
 * 5. `getPrototypeOf(prototype) === null` — chain-depth check: the
 *    prototype is a top-level (no further `[[Prototype]]`), which
 *    every realm's `Object.prototype` satisfies and which class
 *    instances and built-in container instances do not.
 *
 * The descriptor-via-`.value` discipline (markers 3, 4) is
 * deliberate: any accessor-form property definition (`get`/`set`)
 * yields `undefined` from `?.value`, closing the lying-accessor
 * spoof surface where a getter returns one value during the check
 * and a different value to later observers.
 *
 * @param {unknown} [value] - the candidate plain object whose
 *  prototype contract to verify
 * @returns {boolean} `true` when all five markers hold; `false`
 *  otherwise
 * @internal
 */
export function hasPlainObjectPrototypeContract(value) {
  const prototype = getPrototypeOf(value);
  const constructor = isObject(prototype) && getDefinedConstructor(prototype);

  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object Object]' &&
    getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object' &&
    getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype &&
    getPrototypeOf(prototype) === null
  );
}

/**
 * Narrows a value to {@link AnyObject} — any non-null, non-function
 * object — via `!!value && typeof value === 'object'`.
 *
 * The truthiness gate rejects `null`, `undefined`, and all falsy
 * primitives in O(1); the `typeof` gate rejects truthy primitives and
 * functions in O(1). What remains is the set of non-null non-function
 * objects: plain objects, arrays, dates, maps, class instances,
 * prototype-less objects, and boxed primitives. Realm-independent.
 *
 * Generic in `T` per the family pattern (decisions #031, #039). The
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
 * isObject(Object.create(null)); // true (prototype-less objects qualify)
 * isObject('x');                 // false (primitive)
 * isObject(() => {});            // false (function)
 * isObject(null);                // false
 */
export function isObject(value) {
  return !!value && typeof value === 'object';
}

/**
 * Narrows a value to {@link PlainObject} — an object whose direct
 * constructor is the built-in `Object`.
 *
 * Composes the {@link isObject} gate with a two-branch identity
 * check: the local-realm fast path `getPrototypeOf(value) ===
 * Object.prototype` (an O(1) reference comparison) and a
 * cross-realm-safe structural anchor formed by
 * {@link hasPlainObjectIdentitySignal} (two cheap string-shape
 * markers) AND {@link hasPlainObjectPrototypeContract} (a five-marker
 * spec-mechanic-anchored chain — `isClass` on the constructor, the
 * prototype's own `[[Class]]` tag, the constructor's own `name` and
 * `prototype` data-descriptor reads, and the chain-depth check
 * `getPrototypeOf(prototype) === null`).
 *
 * Short-circuit `&&` runs the `isObject` gate first; inside the
 * gate, `||` runs the local-realm fast path first and the
 * cross-realm structural fallback only on miss. Cross-realm Plain
 * Objects (from other iframes, workers, vm contexts) pass via the
 * fallback because the local `Object.prototype` reference does not
 * match their prototype, but their structural contract matches in
 * every realm.
 *
 * The round-trip identity marker — verifying that the constructor's
 * own `prototype` data property points back to the prototype walked
 * from `value` — closes the spoof surface where `value.constructor`
 * (own or inherited) is tampered to point at the global `Object`
 * without the prototype actually owning `value`'s `[[Prototype]]`.
 * The descriptor-via-`.value` discipline closes the lying-accessor
 * variant of the same spoof. The chain-depth check rules out class
 * instances and built-in container instances by structural shape
 * rather than by string fingerprint.
 *
 * **Strict semantics.** Unlike lodash's permissive `_.isPlainObject`,
 * this predicate _rejects_ prototype-less objects
 * (`Object.create(null)`). Reach for {@link isDictionaryObject} for
 * those, or {@link isPlainOrDictionaryObject} for the
 * lodash-equivalent set under one name.
 *
 * Generic in `T` per the family pattern. The narrow returns
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
 * isPlainObject(new Object());        // true
 * isPlainObject([]);                  // false (constructor is Array)
 * isPlainObject(Object.create(null)); // false (no constructor — use isDictionaryObject)
 */
export function isPlainObject(value) {
  return (
    isObject(value) &&
    (getPrototypeOf(value) === Object.prototype ||
      (hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value)))
  );
}

/**
 * Narrows a value to {@link DictionaryObject} — an object with no
 * prototype chain. Typically the result of `Object.create(null)` for
 * use as a hashmap.
 *
 * Composes four markers via short-circuit `&&`: the {@link isObject}
 * gate (rejects primitives, `null`, functions), the prototype check
 * `getPrototypeOf(value) === null`, the constructor-absence check
 * `getDefinedConstructor(value) === undefined`, and the tag-signature
 * cross-validator `getTypeSignature(value) === '[object Object]'`.
 *
 * The prototype check is the spec-correct test; the constructor-absence
 * check is the structural cross-validator that closes the spoof surface
 * where `getPrototypeOf === null` holds but a `constructor` property
 * has been attached to the value directly. For a true prototype-less
 * object, none of the four sources of `getDefinedConstructor`'s
 * fallback walk are reachable, so the walk returns `undefined`. The
 * tag-signature cross-validator closes the rarer surface where
 * a prototype-less object has been hand-decorated with an own
 * `Symbol.toStringTag` to lie about its [[Class]] — for the hashmap
 * semantic this type targets, a tag would never be set legitimately.
 *
 * Realm-independent. The prototype-less state is realm-orthogonal (no
 * constructor identity involved); the constructor walk is cross-realm
 * safe by construction; the tag signature reads through the
 * realm-fixed `toObjectString.call` capture.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & DictionaryObject`; `T = unknown` collapses to `DictionaryObject`.
 *
 * @template [T=unknown]
 * @param {T} [value] - the value to test; omitted is treated as
 *  `undefined`, which is not a dictionary object
 * @returns {value is T & DictionaryObject} `true` when the value is a
 *  non-null object with no prototype chain and no reachable
 *  constructor, narrowing `value` to `T & DictionaryObject`; `false`
 *  otherwise
 * @example
 * isDictionaryObject(Object.create(null)); // true
 * isDictionaryObject({});                  // false (has Object.prototype)
 * isDictionaryObject(null);                // false
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
 * {@link PlainObject} or a {@link DictionaryObject}.
 *
 * Fused implementation: shares one {@link isObject} gate and one
 * `getPrototypeOf` read across both branches, then dispatches by
 * prototype value:
 *
 * - `prototype === Object.prototype` → local-realm `PlainObject`,
 *   accept immediately (fast path).
 * - `prototype === null` → `DictionaryObject` candidate, verify the two
 *   non-prototype cross-validators (`getDefinedConstructor ===
 *   undefined` and `getTypeSignature === '[object Object]'`).
 * - otherwise → cross-realm `PlainObject` fallback via
 *   {@link hasPlainObjectIdentitySignal} + the prototype-contract walk.
 *
 * The fused form avoids the redundant gate, prototype read, tag
 * computation, and constructor walk that a naive
 * `isPlainObject(v) || isDictionaryObject(v)` composition would perform
 * — especially in the `DictionaryObject` input case, where the strict
 * predicate runs its signal + contract checks before failing.
 *
 * Captures the lodash-equivalent semantic — `_.isPlainObject` from
 * lodash admits both forms in one predicate.
 *
 * Generic in `T` per the family pattern. The narrow returns
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
 * isPlainOrDictionaryObject({});                  // true
 * isPlainOrDictionaryObject(Object.create(null)); // true
 * isPlainOrDictionaryObject([]);                  // false
 * isPlainOrDictionaryObject(null);                // false
 */
export function isPlainOrDictionaryObject(value) {
  if (!isObject(value)) {
    return false;
  }
  const prototype = getPrototypeOf(value);

  // PlainObject — local-realm fast path
  if (prototype === Object.prototype) {
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
