// @ts-check

/**
 * @module @species-js/function-introspection/concise
 *
 * Concise-method introspection — which shorthand method definition, if any, a
 * function came from.
 *
 * A method is not structurally distinguishable from the function it resembles.
 * `[[HomeObject]]`, the slot only a method carries, cannot be observed. What
 * separates them is `[[SourceText]]`, read through the realm-fixed
 * `Function.prototype.toString`, together with two signals a caller cannot
 * forge: the spec-defined tag, and the presence of an own `prototype`.
 *
 * Every predicate reads the head only, never the body. The head is a key,
 * optionally behind `async`, `*`, or both, followed by the parameter list. A
 * method whose body contains an arrow is therefore classified by its own head.
 *
 * ## Reading order
 *
 * Each predicate matches the source before it consults a flavor tag. A tag is
 * cheap when it agrees and two orders of magnitude dearer when it refuses, so
 * the rule is **never let a flavor tag reject**: reach one only where the source
 * shape says it will agree.
 *
 * `isFunction` is the deliberate exception and runs first. It is a `typeof`
 * test, priced the same either way, and it keeps a non-callable away from
 * `getFunctionSource`, whose refusal costs a caught exception. Guarding
 * callability early and reaching a flavor tag late are separate rules.
 *
 * **Gate scoping.** `!hasOwnPrototype` and the native-source subtraction apply
 * to a `function` head alone. Only the anonymous function expression reaches the
 * plain pattern carrying an own `prototype`; everything else with one is already
 * refused by the pattern. Applied to every key, the gate cost recall on methods
 * that had merely been GIVEN one.
 *
 * ## Where the module stops
 *
 * `concise.d.ts` states the four boundaries for a consumer. Each is a case of
 * silence rather than a wrong answer, which is what earns the `is` prefix under
 * #090. Two of them shape this file. `async function(){}` is undecidable, since
 * a method may be NAMED `function` and then agrees with an anonymous async
 * function expression on every observable — so both are refused. And a method
 * named `async` is the single input that reaches a rejecting tag read, because
 * its head is also a parenthesized async arrow's.
 *
 * ## Header trivia
 *
 * The rules are position-dependent, so one trivia class cannot serve every slot.
 * After `async` a LineTerminator is a SyntaxError. After `*`, after `get`/`set`,
 * and between a key and its `(`, newlines and line comments are legal. The spec
 * carries the full table.
 *
 * Comment interiors match unrolled, never lazily. A lazy quantifier expands past
 * a later terminator and would swallow the code between two comments.
 *
 * ## What forgery cannot reach
 *
 * Redefining `name` changes nothing, because no predicate reads it. Installing
 * an own `toString` changes nothing, because the source comes from the
 * realm-fixed intrinsic. Neither the tag nor an own `prototype` is writable.
 *
 * Vectors, laws and the measurements behind the reading order live in
 * `docs/spec/CONCISE.spec.md`.
 */

import {
  hasOwnPrototype,
  getFunctionSource,
  isFunction,
  isAsyncFunction,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
} from '@species-js/type-detection';

import {
  CONDENSED_NATIVE_SOURCE_FOUNDATION,
  getFunctionSourceCondensate,
} from '#utility';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Source Head Recognizers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Reports whether the source opens with the token `async`.
 *
 * The token, not the modifier — it may equally be a property KEY named `async`
 * or an arrow's parameter of that name. The name says only what the pattern can
 * see, deliberately: an earlier name claimed async-ness and invited the reading
 * that anything failing it cannot be a method, which is false for
 * `({ async(){} }).async`.
 *
 * `\b` keeps a key that merely BEGINS with those letters out — `asyncFoo(){}`
 * does not match, and so never pays the async branch's costs.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesLeadingAsyncToken(source) {
  return /^async\b/.test(source);
}

/* @@throw-safe */
/**
 * Reports whether the source opens with `async`, optional trivia, then `*`.
 *
 * The second significant token is what decides: a METHOD puts `*` there, an
 * async generator FUNCTION puts `function`. Everything past the `*` is
 * irrelevant, so every key form is admitted without being read.
 *
 * The trivia is zero-or-more because `async*foo(){}` is legal — the opposite of
 * the async-to-key slot, where separation is mandatory.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfConciseAsyncGeneratorMethodSource(source) {
  // see ... https://regex101.com/r/AXSEW0/5
  // delete workspace https://regex101.com/delete/nsan2mVvhI25SsbkaD3bi1CKgd69KDKqmZfp
  // delete version https://regex101.com/delete/5/OlwLcW1tGv3FESuyS6zmatchp9BDSt5yMLmt

  return /^async(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*\*/.test(source);
}

/* @@throw-safe */
/**
 * Reports whether the source opens with `async`, mandatory trivia, a property
 * key, optional trivia, then `(`.
 *
 * The trivia after `async` is one-or-more, because `asyncfoo()` is a method
 * NAMED `asyncfoo` rather than an async method named `foo`.
 *
 * A key of `function` is excluded by keyword boundary, which is what refuses
 * `async function(){}` — the undecidable pair — while still admitting
 * `async functionFoo(){}`.
 *
 * The closing `(` is what separates a method from an async ARROW: `async x => x`
 * reaches the same identifier and then finds `=>`.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfConciseAsyncMethodSource(source) {
  // see ... https://regex101.com/r/AXSEW0/4
  // delete workspace https://regex101.com/delete/nsan2mVvhI25SsbkaD3bi1CKgd69KDKqmZfp
  // delete version https://regex101.com/delete/4/q7RA5beBkjUI4Z0vbxZitajYrbCJtMi4cn58

  return /^async(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)+(?!function\b)(?:#?(?:[$_\p{ID_Start}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))(?:[$\u200C\u200D\p{ID_Continue}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))*|(?:\.\p{Nd}+|\p{Nd}[\p{Nd}\p{L}_]*(?:\.\p{Nd}*)?(?:[eE][+-]?\p{Nd}+)?)|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\[[\s\S]*\])(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*\(/u.test(
    source,
  );
}

/* @@throw-safe */
/**
 * Reports whether the source opens with a property key, optional trivia, then
 * `(` — the unmodified method head, in every key spelling the grammar allows:
 * identifier, private, numeric, quoted and computed.
 *
 * The identifier branch uses `ID_Start` / `ID_Continue` rather than a
 * hand-rolled letter class, since an identifier legally carries combining
 * marks and zero-width joiners and may be written with unicode escapes that
 * `toString` reports verbatim. The numeric branch is separate because a KEY may
 * begin with a digit where a parameter may not — which is why the sibling
 * `arrow` module cannot share this class. It covers every legal spelling,
 * including the three a narrower pattern missed: `.5`, `1e-3` and `1.`.
 *
 * NECESSARY but not sufficient. Three non-methods share this shape and are each
 * settled downstream: an anonymous function expression (`function(){}`), a
 * parenthesized async arrow (`async (a) => a`), and the anonymous
 * `[native code]` form worn by bound and Proxy-wrapped callables.
 *
 * What it does refuse outright is everything with something BETWEEN the first
 * token and the `(` — accessors (`get x(`), async methods (`async foo(`), named
 * natives (`function max(`) — plus arrows, generator methods and classes.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfConciseMethodNormalForm(source) {
  // see ... https://regex101.com/r/AXSEW0/3
  // delete workspace https://regex101.com/delete/nsan2mVvhI25SsbkaD3bi1CKgd69KDKqmZfp
  // delete version https://regex101.com/delete/3/3yel6KZMOkxkd9ttnkEhhFqFrgUDhSvC4Nxn

  return /^(?:#?(?:[$_\p{ID_Start}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))(?:[$\u200C\u200D\p{ID_Continue}]|\\u(?:[0-9a-fA-F]{4}|\{[0-9a-fA-F]+\}))*|(?:\.\p{Nd}+|\p{Nd}[\p{Nd}\p{L}_]*(?:\.\p{Nd}*)?(?:[eE][+-]?\p{Nd}+)?)|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\[[\s\S]*\])(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/[^\n]*(?:\n|$))*\(/u.test(
    source,
  );
}

/* @@throw-safe */
/**
 * Reports whether the source opens with the `function` keyword, optional
 * trivia, then `(` — an anonymous function expression's head.
 *
 * A method NAMED `function` wears exactly this shape, which is the point. The
 * helper marks the one head where the source has said all it can. From there
 * the caller looks at `prototype` and the native-source form to finish the
 * question.
 *
 * @param {string} source - a function's raw source text
 * @returns {boolean} `true` when the source opens with that sequence
 *
 * @internal
 */
export function matchesStartSequencesOfUnnamedPlainFunctionSource(source) {
  return /^function(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/|\/\/[^\n]*(?:\n|$))*\(/.test(source);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Flavor Predicates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition carrying no modifier —
 * `foo() {}`, and every key form it may take.
 *
 * One entrance-level read runs before the source is touched — a non-function.
 * Everything else is decided from the source first, and the costly reads are
 * reached only where they can succeed.
 *
 * Async values are refused by the pattern rather than by a gate. An async
 * method, an async generator method, an async function expression and a
 * bare-parameter async arrow all fail `key` + `(` on their own. The single
 * exception is a PARENTHESISED async arrow — `async (a) => a` wears exactly the
 * head of a method named `async` — so `isAsyncFunction` is consulted there and
 * nowhere else.
 *
 * Past that, a key followed by a parameter list is enough for every key except
 * one. `function` is the exception: a method may be NAMED `function`, which
 * puts its source into the shape of a function expression, and that shape is
 * the only place further evidence is needed. It is read there and nowhere else:
 *
 * - **an own `prototype`** separates a function expression, which is
 *   constructable and always carries one. The property is `configurable: false`
 *   where it exists, so it can never be stripped to defeat this.
 * - **the anonymous `[native code]` form** separates a bound function, a
 *   Proxy-wrapped callable and `Function.prototype`, none of which has an own
 *   `prototype` either. Authored source cannot reproduce that form.
 * - **a NAMED native** (`function max() { … }`) never reaches the check at all,
 *   since its name sits between the keyword and the `(` and the pattern
 *   declines it on shape.
 *
 * Scoping both reads to that one head is deliberate. Applied to every key they
 * would also refuse a method that had merely been GIVEN a `prototype` after the
 * fact. That tampering costs recall for no gain, since only the `function` head
 * is ambiguous in the first place. The cost is now confined to a method named
 * `function` that has also been tampered with.
 *
 * The source is read once and reused, so the condensing pass runs only for the
 * `function` head rather than on every candidate.
 *
 * Composed entirely from throw-safe readers, so a source that cannot be
 * produced arrives as `undefined` and is answered rather than propagated.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is a plain concise method
 */
export function isPlainConciseMethod(value) {
  if (!isFunction(value)) {
    return false;
  }
  const source = getFunctionSource(value) ?? '';

  if (!matchesStartSequencesOfConciseMethodNormalForm(source)) {
    return false;
  }
  // A parenthesized async ARROW is the only async form that survives
  // the above pattern — its head is indistinguishable from a method
  // named `async`. The following prefix test keeps this rejecting
  // tag-read off every other key's path.
  if (matchesLeadingAsyncToken(source) && isAsyncFunction(value)) {
    return false;
  }

  if (!matchesStartSequencesOfUnnamedPlainFunctionSource(source)) {
    return true;
  }
  return (
    !hasOwnPrototype(value) &&
    getFunctionSourceCondensate(source) !== CONDENSED_NATIVE_SOURCE_FOUNDATION
  );
}

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition modified by `async` —
 * `async foo() {}`.
 *
 * `isAsyncFunction` carries the whole async claim, so the pattern never has to
 * infer it from the head. That is why a method may be named `async` here
 * (`async async() {}`) without being mistaken for the modifier.
 *
 * A key of `function` is refused — the module's one refusal of a genuine case.
 * `async function(){}` is produced BOTH by a method named `function` and by an
 * anonymous async function expression. The two agree on source, tag,
 * own-property set, prototype and `name`, which NamedEvaluation sets
 * identically. With nothing left to read, silence is the
 * only honest answer. The guard is a keyword boundary rather than a shape, so
 * `async functionFoo(){}` still passes while `async function foo(){}` is
 * refused on its own terms.
 *
 * The key still has to be followed by a parameter list, and that requirement is
 * what separates a method from an async ARROW — `async x => x` reaches the same
 * identifier and then finds `=>` instead of `(`. Deferring to the sibling
 * module's `isAsyncArrowFunction` would read more simply, and is deliberately
 * NOT done. Consuming another predicate through `!` turns its false negatives
 * into this one's false positives. That predicate has a known identifier gap:
 * an async arrow whose parameter carries a zero-width joiner, a combining mark
 * or a unicode escape would be admitted here as a method.
 *
 * Trivia is accepted in both slots — after `async`, where only horizontal
 * whitespace and single-line block comments are legal, and before the `(`.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is a concise async method
 */
export function isConciseAsyncMethod(value) {
  // Source shape first, tag check last — see `isConciseGeneratorMethod`. An
  // async ARROW never reaches the tag check: its head has no key before the
  // `(`, so the pattern declines it first.
  return (
    isFunction(value) &&
    matchesStartSequencesOfConciseAsyncMethodSource(getFunctionSource(value) ?? '') &&
    isAsyncFunction(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition modified by `*` —
 * `*foo() {}`.
 *
 * The key is not read at all — a single leading `*` decides. A generator
 * FUNCTION always opens with the `function` keyword and carries its `*` after
 * it (`function*`, `function *`), so within the `GeneratorFunction` tag a
 * leading `*` belongs to a method and to nothing else. Every key form is
 * therefore admitted for free, `*function(){}` included, and so is every
 * spelling of whatever follows the `*` — a comment, a newline, a private or
 * computed key.
 *
 * The tag alone would not do: a bound generator method and a Proxy-wrapped one
 * both KEEP `[object GeneratorFunction]` while stringifying to the anonymous
 * `[native code]` form. It is the leading `*` that excludes them.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is a concise generator method
 */
export function isConciseGeneratorMethod(value) {
  // The tag check runs LAST, behind the source shape. These tag predicates are
  // cheap when they succeed and expensive when they reject, so reaching one
  // only where it will succeed is worth far more than saving a source read.
  return (
    isFunction(value) &&
    (getFunctionSource(value) ?? '').startsWith('*') &&
    isGeneratorFunction(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition modified by both `async` and
 * `*` — `async *foo() {}`.
 *
 * The key is not read here either. Both this flavor and an async generator
 * FUNCTION open with `async`, so unlike the plain generator the first token is
 * not enough. The SECOND significant one is: a method puts `*` there, a
 * function puts `function`. Confirming that settles it, and everything past the
 * `*` is admitted for free.
 *
 * The two may sit directly adjacent (`async*foo(){}` is legal), so the trivia
 * between them is zero-or-more. That is the opposite of the async-to-key slot
 * in {@link isConciseAsyncMethod}, where separation is mandatory — `asyncfoo()`
 * is a method NAMED `asyncfoo`, not an async method named `foo`.
 *
 * Only horizontal whitespace and single-line block comments can occupy the
 * slot: a LineTerminator after `async` is a SyntaxError, which rules out bare
 * newlines, line comments, and block comments containing a newline. The comment
 * interior is written unrolled rather than lazily, because a lazy quantifier
 * still expands across a later comment terminator and would swallow real code
 * between two comments.
 *
 * As with the plain generator, a bound or Proxy-wrapped async generator method
 * keeps `[object AsyncGeneratorFunction]`; the anchored `async…*` is what
 * excludes it.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is a concise async generator method
 */
export function isConciseAsyncGeneratorMethod(value) {
  // Source shape first, tag check last — see `isConciseGeneratorMethod`.
  return (
    isFunction(value) &&
    matchesStartSequencesOfConciseAsyncGeneratorMethodSource(
      getFunctionSource(value) ?? '',
    ) &&
    isAsyncGeneratorFunction(value)
  );
}

/* @@throw-safe */
/**
 * Narrows a value to a shorthand method definition of any flavor.
 *
 * The disjunction of the four, never a fifth pattern of its own. A separate
 * pattern would have to be kept in step with all four by hand; derived, the
 * union law holds by construction and the four boundaries above are inherited
 * exactly. The spec records what hand-maintenance cost when it was tried.
 *
 * @param {unknown} [value] - the value to test; omitted is treated as
 *  `undefined`, which carries no source
 * @returns {boolean} `true` when the value is a concise method of any flavor
 */
export function isAnyConciseMethod(value) {
  if (!isFunction(value)) {
    return false;
  }
  const source = getFunctionSource(value) ?? '';

  // Source shape first, tag check sequence after — see `isConciseGeneratorMethod`.

  // concise generator-function test-block
  if (source.startsWith('*')) {
    return isGeneratorFunction(value);
  }

  // concise async generator-function and async-function test-block
  if (matchesLeadingAsyncToken(source)) {
    if (matchesStartSequencesOfConciseAsyncGeneratorMethodSource(source)) {
      return isAsyncGeneratorFunction(value);
    }
    // - please DO NOT alter/change any of
    //   the implemented logic of the next
    //   following code within this clause.

    const isAsyncFct = isAsyncFunction(value);

    if (matchesStartSequencesOfConciseAsyncMethodSource(source)) {
      return isAsyncFct;
    }
    if (isAsyncFct) {
      // async arrow-function case
      return false;
    }
  }

  // plain concise method test-block

  if (!matchesStartSequencesOfConciseMethodNormalForm(source)) {
    return false;
  }
  if (!matchesStartSequencesOfUnnamedPlainFunctionSource(source)) {
    return true;
  }
  return (
    !hasOwnPrototype(value) &&
    getFunctionSourceCondensate(source) !== CONDENSED_NATIVE_SOURCE_FOUNDATION
  );
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
