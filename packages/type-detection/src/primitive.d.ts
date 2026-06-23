/**
 * @module @species-js/type-detection/primitive
 *
 * Primitive-value and boxed-primitive detection.
 *
 * Each of JavaScript's five primitive families (`'string'`, `'number'`,
 * `'boolean'`, `'symbol'`, `'bigint'`) ships three types and three predicates
 * in this module:
 *
 * - `XValue` / `isXValue` — the primitive form, narrowed via `typeof`.
 *   Realm-independent (`typeof` reads the same in every realm) and the
 *   least expensive predicates in the package.
 * - `BoxedX` / `isBoxedX` — the boxed wrapper-object form. All boxed
 *   predicates share two fixtures: the `isObject` gate from `@/object`
 *   (truthiness + `typeof === 'object'`) at the top as O(1)
 *   primitive-and-null rejection, and the spec-precise `[[XData]]`
 *   internal-slot probe via the captured `X.prototype.valueOf` at the
 *   bottom as the engine-attested sealing marker. Between those
 *   fixtures the families split by whether their intrinsic is a true
 *   constructor. See "Constructor-aware vs. structural-only families"
 *   below. Cross-realm safe by construction.
 * - `XType` / `isX` — the composite type and predicate admitting either
 *   the primitive form or the boxed form. Composes
 *   `isXValue || isBoxedX` with the less-expensive primitive check first.
 *
 * Boxed primitives are the runtime values `new String('x')`,
 * `new Number(42)`, `new Boolean(true)`, `Object(Symbol('y'))`, and
 * `Object(1n)` produce. They carry the same conceptual semantics as
 * their primitive counterparts in most JavaScript contexts. Implicit
 * coercion handles property access, concatenation, arithmetic, and
 * iteration uniformly. The two forms differ on identity (`===`
 * distinguishes them) and on `typeof` (`'object'` for boxed forms).
 * The composite predicates admit both transparently; the value-only and
 * boxed-only predicates discriminate them.
 *
 * ## Constructor-aware vs. structural-only families
 *
 * The boxed predicates split into two shapes between the `isObject`
 * gate and the slot-probe seal:
 *
 * - **`isBoxedString` / `isBoxedNumber` / `isBoxedBoolean`** — two-branch
 *   identity-check. The local-realm fast path pairs `value instanceof X`
 *   with `getPrototypeOf(value) === X.prototype`. The pair admits only
 *   direct `X` instances — subclasses pass `instanceof` but fail the
 *   `prototype` based identity-check, preserving subclass rejection. The
 *   cross-realm structural fallback pairs the `[[Class]]` tag with the
 *   resolved constructor-name. Subclasses are again rejected because
 *   their walked constructor-name is derived from the subclass itself.
 * - **`isBoxedSymbol` / `isBoxedBigInt`** — four-marker structural chain
 *   only (`isObject` + tag + constructor-name + slot-probe). The
 *   local-realm `instanceof` branch is deliberately omitted because
 *   `Symbol` and `BigInt` are factory-functions, not constructors —
 *   `new Symbol()` and `new BigInt()` both throw. Although
 *   `Object(Symbol('x')) instanceof Symbol` evaluates to `true` under
 *   the default `OrdinaryHasInstance` algorithm, that result is
 *   incidental to prototype-chain walking rather than a meaningful
 *   identity test. The structural chain is the honest discriminator.
 *
 * The boxed predicates extend the conservative narrowing-posture
 * established by `isPromise` / `isEventTarget` / `isAbortSignal`
 * (decisions #010, #023, #028) with engine-attested internal-slot
 * evidence (decision #042). The two-branch identity-check on `String` /
 * `Number` / `Boolean` and the factory-function carve-out for Symbol /
 * `BigInt` are decision #049. The slot-probe is the bottom marker,
 * engine-attested and spoof-proof. It closes the
 * `Symbol.toStringTag`-spoofing surface the structural markers
 * leave open.
 *
 * ## Generic primitive predicates — floor of the lattice
 *
 * In addition to the per-family surface, this module exposes three
 * union predicates at the floor of the primitive lattice:
 *
 * - **`isBoxablePrimitive`** — admits any of the five boxable
 *   primitive families ({@link BoxablePrimitive}). Shaped as a
 *   `typeof`-result EXCLUSION (rejects `'undefined'`, `'function'`,
 *   `'object'`) rather than an enumeration. The exclusion form is
 *   future-proof: every primitive added since ES1 (Symbol in ES6,
 *   `BigInt` in ES2020) has arrived with a new `typeof` result distinct
 *   from the three rejection cases, and the rejection set is
 *   spec-locked. An enumeration shape would silently fail to admit any
 *   future primitive; the exclusion shape admits it without code
 *   changes.
 * - **`isNullishPrimitive`** — admits `null` and `undefined`
 *   ({@link NullishPrimitive}), the two non-boxable primitive
 *   singletons. Uses the parameter-default-to-`null` idiom (decision
 *   #025) to collapse both nullish forms to `null` for a single
 *   strict-equality test.
 * - **`isPrimitiveValue`** — admits the full primitive union
 *   {@link PrimitiveValue} (the seven ECMA-262 primitive types) via
 *   `isNullishPrimitive || isBoxablePrimitive`.
 *
 * ## Generic boxed-primitive umbrella
 *
 * On the boxed side of the lattice, this module exposes an umbrella
 * admitting any of the five boxed wrapper-object forms regardless of
 * family:
 *
 * - **`isBoxedPrimitive`** — admits any of the five boxed forms
 *   ({@link BoxedPrimitive}). Composes the `isObject` gate with a
 *   two-path resolution: the ES3 native hot-path for local-realm
 *   `String` / `Number` / `Boolean`, and the alien-realm structural
 *   path that resolves the `[[Class]]` tag and dispatches through the
 *   equality-helper map. The structural path covers cross-realm boxed
 *   primitives for all five families and every local-realm `Symbol` /
 *   `BigInt` case (factory-function carve-out, decision #049).
 *
 * ## Generic-typed predicate pattern
 *
 * All predicates follow the family-pattern set by `isCallable` and
 * `isFunction` in `@/function` (decision #031). The narrow returns
 * `T & X` rather than bare `X`, preserving any caller-side narrowing
 * through the predicate. For `T = unknown` (the default), the
 * intersection collapses to `X`, matching pre-generic behavior. Applied
 * uniformly across value-only, boxed-only, composite, and generic
 * predicates, so the form is consistent across the module. Decision
 * #036's value-only exclusion is revisited and superseded by the
 * consistency rationale (see decision #038 for the framing).
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  String Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `'string'` value type — an alias for the built-in
 * primitive. Exported, so the boxed and composite types can sit
 * alongside it under a uniform naming convention.
 */
export type StringValue = string;

/**
 * The boxed `String` wrapper-object type — instances created via
 * `new String('x')` or `Object('x')`. The `& object` intersection
 * excludes primitive strings: a value typed as `BoxedString` is
 * structurally an object that exposes the `String.prototype` method
 * set, not a primitive string.
 *
 * Boxed strings interoperate with primitive strings via implicit
 * coercion in most JavaScript contexts (concatenation, property
 * access, template-literal interpolation, etc.) but differ on identity
 * (`===`) and on `typeof` (`'object'` vs. `'string'`). The two forms
 * can be admitted together via {@link StringType} / {@link isString}.
 */
export type BoxedString = String & object;

/**
 * Either the primitive string form or the boxed `String`
 * wrapper-object form. The narrow target of {@link isString}.
 */
export type StringType = StringValue | BoxedString;

/**
 * Narrows a value to the primitive string form via
 * `typeof value === 'string'`.
 *
 * Matches the primitive form only. Boxed `String` objects, such as
 * `new String('x')`, report `typeof === 'object'` and are deliberately
 * excluded. Admitting both forms requires {@link isString}.
 * Discriminating the boxed form requires {@link isBoxedString}.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & StringValue`; `T = unknown` collapses to `StringValue`. Useful
 * for callers with literal-union types. For example, a value typed as
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
 * `isObject` gate from `@/object`, a two-branch identity-check, and the
 * spec-precise `[[StringData]]` internal-slot probe via the captured
 * `String.prototype.valueOf`.
 *
 * The two-branch identity-check runs in cost-order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast-path: `value instanceof String` paired with
 *   `getPrototypeOf(value) === String.prototype`. The pair admits only
 *   direct `String` instances. Subclasses pass `instanceof` but fail
 *   the prototype identity-check, preserving subclass rejection. Both
 *   captures (`String` and `String.prototype`) are realm-fixed at
 *   module-load, so the branch is robust to post-load tampering of
 *   the global `String` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object String]'` paired with the resolved constructor-name
 *   `'String'`. Both work realm-independently — the tag-read through
 *   the realm-fixed `toObjectString.call` capture, the constructor-walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor-name is derived from
 *   the subclass itself.
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[StringData]]` evidence. A value
 * passes only if the captured `String.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive equals
 * `String(value)`. The probe closes the `Symbol.toStringTag`-spoofing
 * surface the structural markers leave open even when paired with the
 * constructor-walk. It also rejects post-`Object.setPrototypeOf`
 * spoofs that would otherwise pass the local-realm pair.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BoxedString`; `T = unknown` collapses to `BoxedString`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed string
 * @returns `true` when the identity-check and the `[[StringData]]`
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
 * Narrows a value to either the primitive string form or the boxed
 * `String` wrapper-object form — the union {@link StringType}.
 *
 * Composes `isStringValue || isBoxedString` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isString} when admitting both forms is intentional —
 * most string-handling code accepts boxed and primitive uniformly via
 * implicit coercion. Reach for {@link isStringValue} or
 * {@link isBoxedString} when the distinction matters (e.g., strict
 * equality with a primitive form, or wrapper-method invocation that
 * requires the boxed receiver).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & StringType`; `T = unknown` collapses to `StringType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of string
 * @returns `true` when the value is either a primitive string or a
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
 * The primitive `'number'` value type — an alias for the built-in
 * primitive. Includes `NaN` and `±Infinity`. Finiteness and integrality
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
 * Either the primitive number form or the boxed `Number`
 * wrapper-object form. The narrow target of {@link isNumber}.
 */
export type NumberType = NumberValue | BoxedNumber;

/**
 * Narrows a value to the primitive number form via
 * `typeof value === 'number'`.
 *
 * Matches every numeric primitive — `NaN`, `±Infinity`, and finite
 * numbers alike. Finiteness, integrality, and safe-integer-range
 * checks are caller's concerns. Reach for `isFiniteNumberValue`,
 * `isIntegerValue`, or `isSafeIntegerValue` in `@/config` for those
 * (decision #026). Boxed `Number` objects, such as `new Number(42)`,
 * report `typeof === 'object'` and are deliberately excluded. Admitting
 * both forms requires {@link isNumber}. Discriminating the boxed form
 * requires {@link isBoxedNumber}.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * `isObject` gate from `@/object`, a two-branch identity-check, and the
 * spec-precise `[[NumberData]]` internal-slot probe via the captured
 * `Number.prototype.valueOf`.
 *
 * The two-branch identity-check runs in cost-order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast-path: `value instanceof Number` paired with
 *   `getPrototypeOf(value) === Number.prototype`. The pair admits only
 *   direct `Number` instances. Subclasses pass `instanceof` but fail
 *   the prototype identity-check, preserving subclass rejection. Both
 *   captures (`Number` and `Number.prototype`) are realm-fixed at
 *   module-load, so the branch is robust to post-load tampering of
 *   the global `Number` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object Number]'` paired with the resolved constructor-name
 *   `'Number'`. Both work realm-independently — the tag-read through
 *   the realm-fixed `toObjectString.call` capture, the constructor-walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor-name is derived from
 *   the subclass itself.
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[NumberData]]` evidence. A value
 * passes only if the captured `Number.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive matches
 * `Number(value)` under `Object.is`. `Object.is` is preferred over
 * `===` so that `new Number(NaN)` is correctly admitted
 * (`Object.is(NaN, NaN) === true`, whereas `NaN === NaN` is `false`).
 * The probe closes the `Symbol.toStringTag`-spoofing surface the
 * structural markers leave open even when paired with the constructor
 * walk. It also rejects post-`Object.setPrototypeOf` spoofs that would
 * otherwise pass the local-realm pair.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BoxedNumber`; `T = unknown` collapses to `BoxedNumber`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed number
 * @returns `true` when the identity-check and the `[[NumberData]]`
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
 * Narrows a value to either the primitive number form or the boxed
 * `Number` wrapper-object form — the union {@link NumberType}.
 *
 * Composes `isNumberValue || isBoxedNumber` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isNumber} when admitting both forms is intentional —
 * most numeric code accepts boxed and primitive uniformly via implicit
 * coercion in arithmetic contexts. Reach for {@link isNumberValue} or
 * {@link isBoxedNumber} when the distinction matters (e.g., strict
 * equality with a primitive form, or wrapper-method invocation that
 * requires the boxed receiver).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & NumberType`; `T = unknown` collapses to `NumberType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of number
 * @returns `true` when the value is either a primitive number or a
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
 * The primitive `'boolean'` value type — an alias for the built-in
 * primitive. Either `true` or `false`.
 */
export type BooleanValue = boolean;

/**
 * The boxed `Boolean` wrapper-object type — instances created via
 * `new Boolean(true)` or `Object(false)`. The `& object` intersection
 * excludes primitive booleans. Boxed booleans coerce to their primitive
 * value in truthiness contexts, but they differ on identity (`===`)
 * and on `typeof` (`'object'` vs. `'boolean'`). A subtle gotcha: every
 * boxed `Boolean` (including `new Boolean(false)`) is _truthy_ as an
 * object, regardless of its underlying boolean value, since truthiness
 * tests on objects do not unwrap.
 */
export type BoxedBoolean = Boolean & object;

/**
 * Either the primitive boolean form or the boxed `Boolean`
 * wrapper-object form. The narrow target of {@link isBoolean}.
 */
export type BooleanType = BooleanValue | BoxedBoolean;

/**
 * Narrows a value to the primitive boolean form via
 * `typeof value === 'boolean'`.
 *
 * Matches the primitive form only — both `true` and `false`. Boxed
 * `Boolean` objects, such as `new Boolean(true)`, report
 * `typeof === 'object'` and are deliberately excluded. Admitting both
 * forms requires {@link isBoolean}. Discriminating the boxed form
 * requires {@link isBoxedBoolean}. Truthy/falsy coercion (`!!value`) is
 * a different operation. This predicate discriminates the primitive
 * type, not the truthiness.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * `isObject` gate from `@/object`, a two-branch identity-check, and the
 * spec-precise `[[BooleanData]]` internal-slot probe via the captured
 * `Boolean.prototype.valueOf`.
 *
 * The two-branch identity-check runs in cost-order, with the
 * less-expensive local-realm pair tried first and the structural
 * fallback running only on miss:
 *
 * - Local-realm fast-path: `value instanceof Boolean` paired with
 *   `getPrototypeOf(value) === Boolean.prototype`. The pair admits only
 *   direct `Boolean` instances. Subclasses pass `instanceof` but fail
 *   the prototype identity-check, preserving subclass rejection. Both
 *   captures (`Boolean` and `Boolean.prototype`) are realm-fixed at
 *   module-load, so the branch is robust to post-load tampering of the
 *   global `Boolean` binding.
 * - Cross-realm structural fallback: the `[[Class]]` tag
 *   `'[object Boolean]'` paired with the resolved constructor-name
 *   `'Boolean'`. Both work realm-independently — the tag-read through
 *   the realm-fixed `toObjectString.call` capture, the constructor-walk
 *   through the package's four-source resolver. Subclasses are again
 *   rejected because their walked constructor-name is derived from the
 *   subclass itself.
 *
 * The slot-probe runs last regardless of which branch admits, sealing
 * the chain on engine-attested `[[BooleanData]]` evidence. A value
 * passes only if the captured `Boolean.prototype.valueOf` extracts the
 * slot without throwing AND the unboxed primitive's string form equals
 * `String(value)`. The stringified comparison sidesteps the
 * `ToBoolean(Object) === true` trap that `Boolean(new Boolean(false))`
 * would otherwise produce on a direct value compare. The probe closes
 * the `Symbol.toStringTag`-spoofing surface the structural markers
 * leave open even when paired with the constructor-walk. It also
 * rejects post-`Object.setPrototypeOf` spoofs that would otherwise pass
 * the local-realm pair.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BoxedBoolean`; `T = unknown` collapses to `BoxedBoolean`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed boolean
 * @returns `true` when the identity-check and the `[[BooleanData]]`
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
 * Narrows a value to either the primitive boolean form or the boxed
 * `Boolean` wrapper-object form — the union {@link BooleanType}.
 *
 * Composes `isBooleanValue || isBoxedBoolean` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isBoolean} when admitting both forms is intentional —
 * most code that handles boolean values accepts boxed and primitive
 * uniformly. Reach for {@link isBooleanValue} or {@link isBoxedBoolean}
 * when the distinction matters (e.g., strict equality with a primitive
 * form, or distinguishing type narrowing from truthiness coercion:
 * `new Boolean(false)` is a `BoxedBoolean` but is truthy as an object).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BooleanType`; `T = unknown` collapses to `BooleanType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of boolean
 * @returns `true` when the value is either a primitive boolean or a
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
 * The primitive `'symbol'` value type — an alias for the built-in
 * primitive. Covers unique symbols (`Symbol('x')`), registered symbols
 * (`Symbol.for('x')`), and well-known symbols (`Symbol.iterator`,
 * `Symbol.asyncIterator`, etc.).
 */
export type SymbolValue = symbol;

/**
 * The boxed `Symbol` wrapper-object type — instances created via
 * `Object(Symbol('key'))`. The `& object` intersection excludes
 * primitive symbols. Note that `new Symbol(...)` throws a `TypeError`
 * at runtime per ECMA-262 §20.4.1. The boxed form is reachable only
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
 * Either the primitive symbol form or the boxed `Symbol`
 * wrapper-object form. The narrow target of {@link isSymbol}.
 */
export type SymbolType = SymbolValue | BoxedSymbol;

/**
 * Narrows a value to the primitive symbol form via
 * `typeof value === 'symbol'`.
 *
 * Covers unique symbols, registered symbols from `Symbol.for`, and
 * well-known symbols such as `Symbol.iterator`. Boxed `Symbol` objects
 * (produced via `Object(Symbol('x'))`) report `typeof === 'object'`
 * and are deliberately excluded. Admitting both forms requires
 * {@link isSymbol}. Discriminating the boxed form requires
 * {@link isBoxedSymbol}.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * `[[Class]]` tag `'[object Symbol]'`, the constructor-name `'Symbol'`,
 * and the spec-precise `[[SymbolData]]` internal-slot probe via the
 * captured `Symbol.prototype.valueOf` paired with a `description`-value
 * cross-check.
 *
 * Short-circuit `&&` runs the markers in cost-order: the `isObject`
 * gate first, the tag-read second, the constructor-walk third, the
 * valueOf-slot probe last as the spec-precise spoof closure.
 *
 * Unlike {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity-branch.
 * `Symbol` is a factory-function, not a constructor — `new Symbol()`
 * throws. `Object(Symbol('x')) instanceof Symbol` evaluates to `true`
 * only by virtue of the default `OrdinaryHasInstance` algorithm
 * walking the prototype-chain, not because the spec treats the wrapper
 * as a `Symbol` instance in any identity-bearing sense. The structural
 * chain runs uniformly across local-realm and cross-realm boxed
 * `Symbol`s and is the honest discriminator here.
 *
 * The `[[SymbolData]]` probe cross-checks the unboxed primitive's
 * `description` against the boxed value's `description` — catching
 * the own-property-shadowing tampering surface where a real boxed
 * `Symbol` has had its `description` getter overridden by an own
 * data property.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * Narrows a value to either the primitive symbol form or the boxed
 * `Symbol` wrapper-object form — the union {@link SymbolType}.
 *
 * Composes `isSymbolValue || isBoxedSymbol` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isSymbol} when admitting both forms is intentional —
 * JavaScript treats boxed and primitive symbols as interchangeable
 * property keys via implicit unwrapping. Reach for {@link isSymbolValue}
 * or {@link isBoxedSymbol} when the distinction matters (e.g., strict
 * equality with a specific primitive symbol, or asserting the literal
 * wrapper-object shape).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & SymbolType`; `T = unknown` collapses to `SymbolType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of symbol
 * @returns `true` when the value is either a primitive symbol or a
 *  boxed `Symbol`, narrowing `value` to `T & SymbolType`; `false`
 *  otherwise
 * @example
 * isSymbol(Symbol('x'));         // true
 * isSymbol(Object(Symbol('x'))); // true
 * isSymbol('x');                 // false
 * isSymbol(null);                // false
 */
export function isSymbol<T = unknown>(value?: T): value is T & SymbolType;

/**
 * Whether a symbol is _unregistered_ — created via `Symbol()` or a well-known
 * symbol, i.e. not obtained from the global registry via `Symbol.for`.
 *
 * "Unguarded": the caller must ensure `value` is a symbol; this performs no
 * `isSymbolValue` check. It reads the realm-fixed `Symbol.keyFor` capture —
 * `keyFor(value) === undefined` is the spec tell for an unregistered symbol.
 * The load-bearing use is weak-key validation: only unregistered symbols may
 * serve as `WeakMap` / `WeakSet` keys.
 *
 * @param value - a symbol (precondition; not re-checked)
 * @returns `true` when the symbol is unregistered; `false` for a registered one
 * @internal
 */
export function unguardedIsUnregisteredSymbol(value: symbol): boolean;

/**
 * Whether `value` is a _registered_ symbol — a symbol obtained from the global
 * symbol registry via `Symbol.for`.
 *
 * The guarded public counterpart of {@link unguardedIsUnregisteredSymbol}:
 * confirms `value` is a primitive symbol, then that `Symbol.keyFor` resolves a
 * registry key for it. Registered symbols are notable for being rejected as
 * `WeakMap` / `WeakSet` keys by the engine.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which is
 *  not a symbol
 * @returns `true` when the value is a registered symbol; `false` otherwise
 */
export function isRegisteredSymbol(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  BigInt Family
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The primitive `'bigint'` value type — an alias for the built-in
 * primitive. Covers literal form (`1n`) and `BigInt(value)` calls
 * alike.
 */
export type BigIntValue = bigint;

/**
 * The boxed `BigInt` wrapper-object type — instances created via
 * `Object(1n)` or `Object(BigInt(1_000_000_000))`. The `& object`
 * intersection excludes primitive bigints. Note that `new BigInt(...)`
 * throws a `TypeError` at runtime per ECMA-262 §21.2.1. The boxed form
 * is reachable only through `Object()` coercion.
 *
 * Boxed bigints participate in arithmetic operations via implicit
 * coercion, just like primitive bigints. Both forms can be used
 * interchangeably in mathematical contexts. They differ from primitives
 * on identity (`===`) and on `typeof` (`'object'` vs. `'bigint'`).
 */
export type BoxedBigInt = BigInt & object;

/**
 * Either the primitive bigint form or the boxed `BigInt`
 * wrapper-object form. The narrow target of {@link isBigInt}.
 */
export type BigIntType = BigIntValue | BoxedBigInt;

/**
 * Narrows a value to the primitive bigint form via
 * `typeof value === 'bigint'`.
 *
 * Matches the primitive form only — literals (`1n`), `BigInt()` calls,
 * and any arithmetic result that stays in the bigint domain. Boxed
 * `BigInt` objects (produced via `Object(1n)`) report
 * `typeof === 'object'` and are deliberately excluded. Admitting both
 * forms requires {@link isBigInt}. Discriminating the boxed form
 * requires {@link isBoxedBigInt}.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * `[[Class]]` tag `'[object BigInt]'`, the constructor-name `'BigInt'`,
 * and the spec-precise `[[BigIntData]]` internal-slot probe via the
 * captured `BigInt.prototype.valueOf`.
 *
 * Short-circuit `&&` runs the markers in cost-order: the `isObject`
 * gate first, then tag-check, then constructor-walk, then the
 * valueOf-slot probe.
 *
 * Like {@link isBoxedSymbol}, this predicate does not carry the
 * local-realm `instanceof` + `getPrototypeOf` identity-branch that
 * {@link isBoxedString} / {@link isBoxedNumber} /
 * {@link isBoxedBoolean} use. `BigInt` is a factory-function, not
 * a constructor — `new BigInt(1n)` throws. `instanceof BigInt` is
 * incidental to `OrdinaryHasInstance` rather than a meaningful
 * identity test. The structural chain is the honest discriminator.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * Narrows a value to either the primitive bigint form or the boxed
 * `BigInt` wrapper-object form — the union {@link BigIntType}.
 *
 * Composes `isBigIntValue || isBoxedBigInt` with short-circuit `||`
 * running the less expensive primitive check first. The heavier
 * four-marker boxed check fires only on miss.
 *
 * Reach for {@link isBigInt} when admitting both forms is intentional —
 * boxed and primitive bigints participate uniformly in arithmetic via
 * implicit coercion. Reach for {@link isBigIntValue} or
 * {@link isBoxedBigInt} when the distinction matters (e.g., strict
 * equality with a primitive form, or asserting the literal
 * wrapper-object shape).
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BigIntType`; `T = unknown` collapses to `BigIntType`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is neither form of bigint
 * @returns `true` when the value is either a primitive bigint or a
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
 * `[[StringData]]` slot. The `try/catch` reduces that throw to `false`.
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
 * local realm. `String(value)` for a boxed `Boolean` resolves through
 * the live prototype method. The unboxed side bypasses it via
 * primitive-to-string coercion. Among the five primitive equality
 * helpers, only `Boolean` has this asymmetry (forced by the
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
 * where a real boxed `Symbol` has had its `description` getter overridden
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
//
//  Boxed-Primitive Realm-Resolution Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Whether `value` is a direct current-realm `String` instance — passes
 * `value instanceof String` AND has `String.prototype` as its immediate
 * prototype. The proto-identity arm rejects `String` subclasses (which the
 * bare `instanceof` admits), preserving the direct-instance discrimination
 * the boxed-`String` predicates require. Assumes an object-typed receiver
 * (callers apply the `isObject` gate first). It does NOT seal the
 * `[[StringData]]` slot — `Object.create(String.prototype)` passes this
 * check and is rejected only by the downstream slot-probe.
 *
 * Exported for single-realm unit-testing of the boxed-primitive resolution
 * machinery.
 *
 * @param value - the value to test; assumed object-typed by the caller
 * @returns `true` when both the `instanceof` and prototype-identity checks
 *  hold; `false` otherwise
 * @internal
 */
export function isCurrentRealmNativeString(value: unknown): boolean;

/**
 * Whether `value` is a direct current-realm `Number` instance — passes
 * `value instanceof Number` AND has `Number.prototype` as its immediate
 * prototype. The proto-identity arm rejects `Number` subclasses (which the
 * bare `instanceof` admits). Assumes an object-typed receiver; does not
 * seal the `[[NumberData]]` slot (the downstream slot-probe does).
 *
 * Exported for single-realm unit-testing of the boxed-primitive resolution
 * machinery.
 *
 * @param value - the value to test; assumed object-typed by the caller
 * @returns `true` when both the `instanceof` and prototype-identity checks
 *  hold; `false` otherwise
 * @internal
 */
export function isCurrentRealmNativeNumber(value: unknown): boolean;

/**
 * Whether `value` is a direct current-realm `Boolean` instance — passes
 * `value instanceof Boolean` AND has `Boolean.prototype` as its immediate
 * prototype. The proto-identity arm rejects `Boolean` subclasses (which the
 * bare `instanceof` admits). Assumes an object-typed receiver; does not
 * seal the `[[BooleanData]]` slot (the downstream slot-probe does).
 *
 * Exported for single-realm unit-testing of the boxed-primitive resolution
 * machinery.
 *
 * @param value - the value to test; assumed object-typed by the caller
 * @returns `true` when both the `instanceof` and prototype-identity checks
 *  hold; `false` otherwise
 * @internal
 */
export function isCurrentRealmNativeBoolean(value: unknown): boolean;

/**
 * Whether `value` resolves as a boxed primitive via the ES3 native
 * hot-path — the local-realm fast-path for `String` / `Number` /
 * `Boolean`. Each candidate pairs its current-realm identity check with
 * the matching `[[XData]]` slot-probe and short-circuits on the first
 * match. `Symbol` / `BigInt` are excluded (factory-function carve-out,
 * decision #049) and resolve through the alien-realm path instead. Assumes
 * an object-typed receiver.
 *
 * Exported for single-realm unit-testing: discriminates local-realm boxed
 * primitives independently of the alien-realm path.
 *
 * @param value - the value to test; assumed object-typed by the caller
 * @returns `true` when one of the three ES3 native pairs matches and its
 *  slot-probe passes; `false` otherwise
 * @internal
 */
export function resolvedViaES3NativePrimitiveTypesHotPaths(value: unknown): boolean;

/**
 * Whether `value` resolves as a boxed primitive via the alien-realm
 * structural path — the resolved `[[Class]]` tag must match the walked
 * constructor-name, AND the matching `[[XData]]` slot-probe (looked up by
 * tag) must pass. Covers cross-realm boxed primitives for all five families
 * and every local-realm `Symbol` / `BigInt` (factory-function carve-out).
 * Assumes an object-typed receiver.
 *
 * Exported for single-realm unit-testing: because its markers (tag +
 * constructor-name + slot) are realm-independent, the alien-realm path can
 * be exercised with LOCAL-realm boxed values — no iframe / worker / vm
 * realm needed.
 *
 * @param value - the value to test; assumed object-typed by the caller
 * @returns `true` when the tag and constructor-name agree and the matching
 *  slot-probe passes; `false` otherwise
 * @internal
 */
export function resolvedViaAlienRealmPrimitiveTypesEvaluation(value: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Generic Primitive Type Handling
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The nullish-primitive union — `null` and `undefined`. Equals
 * `null | undefined` and matches the canonical ECMAScript "nullish"
 * vocabulary used by `??` and `?.`.
 *
 * These two values are primitives per ECMA-262 §4.4.4 but lack the
 * constructor/wrapper-object duality the boxable families share:
 * neither has an intrinsic constructor, an internal slot, nor a
 * dedicated `typeof` result. `null`'s `typeof` is `'object'` — the
 * historical bug. They form their own sub-category of primitive.
 */
export type NullishPrimitive = null | undefined;

/**
 * The boxable-primitive union — the five primitive families that
 * carry constructor/wrapper-object duality. Each of `String`, `Number`,
 * `Boolean`, `Symbol`, and `BigInt` has an intrinsic that boxes the
 * primitive to a wrapper-object form. Equals
 * `string | number | boolean | symbol | bigint` — the primitive forms
 * only. The boxed wrapper-object forms are NOT included.
 *
 * Excludes the two nullish primitives (`null`, `undefined`) because
 * they carry no constructor and no `[[XData]]` internal slot. They
 * live in the {@link NullishPrimitive} union instead. Excludes boxed
 * forms (`BoxedString`, `BoxedNumber`, …) because they have
 * `typeof === 'object'`. The boxable-primitive lattice is defined at
 * the unboxed level.
 */
export type BoxablePrimitive =
  | StringValue
  | NumberValue
  | BooleanValue
  | SymbolValue
  | BigIntValue;

/**
 * The full primitive union — all seven ECMA-262 primitive types. Equals
 * {@link NullishPrimitive} `|` {@link BoxablePrimitive}, covering
 * every value `typeof` can resolve to outside the `Object` family.
 */
export type PrimitiveValue = NullishPrimitive | BoxablePrimitive;

/**
 * The boxed-primitive union — the five wrapper-object types that pair
 * with their boxable-primitive siblings under constructor/wrapper-object
 * duality. Equals
 * `BoxedString | BoxedNumber | BoxedBoolean | BoxedSymbol | BoxedBigInt`.
 *
 * Each member has `typeof === 'object'` and carries the spec-precise
 * `[[XData]]` internal slot that its boxable-primitive sibling lacks.
 * Together with {@link BoxablePrimitive} this completes both sides of
 * the boxable-primitive lattice.
 */
export type BoxedPrimitive =
  | BoxedString
  | BoxedNumber
  | BoxedBoolean
  | BoxedSymbol
  | BoxedBigInt;

/**
 * Narrows a value to the nullish-primitive union
 * {@link NullishPrimitive} — `null` or `undefined`.
 *
 * Uses the parameter-default-to-`null` idiom (decision #025) to
 * collapse both nullish forms to `null` for a single strict-equality
 * test. The three input cases:
 *
 * 1. `isNullishPrimitive()` and `isNullishPrimitive(undefined)` trigger
 *    the default and reach `value === null` as `true`.
 * 2. `isNullishPrimitive(null)` reaches the same comparison directly.
 * 3. Every non-nullish value suppresses the default and fails the
 *    comparison.
 *
 * Generic in `T` per the family-pattern. The narrow returns
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
 * Narrows a value to the boxable-primitive union
 * {@link BoxablePrimitive} — `'string'`, `'number'`, `'boolean'`,
 * `'symbol'`, or `'bigint'`.
 *
 * Shaped as a `typeof`-result EXCLUSION rather than an enumeration:
 * admits any value whose `typeof` is not `'undefined'`, `'function'`,
 * or `'object'`. The three rejected signatures cover the entire
 * non-boxable surface (undefined, callable Object, regular Object
 * including `null`), leaving the five boxable families as the
 * admitted set.
 *
 * The exclusion shape is deliberate and load-bearing — it makes the
 * predicate future-proof against new primitive types added by future
 * ECMA versions. Every primitive added since ES1 (`Symbol` in ES6,
 * `BigInt` in ES2020) has arrived with a new `typeof` result distinct
 * from the three rejection cases. The rejection set is spec-locked:
 * modern ECMA does not permit implementation-defined `typeof` strings.
 * An enumeration-based shape (`t === 'string' || t === 'number' || …`)
 * would silently fail to admit any new primitive; the exclusion form
 * admits it without code changes. The only legacy quirk that produces
 * a non-canonical `typeof` result is `document.all` returning
 * `'undefined'`. The exclusion correctly rejects it.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BoxablePrimitive`; `T = unknown` collapses to `BoxablePrimitive`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxable primitive
 * @returns `true` when `typeof value` is not one of the three
 *  non-boxable signatures, narrowing `value` to
 *  `T & BoxablePrimitive`; `false` otherwise
 * @example
 * isBoxablePrimitive('x');             // true
 * isBoxablePrimitive(42);              // true
 * isBoxablePrimitive(true);            // true
 * isBoxablePrimitive(Symbol('y'));     // true
 * isBoxablePrimitive(1n);              // true
 * isBoxablePrimitive(null);            // false (typeof 'object')
 * isBoxablePrimitive(undefined);       // false
 * isBoxablePrimitive({});              // false
 * isBoxablePrimitive(() => {});        // false
 * isBoxablePrimitive(new String('x')); // false (boxed)
 */
export function isBoxablePrimitive<T = unknown>(value?: T): value is T & BoxablePrimitive;

/**
 * Narrows a value to the full primitive union {@link PrimitiveValue} — any
 * of the seven ECMA-262 primitive types.
 *
 * Composes `isNullishPrimitive || isBoxablePrimitive`. Short-circuit
 * `||` runs `isNullishPrimitive` first. For non-nullish inputs (the
 * common case) the cost is the leading function call plus
 * `isBoxablePrimitive`'s single `typeof` read and `Set.has` lookup.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & PrimitiveValue`; `T = unknown` collapses to `PrimitiveValue`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is a primitive
 * @returns `true` when the value is any of the seven primitive types,
 *  narrowing `value` to `T & PrimitiveValue`; `false` otherwise
 * @example
 * isPrimitiveValue('x');             // true
 * isPrimitiveValue(42);              // true
 * isPrimitiveValue(Symbol('y'));     // true
 * isPrimitiveValue(null);            // true
 * isPrimitiveValue(undefined);       // true
 * isPrimitiveValue({});              // false
 * isPrimitiveValue(() => {});        // false
 * isPrimitiveValue(new String('x')); // false (boxed)
 */
export function isPrimitiveValue<T = unknown>(value?: T): value is T & PrimitiveValue;

/**
 * Narrows a value to the boxed-primitive union {@link BoxedPrimitive} —
 * any of the five boxed wrapper-object forms ({@link BoxedString},
 * {@link BoxedNumber}, {@link BoxedBoolean}, {@link BoxedSymbol},
 * {@link BoxedBigInt}).
 *
 * Composes the `isObject` gate from `@/object` with a two-path
 * resolution:
 *
 * 1. **ES3 native hot-path**. The local-realm fast-path for the three
 *    ES3 wrapper constructors. Tries `String`, `Number`, and `Boolean`
 *    in sequence; each candidate pairs `isCurrentRealmNativeX` with the
 *    matching `[[XData]]` slot-probe. Short-circuits on the first match.
 *    `Symbol` and `BigInt` are excluded from this path by the
 *    factory-function carve-out (decision #049) — `new Symbol()` and
 *    `new BigInt()` both throw, so they have no local-realm
 *    `instanceof` branch.
 * 2. **Alien-realm structural path**. Resolves the `[[Class]]` tag,
 *    verifies the walked constructor-name matches the tag, and
 *    dispatches through the equality-helper map to run the matching
 *    `[[XData]]` slot-probe. Covers cross-realm boxed primitives for
 *    all five families and every local-realm `Symbol` / `BigInt` case.
 *
 * The slot-probe is the engine-attested seal on either path. A value
 * passes only if it carries one of the five `[[XData]]` internal slots,
 * confirmed by extracting the slot via the captured
 * `X.prototype.valueOf` and cross-checking the unboxed primitive
 * against `X(value)` under the family-appropriate equality strategy
 * (`===` for `String` / `BigInt`, `Object.is` for `Number`, stringified
 * compare for `Boolean`, `description`-value cross-check for `Symbol`).
 *
 * Reach for {@link isBoxedPrimitive} when admitting the boxed form
 * regardless of family is intentional (e.g., for stripping wrapper
 * objects to their primitive value before equality work). Reach for
 * the per-family {@link isBoxedString}, {@link isBoxedNumber},
 * {@link isBoxedBoolean}, {@link isBoxedSymbol}, or
 * {@link isBoxedBigInt} when only one family is acceptable.
 *
 * Generic in `T` per the family-pattern. The narrow returns
 * `T & BoxedPrimitive`; `T = unknown` collapses to `BoxedPrimitive`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed primitive
 * @returns `true` when the value carries one of the five `[[XData]]`
 *  internal slots, narrowing `value` to `T & BoxedPrimitive`; `false`
 *  otherwise
 * @example
 * isBoxedPrimitive(new String('x'));     // true
 * isBoxedPrimitive(Object(1n));          // true
 * isBoxedPrimitive(Object(Symbol('y'))); // true
 * isBoxedPrimitive(new Number(NaN));     // true (Object.is admits NaN)
 * isBoxedPrimitive('x');                 // false (primitive)
 * isBoxedPrimitive(null);                // false
 * isBoxedPrimitive({});                  // false (no [[XData]])
 */
export function isBoxedPrimitive<T = unknown>(value?: T): value is T & BoxedPrimitive;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
