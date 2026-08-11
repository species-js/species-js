/**
 * @module @species-js/function-introspection/concise
 *
 * Concise-method introspection — which shorthand method definition, if any, a
 * function came from.
 *
 * A method is not structurally distinguishable from the function it resembles.
 * `[[HomeObject]]`, the slot only a method carries, cannot be observed. The
 * answer comes from `[[SourceText]]`, read through the realm-fixed
 * `Function.prototype.toString`, together with two signals a caller cannot
 * forge: the spec-defined tag, and the presence of an own `prototype`.
 *
 * Only the head of that source is read, never the body. A method whose body
 * contains an arrow is classified by its own head.
 *
 * ## What the `is` prefix promises
 *
 * Every admission is proven rather than inferred. Where one shape could belong
 * to two kinds, a signal no caller controls settles it. Where no such signal
 * exists, the answer is refused rather than guessed. These predicates never
 * report a value as a method that is not one, so every boundary below is a case
 * of silence rather than a wrong answer.
 *
 * The four flavors are mutually exclusive, and {@link isAnyConciseMethod} is
 * exactly their union.
 *
 * ## Boundaries
 *
 * Each is exotic, reached by naming a member after a keyword or by tampering
 * with a function after the fact. Each is written down all the same: a predicate
 * claiming certainty owes an account of where it stops.
 *
 * - **`async function(){}` is refused.** A method's key is an IdentifierName, so
 *   a method may be NAMED `function`. As an async method it then agrees with an
 *   anonymous async function expression on source, tag, own properties,
 *   prototype and `name`. Nothing remains to read, so neither is admitted. The
 *   non-async twin IS decided: a function expression is constructable and so
 *   carries an own `prototype`.
 * - **Binding or wrapping hides a method.** A bound method, a Proxy-wrapped one
 *   and `Function.prototype` all stringify to the anonymous `[native code]`
 *   form, which carries no head.
 * - **A method given an own `prototype` is refused.** That property cannot be
 *   removed from a function expression, which is what makes the boundary above
 *   decidable. It can be added to a method, and doing so costs recall rather
 *   than precision.
 * - **A comment in the header is fine, a newline sometimes is not.** After
 *   `async` a LineTerminator is a SyntaxError. Only horizontal whitespace and
 *   single-line block comments may follow it. Between a key and its parameter
 *   list, newlines and line comments are legal too.
 *
 * @example
 * ```ts
 * isPlainConciseMethod(({ foo() {} }).foo); // true
 * isConciseAsyncMethod(({ async foo() {} }).foo); // true
 * isConciseGeneratorMethod(({ *foo() {} }).foo); // true
 * isConciseAsyncGeneratorMethod(({ async *foo() {} }).foo); // true
 *
 * isAnyConciseMethod((a) => a); // false — an arrow
 * isAnyConciseMethod(function () {}); // false — a function expression
 * isAnyConciseMethod(({ foo() {} }).foo.bind(null)); // false — bound, so hidden
 * ```
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Source Head Recognizers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the source opens with the token `async`.
 *
 * The token, not the modifier — it may equally be a property key named `async`
 * or an arrow's parameter of that name. A key that merely begins with those
 * letters, such as `asyncFoo`, does not match.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesLeadingAsyncToken(source: string): boolean;

/* @@throw-safe */
/**
 * Reports whether the source opens with `async`, optional trivia, then `*`.
 *
 * The second significant token decides the flavor: a method puts `*` there, an
 * async generator function puts `function`. The two may be adjacent, since
 * `async*foo(){}` is legal.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfConciseAsyncGeneratorMethodSource(
  source: string,
): boolean;

/* @@throw-safe */
/**
 * Reports whether the source opens with `async`, mandatory trivia, a property
 * key, optional trivia, then `(`.
 *
 * Separation after `async` is required, since `asyncfoo()` is a method named
 * `asyncfoo`. A key of `function` is excluded by keyword boundary. The closing
 * `(` is what distinguishes a method from an async arrow.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfConciseAsyncMethodSource(source: string): boolean;

/* @@throw-safe */
/**
 * Reports whether the source opens with a property key, optional trivia, then
 * `(` — the unmodified method head. Every key spelling the grammar allows is
 * accepted: identifier, private, numeric in every literal form, quoted and
 * computed. The identifier branch covers combining marks, zero-width joiners
 * and unicode escapes.
 *
 * Necessary but not sufficient: an anonymous function expression, a
 * parenthesized async arrow and the anonymous `[native code]` form share this
 * shape and are settled by further reads.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfConciseMethodNormalForm(source: string): boolean;

/* @@throw-safe */
/**
 * Reports whether the source opens with the `function` keyword, optional
 * trivia, then `(` — an anonymous function expression's head, which a method
 * named `function` wears identically.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfUnnamedPlainFunctionSource(
  source: string,
): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Flavor Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition carrying no modifier —
 * `foo() {}` — in every key form: identifier, private, numeric, quoted and
 * computed.
 *
 * A method named `function` is admitted, because an own `prototype` separates
 * it from the function expression it resembles. A bound or Proxy-wrapped
 * callable wearing the same head is refused by its `[native code]` source.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is a plain concise method
 *
 * @example
 * ```ts
 * isPlainConciseMethod(({ foo() {} }).foo); // true
 * isPlainConciseMethod(({ ['k']() {} }).k); // true
 * isPlainConciseMethod(({ function() {} }).function); // true
 * isPlainConciseMethod(function () {}); // false
 * isPlainConciseMethod(({ async foo() {} }).foo); // false
 * ```
 */
export function isPlainConciseMethod(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition modified by `async` —
 * `async foo() {}`.
 *
 * A method may itself be named `async` (`async async() {}`) without being
 * mistaken for the modifier. A key of `function` is refused — that shape is
 * indistinguishable from an anonymous async function expression.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is a concise async method
 *
 * @example
 * ```ts
 * isConciseAsyncMethod(({ async foo() {} }).foo); // true
 * isConciseAsyncMethod(({ async async() {} }).async); // true
 * isConciseAsyncMethod(async (a) => a); // false — an async arrow
 * isConciseAsyncMethod(async function () {}); // false
 * ```
 */
export function isConciseAsyncMethod(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition modified by `*` —
 * `*foo() {}`.
 *
 * The key is never read. A generator function always opens with the `function`
 * keyword and carries its `*` after it, so a leading `*` belongs to a method and
 * to nothing else. Every key form and every spelling past the `*` is therefore
 * admitted, `*function(){}` included.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is a concise generator method
 *
 * @example
 * ```ts
 * isConciseGeneratorMethod(({ *foo() {} }).foo); // true
 * isConciseGeneratorMethod(function* () {}); // false
 * ```
 */
export function isConciseGeneratorMethod(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition modified by both `async` and
 * `*` — `async *foo() {}`.
 *
 * Both this flavor and an async generator function open with `async`, so the
 * second significant token decides: `*` for a method, `function` for a
 * function.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is a concise async generator method
 *
 * @example
 * ```ts
 * isConciseAsyncGeneratorMethod(({ async *foo() {} }).foo); // true
 * isConciseAsyncGeneratorMethod(async function* () {}); // false
 * ```
 */
export function isConciseAsyncGeneratorMethod(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition of any flavor.
 *
 * Exactly the union of the four: `true` for a value any one of them accepts,
 * `false` otherwise. It is derived from them rather than given a pattern of its
 * own, which is what keeps that equivalence true.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is a concise method of any flavor
 *
 * @example
 * ```ts
 * isAnyConciseMethod(({ foo() {} }).foo); // true
 * isAnyConciseMethod(({ async *foo() {} }).foo); // true
 * isAnyConciseMethod(({ async() {} }).async); // true — a method NAMED `async`
 * isAnyConciseMethod(async () => 1); // false — an async arrow
 * ```
 */
export function isAnyConciseMethod(value?: unknown): boolean;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
