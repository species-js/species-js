/**
 * @module @species-js/type-detection/object
 *
 * Object-shape discrimination.
 *
 * Four types and four predicates discriminate the spec-relevant
 * categories of "is this value an object, and if so what kind?":
 *
 * - {@link AnyObject} / {@link isObject} — the structural floor: any
 *   non-null, non-function object. Plain objects, arrays, dates,
 *   class instances, boxed primitives, prototype-less objects — all
 *   are `AnyObject`. Functions are excluded by the runtime predicate
 *   (`typeof === 'function'` rather than `'object'`). Primitives and
 *   `null` are excluded by the truthiness gate.
 *
 * - {@link PlainObject} / {@link isPlainObject} — a strict subtype:
 *   AnyObject whose direct constructor is the built-in `Object`. The
 *   runtime predicate verifies `getPrototypeOf === Object.prototype`
 *   (same-realm fast-path) or the cross-realm-safe pair `[[Class]]`
 *   tag `'[object Object]'` and constructor name `'Object'`. Excludes
 *   class instances, built-in container types, prototype-less objects,
 *   and boxed primitives.
 *
 * - {@link DictionaryObject} / {@link isDictionaryObject} — a strict
 *   subtype: AnyObject with no prototype-chain at all (typically
 *   `Object.create(null)`). The runtime predicate verifies
 *   `getPrototypeOf === null` plus the absence of a reachable
 *   constructor.
 *
 * - {@link PlainOrDictionaryObject} / {@link isPlainOrDictionaryObject}
 *   — the union of the two strict forms above. Captures the
 *   lodash-equivalent semantic in a single-named type and predicate
 *   without losing the distinction the two strict forms provide
 *   individually.
 *
 * `PlainObject` and `DictionaryObject` are structurally disjoint.
 * They cannot be combined into one of the strict forms, since their
 * `constructor` property constraints (`ObjectConstructor` vs. `never`)
 * are incompatible. The disjointness is preserved in the union
 * {@link PlainOrDictionaryObject}: each member retains its own
 * discriminator. The type-system discriminator matches the runtime
 * discriminator: the presence and identity of the constructor
 * property.
 *
 * ## On the `isPlainObject` vs. lodash distinction
 *
 * Lodash's `_.isPlainObject` is _permissive_: it admits both
 * prototype-bearing objects (constructor === Object) AND prototype-less
 * objects (`Object.create(null)`). This module's {@link isPlainObject}
 * is _strict_: only prototype-bearing objects with constructor ===
 * Object pass. The dedicated permissive form is
 * {@link isPlainOrDictionaryObject}, which composes
 * `isPlainObject(v) || isDictionaryObject(v)`. Reach for the
 * permissive form when lodash semantics are wanted explicitly. Reach
 * for {@link isPlainObject} or {@link isDictionaryObject} alone when
 * the distinction matters (lookup-table-vs-instance vs.
 * hashmap-vs-instance is the typical reason).
 *
 * ## Cross-module: `BlankType` in `@/utility`
 *
 * `BlankType` (in `@/utility`) is `Record<PropertyKey, never>` —
 * the _sentinel_ form of a prototype-less object, with no keys
 * statically reachable. `DictionaryObject` is the _populated_ form,
 * `Record<PropertyKey, unknown>` extended with the structural
 * discriminator. The two types target the same runtime carrier
 * (prototype-less objects via `Object.create(null)`) but differ in
 * the type-system access pattern: `BlankType` for blank-descriptor
 * sentinels (used by `@/error`'s `hasErrorPrototypeContract` legacy
 * heuristic via the `objectCreate(null)` retyped return in `@/config`,
 * decisions #017, #034), `DictionaryObject` for hashmap use. Per
 * TypeScript variance, `BlankType` is a subtype of `DictionaryObject`
 * (since `never` is a subtype of `unknown`).
 */

import type { NewableFunction } from '@/function';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Types
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The floor type for non-null, non-function objects.
 *
 * Admits plain objects, instances of built-in types (`Array`, `RegExp`,
 * `Date`, `Map`, `Set`, etc.), instances of custom classes or
 * constructor functions, prototype-less objects, and boxed primitives.
 * Excludes primitives, `null`, `undefined`, and functions.
 *
 * The type is TypeScript's built-in `object` (anything non-primitive)
 * intersected with an open index signature for arbitrary property
 * access on narrowed values. The intersection means consumers can
 * write `value[key]` on a narrowed AnyObject without per-access casts.
 *
 * Note: TypeScript's `object` type itself admits functions at the
 * type-system level (functions structurally are objects in TS). The
 * runtime exclusion of functions — via {@link isObject} reading
 * `typeof === 'object'` rather than `'function'` — is the load-bearing
 * distinction. The runtime predicate is the safety contract. This
 * type is the access-pattern contract for consumers post-narrow.
 */
export type AnyObject = object & Record<PropertyKey, unknown>;

/**
 * A plain prototype-bearing object whose direct constructor is the
 * built-in `Object`. The narrow target of {@link isPlainObject}.
 *
 * Runtime characteristic (verified by the predicate):
 * `getPrototypeOf(v) === Object.prototype` in the local realm, OR the
 * cross-realm-safe structural anchor — two string-shape signal
 * markers (`[[Class]] === '[object Object]'` and constructor name
 * `'Object'`) PLUS the six-marker prototype contract on the
 * constructor (newable class shape, prototype's own tag, the
 * constructor's `name` and `prototype` data-descriptor reads, the
 * chain-depth check `getPrototypeOf(prototype) === null`, and the
 * prototype's own member surface). See the predicate JSDoc for the full
 * marker list.
 *
 * Structurally enforced via `constructor: ObjectConstructor` — the
 * presence and type of the `constructor` property is the load-bearing
 * type-level discriminator from {@link DictionaryObject} (which
 * carries `constructor?: never`). Values whose constructor is a custom
 * class or built-in container (`Array`, `Map`, etc.) fail the type
 * constraint. Values with no constructor fail it too.
 *
 * Examples of values that satisfy this:
 *
 * - `{}` (object literal)
 * - `{ a: 1 }` (any literal)
 * - `new Object()`
 * - `Object.create(Object.prototype)`
 * - Cross-realm equivalents of the above
 *
 * Examples that do _not_ satisfy this:
 *
 * - `[]` (array — constructor is `Array`)
 * - `new Date()` (constructor is `Date`)
 * - `new (class Foo {})()` (custom class instance)
 * - `Object.create(null)` (prototype-less — covered by
 *   {@link DictionaryObject})
 *
 * ## Strictness vs. lodash `_.isPlainObject`
 *
 * Lodash's `_.isPlainObject` is _permissive_ — it admits prototype-less
 * objects alongside prototype-bearing ones. This package's
 * `PlainObject` is strict. The prototype-less form has its own
 * dedicated type, {@link DictionaryObject}. See the module-level doc
 * for the rationale and the migration tip for callers familiar with
 * lodash.
 */
export interface PlainObject extends AnyObject {
  /** Spec-required: the constructor must be the built-in `Object`. */
  constructor: ObjectConstructor;
}

/**
 * A prototype-less object — typically created via `Object.create(null)`
 * for use as a pure hashmap that avoids key collisions with
 * `Object.prototype` members.
 *
 * The narrow target of {@link isDictionaryObject}.
 *
 * Runtime characteristic (verified by the predicate):
 * `getPrototypeOf(v) === null` AND `getDefinedConstructor(v) ===
 * undefined` AND `getTypeSignature(v) === '[object Object]'`. The
 * tag-signature cross-validator closes the rare case where a
 * prototype-less object has been hand-decorated with an own
 * `Symbol.toStringTag`.
 *
 * Structurally enforced via `constructor?: never` — the absence of
 * `constructor` (or its presence as a `never`-typed value, equivalent
 * structurally) is the type-level discriminator from
 * {@link PlainObject} (which requires `constructor: ObjectConstructor`).
 * The two types are disjoint at the type level via this constraint;
 * TypeScript will reject assignments between them without an explicit
 * cast.
 *
 * TypeScript cannot express "no prototype-chain" directly — the
 * `[[Prototype]]` slot is a reflective runtime state, not a type-system
 * structure. The absence-of-constructor constraint is the closest
 * structural model that the predicate's runtime check verifies.
 *
 * ## Relationship to `BlankType`
 *
 * `BlankType` (from `@/utility`) is the _sentinel_ form of the
 * same runtime carrier — `Record<PropertyKey, never>`, no keys
 * statically reachable. `DictionaryObject` is the _populated_ form
 * extending the same `Record<PropertyKey, unknown>` shape with the
 * `constructor?: never` discriminator. The two types target the same
 * kind of runtime value (`Object.create(null)`) but differ in the
 * type-system access-pattern:
 *
 * - `BlankType` — used as a blank-descriptor sentinel (e.g.,
 *   `objectCreate(null)` in `@/config`'s retyped return type, decision
 *   #034). No keys statically reachable.
 * - `DictionaryObject` — used as a typed hashmap. Arbitrary keys via
 *   the index signature.
 *
 * Per TypeScript variance, `BlankType` is a structural subtype of
 * `DictionaryObject` (since `Record<PropertyKey, never>` is a subtype
 * of `Record<PropertyKey, unknown>` — `never` is the bottom type).
 * The two are not interchangeable in API contracts because the
 * intent differs (sentinel vs. hashmap), but they coexist in the type
 * system without a conflict.
 */
export interface DictionaryObject extends AnyObject {
  /**
   * Must not be present — the absence of `constructor` is the
   * type-level reflection of the runtime "no prototype" characteristic.
   * `?: never` admits both literal absence and structural-`never`
   * presence; either form satisfies the constraint.
   */
  constructor?: never;
}

/**
 * The union of {@link PlainObject} and {@link DictionaryObject} — the
 * set of "real" object types: prototype-bearing objects whose direct
 * constructor is the built-in `Object`, plus prototype-less objects
 * (typically `Object.create(null)`). The narrow target of
 * {@link isPlainOrDictionaryObject}.
 *
 * Excludes class instances, built-in container types (`Array`, `Date`,
 * `Map`, etc.), and boxed primitives — all of which {@link AnyObject}
 * admits.
 *
 * ## Matching lodash `_.isPlainObject`
 *
 * Lodash's `_.isPlainObject` is permissive — it admits both
 * prototype-bearing objects (constructor === Object) AND prototype-less
 * objects. This type, together with its predicate
 * {@link isPlainOrDictionaryObject}, captures the same set. Reach for
 * it when the lodash-equivalent semantic is wanted explicitly. Reach
 * for {@link PlainObject} or {@link DictionaryObject} alone when the
 * distinction between prototype-bearing and prototype-less is
 * meaningful.
 */
export type PlainOrDictionaryObject = PlainObject | DictionaryObject;

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
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not an object
 * @returns `true` when the value is a non-null non-function object,
 *  narrowing `value` to `T & AnyObject`; `false` otherwise
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
export function isObject<T = unknown>(value?: T): value is T & AnyObject;

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
 * @param value - the value whose `[[Class]]` tag to read; assumed to be
 *  an object provided by the caller
 * @param name - the initial value's already resolved constructor name,
 *  threaded in by the caller
 * @returns `true` when both string-shape markers match `Object`'s
 *  signature; `false` otherwise
 * @internal
 */
export function hasPlainObjectIdentitySignal(
  value: object,
  name: string | undefined,
): boolean;

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
 * @param value - the value whose string-shape and constructor-absence
 *  signal to probe
 * @returns `true` when the tag matches and no constructor is reachable;
 *  `false` otherwise
 * @internal
 */
export function hasDictionaryObjectIdentitySignal(value?: unknown): boolean;

/**
 * The member-surface marker of the cross-realm Plain Object contract:
 * confirms that `value` carries, as its own non-enumerable callable
 * properties, every canonical `Object.prototype` member (the seven core
 * ES members plus whichever Annex-B accessor helpers the host realm
 * carries, calibrated once at module load).
 *
 * This is the one marker of {@link isObjectPrototypeEquivalent} that
 * inspects the prototype's actual members rather than its identity
 * claims. The five identity markers are all satisfiable by a hollow
 * `class extends null` whose `name` was redefined to `'Object'`; this
 * check rejects it because the canonical members are absent.
 *
 * Own, not inherited — by design: it reads own descriptors only, since
 * the contract is about what the prototype itself implements, never what
 * it inherits. Augmentation-tolerant: extra own properties do not break
 * it. Residual: a spoof that installs the full canonical member set
 * passes — accepted, as this closes the cheap spoof, not every one.
 *
 * Throw-safe: a hostile `Proxy` `ownKeys` / `getOwnPropertyDescriptor`
 * trap that throws is absorbed and yields `false` rather than
 * propagating.
 *
 * @param prototype - the prototype whose own member surface to verify
 *  (callers pass an already-resolved `[[Prototype]]`); a nullish or
 *  non-object value is absorbed by the guard and yields `false`
 * @returns `true` when every canonical member is present as a
 *  non-enumerable callable own property; `false` otherwise
 * @internal
 */
export function doesImplementObjectPrototypeContract(prototype?: unknown): boolean;

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
 * 3. The constructor's own `name` data property reads `'Object'`
 *    via the throw-safe `getVerifiedOwnName` — an accessor-form `name`
 *    definition yields `undefined` and fails the check.
 * 4. The constructor's own `prototype` data property points back to
 *    the threaded `prototype` — round-trip identity, read via the
 *    throw-safe `getInertDescriptor(...).value` (same discipline).
 * 5. `getInertPrototypeOf(prototype) === null` — chain-depth check: the
 *    prototype is a top-level (no further `[[Prototype]]`), which
 *    every realm's `Object.prototype` satisfies and which class
 *    instances and built-in container instances do not.
 * 6. `doesImplementObjectPrototypeContract(prototype)` — member-surface
 *    check: the prototype carries every canonical `Object.prototype`
 *    member as its own non-enumerable callable property. The one marker
 *    that inspects members rather than identity claims, separating a
 *    genuine cross-realm `Object.prototype` from a hollow
 *    `class extends null` renamed to `'Object'` (which satisfies
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
 * round-trip (`getInertDescriptor`), and the member-surface read (a
 * guarded `getOwnPropertyDescriptors`) each absorb a hostile
 * `getPrototypeOf` / `getOwnPropertyDescriptor` Proxy-trap, failing the
 * contract rather than propagating. `isClass` is likewise throw-safe at
 * its own descriptor read.
 *
 * @param prototype - the value's already-resolved `[[Prototype]]`,
 *  threaded in by the caller that read it first (decision #059)
 * @param constructor - the value's already-resolved `[[Constructor]]`,
 *  threaded in by the caller
 * @param name - the initial value's already resolved constructor name,
 *  threaded in by the caller
 * @returns `true` when all six markers hold; `false` otherwise
 * @internal
 */
export function isObjectPrototypeEquivalent(
  prototype: object,
  constructor: NewableFunction | undefined,
  name: string | undefined,
): boolean;

/**
 * Narrows a value to {@link PlainObject} — an AnyObject whose direct
 * constructor is the built-in `Object`.
 *
 * Composes two complementary checks: the local-realm fast-path
 * `getPrototypeOf(value) === Object.prototype` (an O(1) reference
 * comparison) and a cross-realm-safe structural anchor formed by
 * {@link hasPlainObjectIdentitySignal} (two inexpensive string-shape
 * signal markers) AND {@link isObjectPrototypeEquivalent} (the
 * six-marker prototype contract):
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
 *   chain-depth invariant that every realm's `Object.prototype` carries,
 *   and `doesImplementObjectPrototypeContract(prototype)` confirms the
 *   prototype's own member surface (every canonical `Object.prototype`
 *   method present as a non-enumerable callable).
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
 * the four-source constructor walk (via `getDefinedConstructor`, its
 * name read via `getVerifiedOwnName`). Cross-realm Plain Objects (from
 * iframes, workers, vm contexts) pass via the fallback: the local
 * `Object.prototype` reference does not match their prototype, but
 * their structural contract matches in every realm.
 *
 * Throw-safe: every prototype read routes through `getInertPrototypeOf`,
 * so a hostile `getPrototypeOf` Proxy-trap yields `false` rather than
 * propagating the throw.
 *
 * ## Realm asymmetry on tampered inputs (deliberate)
 *
 * The local-realm fast-path (`prototype === objectPrototype`) is pure
 * identity and blind to surface tampering: a local plain object carrying
 * a spoofed or throwing `Symbol.toStringTag` is still admitted, because it
 * genuinely has the real `Object.prototype` — identity outranks a cosmetic
 * marker. The cross-realm arm, lacking a local prototype to match, has
 * only surface markers, so the same tampering makes it reject. The same
 * tampered object can therefore read `true` locally and `false`
 * cross-realm — inherent to having a fast identity path, accepted and not
 * reconciled. Every untampered plain object agrees across realms; the
 * divergence appears only under tampering.
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
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a plain object
 * @returns `true` when the value is a non-null object whose direct
 *  constructor is the built-in `Object` (in any realm), narrowing
 *  `value` to `T & PlainObject`; `false` otherwise
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
export function isPlainObject<T = unknown>(value?: T): value is T & PlainObject;

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
 * Throw-safe: the prototype read routes through `getInertPrototypeOf`,
 * so a hostile `getPrototypeOf` Proxy-trap yields `undefined` (not
 * `null`) and the predicate returns `false` rather than propagating.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & DictionaryObject`; `T = unknown` collapses to `DictionaryObject`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a dictionary object
 * @returns `true` when the value is a non-null object with no
 *  prototype-chain and no reachable constructor, narrowing `value` to
 *  `T & DictionaryObject`; `false` otherwise
 * @example
 * isDictionaryObject(Object.create(null));     // true
 * isDictionaryObject({});                      // false (has Object.prototype)
 * isDictionaryObject([]);                      // false
 * isDictionaryObject(null);                    // false
 * isDictionaryObject(Object.create({ a: 1 })); // false (has a non-null prototype)
 */
export function isDictionaryObject<T = unknown>(value?: T): value is T & DictionaryObject;

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
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form
 * @returns `true` when the value is either a `PlainObject` or a
 *  `DictionaryObject`, narrowing `value` to
 *  `T & PlainOrDictionaryObject`; `false` otherwise
 * @example
 * isPlainOrDictionaryObject({});                  // true (PlainObject)
 * isPlainOrDictionaryObject(Object.create(null)); // true (DictionaryObject)
 * isPlainOrDictionaryObject(new Object());        // true
 * isPlainOrDictionaryObject([]);                  // false (constructor is Array)
 * isPlainOrDictionaryObject(new Date());          // false
 * isPlainOrDictionaryObject(new (class Foo {})()); // false (custom class)
 * isPlainOrDictionaryObject(null);                // false
 */
export function isPlainOrDictionaryObject<T = unknown>(
  value?: T,
): value is T & PlainOrDictionaryObject;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
