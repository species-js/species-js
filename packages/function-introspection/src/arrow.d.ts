/**
 * @module @species-js/function-introspection/arrow
 *
 * Arrow-function introspection — telling an arrow from the concise method it
 * otherwise resembles exactly.
 *
 * Nothing structural separates them. Both lack an own `prototype` and a
 * `[[Construct]]` slot, both report `[object Function]`, both name `Function` as
 * their constructor. The one slot that differs, `[[HomeObject]]`, cannot be
 * observed. That leaves `[[SourceText]]`, read through the realm-fixed
 * `Function.prototype.toString`.
 *
 * Only the head of that source is read, never the body. A method returning an
 * arrow is therefore classified by its own head.
 *
 * ## What the `is` prefix promises
 *
 * Every admission is proven rather than inferred. One shape source alone cannot
 * decide: `async(` opens an async arrow's parameter list, and it opens a concise
 * method named `async`. `isAsyncFunction` settles that one — a signal no caller
 * controls. These predicates never report a value as an arrow that is not one.
 *
 * {@link isArrowFunction} and {@link isAsyncArrowFunction} are mutually
 * exclusive, and {@link isAnyArrowFunction} is exactly their union.
 *
 * ## Boundaries
 *
 * - **Binding or wrapping hides an arrow.** A bound arrow, a Proxy-wrapped one
 *   and every built-in stringify to the anonymous `[native code]` form, which
 *   carries no head. Nothing source-based recovers the original, so all are
 *   refused.
 * - **A parameter named `async` is not the modifier.** `async => async` is a
 *   sync arrow whose parameter happens to be called `async`, and is reported as
 *   one. What follows the word distinguishes it, never the word itself.
 * - **Nothing is claimed about arity, parameter shape or the body.** Only the
 *   head is read, so destructured, defaulted and rest parameters are admitted
 *   exactly as plain ones are.
 * - **A comment in the header is fine, a newline often is not.** Comments may
 *   sit inside the parameter list, before `=>`, and after `async`. A
 *   LineTerminator may not precede `=>` or an async arrow's parameters, so in
 *   those slots only single-line block comments are legal.
 *
 * @example
 * ```ts
 * isArrowFunction((a) => a); // true
 * isAsyncArrowFunction(async (a) => a); // true
 * isAnyArrowFunction((x) => x); // true
 *
 * isAnyArrowFunction(({ m() { return (x) => x; } }).m); // false — a method
 * isAnyArrowFunction(function () {}); // false
 * isAnyArrowFunction(((a) => a).bind(null)); // false — bound, so hidden
 * ```
 */

/* @@throw-safe */
/**
 * Reports whether the source opens with a non-async arrow's head — either a
 * parenthesized parameter list, or a single bare parameter followed by `=>`.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfArrowFunctionSource(source: string): boolean;

/* @@throw-safe */
/**
 * Reports whether the source opens with an async arrow's head — `async`, then
 * either a parenthesized parameter list or a bare parameter followed by `=>`.
 *
 * Matching alone is not a verdict: a concise method named `async` wears the
 * same `async(` head, so the caller confirms with the spec-defined tag.
 *
 * @param source - a function's raw source text
 * @returns `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfAsyncArrowFunctionSource(source: string): boolean;

/* @@throw-safe */
/**
 * Narrows a value to a NON-async arrow function — `(a) => a`, `x => x`, and
 * every parameter shape in between.
 *
 * A leading `(` decides on its own, since no property key may be parenthesized.
 * A bare parameter is admitted only when `=>` follows it, which is what keeps a
 * concise method (`m() {}`) and an accessor (`get x() {}`) out.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is a non-async arrow function
 *
 * @example
 * ```ts
 * isArrowFunction((a) => a); // true
 * isArrowFunction(x => x); // true
 * isArrowFunction(({ a = 1 }, ...rest) => [a, rest]); // true
 * isArrowFunction(async => async); // true — a parameter NAMED `async`
 *
 * isArrowFunction(async (a) => a); // false — the async flavor
 * isArrowFunction(({ m() {} }).m); // false — a concise method
 * ```
 */
export function isArrowFunction(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Narrows a value to an async arrow function — `async (a) => a`, `async x => x`
 * and their unspaced spellings.
 *
 * `async(` is genuinely ambiguous in source, since a concise method may be
 * named `async` and wears the same head. `isAsyncFunction` resolves it: the
 * arrow is an async function, the method is not.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is an async arrow function
 *
 * @example
 * ```ts
 * isAsyncArrowFunction(async (a) => a); // true
 * isAsyncArrowFunction(async x => x); // true
 * isAsyncArrowFunction(async(x) => x); // true — no space needed
 *
 * isAsyncArrowFunction(({ async() {} }).async); // false — a method named `async`
 * isAsyncArrowFunction(async function () {}); // false
 * ```
 */
export function isAsyncArrowFunction(value?: unknown): boolean;

/* @@throw-safe */
/**
 * Narrows a value to an arrow function of either flavor.
 *
 * Exactly the union of {@link isArrowFunction} and
 * {@link isAsyncArrowFunction}: it reports `true` for a value either of them
 * accepts, and `false` otherwise. Deriving it from them rather than from a
 * pattern of its own is what keeps that equivalence true.
 *
 * @param value - the value to test; omitted is treated as `undefined`, which
 *  carries no source
 * @returns `true` when the value is an arrow function of either flavor
 *
 * @example
 * ```ts
 * isAnyArrowFunction((a) => a); // true
 * isAnyArrowFunction(async (a) => a); // true
 * isAnyArrowFunction(function () {}); // false
 * ```
 */
export function isAnyArrowFunction(value?: unknown): boolean;
