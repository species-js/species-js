// @ts-check

/**
 * @module test/__config
 *
 * The claims: every matrix the suites drive, plus the message oracle the
 * ordering band is decided against.
 *
 * `__fixtures.js` owns the value universe and imports nothing from `src/`.
 * This file adds what is CLAIMED about those values, and is therefore the one
 * place allowed to reach for the subject itself — a fixture like "a constructor
 * this package has already frozen" cannot be forged, since the vector is about
 * the round trip. Keeping that coupling here rather than in the fixtures makes
 * it a property of the claims, where it belongs, and leaves the universe
 * reusable by a suite that never freezes anything.
 *
 * ## Two matrix shapes, because the package has two kinds of surface
 *
 * `doesCarryStableTypeIdentity` and `isSupportedConstructor` answer a VERDICT
 * over a value universe, so they are scored the way every predicate in this
 * workspace is scored: one row per candidate, a boolean per predicate, a
 * completeness guard so no row can quietly omit a column.
 *
 * The two mutators do not answer a verdict. Their contract is an ordered
 * rejection list where the first blocking condition ends the attempt, so the
 * cell is a triple — condition, error class, message — and the interesting
 * question is not _whether_ a call failed but _where_. That is what
 * {@link DEFINE_CONDITION_MESSAGES} is for: it maps each condition to the
 * message only that condition produces, which lets a suite recover the ORDINAL
 * from an observed reason and assert `ord/*` as the ordering claim it is,
 * rather than as a string comparison that happens to pass.
 *
 * The messages are written out here rather than imported from `src/`. An
 * oracle that reads the value it checks cannot detect a change to that value —
 * the `CANONICAL_CONDENSED_SOURCE` rule from the sibling package's `utility`
 * round.
 *
 * Mirrors `docs/spec/TYPE-IDENTITY.spec.md` (FROZEN 2026-09-09).
 */

import { defineStableTypeIdentity, brandFunctionName } from '#index';

import {
  IgnoringError,
  ThrowingError,
  arrowFunction,
  arrowWithGraftedPrototype,
  asyncFunction,
  boundClass,
  boundES3,
  boundNewableWithGraftedPrototype,
  builtinArray,
  builtinDate,
  builtinFunction,
  builtinSymbol,
  callableWithHostileDefineTrap,
  carryNearMisses,
  conciseMethod,
  constructorWithHostileDefineTrap,
  descriptorTrapThrowingProxy,
  freshClass,
  freshClassHierarchy,
  freshES3,
  frozenClass,
  frozenES3,
  frozenPrototypeType,
  generatorFunction,
  halfwayFailingType,
  handForgedIdentity,
  hostileBoxedString,
  inertReadProbeType,
  instantiate,
  lateDescriptorTrapThrowingProxy,
  lyingDefineTrap,
  nonWritablePrototypeFunction,
  prototypeOf,
  prototypeTrapThrowingProxy,
  proxyOverClass,
  proxyOverES3,
  revokedFunctionProxy,
  sealedConstructorSlotType,
  sealedTagSlotType,
  stringSubclassInstance,
  throwingDefineTrap,
  withOwnPrototype,
} from './__fixtures.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */
/** @typedef {import('@species-js/type-detection').NewableFunction} NewableFunction */
/** @typedef {import('#index').IdentityDefinitionResult} IdentityDefinitionResult */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Typed Adapters
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Re-declares an entry with the signature its RUNTIME has: any argument list at
 * all, arity included.
 *
 * One cast, in one place, rather than one per out-of-contract vector. What it
 * acknowledges is the width the spec puts there deliberately — `type/T4` records
 * that `constructorName` is declared `string` while the runtime also admits and
 * unwraps a boxed `String`, `type/T2` that the rest tuple refuses the explicit
 * `undefined` the runtime rejects at condition 5, and `type/T5` that the
 * constructor parameter refuses nothing at all. Several vectors below are
 * therefore, by design, calls a typed consumer could not write; the entries are
 * specified to answer them with a `reason` rather than a throw, and that answer
 * is the claim.
 *
 * @param {unknown} entry - the entry to widen
 * @returns {(...args: unknown[]) => IdentityDefinitionResult} the same function, re-typed
 */
const asArgumentListEntry = (entry) =>
  /** @type {(...args: unknown[]) => IdentityDefinitionResult} */ (entry);

/**
 * Calls `defineStableTypeIdentity` with an argument LIST rather than with
 * arguments, so the call's arity is carried by the vector.
 *
 * Arity is contract here (`define/R5`, `ord/A6`): an explicitly passed
 * `undefined` third argument is a supplied argument and is refused, while an
 * omitted one defaults the tag. A helper taking `(constructor, name, tag)`
 * could not express the difference, since both would arrive as `undefined`.
 *
 * @param {unknown[]} args - the whole argument list
 * @returns {IdentityDefinitionResult} the entry's result
 */
export const callDefine = (args) =>
  asArgumentListEntry(defineStableTypeIdentity)(...args);

/**
 * The same, for `brandFunctionName`.
 *
 * @param {unknown[]} args - the whole argument list
 * @returns {IdentityDefinitionResult} the entry's result
 */
export const callBrand = (args) => asArgumentListEntry(brandFunctionName)(...args);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Message Oracle
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Every `defineStableTypeIdentity` condition whose message the package itself
 * words, keyed by condition number.
 *
 * Conditions 8 and 12 are absent on purpose: both report the value that was
 * thrown, so their message belongs to whoever threw it. What they word instead
 * — the wrapper used when a non-error is thrown — is
 * {@link DEFINE_WRAPPER_MESSAGES}.
 *
 * The map is what makes an ordinal recoverable from a reason, which is what the
 * `ord/*` band actually claims. It is only sound while the messages are
 * pairwise distinct; `spec.test.js` asserts that rather than assuming it.
 */
export const DEFINE_CONDITION_MESSAGES = {
  1: 'The provided "constructor" parameter has to be at least a constructable function-type.',
  2: 'The provided "constructor" parameter needs to be either an ES3 constructor function or a class-syntax constructor. Built-in constructors and bound newables carry neither shape.',
  3: 'The provided "constructorName" parameter needs to be a string.',
  4: 'Invalid string value passed as "constructorName".',
  5: 'The provided "taggedType" parameter needs to be a string.',
  6: 'Invalid string value passed as "taggedType".',
  7: 'The passed constructor\'s "name" property cannot be redefined.',
  9: 'The passed constructor\'s "prototype" property is invalid.',
  10: 'The passed constructor\'s prototypal "constructor" property cannot be redefined.',
  11: 'The passed constructor\'s prototypal "Symbol.toStringTag" property cannot be redefined.',
};

/** The wrapper messages the two pass-through conditions use for a non-error throw. */
export const DEFINE_WRAPPER_MESSAGES = {
  8: 'Reading the own "prototype" property-descriptor threw.',
  12: 'Defining one of the identity properties threw.',
};

/** The same map for `brandFunctionName`, whose list runs to five. */
export const BRAND_CONDITION_MESSAGES = {
  1: 'The provided "fct" parameter needs to be a function-type.',
  2: 'The provided "fctName" parameter needs to be a string.',
  3: 'Invalid string value passed as "fctName".',
  4: 'The passed callable\'s "name" property cannot be redefined.',
};

/** The wrapper message `brandFunctionName`'s pass-through condition uses. */
export const BRAND_WRAPPER_MESSAGES = { 5: 'Branding the "name" property threw.' };

/**
 * Recovers the CONDITION an observed reason reports, by looking its message up
 * in the entry's canonical map.
 *
 * This is what lets the ordering band assert an ORDINAL — "condition 3, not 7"
 * — rather than a string that happens to match. The lookup is only sound while
 * the messages are pairwise distinct, which `spec.test.js` asserts.
 *
 * The pass-through conditions are unreachable this way by construction: their
 * message is whatever was thrown, so they are absent from the map and resolve
 * to `null`. No ordering vector targets one.
 *
 * @param {'defineStableTypeIdentity' | 'brandFunctionName'} entry - which entry answered
 * @param {string} message - the observed reason's message
 * @returns {number | null} the condition, or `null` when no condition words it
 */
export const conditionOfMessage = (entry, message) => {
  const messages =
    entry === 'defineStableTypeIdentity'
      ? DEFINE_CONDITION_MESSAGES
      : BRAND_CONDITION_MESSAGES;
  const found = Object.entries(messages).find(([, text]) => text === message);

  return found === undefined ? null : Number(found[0]);
};

/**
 * Calls either entry with an argument list, chosen by name.
 *
 * @param {'defineStableTypeIdentity' | 'brandFunctionName'} entry - which entry to call
 * @param {unknown[]} args - the whole argument list
 * @returns {IdentityDefinitionResult} the entry's result
 */
export const callEntry = (entry, args) =>
  entry === 'defineStableTypeIdentity' ? callDefine(args) : callBrand(args);

/** The full condition count of each entry, as the `.d.ts` numbers them. */
export const CONDITION_COUNTS = { defineStableTypeIdentity: 12, brandFunctionName: 5 };

/**
 * The `@@throw-safe`-marked exports this package declares, as the suite's own
 * statement of the set.
 *
 * Compared against what the two source dialects actually carry, so a marker
 * added or removed without a vector behind it turns the throw-safety suite red.
 */
export const THROW_SAFE_EXPORTS = [
  'brandFunctionName',
  'defineStableTypeIdentity',
  'doesCarryStableTypeIdentity',
  'getIdentifierAsSafeResult',
  'isSupportedConstructor',
  'resolveErrorWithCause',
];

/**
 * The five module-local values the spec's surface inventory names, each of
 * which the `.js` also marks throw-safe.
 *
 * They have no `.d.ts` twin — a marker is a promise about a function, and a
 * function does not stop making it by staying local — so this is the half of
 * the marked set the two dialects are specified to DISAGREE on. ADR #101 is
 * that specification: parity is owed over the DECLARED set, and a marked
 * function with no declaration to sit on is the sanctioned excess.
 */
export const THROW_SAFE_MODULE_LOCALS = [
  'canOwnNameBeShaped',
  'getOwnPropertyDescriptorAsSafeResult',
  'isCustomClass',
  'isES3Function',
  'toReportableError',
];

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Already-Frozen Fixtures
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A constructor this package has frozen, with its identifier, so a vector can
 * assert the read-back rather than reconstructing what was written.
 *
 * The freeze is asserted here rather than assumed. A factory whose setup step
 * silently failed would hand every consumer a plain constructor, and the
 * vectors that then answered `false` would look like findings.
 *
 * @param {'class' | 'es3'} shape - which of the two admitted shapes to build
 * @param {string} [identifier] - the name and tag to freeze
 * @returns {{ Frozen: NewableFunction, identifier: string }} the pair
 */
export const frozenType = (shape, identifier = 'Frozen') => {
  const Frozen = shape === 'class' ? freshClass() : freshES3();
  const result = callDefine([Frozen, identifier]);

  if (!result.success) {
    throw new Error(
      `the frozen-${shape} fixture failed to freeze: ${result.reason.message}`,
    );
  }

  return { Frozen, identifier };
};

/**
 * A callable this package has already branded — the one-way door, from the
 * other side (`brand/B3`, `define/R7`, `ord/A7`).
 *
 * @param {string} [identifier] - the name to brand with
 * @returns {Callable} the branded callable
 */
export const brandedCallable = (identifier = 'Branded') => {
  const fct = arrowFunction();
  const result = callBrand([fct, identifier]);

  if (!result.success) {
    throw new Error(
      `the branded-callable fixture failed to brand: ${result.reason.message}`,
    );
  }

  return fct;
};

/**
 * A branded CLASS — the shape `define/R7` needs, a target the freezing entry
 * would otherwise accept whose `name` a brand has already closed.
 *
 * @returns {NewableFunction} the branded class
 */
export const brandedClass = () => {
  const Branded = freshClass();
  const result = callBrand([Branded, 'Branded']);

  if (!result.success) {
    throw new Error(
      `the branded-class fixture failed to brand: ${result.reason.message}`,
    );
  }

  return Branded;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  A — The Identifier Matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} IdentifierRow
 * @property {string} description - what the candidate is
 * @property {() => unknown} make - the candidate, fresh
 * @property {ErrorConstructor | RangeErrorConstructor | null} errorClass - the
 *  rejection's class, or `null` when the candidate is admitted
 * @property {string | null} value - the normalized identifier, or `null` on a rejection
 * @property {string[]} vectors - the spec vectors this row covers
 */

/**
 * The `ident/*` band — every identifier the package accepts or refuses.
 *
 * One matrix, driven FOUR ways: against `getIdentifierAsSafeResult` directly,
 * and through each of the three parameters it serves — `constructorName`,
 * `taggedType` and `fctName`. That is what turns the source's "one helper
 * serves all three, and each keeps naming the parameter its caller passed" from
 * prose into an assertion, and it is why `define/R3`–`R6` and `brand/R2`–`R3`
 * carry only a representative row in the rejection matrices below.
 *
 * @type {Record<string, IdentifierRow>}
 */
export const identifierMatrix = {
  plainString: {
    description: 'a plain string',
    make: () => 'Foo',
    errorClass: null,
    value: 'Foo',
    vectors: ['ident/A1'],
  },
  paddedString: {
    description: 'a string padded on both edges',
    make: () => '  Foo  ',
    errorClass: null,
    value: 'Foo',
    vectors: ['ident/A2'],
  },
  innerSpaces: {
    description: 'a string whose inner spaces must survive the trim',
    make: () => '  a b  ',
    errorClass: null,
    value: 'a b',
    vectors: ['ident/A2'],
  },
  innerNewline: {
    description: 'a string whose inner newline must survive the trim',
    make: () => ' a\nb ',
    errorClass: null,
    value: 'a\nb',
    vectors: ['ident/A2'],
  },
  boxedString: {
    description: 'a boxed `String`, unwrapped to its primitive and then trimmed',
    make: () => new String(' Foo '),
    errorClass: null,
    value: 'Foo',
    vectors: ['ident/A3'],
  },
  number: {
    description: 'a number',
    make: () => 42,
    errorClass: TypeError,
    value: null,
    vectors: ['ident/R1'],
  },
  nullValue: {
    description: '`null`',
    make: () => null,
    errorClass: TypeError,
    value: null,
    vectors: ['ident/R1'],
  },
  undefinedValue: {
    description: '`undefined`',
    make: () => undefined,
    errorClass: TypeError,
    value: null,
    vectors: ['ident/R1'],
  },
  symbol: {
    description: 'a symbol',
    make: () => Symbol('x'),
    errorClass: TypeError,
    value: null,
    vectors: ['ident/R1'],
  },
  plainObject: {
    description: 'a plain object',
    make: () => ({}),
    errorClass: TypeError,
    value: null,
    vectors: ['ident/R1'],
  },
  emptyString: {
    description: 'the empty string',
    make: () => '',
    errorClass: RangeError,
    value: null,
    vectors: ['ident/R2'],
  },
  whitespaceString: {
    description: 'a whitespace-only string',
    make: () => '   ',
    errorClass: RangeError,
    value: null,
    vectors: ['ident/R2'],
  },
  boxedEmptyString: {
    description: 'a boxed empty `String` — unwrapped BEFORE the emptiness test',
    make: () => new String(''),
    errorClass: RangeError,
    value: null,
    vectors: ['ident/R3'],
  },
  boxedWhitespaceString: {
    description: 'a boxed whitespace-only `String`',
    make: () => new String('   '),
    errorClass: RangeError,
    value: null,
    vectors: ['ident/R3'],
  },
  stringSubclassInstance: {
    description: 'an instance of a `String` SUBCLASS',
    make: stringSubclassInstance,
    errorClass: TypeError,
    value: null,
    vectors: ['ident/R4'],
  },
  hostileBoxedString: {
    description: 'a `Proxy` over a boxed `String` whose every coercion path throws',
    make: hostileBoxedString,
    errorClass: TypeError,
    value: null,
    vectors: ['ident/B1'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  B/C — The Rejection Matrices
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** The non-error value the two wrapping conditions are measured with. */
export const THROWN_NON_ERROR = 'a thrown string, which is no error at all';

/**
 * @typedef {object} RejectionRow
 * @property {string} description - what the input is
 * @property {number} condition - the condition of the `.d.ts`'s ordered list
 * @property {() => unknown[]} make - the whole argument list, arity included
 * @property {ErrorConstructor | RangeErrorConstructor} errorClass - the reason's exact class
 * @property {string} [message] - the exact message; defaults to the condition's canonical one
 * @property {string} [messageIncludes] - a substring, where the ENGINE words the reason
 * @property {unknown} [cause] - the value the wrapper carries, on a wrapping row
 * @property {string[]} vectors - the spec vectors this row covers
 */

/**
 * `defineStableTypeIdentity`'s ordered list, one row per pinned input.
 *
 * Conditions 3–6 carry a single representative row each. Their exhaustive
 * coverage is the identifier matrix driven through this entry's two identifier
 * parameters; what these rows add is membership in the condition-completeness
 * guard, which asserts that the twelve conditions are covered with no gap.
 *
 * @type {Record<string, RejectionRow>}
 */
export const defineRejectionMatrix = {
  arrow: {
    description: 'an arrow function — no `[[Construct]]` slot',
    condition: 1,
    make: () => [arrowFunction(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  asyncFunction: {
    description: 'an `async` function',
    condition: 1,
    make: () => [asyncFunction(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  generatorFunction: {
    description: 'a generator function',
    condition: 1,
    make: () => [generatorFunction(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  conciseMethod: {
    description: 'a concise method',
    condition: 1,
    make: () => [conciseMethod(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  plainObject: {
    description: 'a plain object',
    condition: 1,
    make: () => [{}, 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  nullTarget: {
    description: '`null`',
    condition: 1,
    make: () => [null, 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  stringTarget: {
    description: 'a string',
    condition: 1,
    make: () => ['nope', 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  revokedProxy: {
    description: 'a REVOKED `Proxy` over a function — the construct probe cannot run',
    condition: 1,
    make: () => [revokedFunctionProxy(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R1'],
  },
  builtinArray: {
    description: '`Array` — a built-in, refused on the source read',
    condition: 2,
    make: () => [builtinArray(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  builtinDate: {
    description: '`Date`',
    condition: 2,
    make: () => [builtinDate(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  builtinSymbol: {
    description: '`Symbol`',
    condition: 2,
    make: () => [builtinSymbol(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  builtinFunction: {
    description: '`Function`',
    condition: 2,
    make: () => [builtinFunction(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  boundClass: {
    description: 'a bound class — `bind` stripped the own `prototype`',
    condition: 2,
    make: () => [boundClass(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  boundES3: {
    description: 'a bound ES3 function',
    condition: 2,
    make: () => [boundES3(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  proxyOverClass: {
    description: 'a `Proxy` over a class — the source read reports the native form',
    condition: 2,
    make: () => [proxyOverClass(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2', 'define/B3'],
  },
  descriptorTrapThrowingProxy: {
    description: 'a `Proxy` whose descriptor trap always throws — no shape can be read',
    condition: 2,
    make: () => [descriptorTrapThrowingProxy(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  frozenES3: {
    description: 'a frozen ES3 function — its `prototype` is no longer writable',
    condition: 2,
    make: () => [frozenES3(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  nonWritablePrototypeFunction: {
    description: 'a function whose own `prototype` was made non-writable',
    condition: 2,
    make: () => [nonWritablePrototypeFunction(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R2'],
  },
  nonStringName: {
    description:
      'a non-string `constructorName` (representative; see the identifier matrix)',
    condition: 3,
    make: () => [freshClass(), 42],
    errorClass: TypeError,
    vectors: ['define/R3'],
  },
  emptyName: {
    description: 'a `constructorName` that trims to empty (representative)',
    condition: 4,
    make: () => [freshClass(), '   '],
    errorClass: RangeError,
    vectors: ['define/R4'],
  },
  nonStringTag: {
    description: 'a supplied non-string `taggedType` (representative)',
    condition: 5,
    make: () => [freshClass(), 'Foo', 42],
    errorClass: TypeError,
    vectors: ['define/R5'],
  },
  explicitlyUndefinedTag: {
    description: 'an EXPLICIT `undefined` tag — a supplied argument, not an omitted one',
    condition: 5,
    make: () => [freshClass(), 'Foo', undefined],
    errorClass: TypeError,
    vectors: ['define/R5'],
  },
  emptyTag: {
    description: 'a `taggedType` that trims to empty (representative)',
    condition: 6,
    make: () => [freshClass(), 'Foo', new String('')],
    errorClass: RangeError,
    vectors: ['define/R6'],
  },
  alreadyFrozen: {
    description: 'a re-freeze — the first call closed the `name` slot',
    condition: 7,
    make: () => [frozenType('class').Frozen, 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R7'],
  },
  frozenClass: {
    description: 'an `Object.freeze`d class',
    condition: 7,
    make: () => [frozenClass(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R7'],
  },
  brandedClass: {
    description: 'a class the branding entry already closed',
    condition: 7,
    make: () => [brandedClass(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R7', 'brand/B3'],
  },
  lateThrowingDescriptorTrap: {
    description:
      'a `Proxy` whose `prototype` read throws AFTER the shape probe passed — the error itself',
    condition: 8,
    make: () => [
      lateDescriptorTrapThrowingProxy(new RangeError('the second read is refused'))
        .constructor,
      'Foo',
    ],
    errorClass: RangeError,
    message: 'the second read is refused',
    vectors: ['define/R8'],
  },
  lateThrowingDescriptorTrapNonError: {
    description:
      'the same trap throwing a non-error — wrapped, with the value as `cause`',
    condition: 8,
    make: () => [lateDescriptorTrapThrowingProxy(THROWN_NON_ERROR).constructor, 'Foo'],
    errorClass: Error,
    message: DEFINE_WRAPPER_MESSAGES[8],
    cause: THROWN_NON_ERROR,
    vectors: ['define/R8'],
  },
  numberPrototype: {
    description: 'a `prototype` holding a number',
    condition: 9,
    make: () => [withOwnPrototype(freshES3(), 42), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R9'],
  },
  stringPrototype: {
    description: 'a `prototype` holding a string',
    condition: 9,
    make: () => [withOwnPrototype(freshES3(), 'str'), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R9'],
  },
  nullPrototype: {
    description: 'a `prototype` holding `null`',
    condition: 9,
    make: () => [withOwnPrototype(freshES3(), null), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R9'],
  },
  undefinedPrototype: {
    description: 'a `prototype` holding `undefined`',
    condition: 9,
    make: () => [withOwnPrototype(freshES3(), undefined), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R9'],
  },
  frozenPrototypeObject: {
    description: 'a frozen prototype object — its `constructor` can no longer be shaped',
    condition: 10,
    make: () => [frozenPrototypeType(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R10'],
  },
  sealedConstructorSlot: {
    description: 'a prototype whose `constructor` was defined non-configurable',
    condition: 10,
    make: () => [sealedConstructorSlotType(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R10'],
  },
  sealedTagSlot: {
    description: 'a prototype carrying an own non-configurable `Symbol.toStringTag`',
    condition: 11,
    make: () => [sealedTagSlotType(), 'Foo'],
    errorClass: TypeError,
    vectors: ['define/R11'],
  },
  throwingDefineTrap: {
    description:
      'a prototype whose `defineProperty` trap throws — the error passes through',
    condition: 12,
    make: () => [
      constructorWithHostileDefineTrap(
        throwingDefineTrap(new RangeError('the define is refused')),
      ),
      'Foo',
    ],
    errorClass: RangeError,
    message: 'the define is refused',
    vectors: ['define/R12'],
  },
  throwingDefineTrapNonError: {
    description:
      'the same trap throwing a non-error — wrapped, with the value as `cause`',
    condition: 12,
    make: () => [
      constructorWithHostileDefineTrap(throwingDefineTrap(THROWN_NON_ERROR)),
      'Foo',
    ],
    errorClass: Error,
    message: DEFINE_WRAPPER_MESSAGES[12],
    cause: THROWN_NON_ERROR,
    vectors: ['define/R12'],
  },
  lyingDefineTrap: {
    description:
      'a prototype whose `defineProperty` trap LIES by returning falsish — the engine words it',
    condition: 12,
    make: () => [constructorWithHostileDefineTrap(lyingDefineTrap()), 'Foo'],
    errorClass: TypeError,
    messageIncludes: 'falsish',
    vectors: ['define/R12'],
  },
};

/**
 * `brandFunctionName`'s ordered list, five conditions.
 *
 * @type {Record<string, RejectionRow>}
 */
export const brandRejectionMatrix = {
  plainObject: {
    description: 'a plain object',
    condition: 1,
    make: () => [{}, 'Foo'],
    errorClass: TypeError,
    vectors: ['brand/R1'],
  },
  nullTarget: {
    description: '`null`',
    condition: 1,
    make: () => [null, 'Foo'],
    errorClass: TypeError,
    vectors: ['brand/R1'],
  },
  numberTarget: {
    description: 'a number',
    condition: 1,
    make: () => [42, 'Foo'],
    errorClass: TypeError,
    vectors: ['brand/R1'],
  },
  nonStringName: {
    description: 'a non-string `fctName` (representative; see the identifier matrix)',
    condition: 2,
    make: () => [arrowFunction(), 42],
    errorClass: TypeError,
    vectors: ['brand/R2'],
  },
  emptyName: {
    description: 'an `fctName` that trims to empty (representative)',
    condition: 3,
    make: () => [arrowFunction(), '   '],
    errorClass: RangeError,
    vectors: ['brand/R3'],
  },
  alreadyBranded: {
    description: 'a second brand on the same callable — the one-way door',
    condition: 4,
    make: () => [brandedCallable(), 'Other'],
    errorClass: TypeError,
    vectors: ['brand/R4'],
  },
  frozenCallable: {
    description: 'an `Object.freeze`d function',
    condition: 4,
    make: () => [frozenES3(), 'Foo'],
    errorClass: TypeError,
    vectors: ['brand/R4'],
  },
  revokedProxy: {
    description: 'a REVOKED `Proxy` — still callable, so it passes condition 1',
    condition: 4,
    make: () => [revokedFunctionProxy(), 'Foo'],
    errorClass: TypeError,
    vectors: ['brand/R4'],
  },
  throwingDefineTrap: {
    description:
      'a callable whose `defineProperty` trap throws — the error passes through',
    condition: 5,
    make: () => [
      callableWithHostileDefineTrap(
        throwingDefineTrap(new RangeError('the brand is refused')),
      ),
      'Foo',
    ],
    errorClass: RangeError,
    message: 'the brand is refused',
    vectors: ['brand/R5'],
  },
  throwingDefineTrapNonError: {
    description:
      'the same trap throwing a non-error — wrapped, with the value as `cause`',
    condition: 5,
    make: () => [
      callableWithHostileDefineTrap(throwingDefineTrap(THROWN_NON_ERROR)),
      'Foo',
    ],
    errorClass: Error,
    message: BRAND_WRAPPER_MESSAGES[5],
    cause: THROWN_NON_ERROR,
    vectors: ['brand/R5'],
  },
  lyingDefineTrap: {
    description: 'a callable whose `defineProperty` trap LIES by returning falsish',
    condition: 5,
    make: () => [callableWithHostileDefineTrap(lyingDefineTrap()), 'Foo'],
    errorClass: TypeError,
    messageIncludes: 'falsish',
    vectors: ['brand/R5'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Ordering Matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} OrderingRow
 * @property {string} description - the two-fault input and the condition it must report
 * @property {'defineStableTypeIdentity' | 'brandFunctionName'} entry - which entry is called
 * @property {() => unknown[]} make - the whole argument list
 * @property {number} condition - the condition that must WIN
 * @property {number} losing - the condition that would have fired had the order been the other way
 * @property {string[]} vectors - the spec vectors this row covers
 */

/**
 * The `ord/*` band — inputs that violate TWO conditions at once, where the
 * claim is which one is reported.
 *
 * Each row names the LOSING condition as well as the winning one, so the
 * assertion can say what the alternative would have been. A row whose two
 * conditions coincide would assert nothing, and the suite refuses one.
 *
 * @type {Record<string, OrderingRow>}
 */
export const orderingMatrix = {
  nonNewableWithBadName: {
    description: 'a non-newable with an invalid name — the target is judged first',
    entry: 'defineStableTypeIdentity',
    make: () => [arrowFunction(), 42],
    condition: 1,
    losing: 3,
    vectors: ['ord/A1'],
  },
  builtinWithBadName: {
    description: 'a built-in with an invalid name — the shape gate still runs first',
    entry: 'defineStableTypeIdentity',
    make: () => [builtinArray(), 42],
    condition: 2,
    losing: 3,
    vectors: ['ord/A2'],
  },
  frozenWithBadName: {
    description: 'an already-frozen class with an invalid name — arguments settle first',
    entry: 'defineStableTypeIdentity',
    make: () => [frozenType('class').Frozen, 42],
    condition: 3,
    losing: 7,
    vectors: ['ord/A3'],
  },
  frozenWithBadTag: {
    description: 'an already-frozen class with an invalid tag — likewise',
    entry: 'defineStableTypeIdentity',
    make: () => [frozenType('class').Frozen, 'Foo', 42],
    condition: 5,
    losing: 7,
    vectors: ['ord/A4'],
  },
  badNameAndBadTag: {
    description: 'an invalid name AND an invalid tag — the name is verified first',
    entry: 'defineStableTypeIdentity',
    make: () => [freshClass(), 42, 42],
    condition: 3,
    losing: 5,
    vectors: ['ord/A5'],
  },
  frozenWithOmittedTag: {
    description:
      'an already-frozen class with the tag OMITTED — presence is settled before validity',
    entry: 'defineStableTypeIdentity',
    make: () => [frozenType('class').Frozen, 'Foo'],
    condition: 7,
    losing: 5,
    vectors: ['ord/A6'],
  },
  brandedWithBadName: {
    description:
      'an already-branded callable with an invalid name — the same rule holds here',
    entry: 'brandFunctionName',
    make: () => [brandedCallable(), 42],
    condition: 2,
    losing: 4,
    vectors: ['ord/A7'],
  },
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  D — The Verification Matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} VerdictRow
 * @property {string} description - what the candidate is
 * @property {() => unknown} make - the candidate, fresh
 * @property {boolean} expected - the verdict
 * @property {boolean} [intrinsic] - whether the candidate is a SHARED realm intrinsic
 * @property {string[]} vectors - the spec vectors this row covers
 */

/**
 * The `carry/*` band, as verdicts.
 *
 * The vectors whose claim has a SECOND half — the tag a shadowing value
 * answers, the getter that must go uninvoked, the instance that keeps its
 * verdict after its type lost one — are not here. A row can only carry a
 * boolean, and reducing those to one would assert the smaller half of each
 * claim; they are hand-written in `verification.test.js` instead. The foreign-
 * realm rows live in `cross-realm.test.js` for the same reason the fixtures do.
 *
 * @type {Record<string, VerdictRow>}
 */
export const verificationMatrix = {
  frozenClass: {
    description: 'a frozen class constructor',
    make: () => frozenType('class').Frozen,
    expected: true,
    vectors: ['carry/A1'],
  },
  frozenClassInstance: {
    description: 'an instance of a frozen class — the other side of the relation',
    make: () => instantiate(frozenType('class').Frozen),
    expected: true,
    vectors: ['carry/A2'],
  },
  frozenES3Instance: {
    description: 'an instance of a frozen ES3 constructor function',
    make: () => instantiate(frozenType('es3').Frozen),
    expected: true,
    vectors: ['carry/A3'],
  },
  handForged: {
    description: 'a hand-forged shape that never went through this package',
    make: handForgedIdentity,
    expected: true,
    vectors: ['carry/A4'],
  },
  handForgedInstance: {
    description: 'an instance of a hand-forged shape',
    make: () => instantiate(handForgedIdentity()),
    expected: true,
    vectors: ['carry/A4'],
  },
  nullValue: {
    description: '`null`',
    make: () => null,
    expected: false,
    vectors: ['carry/R1'],
  },
  undefinedValue: {
    description: '`undefined`',
    make: () => undefined,
    expected: false,
    vectors: ['carry/R1'],
  },
  number: {
    description: 'a number',
    make: () => 42,
    expected: false,
    vectors: ['carry/R2'],
  },
  string: {
    description: 'a string',
    make: () => 'str',
    expected: false,
    vectors: ['carry/R2'],
  },
  symbol: {
    description: 'a symbol',
    make: () => Symbol('s'),
    expected: false,
    vectors: ['carry/R2'],
  },
  plainObject: {
    description: 'a plain object',
    make: () => ({}),
    expected: false,
    vectors: ['carry/R3'],
  },
  unfrozenClass: {
    description: 'an unfrozen class',
    make: freshClass,
    expected: false,
    vectors: ['carry/R4'],
  },
  unfrozenClassInstance: {
    description: 'an instance of an unfrozen class',
    make: () => instantiate(freshClass()),
    expected: false,
    vectors: ['carry/R4'],
  },
  promiseConstructor: {
    intrinsic: true,
    description: '`Promise` — a tag that is a configurable DATA property',
    make: () => Promise,
    expected: false,
    vectors: ['carry/R5'],
  },
  arrayConstructor: {
    intrinsic: true,
    description: '`Array` — a prototype carrying no tag at all',
    make: builtinArray,
    expected: false,
    vectors: ['carry/R5'],
  },
  mathNamespace: {
    intrinsic: true,
    description: '`Math` — tagged, and not a constructor',
    make: () => Math,
    expected: false,
    vectors: ['carry/R5'],
  },
  promiseInstance: {
    description: 'a promise',
    make: () => Promise.resolve(),
    expected: false,
    vectors: ['carry/R5'],
  },
  brandedOnly: {
    // the row's claim is `carry/R6` alone. `brand/B2` says more than a verdict
    // — no identity on the constructor, none on its instances, and the tag
    // unchanged — so it is asserted whole in `spec.test.js` rather than cited
    // here for a boolean that carries a third of it. A citation the assertion
    // does not earn is what would hollow out `vector-coverage.test.js`.
    description: 'a callable that was only BRANDED — branding installs no identity',
    make: brandedCallable,
    expected: false,
    vectors: ['carry/R6'],
  },
  boundViewOfFrozen: {
    description:
      'a bound view of a frozen constructor — its own `name` is `bound Frozen`',
    make: () => frozenType('class').Frozen.bind(null),
    expected: false,
    vectors: ['carry/R7'],
  },
  descriptorTrapThrowingProxy: {
    description: 'a `Proxy` whose descriptor trap throws',
    make: descriptorTrapThrowingProxy,
    expected: false,
    vectors: ['carry/R8'],
  },
  prototypeTrapThrowingProxy: {
    description: 'a `Proxy` whose `getPrototypeOf` trap throws',
    make: prototypeTrapThrowingProxy,
    expected: false,
    vectors: ['carry/R8'],
  },
  frozenPrototypeObject: {
    description: "a frozen constructor's PROTOTYPE object — neither side of the relation",
    make: () => prototypeOf(frozenType('class').Frozen),
    expected: false,
    vectors: ['carry/B3'],
  },
};

/**
 * The `carry/B1` near-misses: all three criteria are load-bearing, and so is
 * the tag being a getter-ONLY accessor.
 *
 * Built as a separate group because every row shares one expectation and one
 * vector; scoring them in the main matrix would say six times what the group
 * says once, and would hide that they are variations of a single claim.
 *
 * @returns {Record<string, () => unknown>} the named near-misses
 */
export const verificationNearMisses = () => carryNearMisses();

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  E — The Shape-Gate Matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} ShapeRow
 * @property {string} description - what the candidate is
 * @property {() => unknown} make - the candidate, fresh
 * @property {boolean} expected - the verdict
 * @property {boolean} withinPrecondition - whether the candidate is actually newable
 * @property {boolean} [intrinsic] - whether the candidate is a SHARED realm intrinsic
 * @property {string[]} vectors - the spec vectors this row covers
 */

/**
 * The `shape/*` band — `isSupportedConstructor`, scored directly.
 *
 * The helper's precondition is that the value is ALREADY known newable, which
 * is why it gets its own matrix rather than a second column in the verification
 * one: most of that universe is not newable, and a cell scoring the helper
 * there would be reporting a sentinel as though it were a claim.
 *
 * `withinPrecondition` is what keeps the one deliberate violation honest.
 * `shape/B2` is in the matrix because the answer it gives is worth pinning, and
 * flagged because that answer is not a claim the helper makes.
 *
 * @type {Record<string, ShapeRow>}
 */
export const shapeMatrix = {
  es3Function: {
    description: 'an ES3 constructor function',
    make: freshES3,
    expected: true,
    withinPrecondition: true,
    vectors: ['shape/A1'],
  },
  classConstructor: {
    description: 'a `class`-syntax constructor',
    make: freshClass,
    expected: true,
    withinPrecondition: true,
    vectors: ['shape/A1'],
  },
  subclassConstructor: {
    description: 'a subclass constructor',
    make: () => freshClassHierarchy().Derived,
    expected: true,
    withinPrecondition: true,
    vectors: ['shape/A1'],
  },
  builtinArray: {
    intrinsic: true,
    description: '`Array` — refused on the source read',
    make: builtinArray,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R1'],
  },
  builtinDate: {
    intrinsic: true,
    description: '`Date`',
    make: builtinDate,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R1'],
  },
  builtinSymbol: {
    intrinsic: true,
    description: '`Symbol`',
    make: builtinSymbol,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R1'],
  },
  builtinFunction: {
    intrinsic: true,
    description: '`Function`',
    make: builtinFunction,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R1'],
  },
  boundClass: {
    description: 'a bound class — no own `prototype` for either arm to read',
    make: boundClass,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R2'],
  },
  boundES3: {
    description: 'a bound ES3 function',
    make: boundES3,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R2'],
  },
  frozenES3: {
    description: 'a frozen ES3 function — not writable, and not `class`-sourced',
    make: frozenES3,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R3'],
  },
  nonWritablePrototypeFunction: {
    description: 'a function whose own `prototype` was made non-writable',
    make: nonWritablePrototypeFunction,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/R3'],
  },
  proxyOverES3: {
    description: 'a `Proxy` over an ES3 function — the descriptor read passes through',
    make: proxyOverES3,
    expected: true,
    withinPrecondition: true,
    vectors: ['shape/B1'],
  },
  proxyOverClass: {
    description: 'a `Proxy` over a class — the source read reports the native form',
    make: proxyOverClass,
    expected: false,
    withinPrecondition: true,
    vectors: ['shape/B1'],
  },
  boundNewableWithGraftedPrototype: {
    description: 'a bound newable handed an own writable `prototype` by hand',
    make: boundNewableWithGraftedPrototype,
    expected: true,
    withinPrecondition: true,
    vectors: ['define/B4'],
  },
  arrowWithGraftedPrototype: {
    description: 'an arrow handed an own writable `prototype` — OUTSIDE the precondition',
    make: arrowWithGraftedPrototype,
    expected: true,
    withinPrecondition: false,
    vectors: ['shape/B2'],
  },
};

/**
 * The values `shape/B2` calls the helper's SENTINEL rather than its claim —
 * every one of them outside the precondition, and every one answering `false`.
 *
 * @returns {Record<string, () => unknown>} the named sentinel inputs
 */
export const shapeSentinelInputs = () => ({
  number: () => 42,
  nullValue: () => null,
  plainObject: () => ({}),
  bareArrow: arrowFunction,
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Axis 3 — The Never-Throws Matrix
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * @typedef {object} HostileRow
 * @property {string} description - the hostile class
 * @property {() => unknown} make - the hostile value, fresh
 * @property {{ defineStableTypeIdentity: boolean, brandFunctionName: boolean, doesCarryStableTypeIdentity: boolean }} expected -
 *  the honest outcome of each entry: `success` for the two mutators, the verdict
 *  for the predicate
 * @property {string} [note] - why an outcome is the surprising one
 */

/**
 * The hostile TARGETS, scored against all three entries at once.
 *
 * The claim under test is one the verdicts cannot state: that no input makes an
 * entry throw. Every cell asserts BOTH halves — that the call returned, and
 * that what it returned is the honest answer — because a suite asserting only
 * the first would pass against an entry that swallowed everything into a
 * constant.
 *
 * Several rows diverge across the columns, and the divergences are the reason
 * this is one matrix rather than three. A prototype whose `defineProperty` trap
 * is hostile defeats the freezing entry and leaves the branding entry
 * untouched, because branding never reads a prototype; a `Proxy` that throws on
 * the SECOND `prototype` read defeats the freezing entry only, since nothing
 * else reads that slot twice. Scored separately, each of those would look like
 * a property of the hostile value rather than of the entry.
 *
 * @type {Record<string, HostileRow>}
 */
export const hostileTargetMatrix = {
  revokedProxy: {
    description: 'a revoked `Proxy` over a function',
    make: revokedFunctionProxy,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: false,
    },
    note: 'still callable, so the branding entry reaches its shapeability probe',
  },
  descriptorTrapThrowingProxy: {
    description: 'a `Proxy` whose `getOwnPropertyDescriptor` trap always throws',
    make: descriptorTrapThrowingProxy,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: false,
    },
  },
  lateDescriptorTrapThrowingProxy: {
    description: 'a `Proxy` whose `prototype` read throws on the SECOND read',
    make: () => lateDescriptorTrapThrowingProxy(new RangeError('refused')).constructor,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: true,
      doesCarryStableTypeIdentity: false,
    },
    note: 'branding never reads a prototype, so the second read never happens',
  },
  hostileDefineTrapOnPrototype: {
    description: "a constructor whose PROTOTYPE's `defineProperty` trap throws",
    make: () =>
      constructorWithHostileDefineTrap(throwingDefineTrap(new RangeError('refused'))),
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: true,
      doesCarryStableTypeIdentity: false,
    },
    note: 'the branding entry writes to the callable, never to its prototype',
  },
  lyingDefineTrapOnPrototype: {
    description: "a constructor whose PROTOTYPE's `defineProperty` trap returns falsish",
    make: () => constructorWithHostileDefineTrap(lyingDefineTrap()),
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: true,
      doesCarryStableTypeIdentity: false,
    },
  },
  hostileDefineTrapOnCallable: {
    description: 'a callable `Proxy` whose own `defineProperty` trap throws',
    make: () =>
      callableWithHostileDefineTrap(throwingDefineTrap(new RangeError('refused'))),
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: false,
    },
    note: 'both entries write to the callable itself, so both are refused',
  },
  frozenCallable: {
    description: 'a frozen function — no slot can be shaped',
    make: frozenES3,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: false,
    },
  },
  prototypeTrapThrowingProxy: {
    description: 'a `Proxy` over a plain object whose `getPrototypeOf` trap throws',
    make: prototypeTrapThrowingProxy,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: false,
    },
    note: 'not callable at all, so both mutators stop at condition 1',
  },
  throwingTagGetter: {
    description: 'a forged identity whose tag getter throws when invoked',
    make: () => inertReadProbeType().constructor,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: true,
    },
    note: 'the verdict is `true` because the read is inert — the getter is never called',
  },
  hostileBoxedString: {
    description: 'a `Proxy` over a boxed `String` whose every coercion path throws',
    make: hostileBoxedString,
    expected: {
      defineStableTypeIdentity: false,
      brandFunctionName: false,
      doesCarryStableTypeIdentity: false,
    },
    note: 'as a TARGET rather than as an identifier — neither newable nor callable',
  },
};

/**
 * The hostile IDENTIFIERS, passed to each of the three identifier parameters
 * against a benign target.
 *
 * A separate group because the hostility is in a different argument: these say
 * nothing about what may be frozen, and everything about the entries staying
 * total while a value refuses to be read.
 *
 * @returns {Record<string, { description: string, make: () => unknown, errorClass: ErrorConstructor | RangeErrorConstructor }>} the identifiers
 */
export const hostileIdentifiers = () => ({
  hostileBoxedString: {
    description: 'a boxed `String` whose every coercion path throws',
    make: hostileBoxedString,
    errorClass: TypeError,
  },
  stringSubclassInstance: {
    description: 'an instance of a `String` subclass',
    make: stringSubclassInstance,
    errorClass: TypeError,
  },
  symbol: {
    description: 'a symbol, which every implicit coercion refuses',
    make: () => Symbol('hostile'),
    errorClass: TypeError,
  },
  boxedEmptyString: {
    description: 'a boxed empty `String`',
    make: () => new String(''),
    errorClass: RangeError,
  },
});

/**
 * The hostile CONSTRUCTORS the error-cause seam is probed with.
 *
 * A third argument group, because the seam's declared parameter is an
 * `ErrorConstructor` — a hostile value there is a constructor that misbehaves
 * when constructed, not a non-constructor. The marker promises totality within
 * the declared type, so feeding it something else would test nothing about the
 * marker and report a defect that is not one.
 *
 * @returns {Record<string, { description: string, make: () => unknown }>} the constructors
 */
export const hostileErrorConstructors = () => ({
  throwingOnConstruction: {
    description: 'a constructor that throws when probed',
    make: () => ThrowingError,
  },
  throwingConstructTrap: {
    description: 'a `Proxy` over `Error` whose `construct` trap throws',
    make: () =>
      new Proxy(Error, {
        construct() {
          throw new TypeError('the construct trap refuses');
        },
      }),
  },
  ignoringTheOptionsBag: {
    description: 'a constructor that silently ignores the options bag',
    make: () => IgnoringError,
  },
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Standing Corpus
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Every candidate the package is specified over, as fresh values.
 *
 * What the standing invariants are checked against. A law over the corpus
 * covers the space BETWEEN vectors: a regression that moves one value shows up
 * in the matrices, while one that changes the SHAPE of an answer — a result
 * losing its discriminant, a rejection acquiring a side effect, a predicate
 * becoming constant — is what only a law can see.
 *
 * @returns {{ key: string, value: unknown, intrinsic: boolean }[]} the corpus
 */
export const corpus = () => [
  ...Object.entries(verificationMatrix).map(([key, row]) => ({
    key,
    value: row.make(),
    intrinsic: row.intrinsic === true,
  })),
  ...Object.entries(shapeMatrix).map(([key, row]) => ({
    key: `shape:${key}`,
    value: row.make(),
    intrinsic: row.intrinsic === true,
  })),
  ...Object.entries(hostileTargetMatrix).map(([key, row]) => ({
    key: `hostile:${key}`,
    value: row.make(),
    intrinsic: false,
  })),
  {
    key: 'halfwayFailingType',
    value: halfwayFailingType().constructor,
    intrinsic: false,
  },
  { key: 'freshES3', value: freshES3(), intrinsic: false },
  { key: 'freshClass', value: freshClass(), intrinsic: false },
];

/**
 * The corpus with every SHARED realm intrinsic removed — the only corpus a law
 * that calls a mutator may use.
 *
 * Both mutators are one-way doors, and a built-in is the one candidate nobody
 * can make a fresh copy of. `brandFunctionName` admits any callable, `Promise`
 * and `Array` included (`brand/B1`), so a law that branded the whole corpus
 * would rename this realm's intrinsics for the rest of the process — and every
 * later fixture that reads a built-in's `name` would be measuring the law
 * rather than the package.
 *
 * The exclusion is by DECLARATION rather than by a `typeof` guess: a row says
 * whether its candidate is an intrinsic, and `invariants.test.js` asserts the
 * flag is set on something, so an intrinsic arriving unflagged is caught.
 *
 * @returns {{ key: string, value: unknown }[]} the mutable corpus
 */
export const mutableCorpus = () => corpus().filter((entry) => !entry.intrinsic);
