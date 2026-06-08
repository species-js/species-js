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
 * - {@link PlainOrDictionaryObject} / {@link isPlainOrDictionaryObject}
 *   — the union of the two strict forms above. Captures the
 *   lodash-equivalent semantic in a single-named type and predicate
 *   without losing the distinction the two strict forms provide
 *   individually.
 *
 * `PlainObject` and `DictionaryObject` are structurally disjoint —
 * they cannot be combined into one of the strict forms, since their
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
 * permissive form when lodash semantics are wanted explicitly; reach
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
 * cross-realm-safe structural anchor — two string-shape signal
 * markers (`[[Class]] === '[object Object]'` and constructor name
 * `'Object'`) PLUS the five-marker prototype contract on the
 * constructor (newable class shape, prototype's own tag, the
 * constructor's `name` and `prototype` data-descriptor reads, and
 * the chain-depth check `getPrototypeOf(prototype) === null`).
 * See the predicate JSDoc for the full marker list.
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
 * ## Strictness vs. lodash `_.isPlainObject`
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
 * TypeScript cannot express "no prototype chain" directly — the
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
 * it when the lodash-equivalent semantic is wanted explicitly; reach
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
 * comparison) and a cross-realm-safe structural anchor formed by two
 * inexpensive string-shape signal markers AND a five-marker prototype
 * contract:
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
 * The descriptor-via-`.value` discipline on the constructor's own
 * `name` and `prototype` properties closes the lying-accessor spoof
 * surface — an accessor-form definition yields `undefined` from
 * `?.value` and fails the check. The round-trip identity marker
 * (constructor's `prototype` ≡ the prototype walked from `value`)
 * closes the tampered-`constructor`-pointer spoof. The chain-depth
 * check rules out class instances and built-in container instances
 * by structural shape rather than by string fingerprint.
 *
 * Short-circuit `&&` runs the `isObject` gate first (rejects null,
 * primitives, undefined, functions in O(1)). Inside the gate, the
 * fast-path reference check runs first; the structural anchor fires
 * only on miss, with signal markers gating the more expensive
 * contract walk.
 *
 * Cross-realm safe by construction. The fast path matches local-realm
 * `Object.prototype` identity; the fallback uses realm-fixed captures
 * (`toObjectString.call` via `getTypeSignature`, `getPrototypeOf` and
 * `getOwnPropertyDescriptor` from `@/config`) and the four-source
 * constructor walk (via `getDefinedConstructor` /
 * `getDefinedConstructorName`).
 *
 * ## Strictness vs. lodash `_.isPlainObject`
 *
 * Lodash's permissive form admits prototype-less objects too. This
 * predicate is strict — it rejects prototype-less objects, which
 * have their own dedicated predicate, {@link isDictionaryObject}. To
 * match lodash's set, use {@link isPlainOrDictionaryObject}, which
 * composes `isPlainObject(v) || isDictionaryObject(v)` under one
 * name.
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
 * Four markers compose: the `isObject` gate, the prototype check
 * `getPrototypeOf(value) === null`, the constructor-absence check
 * `getDefinedConstructor(value) === undefined`, and the tag-signature
 * cross-validator `getTypeSignature(value) === '[object Object]'`. The
 * three non-gate markers are independent cross-validators:
 *
 * - `getPrototypeOf === null` is the spec-correct test for "no
 *   prototype chain." `Object.create(null)` is the canonical way to
 *   reach this state, but any object whose prototype was later set
 *   to `null` via `Object.setPrototypeOf(obj, null)` also passes.
 * - `getDefinedConstructor === undefined` is the structural
 *   cross-validator reading through the four-source constructor walk.
 *   For a true prototype-less object, none of the four sources are
 *   reachable, so the walk returns `undefined`. This catches cases
 *   where the prototype is `null` but a `constructor` property has
 *   been explicitly attached to the value (a contrived case, but a
 *   real spoof surface the cross-validator closes).
 * - `getTypeSignature === '[object Object]'` is the tag cross-validator
 *   closing the rare surface where a prototype-less object has been
 *   hand-decorated with an own `Symbol.toStringTag` to lie about its
 *   [[Class]]. For the hashmap semantic this type targets, a tag
 *   would never be set legitimately.
 *
 * Realm-independent. The prototype-less state is realm-orthogonal
 * (no constructor identity is involved), and both the
 * `getDefinedConstructor` walk and the `getTypeSignature` capture are
 * cross-realm safe.
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
 *   accept immediately (fast path).
 * - `prototype === null` → `DictionaryObject` candidate, verify the
 *   two non-prototype cross-validators (`getDefinedConstructor ===
 *   undefined` and `getTypeSignature === '[object Object]'`).
 * - otherwise → cross-realm `PlainObject` fallback via the signal +
 *   contract pair behind {@link isPlainObject}.
 *
 * The fused form avoids the redundant gate, prototype read, tag
 * computation, and constructor walk that a naive
 * `isPlainObject(v) || isDictionaryObject(v)` composition would
 * perform — especially in the `DictionaryObject` input case, where
 * the strict predicate runs its signal + contract checks before
 * failing.
 *
 * This is the lodash-equivalent semantic — `_.isPlainObject` from
 * lodash admits both forms in one predicate. Use this when lodash
 * compatibility is wanted; use {@link isPlainObject} or
 * {@link isDictionaryObject} alone when the distinction between
 * prototype-bearing and prototype-less is meaningful to the caller
 * (lookup-table-vs-instance vs. hashmap-vs-instance is the typical
 * reason).
 *
 * Generic in `T` per the family pattern. The narrow returns
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
