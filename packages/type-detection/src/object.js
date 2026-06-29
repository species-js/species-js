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
 * predicates use cross-realm-safe machinery (`getOwnPropertyDescriptors`
 * and the realm-fixed `objectPrototype` reference from `@/config`; the
 * throw-safe `getInertPrototypeOf`, `getInertDescriptor`,
 * `getVerifiedOwnName`, plus `getTypeSignature`, `getDefinedConstructor`,
 * `getDefinedConstructorName` from `@/utility`; `isCallable` and
 * `isClass` from `@/function`) — they discriminate the constructor
 * identity realm-independently rather than via local `instanceof Object`
 * which would miss cross-realm Plain Objects. Every prototype and
 * descriptor read is throw-safe (the `getInert*` readers, and a guarded
 * `getOwnPropertyDescriptors` for the member-surface contract), so a
 * hostile `getPrototypeOf` / `getOwnPropertyDescriptor` Proxy-trap
 * yields `false`, never a propagated throw.
 *
 * See the sibling `.d.ts` for type definitions and the per-predicate
 * specification. This `.js` carries the runtime implementation with
 * parallel JSDoc.
 */

import { getOwnPropertyDescriptors, objectPrototype } from '@/config';
import {
  TRUSTED_DATA_CONFIRMATION,
  getInertPrototypeOf,
  getInertDescriptor,
  getVerifiedOwnName,
  getTypeSignature,
  getDefinedConstructor,
  getDefinedConstructorName,
} from '@/utility';

import { isCallable, isClass } from '@/function.js';

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

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Probes the two markers that suggest a value is a prototype-less
 * Dictionary Object — the `[[Class]]` tag (`'[object Object]'`) and the
 * absence of a reachable constructor (the four-source walk resolves
 * none). Both markers are cross-realm safe via the realm-fixed
 * `toObjectString.call` capture and the constructor-walk's
 * descriptor-discipline.
 *
 * The dictionary counterpart to {@link hasPlainObjectIdentitySignal}:
 * where the plain signal expects the constructor name to read
 * `'Object'`, this one expects no defined constructor at all. Reused by
 * {@link isDictionaryObject} and by the `prototype === null` branch of
 * the fused {@link isPlainOrDictionaryObject} dispatch.
 *
 * @param {unknown} [value] - the value whose string-shape and
 *  constructor-absence signal to probe
 * @returns {boolean} `true` when the tag matches and no constructor is
 *  reachable; `false` otherwise
 * @internal
 */
export function hasDictionaryObjectIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object Object]' &&
    getDefinedConstructor(value) === undefined
  );
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
 * expensive {@link isObjectPrototypeEquivalent} walk is skipped.
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
 * Tests one own descriptor against the shape every `Object.prototype`
 * member carries: it must exist, be non-enumerable, and hold a callable
 * value. Accessor-form (`get`/`set`) and enumerable definitions fail —
 * closing the variant where a spoof installs look-alike members under
 * the right names but the wrong descriptor shape.
 *
 * @param {PropertyDescriptor | undefined} descriptor - the own
 *  descriptor to validate; `undefined` (the member is absent) fails
 * @returns {descriptor is PropertyDescriptor} `true` when the descriptor
 *  is a non-enumerable, callable-valued data property; `false` otherwise
 * @internal
 */
function isValidObjectPrototypeDescriptor(descriptor) {
  return !!descriptor && descriptor.enumerable === false && isCallable(descriptor.value);
}

// The seven core `Object.prototype` members mandated by every conformant
// realm — the always-present floor of the host-calibrated member set.
// Null-ed out once consumed (see `getObjectPrototypeDescriptorNames`).
/** @type {string[] | null} */
let coreObjectPrototypeMemberNames = [
  'constructor',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
];

// The four Annex-B accessor helpers — normative only for web realms, so they
// are probed against the LOCAL `objectPrototype` and appended only when this
// host actually carries them. `__proto__` is omitted on purpose: it is an
// accessor, so it has no callable `.value` and could never satisfy
// `isValidObjectPrototypeDescriptor`. Null-ed out once consumed.
/** @type {string[] | null} */
let optionalObjectPrototypeMemberNames = [
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
];

/** @type {string[]} */
const calibratedObjectPrototypeDescriptorNames = [];

/**
 * The host-calibrated set of member names a genuine `Object.prototype` carries
 * as its own non-enumerable methods: the seven core ES members plus whichever
 * Annex-B accessor helpers this engine actually exposes. Because a cross-realm
 * object is always same-engine (iframe / worker / vm), the LOCAL probe predicts
 * exactly what a genuine foreign `Object.prototype` carries.
 *
 * Calibrated lazily on first call and memoized — deliberately NOT at module
 * load. `object` participates in the `config → primitive → object → config`
 * import cycle, so touching the `@/config` captures (`getOwnPropertyDescriptors`,
 * `objectPrototype`) at module-evaluation time reads them before `config`
 * finishes initializing. Every other config consumer in the package dodges this
 * by reading captures only at call time; this helper follows the same rule.
 *
 * @returns {readonly string[]} the canonical member-name set for the host realm
 * @internal
 */
function getObjectPrototypeDescriptorNames() {
  if (calibratedObjectPrototypeDescriptorNames.length) {
    return calibratedObjectPrototypeDescriptorNames;
  }
  // - dead execution branch, once after the initial, lazy
  //   accumulation of `calibratedObjectPrototypeDescriptorNames`
  calibratedObjectPrototypeDescriptorNames.push(
    .../** @type {string[]} */ (coreObjectPrototypeMemberNames),
  );
  const descriptors = getOwnPropertyDescriptors(objectPrototype);

  for (const name of /** @type {string[]} */ (optionalObjectPrototypeMemberNames)) {
    if (isValidObjectPrototypeDescriptor(descriptors[name])) {
      calibratedObjectPrototypeDescriptorNames.push(name);
    }
  }
  coreObjectPrototypeMemberNames = null;
  optionalObjectPrototypeMemberNames = null;

  return calibratedObjectPrototypeDescriptorNames;
}

/**
 * The member-surface marker of the cross-realm Plain Object contract:
 * confirms that `value` carries, as its own non-enumerable callable
 * properties, every name in the host-calibrated member-name array
 * (see {@link getObjectPrototypeDescriptorNames}).
 *
 * This is the one marker that inspects the prototype's actual members
 * rather than its identity claims. The five identity markers in
 * {@link isObjectPrototypeEquivalent} can all be satisfied by a hollow
 * `class extends null` whose `name` was redefined to `'Object'` — its
 * `.prototype` is null-rooted, brands `'[object Object]'`, and
 * round-trips, yet carries only `constructor`. This check rejects it
 * because the canonical members are absent.
 *
 * ## Own, not inherited — deliberately
 *
 * The read is `getOwnPropertyDescriptors` (own descriptors only): the
 * contract is about what the prototype itself implements, never what it
 * inherits. Do not substitute a prototype-chain-walking reader (e.g.
 * `getInertDescriptor`) — that would accept members inherited from an
 * ancestor and silently weaken the contract for standalone callers. The
 * `.every` short-circuits on the first absent or wrong-shaped member.
 *
 * Augmentation-tolerant: extra own properties on the prototype (a
 * polyfill, a monkeypatched method) do not break the check, since it
 * verifies presence of the canonical set rather than set equality.
 *
 * Residual: a spoof that installs the full canonical set as genuine
 * non-enumerable methods passes — accepted by design, as the structural
 * contract is a best-effort "looks like `Object.prototype`" check; this
 * marker closes the cheap spoof, not every conceivable one.
 *
 * Throw-safe: a hostile `Proxy` `ownKeys` / `getOwnPropertyDescriptor`
 * trap that throws is caught and yields `false` rather than propagating.
 *
 * @param {unknown} [value] - the prototype whose own member surface to
 *  verify (callers pass an already-resolved `[[Prototype]]`); a nullish
 *  or non-object value is absorbed by the guard and yields `false`
 * @returns {boolean} `true` when every canonical member is present as a
 *  non-enumerable callable own property; `false` otherwise
 * @internal
 */
export function doesImplementObjectPrototypeContract(value) {
  try {
    const descriptors = getOwnPropertyDescriptors(/** @type {object} */ (value));

    return getObjectPrototypeDescriptorNames().every((name) =>
      isValidObjectPrototypeDescriptor(descriptors[name]),
    );
  } catch {
    return false;
  }
}

/**
 * Verifies the structural anchor for cross-realm Plain Object
 * discrimination: a six-marker chain over a value's already-resolved
 * `[[Prototype]]`. It walks from the threaded prototype to its
 * constructor, verifies the spec-mechanic invariants that `Object`
 * carries in every realm, then confirms the prototype's own member
 * surface.
 *
 * Markers, short-circuited in cost-order:
 *
 * 1. `isClass(constructor)` — the constructor reached via
 *    `getDefinedConstructor(prototype)` is a built-in or
 *    `class`-syntax newable (rejects fake-constructor pointers that
 *    aren't even functions).
 * 2. `getTypeSignature(prototype) === '[object Object]'` — the
 *    prototype's own `[[Class]]` tag matches.
 * 3. The constructor's own `name` data property reads `'Object'` via
 *    the throw-safe `getVerifiedOwnName`. An accessor-form `name`
 *    definition fails this check — `getVerifiedOwnName` returns
 *    `undefined` for it.
 * 4. The constructor's own `prototype` data property points back to the
 *    threaded `prototype` — round-trip identity, read via the throw-safe
 *    `getInertDescriptor(...).value` (same descriptor discipline).
 * 5. `getInertPrototypeOf(prototype) === null` — chain-depth check: the
 *    prototype is a top-level (no further `[[Prototype]]`), which
 *    every realm's `Object.prototype` satisfies and which class
 *    instances and built-in container instances do not.
 * 6. `doesImplementObjectPrototypeContract(prototype)` — member-surface
 *    check: the prototype carries every canonical `Object.prototype`
 *    member as its own non-enumerable callable property. This is the
 *    one marker that inspects members rather than identity claims, so it
 *    is what separates a genuine cross-realm `Object.prototype` from a
 *    hollow `class extends null` renamed to `'Object'` (which satisfies
 *    markers 1–5 yet carries only `constructor`).
 *
 * The descriptor-via-`.value` discipline (markers 3, 4) is deliberate:
 * any accessor-form property definition (`get`/`set`) yields `undefined`
 * from `getVerifiedOwnName` / `?.value`, closing the lying-accessor spoof
 * surface where a getter returns one value during the check and a
 * different value to later observers.
 *
 * Throw-safe end to end: the prototype read (`getInertPrototypeOf`), the
 * constructor `name` (`getVerifiedOwnName`), the constructor `prototype`
 * round-trip (`getInertDescriptor`), and the member-surface read
 * (a guarded `getOwnPropertyDescriptors`) each absorb a hostile
 * `getPrototypeOf` / `getOwnPropertyDescriptor` Proxy-trap, failing the
 * contract rather than propagating. `isClass` is likewise throw-safe at
 * its own descriptor read.
 *
 * @param {unknown} prototype - the value's already-resolved
 *  `[[Prototype]]`, threaded in by the caller that read it (decision
 *  #059); the helper does not re-read it
 * @returns {boolean} `true` when all six markers hold; `false` otherwise
 * @internal
 */
export function isObjectPrototypeEquivalent(prototype) {
  // `assumePrototype: true` — the threaded `prototype` IS a real
  // prototype object; its own `constructor` descriptor is the
  // spec-mandated source (ECMA-262 §10.2.6). Without this hint,
  // `getDefinedConstructor` would walk one level further up and read
  // `Object.prototype`'s own constructor (i.e. `Object`) for EVERY
  // plain object's prototype, including `Object.prototype` itself
  // — which would overshoot, yielding `undefined` for the canonical
  // local-realm case. `prototype` is threaded in by the predicates that
  // already read it (decision #059); the helper never re-reads it.
  const constructor =
    isObject(prototype) && getDefinedConstructor(prototype, { assumePrototype: true });

  // Markers 3/4 read the constructor's own `name` / `prototype` through the
  // throw-safe `getVerifiedOwnName` and `getInertDescriptor` (decision #056):
  // a hostile `getOwnPropertyDescriptor` Proxy-trap on the constructor yields
  // `undefined` rather than propagating. (`isClass` is throw-safe at its own
  // descriptor read for the same reason.)
  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object Object]' &&
    getVerifiedOwnName(constructor) === 'Object' &&
    getInertDescriptor(constructor, 'prototype', TRUSTED_DATA_CONFIRMATION)?.value ===
      prototype &&
    getInertPrototypeOf(prototype) === null &&
    doesImplementObjectPrototypeContract(prototype)
  );
}

/**
 * The cross-realm Plain Object fallback, composed: the inexpensive
 * {@link hasPlainObjectIdentitySignal} front-gate AND the load-bearing
 * {@link isObjectPrototypeEquivalent} structural contract. A foreign
 * `Object.prototype` fails the local-realm `=== objectPrototype`
 * fast-path but matches this structural contract in every realm.
 *
 * The single internal seam shared by {@link isPlainObject} and
 * {@link isPlainOrDictionaryObject} on their cross-realm branch — kept
 * unexported; its behavior is covered through the two exported helpers
 * it composes.
 *
 * @param {unknown} value - the candidate whose Plain Object structure
 *  and contract is to be verified
 * @param {unknown} prototype - the value's already-resolved
 *  `[[Prototype]]`, threaded in by the caller that read it (decision
 *  #059)
 * @returns {boolean} `true` when the signal gate and the structural
 *  contract both hold; `false` otherwise
 * @internal
 */
function isAlienRealmPlainObject(value, prototype) {
  // PlainObject — cross-realm fallback; thread the already-read prototype (#059)
  return hasPlainObjectIdentitySignal(value) && isObjectPrototypeEquivalent(prototype);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Narrows a value to {@link PlainObject} — an AnyObject whose direct
 * constructor is the built-in `Object`.
 *
 * Composes two complementary checks: the local-realm fast-path
 * `getPrototypeOf(value) === Object.prototype` (an O(1) reference
 * comparison) and a cross-realm-safe structural anchor formed by
 * {@link hasPlainObjectIdentitySignal} (two inexpensive string-shape
 * signal markers) AND {@link isObjectPrototypeEquivalent}
 * (the six-marker prototype contract):
 *
 * - Signal markers (inexpensive, front-loaded): `[[Class]]` tag
 *   `'[object Object]'` and constructor name `'Object'`.
 * - Prototype contract (load-bearing structural anchor): the
 *   constructor reached via `getDefinedConstructor(prototype)` is a
 *   newable class shape (`isClass`), the prototype's own
 *   `[[Class]]` tag is `'[object Object]'`, the constructor's own
 *   `name` and `prototype` properties read via the throw-safe
 *   `getVerifiedOwnName` / `getInertDescriptor(...).value` (skipping
 *   accessors), the `prototype` value round-trips back to the threaded
 *   prototype, `getInertPrototypeOf(prototype) === null` confirms the
 *   chain-depth invariant that every realm's `Object.prototype`
 *   carries, and `doesImplementObjectPrototypeContract(prototype)`
 *   confirms the prototype's own member surface (every canonical
 *   `Object.prototype` method present as a non-enumerable callable).
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
 * rather than by string fingerprint. The member-surface check rejects a
 * hollow `class extends null` renamed to `'Object'` — it satisfies the
 * identity markers but carries none of `Object.prototype`'s methods.
 *
 * Short-circuit `&&` runs the `isObject` gate first (rejects null,
 * primitives, undefined, functions in O(1)). Inside the gate, the
 * fast-path reference check runs first. The structural anchor fires
 * only on miss, with signal markers gating the more expensive
 * contract walk.
 *
 * Cross-realm safe by construction. The fast-path matches local-realm
 * `Object.prototype` identity. The fallback uses realm-fixed captures
 * (`toObjectString.call` via `getTypeSignature`, the throw-safe
 * `getInertPrototypeOf`, `getVerifiedOwnName` and `getInertDescriptor`,
 * and a guarded `getOwnPropertyDescriptors` for the member surface) and
 * the four-source constructor walk (via `getDefinedConstructor` /
 * `getDefinedConstructorName`). Cross-realm Plain Objects (from
 * iframes, workers, vm contexts) pass via the fallback: the local
 * `Object.prototype` reference does not match their prototype, but
 * their structural contract matches in every realm.
 *
 * Throw-safe: the prototype read routes through `getInertPrototypeOf`,
 * so a hostile `getPrototypeOf` Proxy-trap yields `undefined` (matching
 * neither `objectPrototype` nor a valid contract) and the predicate
 * returns `false` rather than propagating the throw.
 *
 * ## Realm asymmetry on tampered inputs (deliberate)
 *
 * The two arms weigh evidence differently, so for a TAMPERED input they
 * can disagree by realm. The local-realm fast-path
 * (`prototype === objectPrototype`) is pure identity and blind to surface
 * tampering: a local plain object carrying a spoofed or throwing
 * `Symbol.toStringTag` is still admitted, because it genuinely has the
 * real `Object.prototype` and so genuinely is a plain `Object` instance —
 * identity outranks a cosmetic marker. The cross-realm arm, lacking a
 * local prototype to match, has only surface markers to go on, so the
 * same tampering makes it reject. The same tampered object can therefore
 * read `true` locally and `false` cross-realm. This is inherent to having
 * a fast identity path; it is accepted, not reconciled (forcing the
 * fast-path to read the tag would cost its O(1) nature and wrongly reject
 * a genuine local plain object). Every untampered plain object agrees
 * across realms — the divergence appears only under tampering.
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
  if (!isObject(value)) {
    return false;
  }
  // Resolve the prototype ONCE and thread it into the contract walk (decision
  // #059), instead of letting the helper re-read it.
  const prototype = getInertPrototypeOf(value);

  return (
    // - excluding cross-realm fast-path short-circuit for a
    //   possible dictionary (like) or a "tampered-with" object
    !!prototype &&
    // PlainObject — local-realm fast-path
    (prototype === objectPrototype ||
      // PlainObject — cross-realm fallback; thread the already-read prototype (#059)
      isAlienRealmPlainObject(value, prototype))
  );
}

/**
 * Narrows a value to {@link DictionaryObject} — an AnyObject with no
 * prototype-chain. Typically created via `Object.create(null)` for
 * use as a hashmap.
 *
 * Composes four markers via short-circuit `&&`: the `isObject` gate,
 * the throw-safe prototype check `getInertPrototypeOf(value) === null`,
 * then the two markers bundled by {@link hasDictionaryObjectIdentitySignal}
 * — the constructor-absence check `getDefinedConstructor(value) ===
 * undefined` and the tag-signature cross-validator
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
 * Throw-safe: the prototype read routes through `getInertPrototypeOf`,
 * so a hostile `getPrototypeOf` Proxy-trap yields `undefined` (not
 * `null`) and the predicate returns `false` rather than propagating.
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
    getInertPrototypeOf(value) === null &&
    hasDictionaryObjectIdentitySignal(value)
  );
}

/**
 * Narrows a value to {@link PlainOrDictionaryObject} — either a
 * {@link PlainObject} (prototype-bearing, constructor === Object) or a
 * {@link DictionaryObject} (prototype-less).
 *
 * Fused implementation: shares one `isObject` gate and one throw-safe
 * `getInertPrototypeOf` read across both branches, then dispatches by
 * prototype value:
 *
 * - `prototype === Object.prototype` → local-realm `PlainObject`,
 *   accept immediately (fast-path).
 * - `prototype === null` → `DictionaryObject` candidate, verify the two
 *   non-prototype cross-validators via
 *   {@link hasDictionaryObjectIdentitySignal} (`getDefinedConstructor ===
 *   undefined` and `getTypeSignature === '[object Object]'`).
 * - otherwise → cross-realm `PlainObject` fallback via
 *   {@link isObjectPrototypeEquivalent} (the six-marker prototype
 *   contract) behind the {@link hasPlainObjectIdentitySignal} gate.
 *
 * The fused form avoids the redundant gate, prototype-read, tag-computation,
 * and constructor-walk that a naive `isPlainObject(v) || isDictionaryObject(v)`
 * composition would perform — especially in the `DictionaryObject` input case,
 * where the strict predicate runs its signal + contract checks before failing.
 *
 * Throw-safe: the shared prototype read routes through `getInertPrototypeOf`,
 * so a hostile `getPrototypeOf` Proxy-trap yields `undefined` — matching
 * neither dispatch branch, so it falls to the structural fallback and returns
 * `false` rather than propagating the throw.
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
  const prototype = getInertPrototypeOf(value);

  // PlainObject — local-realm fast-path
  if (prototype === objectPrototype) {
    return true;
  }

  // DictionaryObject — prototype-less form, two cross-validators remain
  if (prototype === null) {
    return hasDictionaryObjectIdentitySignal(value);
  }

  // PlainObject — cross-realm fallback; thread the already-read prototype (#059)
  return isAlienRealmPlainObject(value, prototype);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
