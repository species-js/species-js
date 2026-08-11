// @ts-check

/**
 * @module test/concise/__config
 *
 * The `concise` module's vector corpus — candidates for the four flavor
 * predicates (generic, async, generator, async generator) and the union
 * predicate over them.
 *
 * Rows are `[kind, description, source]` and carry SOURCE TEXT rather than
 * literals, materialized through {@link materialize}. The spelling is the thing
 * under test, and prettier would rewrite a literal into a different vector.
 * Same convention as `test/arrow/__config.js`.
 *
 * ## The header grammar, established empirically
 *
 * A method's `[[SourceText]]` begins at its first modifier or its key — a
 * comment written BEFORE that is not part of it. Past that point the trivia
 * rules are position-dependent, and the asymmetry is the whole difficulty:
 *
 * - **After `async` a LineTerminator is forbidden.** `async\nfoo() {}`,
 *   `async // c\nfoo() {}` and `async\n*foo() {}` are all SyntaxErrors, so only
 *   a single-line block comment can occupy that slot. This is the same
 *   restriction the arrow header carries.
 * - **Everywhere else full trivia is legal** — after `*`, after `get` / `set`,
 *   and between the key and `(`. Newlines, line comments and multi-line block
 *   comments are all permitted there, so `foo // c\n() {}` and
 *   `foo /*\n\n//\n\n* / () {}` are real methods. A pattern tuned to the arrow
 *   header, which never has to accept a newline, is too strict here.
 *
 * ## Two collisions with a function expression
 *
 * A method may be named `function`, which puts its source into the shape of a
 * function expression:
 *
 * - **Plain — decidable.** `({ function(){} }).function` and
 *   `(function(){})` stringify identically to `function(){}`, but the method
 *   has no own `prototype` and the function expression does. `hasOwnPrototype`
 *   is the discriminator, the way `isAsyncFunction` is for the arrow module.
 * - **Async — UNDECIDABLE.** `({ async function(){} }).function` and
 *   `(async function(){})` agree on source (`async function(){}`), on
 *   `[object AsyncFunction]`, AND on having no own `prototype`. `name` does not
 *   separate them either: an anonymous async function expression assigned to a
 *   property named `function` also reports `'function'`. Recorded in
 *   {@link UNDECIDABLE_PAIRS} so the boundary is pinned rather than discovered
 *   later.
 *
 * The generator flavors have no such collision — a generator method leads with
 * `*` where a generator function leads with `function*`.
 *
 * ## Accessors — a role, not a kind (SETTLED)
 *
 * A getter or setter is a **descriptor slot**, and the slot accepts any
 * callable at all: an arrow, a function expression, a generator, a native, a
 * bound function, a `Proxy`, even a class constructor — which is accepted when
 * the property is defined and throws only when it is read. So "getter" names
 * where a function was installed, never what the function is. These predicates
 * receive a value and never a descriptor, so the role is not observable from
 * the argument and is deliberately not modelled. There is no accessor flavor
 * and no fifth predicate.
 *
 * The two halves of that ruling are tested separately, and they pull in
 * opposite directions:
 *
 * - **{@link ACCESSOR_SYNTAX_VECTORS} — always rejected.** A function created
 *   BY accessor syntax (`get x() {}`, `set x(v) {}`) is a `MethodDefinition`
 *   but none of the four flavors. Rejecting it is load-bearing rather than
 *   incidental: it has no own `prototype` and reports `[object Function]`, so
 *   neither `hasOwnPrototype` nor the tag excludes it — **only the source
 *   pattern does**. Every accessor source carries a PropertyName between the
 *   keyword and the `(` (`get x(`, `get ['x'](`, `get 'x'(`, `get 1(`,
 *   `get get(`), which is exactly what separates it from a method NAMED `get`,
 *   where a `(` follows directly. No gate is needed; source alone decides.
 *   Accessors can be neither async nor generators — `async get x() {}`,
 *   `*get x() {}` and `get *x() {}` are all SyntaxErrors — so there are exactly
 *   two shapes to reject.
 * - **{@link ACCESSOR_SLOT_VECTORS} — classified on their own merits.** A
 *   descriptor written in concise-method syntax installs a genuine concise
 *   method as the accessor, so `{ get() { return 1; } }` passed to
 *   `defineProperty` yields a plain concise method that happens to be a
 *   getter. It must still be recognized as the flavor it is. A row's kind is
 *   therefore whatever the installed value actually is, never `NOT_CONCISE`
 *   merely because it sits in an accessor slot.
 *
 * A private accessor is absent by necessity, not oversight: its function cannot
 * be reached from outside the class, so it cannot be made into a vector.
 */

import { foreignRealmEval } from '../_cross-realm.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Expected Classifications
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** A shorthand method with no modifier — `foo() {}`. */
export const CONCISE_PLAIN = 'plain concise method';

/** A shorthand method modified by `async` — `async foo() {}`. */
export const CONCISE_ASYNC = 'concise async method';

/** A shorthand method modified by `*` — `*foo() {}`. */
export const CONCISE_GENERATOR = 'concise generator method';

/** A shorthand method modified by both — `async *foo() {}`. */
export const CONCISE_ASYNC_GENERATOR = 'concise async generator method';

/** None of the four — the union predicate reports `false`. */
export const NOT_CONCISE = 'not a concise method';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Builds a candidate from its source text in this realm.
 *
 * @param {string} source - the expression to evaluate
 * @returns {unknown} the resulting value
 */
export function materialize(source) {
  return /** @type {unknown} */ (eval(source));
}

/**
 * Builds a candidate in the shared foreign realm.
 *
 * @param {string} source - the expression to evaluate
 * @returns {unknown} the resulting value
 */
export function materializeForeign(source) {
  return /** @type {unknown} */ (foreignRealmEval(source));
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Corpus
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Candidates evaluated in this realm.
 *
 * @type {[string, string, string][]}
 */
export const CONCISE_VECTORS = [
  // ----- the four flavors, plainest spelling
  [CONCISE_PLAIN, 'plain', '({ foo() {} }).foo'],
  [CONCISE_ASYNC, 'async', '({ async foo() {} }).foo'],
  [CONCISE_GENERATOR, 'generator', '({ *foo() {} }).foo'],
  [CONCISE_ASYNC_GENERATOR, 'async generator', '({ async *foo() {} }).foo'],

  // ----- spacing around the modifiers
  [CONCISE_PLAIN, 'plain, tight', '({ foo(){} }).foo'],
  [CONCISE_GENERATOR, 'generator, star tight to key', '({ *foo(){} }).foo'],
  [CONCISE_GENERATOR, 'generator, space after star', '({ * foo() {} }).foo'],
  [CONCISE_GENERATOR, 'generator, newline after star', '({ *\nfoo() {} }).foo'],
  [
    CONCISE_ASYNC_GENERATOR,
    'async generator, spaces around star',
    '({ async * foo() {} }).foo',
  ],
  [CONCISE_ASYNC_GENERATOR, 'async generator, star tight', '({ async *foo(){} }).foo'],

  // ----- trivia between the key and the parameter list: FULL trivia is legal
  [CONCISE_PLAIN, 'block comment key -> paren', '({ foo /* c */ () {} }).foo'],
  [
    CONCISE_PLAIN,
    'two block comments key -> paren',
    '({ foo /* a */ /* b */ () {} }).foo',
  ],
  [
    CONCISE_PLAIN,
    'multi-line comment key -> paren',
    '({ foo /*\n\n//\n\n*/ () {} }).foo',
  ],
  [CONCISE_PLAIN, 'line comment key -> paren', '({ foo // c\n () {} }).foo'],
  [CONCISE_PLAIN, 'bare newline key -> paren', '({ foo\n() {} }).foo'],
  [CONCISE_PLAIN, 'comment inside the parameter list', '({ foo(/* c */) {} }).foo'],
  [CONCISE_PLAIN, 'comment between params and body', '({ foo() /* c */ {} }).foo'],
  [
    CONCISE_PLAIN,
    'comment interior holds a slash-star',
    '({ foo /* a * / b */ () {} }).foo',
  ],
  [CONCISE_GENERATOR, 'generator, comment key -> paren', '({ *foo /* c */ () {} }).foo'],

  // ----- trivia after `async`: ONLY a single-line block comment is legal
  [CONCISE_ASYNC, 'comment async -> key', '({ async /* c */ foo() {} }).foo'],
  [CONCISE_ASYNC_GENERATOR, 'comment async -> star', '({ async /* c */ *foo() {} }).foo'],
  [CONCISE_ASYNC_GENERATOR, 'comment star -> key', '({ async * /* c */ foo() {} }).foo'],
  [
    CONCISE_ASYNC_GENERATOR,
    'comments in every modifier slot',
    '({ async /* a */ * /* b */ foo /* c */ () {} }).foo',
  ],

  // ----- key forms
  [CONCISE_PLAIN, 'string key', "({ 'k'() {} })['k']"],
  [CONCISE_PLAIN, 'string key holding a space', "({ 'a b'() {} })['a b']"],
  [CONCISE_PLAIN, 'numeric key', '({ 1() {} })[1]'],
  [CONCISE_PLAIN, 'float key', '({ 1.5() {} })[1.5]'],
  [CONCISE_PLAIN, 'computed key', "({ ['c']() {} }).c"],
  [CONCISE_PLAIN, 'computed key, comment inside', "({ [/* c */ 'c']() {} }).c"],
  [CONCISE_PLAIN, 'computed key, expression', "({ ['a' + 'b']() {} }).ab"],
  [CONCISE_PLAIN, 'computed key holding a bracket', "({ ['a]b']() {} })['a]b']"],
  [CONCISE_PLAIN, 'computed key holding a bracket pair', "({ ['a[]b']() {} })['a[]b']"],
  [
    CONCISE_PLAIN,
    'computed key, call expression',
    '({ [Symbol.for("x")]() {} })[Symbol.for("x")]',
  ],
  [
    CONCISE_PLAIN,
    'computed key, body holds a bracketed call',
    "({ ['x']() { return [0].at(0); } })['x']",
  ],
  [CONCISE_PLAIN, 'string key with an escaped quote', "({ 'a\\'b'() {} })[\"a'b\"]"],
  [CONCISE_PLAIN, 'hex numeric key', '({ 0x10() {} })[16]'],
  [CONCISE_PLAIN, 'exponent numeric key', '({ 1e3() {} })[1000]'],
  [CONCISE_PLAIN, 'separator numeric key', '({ 1_000() {} })[1000]'],
  [CONCISE_PLAIN, 'method named __proto__', '({ __proto__() {} }).__proto__'],

  // ----- numeric key spellings the grammar allows, all verified legal
  [CONCISE_PLAIN, 'leading-dot float key', '({ .5() {} })[0.5]'],
  [CONCISE_PLAIN, 'negative-exponent key', '({ 1e-3() {} })[0.001]'],
  [CONCISE_PLAIN, 'trailing-dot key', '({ 1.() {} })[1]'],
  [CONCISE_PLAIN, 'binary key', '({ 0b101() {} })[5]'],
  [CONCISE_PLAIN, 'octal key', '({ 0o17() {} })[15]'],
  [CONCISE_PLAIN, 'bigint-suffixed key', '({ 1n() {} })[1]'],

  // ----- identifier spellings a narrow letter class silently refused
  [CONCISE_PLAIN, 'ZWNJ in key', '({ a\u200Cb() {} })["a\u200Cb"]'],
  [CONCISE_PLAIN, 'ZWJ in key', '({ a\u200Db() {} })["a\u200Db"]'],
  [CONCISE_PLAIN, 'combining-mark key', '({ e\u0301() {} })["e\u0301"]'],
  [CONCISE_PLAIN, 'devanagari key', '({ \u0915\u093F() {} })["\u0915\u093F"]'],
  [CONCISE_ASYNC, 'async, ZWNJ in key', '({ async a\u200Cb() {} })["a\u200Cb"]'],
  [CONCISE_GENERATOR, 'generator, combining-mark key', '({ *e\u0301() {} })["e\u0301"]'],
  [CONCISE_PLAIN, 'symbol key', '({ [Symbol.iterator]() {} })[Symbol.iterator]'],
  [CONCISE_PLAIN, 'unicode key', '({ ä() {} }).ä'],
  [CONCISE_PLAIN, 'dollar key', '({ $() {} }).$'],
  [CONCISE_PLAIN, 'underscore key', '({ _() {} })._'],

  // ----- keyword-shaped names, each of which puts a keyword at the head
  [CONCISE_PLAIN, 'named async', '({ async() {} }).async'],
  [CONCISE_PLAIN, 'named get', '({ get() {} }).get'],
  [CONCISE_PLAIN, 'named set', '({ set() {} }).set'],
  [CONCISE_PLAIN, 'named static', '({ static() {} }).static'],
  [CONCISE_PLAIN, 'named class', '({ class() {} }).class'],
  [CONCISE_PLAIN, 'named new', '({ new() {} }).new'],
  [CONCISE_PLAIN, 'named let', '({ let() {} }).let'],
  [CONCISE_PLAIN, 'named yield', '({ yield() {} }).yield'],
  [CONCISE_PLAIN, 'named await', '({ await() {} }).await'],
  [CONCISE_PLAIN, 'named constructor', '({ constructor() {} }).constructor'],
  [CONCISE_ASYNC, 'async, named await', '({ async await() {} }).await'],
  [CONCISE_GENERATOR, 'generator, named yield', '({ *yield() {} }).yield'],
  [CONCISE_ASYNC, 'async, named async', '({ async async() {} }).async'],
  [
    CONCISE_PLAIN,
    'named asyncFoo — a key merely STARTING with async',
    '({ asyncFoo() {} }).asyncFoo',
  ],
  [
    CONCISE_PLAIN,
    'named functionFoo — a key merely STARTING with function',
    '({ functionFoo() {} }).functionFoo',
  ],

  // ----- the non-identifier key forms, carried through EVERY flavor
  [CONCISE_ASYNC, 'async, string key', "({ async 'k'() {} })['k']"],
  [CONCISE_ASYNC, 'async, computed key', "({ async ['c']() {} }).c"],
  [CONCISE_GENERATOR, 'generator, string key', "({ *'k'() {} })['k']"],
  [CONCISE_GENERATOR, 'generator, computed key', "({ *['c']() {} }).c"],
  [
    CONCISE_GENERATOR,
    'generator, symbol key',
    '({ *[Symbol.iterator]() {} })[Symbol.iterator]',
  ],
  [CONCISE_ASYNC_GENERATOR, 'async generator, string key', "({ async *'k'() {} })['k']"],
  [CONCISE_ASYNC_GENERATOR, 'async generator, computed key', "({ async *['c']() {} }).c"],
  [
    CONCISE_ASYNC_GENERATOR,
    'async generator, symbol key',
    '({ async *[Symbol.asyncIterator]() {} })[Symbol.asyncIterator]',
  ],
  [
    CONCISE_ASYNC_GENERATOR,
    'async generator, private key',
    'new (class { async *#p() {} peek() { return this.#p; } })().peek()',
  ],

  // ----- named `function` — the function-expression collision (see the module doc)
  [CONCISE_PLAIN, 'named function, spaced', '({ function() {} }).function'],
  [CONCISE_PLAIN, 'named function, tight', '({ function(){} }).function'],
  [CONCISE_GENERATOR, 'generator named function', '({ *function(){} }).function'],
  [
    CONCISE_ASYNC_GENERATOR,
    'async generator named function',
    '({ async *function(){} }).function',
  ],

  // ----- class hosts
  [CONCISE_PLAIN, 'class prototype method', '(class { foo() {} }).prototype.foo'],
  [CONCISE_PLAIN, 'class static method', '(class { static foo() {} }).foo'],
  [CONCISE_ASYNC, 'class async method', '(class { async foo() {} }).prototype.foo'],
  [CONCISE_GENERATOR, 'class generator method', '(class { *foo() {} }).prototype.foo'],
  [
    CONCISE_ASYNC_GENERATOR,
    'class async generator method',
    '(class { async *foo() {} }).prototype.foo',
  ],
  [
    CONCISE_PLAIN,
    'class private method',
    'new (class { #p() {} peek() { return this.#p; } })().peek()',
  ],
  [
    CONCISE_ASYNC,
    'class private async method',
    'new (class { async #p() {} peek() { return this.#p; } })().peek()',
  ],
  [
    CONCISE_GENERATOR,
    'class private generator method',
    'new (class { *#p() {} peek() { return this.#p; } })().peek()',
  ],
  [
    CONCISE_PLAIN,
    'class static private method',
    '(class { static #q() {} static peek() { return this.#q; } }).peek()',
  ],

  // ----- adversarial bodies: the head decides, never the body
  [CONCISE_PLAIN, 'body holds an arrow', '({ foo() { return x => x; } }).foo'],
  [
    CONCISE_PLAIN,
    'body holds method-looking text',
    '({ foo() { return "bar() {}"; } }).foo',
  ],
  [
    CONCISE_PLAIN,
    'body holds async-method-looking text',
    '({ foo() { return "async bar() {}"; } }).foo',
  ],
  [
    CONCISE_PLAIN,
    'comment after key AND a later comment in the body',
    '({ foo /* c */ (a) { const f = x /* d */ => 1; return f; } }).foo',
  ],

  // ----- arrows, which the sibling module owns
  [NOT_CONCISE, 'arrow', '(a) => a'],
  [NOT_CONCISE, 'async arrow', 'async (a) => a'],
  [NOT_CONCISE, 'async arrow, zero params', 'async () => 1'],
  // `async => async` is a SYNC arrow whose parameter is NAMED `async`. It is the
  // witness for the union law: it enters the async branch, matches neither async
  // pattern, and must fall through rather than be refused outright.
  [NOT_CONCISE, 'arrow with a parameter named async', 'async => async'],
  [NOT_CONCISE, 'tight arrow', '(x)=>x'],
  [NOT_CONCISE, 'arrow with a bare param', 'x => x'],

  // ----- function forms, including the ones that shadow a method head
  [NOT_CONCISE, 'anonymous function expression', '(function () {})'],
  [NOT_CONCISE, 'anonymous function expression, tight', '(function(){})'],
  [NOT_CONCISE, 'named function expression', '(function foo() {})'],
  [NOT_CONCISE, 'async function expression', '(async function () {})'],
  [NOT_CONCISE, 'generator function expression', '(function* () {})'],
  [NOT_CONCISE, 'generator function, spaced star', '(function * foo() {})'],
  [NOT_CONCISE, 'async generator function expression', '(async function* () {})'],
  [NOT_CONCISE, 'class expression', '(class {})'],
  [NOT_CONCISE, 'named class expression', '(class Foo {})'],
  [
    NOT_CONCISE,
    'class field holding a function',
    'new (class { f = function () {}; })().f',
  ],
  [NOT_CONCISE, "the Function constructor's product", "new Function('a', 'return a')"],

  // ----- sources that carry no head at all
  [NOT_CONCISE, 'native', 'Math.max'],
  [NOT_CONCISE, 'bound concise method', '({ foo() {} }).foo.bind(null)'],
  [NOT_CONCISE, 'bound generator method', '({ *foo() {} }).foo.bind(null)'],
  [NOT_CONCISE, 'Function.prototype', 'Function.prototype'],
  [NOT_CONCISE, 'Proxy wrapping a concise method', 'new Proxy(({ foo() {} }).foo, {})'],

  // ----- non-callables
  [NOT_CONCISE, 'undefined', 'undefined'],
  [NOT_CONCISE, 'null', 'null'],
  [NOT_CONCISE, 'a string that looks like a method', "'foo() {}'"],
  [NOT_CONCISE, 'plain object', '({})'],
];

/**
 * Functions created BY accessor syntax — the rejecting half of the accessor
 * ruling. Every row is {@link NOT_CONCISE}, and only the source pattern can
 * make it so.
 *
 * The key forms are enumerated deliberately: each one puts something different
 * between the keyword and the `(`, and it is the presence of that PropertyName
 * — not its shape — that distinguishes an accessor from a method NAMED `get`
 * or `set`.
 *
 * @type {[string, string, string][]}
 */
export const ACCESSOR_SYNTAX_VECTORS = [
  [
    NOT_CONCISE,
    'getter',
    "Object.getOwnPropertyDescriptor({ get x() { return 0; } }, 'x').get",
  ],
  [NOT_CONCISE, 'setter', "Object.getOwnPropertyDescriptor({ set x(v) {} }, 'x').set"],
  [
    NOT_CONCISE,
    'getter, tight paren',
    "Object.getOwnPropertyDescriptor({ get x(){} }, 'x').get",
  ],
  [
    NOT_CONCISE,
    'getter, block comment keyword -> key',
    "Object.getOwnPropertyDescriptor({ get /* c */ x() { return 0; } }, 'x').get",
  ],
  [
    NOT_CONCISE,
    'getter, newline keyword -> key',
    "Object.getOwnPropertyDescriptor({ get\nx() { return 0; } }, 'x').get",
  ],
  [
    NOT_CONCISE,
    'getter, line comment keyword -> key',
    "Object.getOwnPropertyDescriptor({ get // c\nx() { return 0; } }, 'x').get",
  ],
  [
    NOT_CONCISE,
    'getter, computed key',
    "Object.getOwnPropertyDescriptor({ get ['x']() { return 0; } }, 'x').get",
  ],
  [
    NOT_CONCISE,
    'getter, string key',
    "Object.getOwnPropertyDescriptor({ get 'x'() { return 0; } }, 'x').get",
  ],
  [
    NOT_CONCISE,
    'getter, numeric key',
    'Object.getOwnPropertyDescriptor({ get 1() { return 0; } }, 1).get',
  ],
  [
    NOT_CONCISE,
    'getter, symbol key',
    'Object.getOwnPropertyDescriptor({ get [Symbol.toStringTag]() { return "x"; } }, Symbol.toStringTag).get',
  ],
  [
    NOT_CONCISE,
    'getter named get',
    "Object.getOwnPropertyDescriptor({ get get() { return 0; } }, 'get').get",
  ],
  [
    NOT_CONCISE,
    'setter named set',
    "Object.getOwnPropertyDescriptor({ set set(v) {} }, 'set').set",
  ],
  [
    NOT_CONCISE,
    'class prototype getter',
    "Object.getOwnPropertyDescriptor((class { get x() { return 0; } }).prototype, 'x').get",
  ],
  [
    NOT_CONCISE,
    'class static getter',
    "Object.getOwnPropertyDescriptor(class { static get x() { return 0; } }, 'x').get",
  ],
];

/**
 * Callables INSTALLED INTO an accessor slot — the verifying half of the
 * accessor ruling. A row's kind is what the installed value actually is, so a
 * concise method serving as a getter must still be recognized as that flavor.
 *
 * The last row is the crossover the ruling turns on: a function created by
 * accessor syntax, then reused as another object's getter. It stays rejected,
 * because what it IS did not change when where it sits did.
 *
 * @type {[string, string, string][]}
 */
export const ACCESSOR_SLOT_VECTORS = [
  [
    CONCISE_PLAIN,
    'plain concise method as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get() { return 1; }, configurable: true }), 'p').get",
  ],
  [
    CONCISE_PLAIN,
    'plain concise method as a setter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { set(v) {}, configurable: true }), 'p').set",
  ],
  [
    CONCISE_ASYNC,
    'concise async method as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: ({ async m() {} }).m, configurable: true }), 'p').get",
  ],
  [
    CONCISE_GENERATOR,
    'concise generator method as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: ({ *m() {} }).m, configurable: true }), 'p').get",
  ],
  [
    CONCISE_ASYNC_GENERATOR,
    'concise async generator method as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: ({ async *m() {} }).m, configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'arrow as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: () => 1, configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'function expression as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: function () { return 1; }, configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'generator function as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: function* () {}, configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'native as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: Math.max, configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'bound function as a getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: ({ m() {} }).m.bind(null), configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'class constructor as a getter (accepted, throws only when read)',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'p', { get: class {}, configurable: true }), 'p').get",
  ],
  [
    NOT_CONCISE,
    'accessor-syntax function reused as another getter',
    "Object.getOwnPropertyDescriptor(Object.defineProperty({}, 'q', { get: Object.getOwnPropertyDescriptor({ get x() { return 1; } }, 'x').get, configurable: true }), 'q').get",
  ],
];

/**
 * Candidates evaluated in the foreign realm — the same questions asked of
 * values whose intrinsics this realm never captured.
 *
 * @type {[string, string, string][]}
 */
export const FOREIGN_CONCISE_VECTORS = [
  [CONCISE_PLAIN, 'foreign plain method', '({ foo() {} }).foo'],
  [CONCISE_ASYNC, 'foreign async method', '({ async foo() {} }).foo'],
  [CONCISE_GENERATOR, 'foreign generator method', '({ *foo() {} }).foo'],
  [
    CONCISE_ASYNC_GENERATOR,
    'foreign async generator method',
    '({ async *foo() {} }).foo',
  ],
  [CONCISE_PLAIN, 'foreign method named function', '({ function(){} }).function'],
  [NOT_CONCISE, 'foreign function expression', '(function () {})'],
  [NOT_CONCISE, 'foreign arrow', '(a) => a'],
];

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Boundaries
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Pairs a predicate cannot separate, with the evidence that they are genuinely
 * indistinguishable rather than merely hard.
 *
 * A test over these asserts that both members receive the SAME verdict —
 * whichever the module decides — so the boundary stays documented and any
 * future claim to have resolved it has to face the pair.
 *
 * @type {Record<string, { concise: string, other: string, sharedSource: string, why: string }>}
 */
export const UNDECIDABLE_PAIRS = {
  asyncMethodNamedFunction: {
    concise: '({ async function(){} }).function',
    other: '(async function(){})',
    sharedSource: 'async function(){}',
    why: 'identical source, both [object AsyncFunction], neither has an own prototype; `name` fails too, since an anonymous async function expression assigned to a property named `function` also reports "function"',
  },
};

/**
 * The plain counterpart, which IS decidable — kept beside the undecidable
 * pair so the difference is visible rather than asserted.
 *
 * @type {Record<string, { concise: string, other: string, sharedSource: string, discriminator: string }>}
 */
export const DECIDABLE_PAIRS = {
  methodNamedFunction: {
    concise: '({ function(){} }).function',
    other: '(function(){})',
    sharedSource: 'function(){}',
    discriminator:
      'hasOwnPrototype — false for the method, true for the function expression',
  },
};

/**
 * Header spellings that are SyntaxErrors, kept so the grammar bound stays
 * pinned rather than remembered.
 *
 * Every one of them is a LineTerminator in the slot after `async`. The absence
 * of entries for the other slots is the point: a newline after `*`, after `get`,
 * and between the key and `(` is all legal, so a pattern must accept it there.
 *
 * @type {Record<string, string>}
 */
export const illegalHeaders = {
  newlineAsyncToKey: '({ async\nfoo() {} }).foo',
  newlineAsyncToStar: '({ async\n*foo() {} }).foo',
  lineCommentAsyncToKey: '({ async // c\n foo() {} }).foo',
};

/**
 * The module's `@@throw-safe` marked set — leg 1 of the axis-5 completeness
 * oracle, compared against what `parseMarkedExports` finds in BOTH dialects.
 *
 * Declared here rather than derived from the source, deliberately: a list
 * computed from the same file it is checked against would agree with itself no
 * matter what drifted.
 *
 * @type {string[]}
 */
export const THROW_SAFE_MARKED = [
  'isAnyConciseMethod',
  'isConciseAsyncGeneratorMethod',
  'isConciseAsyncMethod',
  'isConciseGeneratorMethod',
  'isPlainConciseMethod',
  'matchesLeadingAsyncToken',
  'matchesStartSequencesOfConciseAsyncGeneratorMethodSource',
  'matchesStartSequencesOfConciseAsyncMethodSource',
  'matchesStartSequencesOfConciseMethodNormalForm',
  'matchesStartSequencesOfUnnamedPlainFunctionSource',
];

/**
 * Hostile values for the `string` parameter of the five source-head helpers.
 *
 * The marker promises no throw within the DECLARED type, so this set is hostile
 * STRINGS rather than arbitrary junk — a non-string would test out of contract,
 * which the declared type already prevents at the compiler
 * (`BOUND.spec.md` → the marker's contract).
 *
 * The pathological rows are the point of the set. These patterns nest
 * quantifiers over a trivia group and a key class that includes a greedy
 * computed-key branch (`\[[\s\S]*\]`), so a long run of comment openers, of
 * `async` prefixes, or of unclosed brackets is where a careless pattern stops
 * RETURNING rather than returns wrongly.
 *
 * Written with escapes, never raw bytes: a literal NUL turns this file into
 * binary as far as grep is concerned, and a literal RTL override is invisible
 * in review.
 *
 * @type {Record<string, () => string>}
 */
export const hostileSources = {
  emptyString: () => '',
  whitespaceOnly: () => ' \t\n\r  ',
  punctuationSoup: () => '((({{{[[[)))}}}]]]',
  loneSurrogate: () => '\ud800',
  combiningMarks: () => 'e\u0301\u0302\u0303() {}',
  embeddedNul: () => 'foo\u0000() {\u0000}',
  rtlOverride: () => 'foo\u202e() {}',
  emoji: () => '\u{1f600}() { \u{1f4a5} }',
  unterminatedComment: () => `async ${'/* '.repeat(2_000)}foo() {}`,
  unclosedComputedKey: () => `${'['.repeat(50_000)}foo]() {}`,
  manyAsyncPrefixes: () => `${'async '.repeat(5_000)}foo() {}`,
  manyStars: () => `${'*'.repeat(50_000)}foo() {}`,
  veryLongKey: () => `${'k'.repeat(1_000_000)}() {}`,
};

/**
 * Callables built to make a reader throw.
 *
 * Every entry is genuinely callable, so the predicates are exercised WITHIN
 * their declared parameter type.
 *
 * @type {Record<string, () => unknown>}
 */
export const hostileCallables = {
  revokedProxy: () => {
    const revocable = Proxy.revocable(() => undefined, {});
    revocable.revoke();

    return revocable.proxy;
  },
  throwingGetTrap: () =>
    new Proxy(() => undefined, {
      get() {
        throw new Error('hostile get trap');
      },
    }),
  throwingDescriptorTrap: () =>
    new Proxy(() => undefined, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile descriptor trap');
      },
    }),
  nullPrototypeCallable: () => {
    const bare = function named() {
      return undefined;
    };
    Object.setPrototypeOf(bare, null);

    return bare;
  },
};
