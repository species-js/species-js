// @ts-check

/**
 * @module @species-js/function-introspection/arrow
 *
 * Arrow-function introspection — telling an arrow from the concise method it
 * otherwise resembles exactly.
 *
 * Nothing structural separates them. Both lack an own `prototype` and a
 * `[[Construct]]` slot, both report `[object Function]`, both name `Function`
 * as their constructor. The one slot that differs, `[[HomeObject]]`, cannot be
 * observed. That leaves `[[SourceText]]`, read through the realm-fixed
 * `Function.prototype.toString`.
 *
 * ## The head decides
 *
 * Only the head is read, never the body. A method that returns an arrow is
 * classified by its own head.
 *
 * An arrow's head is a parameter list followed by `=>`, optionally behind
 * `async`. A property key can never be parenthesized, so a leading `(` settles
 * the question alone. The parameter list is never scanned, which is why this
 * module needs no lexer, no paren balancing and no regex-literal handling.
 *
 * One shape defeats source by itself. `async(` opens an async arrow's parameter
 * list, and it opens a concise method named `async`. `isAsyncFunction` decides:
 * the arrow is an async function, the method is not.
 *
 * ## Reading order
 *
 * Both predicates match the source before they consult a flavor tag. A tag is
 * cheap when it agrees and expensive when it refuses, so the pattern discharges
 * a non-arrow first. `isFunction` is the exception and runs ahead of everything:
 * it is a `typeof` test, and it keeps a non-callable away from
 * `getFunctionSource`, whose refusal costs a caught exception.
 *
 * A method named `async` still pays one rejecting read. Its head IS an async
 * arrow's, so nothing cheaper can separate them.
 *
 * ## Header trivia, and what a parameter may be called
 *
 * A comment may sit inside the parameter list, before `=>`, and after `async`.
 * A LineTerminator may not, so only single-line block comments appear in those
 * slots. The `//` branch is kept for symmetry with `concise`, whose key slot
 * does admit one.
 *
 * A bare parameter matches `ID_Start` / `ID_Continue`. An identifier may carry
 * combining marks and zero-width joiners, and may be written with unicode
 * escapes that `toString` reports verbatim; a hand-rolled letter class refused
 * all of them silently. `concise` needs a wider class again, since a key may
 * begin with a digit where a parameter may not.
 *
 * Vectors, laws and the measurements behind the reading order live in
 * `docs/spec/ARROW.spec.md`.
 */

import {
  isFunction,
  isAsyncFunction,
  getFunctionSource,
} from '@species-js/type-detection';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the source opens with a non-async arrow's head — either a
 * parenthesized parameter list, or a single bare parameter followed by `=>`.
 *
 * The leading `(` needs no confirmation: nothing else reaching this test can
 * open that way. The bare-parameter branch is what refuses a concise method
 * (`m() {}`) and an accessor (`get x() {}`), since both put something other
 * than `=>` after the first identifier.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfArrowFunctionSource(source) {
  // see ... https://regex101.com/r/XY0K3l/7
  // delete workspace https://regex101.com/delete/1nX1rHFg1Th1YE2II9XMQg73lCiuy4L6GkdV
  // delete version https://regex101.com/delete/7/GFlqFW6dw0l0QDupWVW6BGr0DJHeVD9oGcy6

  return /^(?:\(|(?:[$_\p{ID_Start}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))(?:[$\u200C\u200D\p{ID_Continue}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))*(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/[^\n]*(?:\n|$))*=>)/u.test(
    source,
  );
}

/* @@throw-safe */
/**
 * Reports whether the source opens with an async arrow's head — `async`, then
 * either a parenthesized parameter list or a bare parameter followed by `=>`.
 *
 * The trivia before a parenthesized list is zero-or-more, since `async(x)=>x`
 * is legal; before a bare parameter it is one-or-more, since `asyncx` would
 * otherwise read as a single identifier.
 *
 * Matching alone is not a verdict: a concise method named `async` wears the
 * same `async(` head, so the caller confirms with `isAsyncFunction`.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfAsyncArrowFunctionSource(source) {
  // see ... https://regex101.com/r/XY0K3l/8
  // delete workspace https://regex101.com/delete/1nX1rHFg1Th1YE2II9XMQg73lCiuy4L6GkdV
  // delete version https://regex101.com/delete/8/rimR46dVMDqR8lU1n4rE94EPjlwmtYoTsoW4

  return /^(?:async(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/[^\n]*(?:\n|$))*\(|async(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/[^\n]*(?:\n|$))+(?:[$_\p{ID_Start}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))(?:[$\u200C\u200D\p{ID_Continue}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))*(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/[^\n]*(?:\n|$))*=>)/u.test(
    source,
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to a NON-async arrow function.
 *
 * The pattern carries the whole verdict — beyond the entrance-level no tag is
 * read at all, because a leading `(` or `ident =>` belongs to nothing else. An
 * async arrow is refused by that same pattern rather than by a gate: its head
 * leads with `async`, which the bare-parameter branch declines because `=>`
 * does not follow the identifier.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is a non-async arrow function
 */
export function isArrowFunction(value) {
  return (
    isFunction(value) &&
    matchesStartSequencesOfArrowFunctionSource(getFunctionSource(value) ?? '')
  );
}

/* @@throw-safe */
/**
 * Narrows a value to an async arrow function.
 *
 * The source shape decides first and the tag read confirms. The pattern cannot
 * establish async-ness by itself, since a concise method named `async` wears
 * the same head, so `isAsyncFunction` keeps the last word. Asking it last
 * changes only where it is reached: the anchored `^async` discharges every
 * other callable for the price of a string compare, and the costly rejecting
 * read never runs on a value that could not have matched.
 *
 * A method NAMED `async` is the one value that still pays that read. Its head IS
 * an async arrow's, so nothing cheaper separates them.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is an async arrow function
 */
export function isAsyncArrowFunction(value) {
  return (
    isFunction(value) &&
    matchesStartSequencesOfAsyncArrowFunctionSource(getFunctionSource(value) ?? '') &&
    isAsyncFunction(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to an arrow function of either flavor — exactly the union of
 * {@link isArrowFunction} and {@link isAsyncArrowFunction}.
 *
 * Derived from the two rather than given a pattern of its own, so the
 * equivalence cannot drift.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is an arrow function of either
 *  flavor
 */
export function isAnyArrowFunction(value) {
  // The order is free: both operands refuse on the source shape before either
  // reaches a flavor tag. It was not free before the source-first rewrite, and
  // the spec records what it cost. Sync stays first as the commoner flavor.
  return isArrowFunction(value) || isAsyncArrowFunction(value);
}
