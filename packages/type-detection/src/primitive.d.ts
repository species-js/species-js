/**
 * @module @species-js/type-detection/primitive
 *
 * Primitive-value and boxed-primitive detection.
 *
 * Each of JavaScript's five primitive families — `string`, `number`,
 * `boolean`, `symbol`, `bigint` — ships three types and three
 * predicates in this module:
 *
 * - `XValue` / `isXValue` — the primitive form, narrowed via `typeof`.
 *   Realm-independent (`typeof` reads the same in every realm) and the
 *   cheapest predicates in the package.
 * - `BoxedX` / `isBoxedX` — the boxed wrapper-object form. All boxed
 *   predicates share two fixtures: the `isObject` gate from `@/object`
 *   (truthiness + `typeof === 'object'`) at the top as O(1)
 *   primitive-and-null rejection, and the spec-precise `[[XData]]`
 *   internal-slot probe via the captured `X.prototype.valueOf` at the
 *   bottom as the engine-attested sealing marker. Between those
 *   fixtures the families split by whether their intrinsic is a true
 *   constructor — see "Constructor-aware vs. structural-only families"
 *   below. Cross-realm safe by construction.
 * - `XType` / `isX` — the composite type and predicate admitting either
 *   the primitive form or the boxed form. Composes
 *   `isXValue || isBoxedX` with the less-expensive primitive check first.
 *
 * Boxed primitives are the runtime values `new String('x')`,
 * `new Number(42)`, `new Boolean(true)`, `Object(Symbol('y'))`, and
 * `Object(1n)` produce. They carry the same conceptual semantics as
 * their primitive counterparts in most JavaScript contexts — implicit
 * coercion handles property access, concatenation, arithmetic, and
 * iteration uniformly — but they differ in identity: `===` distinguishes
 * primitive from boxed, and `typeof` returns `'object'` for boxed forms.
 * The composite predicates admit both transparently; the value-only and
 * boxed-only predicates discriminate them.
 *
 * ## Constructor-aware vs. structural-only families
 *
 * The boxed predicates split into two shapes between the `isObject`
 * gate and the slot-probe seal:
 *
 * - **`isBoxedString` / `isBoxedNumber` / `isBoxedBoolean`** — two-branch
 *   identity check. The local-realm fast path pairs `value instanceof X`
 *   with `getPrototypeOf(value) === X.prototype`. The pair admits only
 *   direct `X` instances — subclasses pass `instanceof` but fail the
 *   prototype-identity check, preserving subclass rejection. The
 *   cross-realm structural fallback pairs the `[[Class]]` tag with the
 *   resolved constructor name; subclasses are again rejected because
 *   their walked constructor name is the subclass's.
 * - **`isBoxedSymbol` / `isBoxedBigInt`** — four-marker structural chain
 *   only (`isObject` + tag + constructor name + slot probe). The
 *   local-realm `instanceof` branch is deliberately omitted because
 *   `Symbol` and `BigInt` are factory functions, not constructors —
 *   `new Symbol()` and `new BigInt()` both throw. Although
 *   `Object(Symbol('x')) instanceof Symbol` evaluates to `true` under
 *   the default `OrdinaryHasInstance` algorithm, that result is
 *   incidental to prototype-chain walking rather than a meaningful
 *   identity test. The structural chain is the honest discriminator.
 *
 * The boxed predicates extend the conservative-narrowing posture
 * established by `isPromise` / `isEventTarget` / `isAbortSignal`
 * (decisions #010, #023, #028) with engine-attested internal-slot
 * evidence (decision #042); the two-branch identity check on String /
 * Number / Boolean and the factory-function carve-out for Symbol /
 * BigInt are decision #049. The slot probe is the bottom marker —
 * engine-attested and spoof-proof — closing the
 * `Symbol.toStringTag`-spoofing surface the structural markers leave
 * open.
 *
 * ## Generic primitive predicates — floor of the lattice
 *
 * In addition to the per-family surface, this module exposes three
 * union predicates at the floor of the primitive lattice:
 *
 * - **`isWrappablePrimitive`** — admits any of the five wrappable
 *   primitive families ({@link WrappablePrimitive}). Shaped as a
 *   `typeof`-result EXCLUSION (rejects `'undefined'`, `'function'`,
 *   `'object'`) rather than an enumeration. The exclusion form is
 *   future-proof: every primitive added since ES1 (Symbol in ES6,
 *   BigInt in ES2020) has arrived with a new `typeof` result distinct
 *   from the three rejection cases, and the rejection set is
 *   spec-locked. An enumeration shape would silently fail to admit any
 *   future primitive; the exclusion shape admits it without code
 *   changes.
 * - **`isNullishPrimitive`** — admits `null` and `undefined`
 *   ({@link NullishPrimitive}), the two non-wrappable primitive
 *   singletons. Uses the parameter-default-to-`null` idiom (decision
 *   #025) to collapse both nullish forms to `null` for a single
 *   strict-equality test.
 * - **`isPrimitive`** — admits the full primitive union
 *   ({@link Primitive}) — the seven ECMA-262 primitive types — via
 *   `isNullishPrimitive || isWrappablePrimitive`.
 *
 * ## Generic-typed predicate pattern
 *
 * All predicates follow the family pattern set by `isCallable` and
 * `isFunction` in `@/function` (decision #031). The narrow returns
 * `T & X` rather than bare `X`, preserving any caller-side narrowing
 * through the predicate. For `T = unknown` (the default), the
 * intersection collapses to `X`, matching pre-generic behavior. Applied
 * uniformly across value-only, boxed-only, composite, and generic
 * predicates so the form is consistent across the module — decision
 * #036's value-only exclusion is revisited and superseded by the
 * consistency rationale; see decision #038 for the framing.
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generic Primitive Type Handling
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The wrappable-primitive union — the five primitive families that
 * carry constructor/wrapper-object duality (`String`, `Number`,
 * `Boolean`, `Symbol`, `BigInt` each have an intrinsic that boxes the
 * primitive to a wrapper-object form). Equals
 * `string | number | boolean | symbol | bigint` — the primitive forms
 * only; the boxed wrapper-object forms are NOT included.
 *
 * Excludes the two nullish primitives (`null`, `undefined`) — they
 * carry no constructor and no `[[XData]]` internal slot, and live in
 * the {@link NullishPrimitive} union instead. Excludes boxed forms
 * (`BoxedString`, `BoxedNumber`, …) — those have `typeof === 'object'`
 * and the wrappable-primitive lattice is defined at the unboxed level.
 */
export type WrappablePrimitive =
  | StringValue
  | NumberValue
  | BooleanValue
  | SymbolValue
  | BigIntValue;

/**
 * The nullish-primitive union — `null` and `undefined`. Equals
 * `null | undefined` and matches the canonical ECMAScript "nullish"
 * vocabulary used by `??` and `?.`.
 *
 * These two values are primitives per ECMA-262 §4.4.4 but lack the
 * constructor/wrapper-object duality the wrappable families share:
 * neither has an intrinsic constructor, an internal slot, nor a
 * dedicated `typeof` result (Null's `typeof` is `'object'` — the
 * historical bug). They form their own sub-category of primitive.
 */
export type NullishPrimitive = null | undefined;

/**
 * The full primitive union — all seven ECMA-262 primitive types. Equals
 * {@link WrappablePrimitive} `|` {@link NullishPrimitive}, covering
 * every value `typeof` can resolve to outside the Object family.
 */
export type Primitive = WrappablePrimitive | NullishPrimitive;

/**
 * Narrows a value to the wrappable-primitive union
 * {@link WrappablePrimitive} — `string`, `number`, `boolean`, `symbol`,
 * or `bigint`.
 *
 * Shaped as a `typeof`-result EXCLUSION rather than an enumeration:
 * admits any value whose `typeof` is not `'undefined'`, `'function'`,
 * or `'object'`. The three rejected signatures cover the entire
 * non-wrappable surface (undefined, callable Object, regular Object
 * including `null`), leaving the five wrappable families as the
 * admitted set.
 *
 * The exclusion shape is deliberate and load-bearing — it makes the
 * predicate future-proof against new primitive types added by future
 * ECMA versions. Every primitive added since ES1 has arrived with a
 * new `typeof` result distinct from the three rejection cases, and the
 * rejection set is spec-locked (modern ECMA does not permit
 * implementation-defined `typeof` strings). An enumeration-based shape
 * would silently fail to admit any new primitive; the exclusion form
 * admits it without code changes. The only legacy quirk that produces
 * a non-canonical `typeof` result is `document.all` returning
 * `'undefined'`, which the exclusion correctly rejects.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & WrappablePrimitive`; `T = unknown` collapses to `WrappablePrimitive`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a wrappable primitive
 * @returns `true` when `typeof value` is not one of the three
 *  non-wrappable signatures, narrowing `value` to
 *  `T & WrappablePrimitive`; `false` otherwise
 * @example
 * isWrappablePrimitive('x');             // true
 * isWrappablePrimitive(42);              // true
 * isWrappablePrimitive(true);            // true
 * isWrappablePrimitive(Symbol('y'));     // true
 * isWrappablePrimitive(1n);              // true
 * isWrappablePrimitive(null);            // false (typeof 'object')
 * isWrappablePrimitive(undefined);       // false
 * isWrappablePrimitive({});              // false
 * isWrappablePrimitive(() => {});        // false
 * isWrappablePrimitive(new String('x')); // false (boxed)
 */
export function isWrappablePrimitive<T = unknown>(
  value?: T,
): value is T & WrappablePrimitive;

/**
 * Narrows a value to the nullish-primitive union
 * {@link NullishPrimitive} — `null` or `undefined`.
 *
 * Uses the parameter-default-to-`null` idiom (decision #025) to
 * collapse both nullish forms to `null` for a single strict-equality
 * test. `isNullishPrimitive()` and `isNullishPrimitive(undefined)`
 * trigger the default and reach `value === null` as `true`;
 * `isNullishPrimitive(null)` reaches the same comparison directly;
 * every non-nullish value suppresses the default and fails the
 * comparison.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & NullishPrimitive`; `T = unknown` collapses to `NullishPrimitive`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is a nullish primitive
 * @returns `true` when `value` is `null` or `undefined`, narrowing
 *  `value` to `T & NullishPrimitive`; `false` otherwise
 * @example
 * isNullishPrimitive(null);      // true
 * isNullishPrimitive(undefined); // true
 * isNullishPrimitive();          // true (default fires)
 * isNullishPrimitive(0);         // false
 * isNullishPrimitive('');        // false
 * isNullishPrimitive(false);     // false
 */
export function isNullishPrimitive<T = unknown>(value?: T): value is T & NullishPrimitive;

/**
 * Narrows a value to the full primitive union {@link Primitive} — any
 * of the seven ECMA-262 primitive types.
 *
 * Composes `isNullishPrimitive || isWrappablePrimitive`. Short-circuit
 * `||` runs `isNullishPrimitive` first; for non-nullish inputs (the
 * common case) the cost is the leading function call plus
 * `isWrappablePrimitive`'s single `typeof` read and `Set.has` lookup.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & Primitive`; `T = unknown` collapses to `Primitive`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is a primitive
 * @returns `true` when the value is any of the seven primitive types,
 *  narrowing `value` to `T & Primitive`; `false` otherwise
 * @example
 * isPrimitive('x');             // true
 * isPrimitive(42);              // true
 * isPrimitive(Symbol('y'));     // true
 * isPrimitive(null);            // true
 * isPrimitive(undefined);       // true
 * isPrimitive({});              // false
 * isPrimitive(() => {});        // false
 * isPrimitive(new String('x')); // false (boxed)
 */
export function isPrimitive<T = unknown>(value?: T): value is T & Primitive;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  String Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `string` value type — an alias for the built-in
 * primitive, exported so the boxed and composite types can sit
 * alongside it under a uniform naming convention.
 */
export type StringValue = string;

/**
 * The boxed `String` wrapper-object type — instances created via
 * `new String('x')` or `Object('x')`. The `& object` intersection
 * excludes primitive strings: a value typed as `BoxedString` is
 * structurally an object that exposes the `String.prototype` method
 * set, not a primitive `string`.
 *
 * Boxed strings interoperate with primitive strings via implicit
 * coercion in most JavaScript contexts (concatenation, property
 * access, template-literal interpolation, etc.) but differ on identity
 * (`===`) and on `typeof` (`'object'` vs. `'string'`). The two forms
 * can be admitted together via {@link StringType} / {@link isString}.
 */
export type BoxedString = String & object;

/**
 * Either the primitive `string` form or the boxed `String`
 * wrapper-object form. The narrow target of {@link isString}.
 */
export type StringType = StringValue | BoxedString;

/**
 * Narrows a value to the primitive `string` form via
 * `typeof value === 'string'`.
 *
 * Matches the primitive form only. Boxed `String` objects — such as
 * `new String('x')` — report `typeof === 'object'` and are deliberately
 * excluded. Admitting both forms requires {@link isString}; discriminating
 * the boxed form requires {@link isBoxedString}.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & StringValue`; `T = unknown` collapses to `StringValue`. Useful
 * for callers with literal-union types — e.g., a value typed as
 * `'on' | 'off' | number` narrows to `'on' | 'off'` after the check.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a string
 * @returns `true` when `typeof value === 'string'`, narrowing `value`
 *  to `T & StringValue`; `false` otherwise
 * @example
 * isStringValue('x');             // true
 * isStringValue('');              // true (empty string is still a string)
 * isStringValue(new String('x')); // false (boxed; typeof === 'object')
 * isStringValue(42);              // false
 */
export function isStringValue<T = unknown>(value?: T): value is T & StringValue;

/**
 * Narrows a value to the boxed `String` wrapper-object form via the
 * `isObject` gate from `@/object`, a two-branch identity check, and
 * the spec-precise `[[StringData]]` internal-slot probe via the
 * captured `String.prototype.valueOf`.
 *
 * The two-branch identity check runs in cost order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast path: `value instanceof String` paired with
 *   `getPrototypeOf(value) === String.prototype`. The pair admits only
 *   direct `String` instances; subclasses pass `instanceof` but fail
 *   the prototype-identity check, preserving subclass rejection. Both
 *   captures (`String` and `String.prototype`) are realm-fixed at
 *   module-load, so the branch is robust to post-load tampering of
 *   the global `String` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object String]'` paired with the resolved constructor name
 *   `'String'`. Both work realm-independently — the tag read through
 *   the realm-fixed `toObjectString.call` capture, the constructor walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor name is the subclass's.
 *
 * The slot probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[StringData]]` evidence. A value
 * passes only if the captured `String.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive equals
 * `String(value)`. Closes the `Symbol.toStringTag`-spoofing surface
 * the structural markers leave open even when paired with the
 * constructor walk, and rejects post-`Object.setPrototypeOf` spoofs
 * that would otherwise pass the local-realm pair.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedString`; `T = unknown` collapses to `BoxedString`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed string
 * @returns `true` when the identity check and the `[[StringData]]`
 *  slot-probe both hold, narrowing `value` to `T & BoxedString`;
 *  `false` otherwise
 * @example
 * isBoxedString(new String('x'));                       // true (instanceof + slot)
 * isBoxedString(Object('x'));                           // true (Object() boxes the primitive)
 * isBoxedString('x');                                   // false (primitive form)
 * isBoxedString({ [Symbol.toStringTag]: 'String' });    // false (no [[StringData]])
 * isBoxedString(null);                                  // false
 */
export function isBoxedString<T = unknown>(value?: T): value is T & BoxedString;

/**
 * Narrows a value to either the primitive `string` form or the boxed
 * `String` wrapper-object form — the union {@link StringType}.
 *
 * Composes `isStringValue || isBoxedString` with short-circuit `||`
 * running the cheaper primitive check first; the heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isString} when admitting both forms is intentional —
 * most string-handling code accepts boxed and primitive uniformly via
 * implicit coercion. Reach for {@link isStringValue} or
 * {@link isBoxedString} when the distinction matters (e.g., strict
 * equality with a primitive form, or wrapper-method invocation that
 * requires the boxed receiver).
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & StringType`; `T = unknown` collapses to `StringType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of string
 * @returns `true` when the value is either a primitive `string` or a
 *  boxed `String`, narrowing `value` to `T & StringType`; `false`
 *  otherwise
 * @example
 * isString('x');                  // true
 * isString(new String('x'));      // true
 * isString(42);                   // false
 * isString(null);                 // false
 */
export function isString<T = unknown>(value?: T): value is T & StringType;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Number Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `number` value type — an alias for the built-in
 * primitive. Includes `NaN` and `±Infinity`; finiteness and integrality
 * are separate concerns the caller layers on (e.g., via
 * `isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue` in
 * `@/config`).
 */
export type NumberValue = number;

/**
 * The boxed `Number` wrapper-object type — instances created via
 * `new Number(42)` or `Object(42)`. The `& object` intersection
 * excludes primitive numbers. Boxed numbers participate in arithmetic
 * via implicit coercion, but they differ from primitives on identity
 * (`===`) and on `typeof` (`'object'` vs. `'number'`).
 */
export type BoxedNumber = Number & object;

/**
 * Either the primitive `number` form or the boxed `Number`
 * wrapper-object form. The narrow target of {@link isNumber}.
 */
export type NumberType = NumberValue | BoxedNumber;

/**
 * Narrows a value to the primitive `number` form via
 * `typeof value === 'number'`.
 *
 * Matches every numeric primitive — `NaN`, `±Infinity`, and finite
 * numbers alike. Finiteness, integrality, and safe-integer-range
 * checks are caller's concerns; reach for `isFiniteNumberValue`,
 * `isIntegerValue`, or `isSafeIntegerValue` in `@/config` for those
 * (decision #026). Boxed `Number` objects report `typeof === 'object'`
 * and are deliberately excluded; reach for {@link isBoxedNumber} or
 * {@link isNumber} to admit them.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & NumberValue`; `T = unknown` collapses to `NumberValue`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a number
 * @returns `true` when `typeof value === 'number'`, narrowing `value`
 *  to `T & NumberValue`; `false` otherwise
 * @example
 * isNumberValue(42);             // true
 * isNumberValue(NaN);            // true (NaN is a number primitive)
 * isNumberValue(Infinity);       // true
 * isNumberValue('42');           // false
 * isNumberValue(new Number(42)); // false (boxed)
 */
export function isNumberValue<T = unknown>(value?: T): value is T & NumberValue;

/**
 * Narrows a value to the boxed `Number` wrapper-object form via the
 * `isObject` gate from `@/object`, a two-branch identity check, and
 * the spec-precise `[[NumberData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedNumberValueEquality}.
 *
 * Identity-check branches and slot-probe role match
 * {@link isBoxedString} — see that predicate's doc for the structural
 * rationale. The markers that distinguish this predicate from its
 * siblings are the `Number` / `Number.prototype` captures on the
 * local-realm branch, the tag/constructor-name pair (both `'Number'`)
 * on the cross-realm branch, and the `[[NumberData]]` slot probe,
 * which uses `Object.is` rather than `===` so that `new Number(NaN)`
 * is correctly admitted.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedNumber`; `T = unknown` collapses to `BoxedNumber`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed number
 * @returns `true` when the identity check and the `[[NumberData]]`
 *  slot-probe both hold, narrowing `value` to `T & BoxedNumber`;
 *  `false` otherwise
 * @example
 * isBoxedNumber(new Number(42));   // true (instanceof + slot)
 * isBoxedNumber(Object(42));       // true (Object() boxes the primitive)
 * isBoxedNumber(42);               // false (primitive)
 * isBoxedNumber(null);             // false
 */
export function isBoxedNumber<T = unknown>(value?: T): value is T & BoxedNumber;

/**
 * Narrows a value to either the primitive `number` form or the boxed
 * `Number` wrapper-object form — the union {@link NumberType}.
 *
 * Composes `isNumberValue || isBoxedNumber` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & NumberType`; `T = unknown` collapses to `NumberType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of number
 * @returns `true` when the value is either a primitive `number` or a
 *  boxed `Number`, narrowing `value` to `T & NumberType`; `false`
 *  otherwise
 * @example
 * isNumber(42);             // true
 * isNumber(NaN);            // true
 * isNumber(new Number(42)); // true
 * isNumber('42');           // false
 * isNumber(null);           // false
 */
export function isNumber<T = unknown>(value?: T): value is T & NumberType;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Boolean Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `boolean` value type — an alias for the built-in
 * primitive. Either `true` or `false`.
 */
export type BooleanValue = boolean;

/**
 * The boxed `Boolean` wrapper-object type — instances created via
 * `new Boolean(true)` or `Object(false)`. The `& object` intersection
 * excludes primitive booleans. Boxed booleans coerce to their primitive
 * value in truthiness contexts, but they differ on identity (`===`)
 * and on `typeof` (`'object'` vs. `'boolean'`). A subtle gotcha: every
 * boxed `Boolean` — including `new Boolean(false)` — is _truthy_ as an
 * object, regardless of its underlying boolean value, since truthiness
 * tests on objects do not unwrap.
 */
export type BoxedBoolean = Boolean & object;

/**
 * Either the primitive `boolean` form or the boxed `Boolean`
 * wrapper-object form. The narrow target of {@link isBoolean}.
 */
export type BooleanType = BooleanValue | BoxedBoolean;

/**
 * Narrows a value to the primitive `boolean` form via
 * `typeof value === 'boolean'`.
 *
 * Matches the primitive form only — both `true` and `false`. Boxed
 * `Boolean` objects — such as `new Boolean(true)` — report
 * `typeof === 'object'` and are deliberately excluded. Truthy/falsy
 * coercion (`!!value`) is a different operation; this predicate
 * discriminates the primitive type, not the truthiness.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BooleanValue`; `T = unknown` collapses to `BooleanValue`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boolean
 * @returns `true` when `typeof value === 'boolean'`, narrowing `value`
 *  to `T & BooleanValue`; `false` otherwise
 * @example
 * isBooleanValue(true);              // true
 * isBooleanValue(false);             // true
 * isBooleanValue(0);                 // false (truthy/falsy is different)
 * isBooleanValue(new Boolean(true)); // false (boxed)
 */
export function isBooleanValue<T = unknown>(value?: T): value is T & BooleanValue;

/**
 * Narrows a value to the boxed `Boolean` wrapper-object form via the
 * `isObject` gate from `@/object`, a two-branch identity check, and
 * the spec-precise `[[BooleanData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBooleanValueEquality}.
 *
 * Identity-check branches and slot-probe role match
 * {@link isBoxedString} — see that predicate's doc for the structural
 * rationale. The `[[BooleanData]]` probe compares string-coerced forms
 * rather than the raw values, sidestepping the `ToBoolean(Object) === true`
 * trap that `Boolean(new Boolean(false))` would otherwise produce.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedBoolean`; `T = unknown` collapses to `BoxedBoolean`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed boolean
 * @returns `true` when the identity check and the `[[BooleanData]]`
 *  slot-probe both hold, narrowing `value` to `T & BoxedBoolean`;
 *  `false` otherwise
 * @example
 * isBoxedBoolean(new Boolean(true));  // true (instanceof + slot)
 * isBoxedBoolean(new Boolean(false)); // true (still a boxed Boolean)
 * isBoxedBoolean(Object(true));       // true (Object() boxes the primitive)
 * isBoxedBoolean(true);               // false (primitive)
 * isBoxedBoolean(null);               // false
 */
export function isBoxedBoolean<T = unknown>(value?: T): value is T & BoxedBoolean;

/**
 * Narrows a value to either the primitive `boolean` form or the boxed
 * `Boolean` wrapper-object form — the union {@link BooleanType}.
 *
 * Composes `isBooleanValue || isBoxedBoolean` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BooleanType`; `T = unknown` collapses to `BooleanType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of boolean
 * @returns `true` when the value is either a primitive `boolean` or a
 *  boxed `Boolean`, narrowing `value` to `T & BooleanType`; `false`
 *  otherwise
 * @example
 * isBoolean(true);              // true
 * isBoolean(false);             // true
 * isBoolean(new Boolean(true)); // true
 * isBoolean(0);                 // false
 * isBoolean(null);              // false
 */
export function isBoolean<T = unknown>(value?: T): value is T & BooleanType;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Symbol Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `symbol` value type — an alias for the built-in
 * primitive. Covers unique symbols (`Symbol('x')`), registered symbols
 * (`Symbol.for('x')`), and well-known symbols (`Symbol.iterator`,
 * `Symbol.asyncIterator`, etc.).
 */
export type SymbolValue = symbol;

/**
 * The boxed `Symbol` wrapper-object type — instances created via
 * `Object(Symbol('key'))`. The `& object` intersection excludes
 * primitive symbols. Note that `new Symbol(...)` throws a `TypeError`
 * at runtime per ECMA-262 §20.4.1; the boxed form is reachable only
 * through `Object()` coercion.
 *
 * Boxed symbols carry an interesting property-key behavior: although
 * a primitive symbol and its boxed wrapper are not strictly equal
 * (`===`), their loose equality (`==`) holds, and JavaScript's property
 * key resolution unwraps boxed symbols transparently — so both forms
 * act as interchangeable property keys at the language level. This
 * makes boxed symbols rare in idiomatic code but valid and structurally
 * distinct from the primitive form.
 */
export type BoxedSymbol = Symbol & object;

/**
 * Either the primitive `symbol` form or the boxed `Symbol`
 * wrapper-object form. The narrow target of {@link isSymbol}.
 */
export type SymbolType = SymbolValue | BoxedSymbol;

/**
 * Narrows a value to the primitive `symbol` form via
 * `typeof value === 'symbol'`.
 *
 * Covers unique symbols, registered symbols from `Symbol.for`, and
 * well-known symbols such as `Symbol.iterator`. Boxed `Symbol` objects
 * — produced via `Object(Symbol('x'))` — report `typeof === 'object'`
 * and are deliberately excluded; reach for {@link isBoxedSymbol} or
 * {@link isSymbol} to admit them.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & SymbolValue`; `T = unknown` collapses to `SymbolValue`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a symbol
 * @returns `true` when `typeof value === 'symbol'`, narrowing `value`
 *  to `T & SymbolValue`; `false` otherwise
 * @example
 * isSymbolValue(Symbol('x'));         // true
 * isSymbolValue(Symbol.for('x'));     // true (registered symbol)
 * isSymbolValue(Symbol.iterator);     // true (well-known symbol)
 * isSymbolValue('x');                 // false
 * isSymbolValue(Object(Symbol('x'))); // false (boxed)
 */
export function isSymbolValue<T = unknown>(value?: T): value is T & SymbolValue;

/**
 * Narrows a value to the boxed `Symbol` wrapper-object form via four
 * cross-validating markers: the `isObject` gate from `@/object`, the
 * `[[Class]]` tag `'[object Symbol]'`, the constructor name `'Symbol'`,
 * and the spec-precise `[[SymbolData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedSymbolValueEquality}.
 *
 * Short-circuit `&&` runs the markers in cost order: the `isObject`
 * gate first, the tag-read second, the constructor-walk third, the
 * valueOf-slot probe last as the spec-precise spoof closure.
 *
 * Unlike {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity branch.
 * `Symbol` is a factory function, not a constructor — `new Symbol()`
 * throws, and `Object(Symbol('x')) instanceof Symbol` evaluates to
 * `true` only by virtue of the default `OrdinaryHasInstance` algorithm
 * walking the prototype chain, not because the spec treats the wrapper
 * as a `Symbol` instance in any identity-bearing sense. The structural
 * chain runs uniformly across local-realm and cross-realm boxed
 * Symbols and is the honest discriminator here.
 *
 * The `[[SymbolData]]` probe cross-checks the unboxed primitive's
 * `description` against the boxed value's `description` — catching
 * the own-property-shadowing tampering surface where a real boxed
 * Symbol has had its `description` getter overridden by an own data
 * property.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedSymbol`; `T = unknown` collapses to `BoxedSymbol`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed symbol
 * @returns `true` when all four markers hold, narrowing `value` to
 *  `T & BoxedSymbol`; `false` otherwise
 * @example
 * isBoxedSymbol(Object(Symbol('x'))); // true
 * isBoxedSymbol(Symbol('x'));         // false (primitive)
 * isBoxedSymbol(null);                // false
 */
export function isBoxedSymbol<T = unknown>(value?: T): value is T & BoxedSymbol;

/**
 * Narrows a value to either the primitive `symbol` form or the boxed
 * `Symbol` wrapper-object form — the union {@link SymbolType}.
 *
 * Composes `isSymbolValue || isBoxedSymbol` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & SymbolType`; `T = unknown` collapses to `SymbolType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of symbol
 * @returns `true` when the value is either a primitive `symbol` or a
 *  boxed `Symbol`, narrowing `value` to `T & SymbolType`; `false`
 *  otherwise
 * @example
 * isSymbol(Symbol('x'));         // true
 * isSymbol(Object(Symbol('x'))); // true
 * isSymbol('x');                 // false
 * isSymbol(null);                // false
 */
export function isSymbol<T = unknown>(value?: T): value is T & SymbolType;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  BigInt Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `bigint` value type — an alias for the built-in
 * primitive. Covers literal form (`1n`) and `BigInt(value)` calls
 * alike.
 */
export type BigIntValue = bigint;

/**
 * The boxed `BigInt` wrapper-object type — instances created via
 * `Object(1n)` or `Object(BigInt(1_000_000_000))`. The `& object`
 * intersection excludes primitive bigints. Note that `new BigInt(...)`
 * throws a `TypeError` at runtime per ECMA-262 §21.2.1; the boxed form
 * is reachable only through `Object()` coercion.
 *
 * Boxed bigints participate in arithmetic operations via implicit
 * coercion, just like primitive bigints; both forms can be used
 * interchangeably in mathematical contexts. They differ from primitives
 * on identity (`===`) and on `typeof` (`'object'` vs. `'bigint'`).
 */
export type BoxedBigInt = BigInt & object;

/**
 * Either the primitive `bigint` form or the boxed `BigInt`
 * wrapper-object form. The narrow target of {@link isBigInt}.
 */
export type BigIntType = BigIntValue | BoxedBigInt;

/**
 * Narrows a value to the primitive `bigint` form via
 * `typeof value === 'bigint'`.
 *
 * Matches the primitive form only — literals (`1n`), `BigInt()` calls,
 * and any arithmetic result that stays in the bigint domain. Boxed
 * `BigInt` objects — produced via `Object(1n)` — report
 * `typeof === 'object'` and are deliberately excluded; reach for
 * {@link isBoxedBigInt} or {@link isBigInt} to admit them.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BigIntValue`; `T = unknown` collapses to `BigIntValue`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a bigint
 * @returns `true` when `typeof value === 'bigint'`, narrowing `value`
 *  to `T & BigIntValue`; `false` otherwise
 * @example
 * isBigIntValue(1n);            // true
 * isBigIntValue(BigInt(1));     // true
 * isBigIntValue(1);             // false (regular number)
 * isBigIntValue(Object(1n));    // false (boxed)
 */
export function isBigIntValue<T = unknown>(value?: T): value is T & BigIntValue;

/**
 * Narrows a value to the boxed `BigInt` wrapper-object form via four
 * cross-validating markers: the `isObject` gate from `@/object`, the
 * `[[Class]]` tag `'[object BigInt]'`, the constructor name `'BigInt'`,
 * and the spec-precise `[[BigIntData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBigIntValueEquality}.
 *
 * Short-circuit `&&` runs the markers in cost order: the `isObject`
 * gate first, then tag-check, then constructor-walk, then the
 * valueOf-slot probe.
 *
 * Like {@link isBoxedSymbol}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity branch that
 * {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean} use. `BigInt` is a factory function, not
 * a constructor — `new BigInt(1n)` throws, and `instanceof BigInt`
 * is incidental to `OrdinaryHasInstance` rather than a meaningful
 * identity test. The structural chain is the honest discriminator.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedBigInt`; `T = unknown` collapses to `BoxedBigInt`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed bigint
 * @returns `true` when all four markers hold, narrowing `value` to
 *  `T & BoxedBigInt`; `false` otherwise
 * @example
 * isBoxedBigInt(Object(1n));         // true
 * isBoxedBigInt(Object(BigInt(42))); // true
 * isBoxedBigInt(1n);                 // false (primitive)
 * isBoxedBigInt(null);               // false
 */
export function isBoxedBigInt<T = unknown>(value?: T): value is T & BoxedBigInt;

/**
 * Narrows a value to either the primitive `bigint` form or the boxed
 * `BigInt` wrapper-object form — the union {@link BigIntType}.
 *
 * Composes `isBigIntValue || isBoxedBigInt` with short-circuit `||`
 * running the cheaper primitive check first.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BigIntType`; `T = unknown` collapses to `BigIntType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of bigint
 * @returns `true` when the value is either a primitive `bigint` or a
 *  boxed `BigInt`, narrowing `value` to `T & BigIntType`; `false`
 *  otherwise
 * @example
 * isBigInt(1n);          // true
 * isBigInt(Object(1n));  // true
 * isBigInt(1);           // false
 * isBigInt(null);        // false
 */
export function isBigInt<T = unknown>(value?: T): value is T & BigIntType;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Unboxed-Value Equality Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Verifies that the boxed `String` value's `[[StringData]]` internal slot
 * is present and that its unboxed primitive value matches the value
 * coerced through `String(value)` — the load-bearing fourth marker of
 * {@link isBoxedString}'s discrimination chain. The captured
 * `String.prototype.valueOf.call(value)` throws on any value lacking the
 * `[[StringData]]` slot; the `try/catch` reduces that throw to `false`.
 *
 * @param value - the value to test
 * @returns `true` when the unboxed primitive equals `String(value)`;
 *  `false` otherwise (including when `valueOf` throws)
 * @internal
 */
export function doesHaveStrictUnboxedStringValueEquality(value: unknown): boolean;

/**
 * Verifies that the boxed `Number` value's `[[NumberData]]` internal slot
 * is present and that its unboxed primitive value matches the value
 * coerced through `Number(value)`, compared via `Object.is` — the
 * load-bearing fourth marker of {@link isBoxedNumber}'s discrimination
 * chain. `Object.is` is used in preference to `===` so that
 * `new Number(NaN)` is correctly admitted (`Object.is(NaN, NaN) === true`,
 * whereas `NaN === NaN` is `false`).
 *
 * @param value - the value to test
 * @returns `true` when `Object.is(unboxed, Number(value))` holds; `false`
 *  otherwise (including when `valueOf` throws)
 * @internal
 */
export function doesHaveStrictUnboxedNumberValueEquality(value: unknown): boolean;

/**
 * Verifies that the boxed `Boolean` value's `[[BooleanData]]` internal
 * slot is present and that its unboxed primitive value's string form
 * matches the boxed value's string coercion — the load-bearing fourth
 * marker of {@link isBoxedBoolean}'s discrimination chain. Stringified
 * comparison sidesteps the `ToBoolean(Object) === true` trap that
 * `Boolean(new Boolean(false))` would otherwise produce.
 *
 * The helper assumes `Boolean.prototype.toString` is untampered on the
 * local realm — `String(value)` for a boxed Boolean resolves through
 * the live prototype method, while the unboxed side bypasses it via
 * primitive-to-string coercion. Among the five primitive equality
 * helpers, only Boolean has this asymmetry (forced by the
 * `ToBoolean(Object) → true` trap that closes off the direct-`===`
 * path the other families use). Userland tampering with
 * `Boolean.prototype.toString` is unusual but would produce false
 * negatives on real boxed Booleans. `Boolean.prototype.toString` is not
 * realm-fixed by this package.
 *
 * @param value - the value to test
 * @returns `true` when the unboxed primitive's string form equals
 *  `String(value)`; `false` otherwise (including when `valueOf` throws)
 * @internal
 */
export function doesHaveStrictUnboxedBooleanValueEquality(value: unknown): boolean;

/**
 * Verifies that the boxed `Symbol` value's `[[SymbolData]]` internal slot
 * is present and that the unboxed primitive symbol's `description`
 * matches the boxed value's `description` — the load-bearing fourth
 * marker of {@link isBoxedSymbol}'s discrimination chain. The description
 * cross-validator catches the own-property-shadowing tampering surface
 * where a real boxed Symbol has had its `description` getter overridden
 * by an own data property.
 *
 * @param value - the value to test
 * @returns `true` when the unboxed primitive's `description` equals
 *  `value.description`; `false` otherwise (including when `valueOf`
 *  throws, and including when both descriptions are `undefined`-valued
 *  for `Symbol()` with no description)
 * @internal
 */
export function doesHaveStrictUnboxedSymbolValueEquality(value: unknown): boolean;

/**
 * Verifies that the boxed `BigInt` value's `[[BigIntData]]` internal slot
 * is present and that its unboxed primitive value matches the value
 * coerced through `BigInt(value)` — the load-bearing fourth marker of
 * {@link isBoxedBigInt}'s discrimination chain.
 *
 * @param value - the value to test
 * @returns `true` when the unboxed primitive equals `BigInt(value)`;
 *  `false` otherwise (including when `valueOf` throws)
 * @internal
 */
export function doesHaveStrictUnboxedBigIntValueEquality(value: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
