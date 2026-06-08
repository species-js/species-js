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
 * - `BoxedX` / `isBoxedX` — the boxed wrapper-object form, narrowed via
 *   four cross-validating markers: the `isObject` gate from `@/object`
 *   (truthiness + `typeof === 'object'`), the `[[Class]]` tag (e.g.
 *   `'[object String]'`), the constructor name resolved through the
 *   package's constructor walk, and the spec-precise `[[XData]]`
 *   internal-slot probe via the captured `X.prototype.valueOf`.
 *   Cross-realm safe by construction.
 * - `XType` / `isX` — the composite type and predicate admitting either
 *   the primitive form or the boxed form. Composes
 *   `isXValue || isBoxedX` with the cheaper primitive check first.
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
 * The boxed-predicate marker chain runs in performance-first order:
 * the `isObject` gate from `@/object` is the O(1) primitive-and-null
 * rejection (truthiness + `typeof === 'object'`), the tag read is the
 * moderate-cost type discriminator, the constructor walk is the
 * cross-validating structural check, and the spec-precise
 * `[[XData]]` internal-slot probe (via the captured
 * `X.prototype.valueOf`) is the bottom marker — engine-attested,
 * spoof-proof. The order also mirrors the
 * structural-gate-then-identity-markers pattern established by
 * `isPromise` / `isEventTarget` / `isAbortSignal` (decisions #023,
 * #028). The four markers together form the conservative-narrowing
 * posture (decision #010) extended with internal-slot evidence
 * (decision #042): the first three reject the bulk of non-matches
 * cheaply by structural shape; the fourth confirms the engine-attested
 * slot identity that userland cannot forge, closing the
 * `Symbol.toStringTag`-spoofing surface the structural markers leave
 * open.
 *
 * ## Generic-typed predicate pattern
 *
 * All 15 predicates follow the family pattern set by `isCallable` and
 * `isFunction` in `@/function` (decision #031). The narrow returns
 * `T & X` rather than bare `X`, preserving any caller-side narrowing
 * through the predicate. For `T = unknown` (the default), the
 * intersection collapses to `X`, matching pre-generic behavior. Applied
 * uniformly across value-only, boxed-only, and composite predicates so
 * the form is consistent across the family — decision #036's value-only
 * exclusion is revisited and superseded by the consistency rationale;
 * see decision #038 for the framing.
 */

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
 * (`===`) and on `typeof` (`'object'` vs `'string'`). The two forms
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
 * for callers with literal-union types — e.g. a value typed as
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
 * Narrows a value to the boxed `String` wrapper-object form via four
 * cross-validating markers — the `isObject` gate from `@/object`
 * (truthiness + `typeof === 'object'`), the `[[Class]]` tag
 * `'[object String]'`, the constructor name `'String'` resolved
 * through the package's constructor walk, and the spec-precise
 * `[[StringData]]` internal-slot probe via the captured
 * `String.prototype.valueOf`.
 *
 * Short-circuit `&&` runs the markers in cost order — the `isObject`
 * gate first as the O(1) primitive-and-null rejection, the tag read
 * second, the constructor walk third, the valueOf-slot probe last as
 * the spec-precise spoof closure. Each marker rules out a distinct
 * false-positive class:
 *
 * - The `isObject` gate rejects primitive strings (which share the
 *   `'[object String]'` tag), `null`, all other primitives, and
 *   functions in O(1).
 * - The `[[Class]]` tag rules out values that carry a different tag —
 *   plain objects, arrays, Date, etc. Reads through the realm-fixed
 *   `toObjectString.call` capture, so cross-realm boxed strings are
 *   admitted on contract.
 * - The constructor-name marker is the inexpensive structural
 *   cross-validator, rejecting values that pass the tag check but
 *   whose actual constructor is something other than `String`.
 * - The valueOf-slot probe is the spec-precise spoof gate. The
 *   `[[StringData]]` internal slot is engine-attested and cannot be
 *   forged from userland — a value passes only if the captured
 *   `String.prototype.valueOf` extracts the slot without throwing AND
 *   the unboxed primitive equals `String(value)`. Closes the
 *   `Symbol.toStringTag`-spoofing surface the structural markers leave
 *   open even when paired with the constructor walk.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedString`; `T = unknown` collapses to `BoxedString`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed string
 * @returns `true` when all four markers hold, narrowing `value` to
 *  `T & BoxedString`; `false` otherwise
 * @example
 * isBoxedString(new String('x'));                       // true
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
 * {@link isBoxedString} when the distinction matters (e.g. strict
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
 * are separate concerns the caller layers on (e.g. via
 * `isFiniteNumberValue` / `isIntegerValue` / `isSafeIntegerValue` in
 * `@/config`).
 */
export type NumberValue = number;

/**
 * The boxed `Number` wrapper-object type — instances created via
 * `new Number(42)` or `Object(42)`. The `& object` intersection
 * excludes primitive numbers. Boxed numbers participate in arithmetic
 * via implicit coercion, but they differ from primitives on identity
 * (`===`) and on `typeof` (`'object'` vs `'number'`).
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
 * Narrows a value to the boxed `Number` wrapper-object form via four
 * cross-validating markers: the `isObject` gate from `@/object`, the
 * `[[Class]]` tag `'[object Number]'`, the constructor name `'Number'`,
 * and the spec-precise `[[NumberData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedNumberValueEquality}.
 *
 * Marker chain, composition, and cross-realm semantics match
 * {@link isBoxedString} — see that predicate's doc for the structural
 * rationale. The markers that distinguish this predicate from its
 * siblings are the tag/constructor-name pair (both `'Number'`) and the
 * `[[NumberData]]` slot probe, which uses `Object.is` rather than `===`
 * so that `new Number(NaN)` is correctly admitted.
 *
 * Generic in `T` per the family pattern. The narrow returns
 * `T & BoxedNumber`; `T = unknown` collapses to `BoxedNumber`.
 *
 * @typeParam T - the caller-side type of `value`; defaults to `unknown`
 * @param value - the value to test; omitted is treated as `undefined`,
 *  which is not a boxed number
 * @returns `true` when all four markers hold, narrowing `value` to
 *  `T & BoxedNumber`; `false` otherwise
 * @example
 * isBoxedNumber(new Number(42));   // true
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
 * and on `typeof` (`'object'` vs `'boolean'`). A subtle gotcha: every
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
 * Narrows a value to the boxed `Boolean` wrapper-object form via four
 * cross-validating markers: the `isObject` gate from `@/object`, the
 * `[[Class]]` tag `'[object Boolean]'`, the constructor name `'Boolean'`,
 * and the spec-precise `[[BooleanData]]` internal-slot probe via
 * {@link doesHaveStrictUnboxedBooleanValueEquality}.
 *
 * Marker chain, composition, and cross-realm semantics match
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
 * @returns `true` when all four markers hold, narrowing `value` to
 *  `T & BoxedBoolean`; `false` otherwise
 * @example
 * isBoxedBoolean(new Boolean(true));  // true
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
 * Marker chain, composition, and cross-realm semantics match
 * {@link isBoxedString} — see that predicate's doc for the structural
 * rationale. The `[[SymbolData]]` probe cross-checks the unboxed
 * primitive's `description` against the boxed value's `description` —
 * catching the own-property-shadowing tampering surface where a real
 * boxed Symbol has had its `description` getter overridden by an own
 * data property.
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
 * on identity (`===`) and on `typeof` (`'object'` vs `'bigint'`).
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
 * Marker chain, composition, and cross-realm semantics match
 * {@link isBoxedString} — see that predicate's doc for the structural
 * rationale.
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
