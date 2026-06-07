/**
 * @module @species-js/type-detection/object
 *
 * Object-shape discrimination.
 *
 * Three types and three predicates discriminate the spec-relevant
 * categories of "is this value an object, and if so what kind?":
 *
 * - {@link AnyObject} / {@link isObject} — the structural floor: any
 *   non-null, non-function object. Plain objects, arrays, dates,
 *   class instances, boxed primitives, prototype-less objects — all
 *   are `AnyObject`. Functions are excluded by the runtime predicate
 *   (`typeof === 'function'` rather than `'object'`); primitives and
 *   `null` are excluded by the truthiness gate.
 *
 * - {@link PlainObject} / {@link isPlainObject} — a strict subtype:
 *   AnyObject whose direct constructor is the built-in `Object`. The
 *   runtime predicate verifies `getPrototypeOf === Object.prototype`
 *   (same-realm fast path) or the cross-realm-safe pair `[[Class]]`
 *   tag `'[object Object]'` and constructor name `'Object'`. Excludes
 *   class instances, built-in container types, prototype-less objects,
 *   and boxed primitives.
 *
 * - {@link DictionaryObject} / {@link isDictionaryObject} — a strict
 *   subtype: AnyObject with no prototype chain at all (typically
 *   `Object.create(null)`). The runtime predicate verifies
 *   `getPrototypeOf === null` plus the absence of a reachable
 *   constructor.
 *
 * `PlainObject` and `DictionaryObject` are structurally disjoint —
 * they cannot be combined, since their `constructor` property
 * constraints (`ObjectConstructor` vs `never`) are incompatible. The
 * type-system discriminator matches the runtime discriminator: the
 * presence and identity of the constructor property.
 *
 * ## On the `isPlainObject` vs lodash distinction
 *
 * Lodash's `_.isPlainObject` is _permissive_: it admits both
 * prototype-bearing objects (constructor === Object) AND prototype-less
 * objects (`Object.create(null)`). This module's {@link isPlainObject}
 * is _strict_: only prototype-bearing objects with constructor === Object
 * pass. The two forms in this module — `isPlainObject` and
 * `isDictionaryObject` — together cover lodash's set. Reach for
 * `isPlainObject(v) || isDictionaryObject(v)` when lodash semantics
 * are wanted explicitly; reach for one or the other when the
 * distinction matters (lookup-table-vs-instance vs hashmap-vs-instance
 * is the typical reason).
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
 * distinction. The runtime predicate is the safety contract; this
 * type is the access-pattern contract for consumers post-narrow.
 */
export type AnyObject = object & Record<PropertyKey, unknown>;

/**
 * A plain prototype-bearing object whose direct constructor is the
 * built-in `Object`. The narrow target of {@link isPlainObject}.
 *
 * Runtime characteristic (verified by the predicate):
 * `getPrototypeOf(v) === Object.prototype` in the local realm, OR the
 * cross-realm-safe pair `[[Class]] === '[object Object]' &&
 * constructorName === 'Object'`.
 *
 * Structurally enforced via `constructor: ObjectConstructor` — the
 * presence and type of the `constructor` property is the load-bearing
 * type-level discriminator from {@link DictionaryObject} (which
 * carries `constructor?: never`). Values whose constructor is a custom
 * class or built-in container (`Array`, `Map`, etc.) fail the type
 * constraint; values with no constructor fail it too.
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
 * ## Strictness vs lodash `_.isPlainObject`
 *
 * Lodash's `_.isPlainObject` is _permissive_ — it admits prototype-less
 * objects alongside prototype-bearing ones. This package's
 * `PlainObject` is strict; the prototype-less form has its own
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
 * undefined`.
 *
 * Structurally enforced via `constructor?: never` — the absence of
 * `constructor` (or its presence as a `never`-typed value, equivalent
 * structurally) is the type-level discriminator from
 * {@link PlainObject} (which requires `constructor: ObjectConstructor`).
 * The two types are disjoint at the type level via this constraint;
 * TypeScript will reject assignments between them without an explicit
 * cast.
 *
 * TypeScript cannot express "no prototype chain" directly — the
 * `[[Prototype]]` slot is reflective runtime state, not type-system
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
 * kind of runtime value (`Object.create(null)`) but differ in
 * type-system access pattern:
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
 * intent differs (sentinel vs hashmap), but they coexist in the type
 * system without conflict.
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
 * falsy primitives (`0`, `''`, `false`, `NaN`, `0n`). The
 * `typeof === 'object'` gate rejects truthy primitives (`'foo'`, `42`,
 * `true`, etc.) and functions. What remains is the set of non-null
 * non-function objects: plain objects, arrays, dates, maps, class
 * instances, prototype-less objects, and boxed primitives.
 *
 * Realm-independent — `typeof` reads identically in every realm, and
 * truthiness is spec-defined.
 *
 * Generic in `T` per the family pattern (decisions #031, #039). The
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
 * Narrows a value to {@link PlainObject} — an AnyObject whose direct
 * constructor is the built-in `Object`.
 *
 * Composes two complementary checks: the local-realm fast path
 * `getPrototypeOf(value) === Object.prototype` (an O(1) reference
 * comparison) and the cross-realm-safe structural fallback
 * `getTypeSignature(value) === '[object Object]' &&
 * getDefinedConstructorName(value) === 'Object'`. The fast path covers
 * the common case; the structural fallback catches plain objects from
 * other realms (iframes, workers, vm contexts) where the local
 * `Object.prototype` reference does not match.
 *
 * Short-circuit `&&` runs the `isObject` gate first (rejects null,
 * primitives, undefined, functions in O(1)). Inside the gate, the
 * fast-path reference check runs first; the structural fallback fires
 * only on miss.
 *
 * Cross-realm safe by construction. The fast path matches local-realm
 * `Object.prototype` identity; the fallback uses the realm-fixed
 * `toObjectString.call` capture (via `getTypeSignature`) and the
 * four-source constructor walk (via `getDefinedConstructorName`).
 *
 * ## Strictness vs lodash `_.isPlainObject`
 *
 * Lodash's permissive form admits prototype-less objects too. This
 * predicate is strict — it rejects prototype-less objects, which
 * have their own dedicated predicate, {@link isDictionaryObject}. To
 * match lodash's set, compose:
 *
 * ```ts
 * isPlainObject(v) || isDictionaryObject(v)
 * ```
 *
 * Generic in `T` per the family pattern. The narrow returns
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
 * prototype chain. Typically created via `Object.create(null)` for
 * use as a hashmap.
 *
 * Three markers compose: the `isObject` gate, the prototype check
 * `getPrototypeOf(value) === null`, and the constructor-absence check
 * `getDefinedConstructor(value) === undefined`. The two non-gate
 * markers are independent cross-validators:
 *
 * - `getPrototypeOf === null` is the spec-correct test for "no
 *   prototype chain." `Object.create(null)` is the canonical way to
 *   reach this state, but any object whose prototype was later set
 *   to `null` via `Object.setPrototypeOf(obj, null)` also passes.
 * - `getDefinedConstructor === undefined` is the cross-validator
 *   reading through the four-source constructor walk. For a true
 *   prototype-less object, none of the four sources are reachable,
 *   so the walk returns `undefined`. This catches cases where the
 *   prototype is `null` but a `constructor` property has been
 *   explicitly attached to the value (a contrived case, but a real
 *   spoof surface the cross-validator closes).
 *
 * Realm-independent. The prototype-less state is realm-orthogonal
 * (no constructor identity is involved), and the `getDefinedConstructor`
 * walk is cross-realm safe.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & DictionaryObject`; `T = unknown` collapses to `DictionaryObject`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a dictionary object
 * @returns `true` when the value is a non-null object with no
 *  prototype chain and no reachable constructor, narrowing `value` to
 *  `T & DictionaryObject`; `false` otherwise
 * @example
 * isDictionaryObject(Object.create(null));     // true
 * isDictionaryObject({});                      // false (has Object.prototype)
 * isDictionaryObject([]);                      // false
 * isDictionaryObject(null);                    // false
 * isDictionaryObject(Object.create({ a: 1 })); // false (has a non-null prototype)
 */
export function isDictionaryObject<T = unknown>(value?: T): value is T & DictionaryObject;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
