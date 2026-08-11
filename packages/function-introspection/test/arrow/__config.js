// @ts-check

/**
 * @module test/arrow/__config
 *
 * The `arrow` module's vector corpus — the admit/reject candidates for
 * `isArrowFunction`, `isAsyncArrowFunction` and `isAnyArrowFunction`, plus the
 * hostile set the throw-safety invariant is scored over.
 *
 * Each row is `[kind, description, source]`, where the kind names the expected
 * classification and all three verdicts follow from it: {@link ARROW} means
 * plain and any, {@link ASYNC_ARROW} means async and any, {@link NOT_ARROW}
 * means none. One label per row is what keeps a row from contradicting itself.
 *
 * Candidates are carried as SOURCE TEXT rather than as literals, and built
 * through {@link materialize}. The spelling is the thing under test — a comment
 * inside a function header, a fully unspaced `async(x)=>x` — and a literal
 * would be reformatted by prettier into a different vector than the one
 * intended.
 *
 * ## What the corpus covers
 *
 * Both flavors in tight and spaced spelling; a parameter NAMED `async`; all
 * five ways to name a member `async` (object literal, class prototype, class
 * `static`, spaced, cross-realm); every concise-method flavor, accessors, and
 * computed / string / symbol / private keys; every classic function form
 * including the `Function` constructor's product; natives, bound values,
 * `Function.prototype` and Proxy-wrapped callables, whose sources carry no head
 * at all; cross-realm arrows and methods; bodies that CONTAIN an arrow, which
 * pin the anchor to the head; the comment positions the header pattern accepts;
 * and the two-comment shapes a lazily-quantified comment interior matches by
 * backtracking across real code.
 */

import { foreignRealmEval } from '../_cross-realm.js';

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Expected Classifications
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** A sync arrow — admitted by `isArrowFunction` and `isAnyArrowFunction`. */
export const ARROW = 'arrow';

/** An async arrow — admitted by `isAsyncArrowFunction` and `isAnyArrowFunction`. */
export const ASYNC_ARROW = 'async arrow';

/** Neither — all three predicates report `false`. */
export const NOT_ARROW = 'not an arrow';

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
 * Builds a candidate in the shared foreign realm, for the cross-realm rows.
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
export const ARROW_VECTORS = [
  // ----- arrows, ordinary spelling
  [ARROW, 'paren params', '(a) => a'],
  [ARROW, 'bare param', 'a => a'],
  [ARROW, 'zero params', '() => 0'],
  [ARROW, 'param $', '$ => $'],
  [ARROW, 'param _', '_ => _'],
  [ARROW, 'unicode param', 'ä => ä'],

  // ----- identifier spellings a narrow letter class silently refused.
  // Written as escapes so this file stays free of invisible characters.
  [ARROW, 'ZWNJ in parameter', 'a\u200Cb => a\u200Cb'],
  [ARROW, 'ZWJ in parameter', 'a\u200Db => a\u200Db'],
  [ARROW, 'combining mark in parameter', 'e\u0301 => e\u0301'],
  [ARROW, 'devanagari parameter', '\u0915\u093F => \u0915\u093F'],
  [ARROW, 'parameter written as a unicode escape', '\\u0061 => \\u0061'],
  [ASYNC_ARROW, 'async, ZWNJ in parameter', 'async a\u200Cb => a\u200Cb'],
  [ASYNC_ARROW, 'async, parameter as unicode escape', 'async \\u0061 => \\u0061'],
  [ARROW, 'param named async', 'async => async'],
  [ARROW, 'default is an arrow', '(f = () => 1) => f'],
  [ARROW, 'default string holds =>', "({ a = '=>' }) => a"],
  [ARROW, 'default string holds )', '(a = ")") => a'],
  [ARROW, 'block body', '(a) => { return a; }'],
  [ARROW, 'rest + destructure', '({ a: [b = 1] }, ...r) => [b, r]'],
  [ARROW, 'class field arrow', 'new (class { field = () => 1 })().field'],
  [
    ARROW,
    'class field named async holds arrow',
    'new (class { async = () => 1 })().async',
  ],
  [ASYNC_ARROW, 'async paren', 'async (a) => a'],
  [ASYNC_ARROW, 'async bare param', 'async a => a'],
  [ASYNC_ARROW, 'async, no space before paren', 'async(x) => x'],
  [ASYNC_ARROW, 'async + param named async', 'async async => async'],
  [ASYNC_ARROW, 'async class field', 'new (class { f = async () => 1 })().f'],
  [ASYNC_ARROW, 'async, extra spaces', 'async   (x) => x'],
  [ASYNC_ARROW, 'async, tab before paren', 'async\t(x) => x'],

  // ----- arrows, fully tight spelling
  [ARROW, 'tight paren params', '(x)=>x'],
  [ARROW, 'tight bare param', 'x=>x'],
  [ASYNC_ARROW, 'tight async', 'async(x)=>x'],
  [ASYNC_ARROW, 'tight async, block body', 'async(x)=>{return x}'],
  [ASYNC_ARROW, 'tight async, zero params', 'async()=>1'],
  [ASYNC_ARROW, 'tight async, bare param', 'async x=>x'],

  // ----- comments in the header, the positions the grammar allows
  [ARROW, 'comment between ) and =>', '(a) /* c */ => a'],
  [ARROW, 'comment between ident and =>', 'a /* c */ => a'],
  [ARROW, 'comment inside params', '(a /* ) */) => a'],
  [ARROW, 'comment inside empty params', '(/* c */) => 1'],
  [ARROW, 'leading comment', '/* c */ (a) => a'],
  [ARROW, 'two comments before =>', 'a /* c */ /* d */ => a'],
  [ARROW, 'comment tight against ident', 'a/* c */=> a'],
  [ARROW, 'comment interior holds a lone star', 'a /* c * d */ => a'],
  [ARROW, 'comment interior holds a slash', 'a /* c / d */ => a'],
  [ASYNC_ARROW, 'comment between async and (', 'async /* c */ (x) => x'],
  [ASYNC_ARROW, 'comment between async and ident', 'async /* c */ x => x'],
  [ASYNC_ARROW, 'two comments before (', 'async /* c */ /* d */ (x) => x'],
  [ASYNC_ARROW, 'comment tight against async', 'async/* c */(x) => x'],
  [ASYNC_ARROW, 'comments in both async slots', 'async /* c */ x /* d */ => x'],

  // ----- a member NAMED async, in every host that can declare one
  [NOT_ARROW, 'method named async', '({ async() {} }).async'],
  [NOT_ARROW, 'method named async, spaced', '({ async () {} }).async'],
  [NOT_ARROW, 'method named async, tight', '({async(){}}).async'],
  [NOT_ARROW, 'method named async, tight + body', '({async(){return 1}}).async'],
  [
    NOT_ARROW,
    'method named async, arrow in body',
    '({ async() { return () => 1; } }).async',
  ],
  [
    NOT_ARROW,
    'class prototype method named async',
    '(class { async() {} }).prototype.async',
  ],
  [NOT_ARROW, 'class static method named async', '(class { static async() {} }).async'],
  [NOT_ARROW, 'async method named async', '({ async async() {} }).async'],
  [NOT_ARROW, 'generator method named async', '({ *async() {} }).async'],
  [NOT_ARROW, 'async generator method named async', '({ async *async() {} }).async'],
  [
    NOT_ARROW,
    'getter named async',
    "Object.getOwnPropertyDescriptor({ get async() { return 0; } }, 'async').get",
  ],
  [
    NOT_ARROW,
    'setter named async',
    "Object.getOwnPropertyDescriptor({ set async(v) {} }, 'async').set",
  ],
  [NOT_ARROW, 'string-keyed async', "({ 'async'() {} }).async"],
  [NOT_ARROW, 'computed-key async', "({ ['async']() {} }).async"],
  [
    NOT_ARROW,
    'method named async, comment before params',
    '({ async /* c */ () {} }).async',
  ],

  // ----- the rest of the concise family
  [NOT_ARROW, 'concise method', '({ m() {} }).m'],
  [NOT_ARROW, 'concise method, comment before params', '({ m /* c */ () {} }).m'],
  [NOT_ARROW, 'async concise method', '({ async m() {} }).m'],
  [NOT_ARROW, 'generator concise method', '({ *m() {} }).m'],
  [NOT_ARROW, 'async generator concise method', '({ async *m() {} }).m'],
  [
    NOT_ARROW,
    'getter',
    "Object.getOwnPropertyDescriptor({ get g() { return 0; } }, 'g').get",
  ],
  [NOT_ARROW, 'setter', "Object.getOwnPropertyDescriptor({ set s(v) {} }, 's').set"],
  [NOT_ARROW, 'computed-key method', "({ ['c']() {} }).c"],
  [NOT_ARROW, 'string-key method', "({ 'string key'() {} })['string key']"],
  [NOT_ARROW, 'symbol-key method', '({ [Symbol.iterator]() {} })[Symbol.iterator]'],
  [NOT_ARROW, 'method named get', '({ get() {} }).get'],
  [NOT_ARROW, 'method named set', '({ set() {} }).set'],
  [NOT_ARROW, 'method named function', '({ function() {} }).function'],
  [NOT_ARROW, 'method with an arrow default', '({ m(a = () => 1) {} }).m'],
  [NOT_ARROW, 'class prototype method', '(class { m() {} }).prototype.m'],
  [NOT_ARROW, 'class static method', '(class { static s() {} }).s'],
  [NOT_ARROW, 'async class method', '(class { async m() {} }).prototype.m'],
  [
    NOT_ARROW,
    'class getter',
    "Object.getOwnPropertyDescriptor((class { get g() { return 0; } }).prototype, 'g').get",
  ],
  [
    NOT_ARROW,
    'private method',
    'new (class { #p() {} peek() { return this.#p; } })().peek()',
  ],

  // ----- bodies that CONTAIN an arrow — these pin the anchor to the head
  [
    NOT_ARROW,
    'concise method, named-param arrow in body',
    '({ m() { return x => x; } }).m',
  ],
  [NOT_ARROW, 'function, named-param arrow in body', '(function () { return x => x; })'],
  [
    NOT_ARROW,
    'async function, async arrow in body',
    '(async function () { return async x => x; })',
  ],
  [
    NOT_ARROW,
    'async function, plain arrow in body',
    '(async function () { return x => x; })',
  ],
  [
    NOT_ARROW,
    'method named async, arrow expression in body',
    '({ async() { return x => x; } }).async',
  ],
  [
    NOT_ARROW,
    'class with an arrow in a method body',
    '(class { m() { return x => x; } })',
  ],
  [NOT_ARROW, 'generator yielding an arrow', '(function* () { yield x => x; })'],

  // ----- a comment after the name AND a second one later: the backtracking trap
  [
    NOT_ARROW,
    'concise method, comment after name + arrow in body',
    '({ m /* c */ (a) { const f = x /* d */ => 1; return f; } }).m',
  ],
  [
    NOT_ARROW,
    'function, comment after name + arrow in body',
    '(function m /* c */ (a) { const f = x /* d */ => 1; return f; })',
  ],
  [
    NOT_ARROW,
    'concise method, two comments then an arrow in body',
    '({ m /* a */ (b) { return /* c */ z /* d */ => z; } }).m',
  ],

  // ----- the classic function forms
  [NOT_ARROW, 'function declaration', '(function foo() {})'],
  [NOT_ARROW, 'anonymous function expression', '(function () {})'],
  [NOT_ARROW, 'async function', '(async function () {})'],
  [NOT_ARROW, 'async function, no space', '(async function(){})'],
  [NOT_ARROW, 'generator function', '(function* () {})'],
  [NOT_ARROW, 'async generator function', '(async function* () {})'],
  [NOT_ARROW, 'class constructor', '(class {})'],
  [NOT_ARROW, "the Function constructor's product", "new Function('a', 'return a')"],

  // ----- sources that carry no head at all
  [NOT_ARROW, 'native', 'Math.max'],
  [NOT_ARROW, 'bound arrow', '((a) => a).bind(null)'],
  [NOT_ARROW, 'bound async arrow', '(async (a) => a).bind(null)'],
  [NOT_ARROW, 'bound concise method', '({ m() {} }).m.bind(null)'],
  [NOT_ARROW, 'Function.prototype', 'Function.prototype'],
  [NOT_ARROW, 'Proxy wrapping an arrow', 'new Proxy((a) => a, {})'],

  // ----- non-callables
  [NOT_ARROW, 'undefined', 'undefined'],
  [NOT_ARROW, 'null', 'null'],
  [NOT_ARROW, 'a string that looks like an arrow', "'(a) => a'"],
  [NOT_ARROW, 'plain object', '({})'],
];

/**
 * Candidates evaluated in the foreign realm — the same questions asked of
 * values whose intrinsics this realm never captured.
 *
 * @type {[string, string, string][]}
 */
export const FOREIGN_ARROW_VECTORS = [
  [ARROW, 'foreign arrow', '(a) => a'],
  [ASYNC_ARROW, 'foreign async arrow', 'async (a) => a'],
  [NOT_ARROW, 'foreign concise method', '({ m() {} }).m'],
  [NOT_ARROW, 'foreign method named async', '({ async() {} }).async'],
  [NOT_ARROW, 'foreign function', '(function () {})'],
];

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Throw-safety and the grammar bound
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The module's `@@throw-safe` marked set — leg 1 of the axis-5 completeness
 * oracle, compared against what `parseMarkedExports` finds in BOTH dialects.
 *
 * Declared here rather than derived from the source, deliberately: a list
 * computed from the same file it is checked against would agree with itself
 * no matter what drifted.
 *
 * @type {string[]}
 */
export const THROW_SAFE_MARKED = [
  'isAnyArrowFunction',
  'isArrowFunction',
  'isAsyncArrowFunction',
  'matchesStartSequencesOfArrowFunctionSource',
  'matchesStartSequencesOfAsyncArrowFunctionSource',
];

/**
 * Hostile values for the `string` parameter of the two source-head helpers.
 *
 * The marker promises no throw within the DECLARED type, so this set is hostile
 * STRINGS rather than arbitrary junk — a non-string would test out of contract,
 * which the declared type already prevents at the compiler
 * (`BOUND.spec.md` → the marker's contract).
 *
 * The pathological-backtracking rows are the point of the set: the header
 * patterns nest quantifiers over a trivia group, and a long run of comment
 * openers or of `async` prefixes is where a careless pattern stops returning
 * rather than returns wrongly.
 *
 * @type {Record<string, () => string>}
 */
export const hostileSources = {
  emptyString: () => '',
  whitespaceOnly: () => ' \t\n\r  ',
  punctuationSoup: () => '((({{{[[[)))}}}]]]',
  loneSurrogate: () => '\ud800',
  combiningMarks: () => 'e\u0301\u0302\u0303 => e\u0301',
  embeddedNul: () => 'a\u0000 => \u0000a',
  rtlOverride: () => 'a\u202e => a',
  emoji: () => '\u{1f600} => \u{1f4a5}',
  unterminatedComment: () => `a ${'/* '.repeat(2_000)}=> a`,
  manyAsyncPrefixes: () => `${'async '.repeat(5_000)}=> x`,
  manyOpenParens: () => `${'('.repeat(50_000)}a) => a`,
  veryLongHead: () => `(${' '.repeat(1_000_000)}) => 1`,
};

/**
 * Callables built to make a reader throw.
 *
 * Every entry is genuinely callable, so the predicates are exercised WITHIN
 * their declared parameter type; a non-callable would test a contract the
 * module never made.
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

/**
 * Header spellings that are SyntaxErrors, kept so the grammar bound stays
 * pinned rather than remembered.
 *
 * A LineTerminator may precede neither `=>` nor the parameters of an `async`
 * arrow, which makes every line comment and every newline-bearing block comment
 * illegal in those slots. That is why the header pattern only ever has to
 * accept a single-line block comment.
 *
 * @type {Record<string, string>}
 */
export const illegalHeaders = {
  lineCommentBeforeArrow: 'a // c\n => a',
  lineCommentAfterAsync: 'async // c\n (x) => x',
  blockCommentWithNewlineBeforeArrow: 'a /* \n */ => a',
  blockCommentWithNewlineAfterAsync: 'async /* \n */ (x) => x',
};
