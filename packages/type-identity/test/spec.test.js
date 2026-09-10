// @ts-check

/**
 * @module test/spec
 *
 * Axis 1 — the two MUTATORS: what freezing and branding land, what they refuse,
 * and in which order. Dimensions B and C of
 * `docs/spec/TYPE-IDENTITY.spec.md` (FROZEN 2026-09-09), plus the `ord/*` band
 * that spans them.
 *
 * If a test here fails, the implementation is wrong, not the test.
 *
 * ## Why this suite is not one matrix
 *
 * A mutator's contract is not an accept/reject matrix. `defineStableTypeIdentity`
 * has twelve ordered conditions and `brandFunctionName` five, the first blocking
 * one ends the attempt, and the oracle is therefore _which reason, in which
 * order_. So the file has two halves that answer different questions.
 *
 * The rejection halves ARE matrix-driven, because "input → condition, class,
 * message" tiles exactly. What they add over a hand-written list is the
 * completeness guard: the conditions covered must be the full run 1…n with no
 * gap, so a thirteenth condition arriving in the contract cannot be met by a
 * silently unchanged suite.
 *
 * The accepting halves are hand-written, because no two of them observe the
 * same thing — one reads three descriptors, one calls a getter with a foreign
 * receiver, one counts defines through a trap. A matrix cell would have to
 * carry a function to make each row's observation, at which point it is a list
 * of tests wearing a table's clothes.
 *
 * ## The source oracle
 *
 * The first block asserts nothing about behavior. It reads the `.d.ts`'s own
 * numbered lists and checks them against what this suite covers — the
 * mechanically checkable half of CLAUDE.md's twin-list rule, and the drift it
 * names by example: `defineStableTypeIdentity`'s decider list sat at eleven for
 * a round after its contract went to twelve.
 *
 * `ident/*`, `shape/*` and `cause/*` are in `helpers.test.js`; `carry/*` in
 * `verification.test.js`; `realm/*` and the two vectors whose effect is
 * permanent in `cross-realm.test.js`.
 */

import { describe, it, expect } from 'vitest';

import { defineStableTypeIdentity, doesCarryStableTypeIdentity } from '#index';
import { defineProperty } from '#config';

import {
  BRAND_CONDITION_MESSAGES,
  CONDITION_COUNTS,
  DEFINE_CONDITION_MESSAGES,
  brandRejectionMatrix,
  brandedCallable,
  callBrand,
  callDefine,
  callEntry,
  conditionOfMessage,
  defineRejectionMatrix,
  frozenType,
  orderingMatrix,
} from './__config.js';
import {
  arrowFunction,
  asyncFunction,
  boundES3,
  freshClass,
  freshClassHierarchy,
  freshES3,
  freshPrototypeSharingPair,
  freshShadowedTagHierarchy,
  halfwayFailingType,
  instantiate,
  ownDescriptorOf,
  boundNewableWithGraftedPrototype,
  prototypeOf,
  proxyOverES3,
  tagOf,
  withOwnPrototype,
  withdrawingPrototypeProxy,
  withdrawingPrototypeProxyOverOrdinaryFunction,
} from './__fixtures.js';
import { parseNumberedRuns } from './_source-oracles.js';

/** @typedef {import('#index').IdentityDefinitionResult} IdentityDefinitionResult */
/** @typedef {import('./__config.js').RejectionRow} RejectionRow */

/** @type {Record<number, string>} */
const defineMessages = DEFINE_CONDITION_MESSAGES;
/** @type {Record<number, string>} */
const brandMessages = BRAND_CONDITION_MESSAGES;

/**
 * The reason a failing result carries, with the failing arm established rather
 * than assumed.
 *
 * A successful result reaching here would otherwise skip every assertion below
 * it silently, which is the vacuous-test shape the workspace refuses. The throw
 * is what makes the skip loud.
 *
 * @param {IdentityDefinitionResult} result - the entry's result
 * @param {string} label - the row, for the failure message
 * @returns {Error & { cause?: unknown }} the reason
 */
function reasonOf(result, label) {
  if (result.success) {
    throw new Error(`${label} — expected a rejection, the call succeeded`);
  }

  return /** @type {Error & { cause?: unknown }} */ (result.reason);
}

/**
 * Asserts a rejection row: the exact class, the message, and the `cause` on the
 * two conditions that wrap a non-error throw.
 *
 * The class is compared by IDENTITY rather than with `toBeInstanceOf`, which a
 * `TypeError` would satisfy for a row expecting the bare `Error` wrapper.
 *
 * @param {IdentityDefinitionResult} result - the entry's result
 * @param {RejectionRow} row - the row being driven
 * @param {Record<number, string>} messages - the entry's canonical message map
 * @param {string} label - the row key, for the failure message
 * @returns {void}
 */
function assertRejection(result, row, messages, label) {
  const reason = reasonOf(result, label);

  expect(reason.constructor, `${label} — the reason's class`).toBe(row.errorClass);

  if (row.messageIncludes === undefined) {
    const expected = row.message ?? messages[row.condition];

    if (expected === undefined) {
      throw new Error(
        `${label} — condition ${String(row.condition)} words no message of its own, ` +
          'so the row must state one',
      );
    }
    expect(reason.message, `${label} — the reason's message`).toBe(expected);
  } else {
    expect(reason.message, `${label} — the reason's message`).toContain(
      row.messageIncludes,
    );
  }

  if ('cause' in row) {
    expect(reason.cause, `${label} — the wrapper's cause`).toBe(row.cause);
  }
}

/**
 * The conditions a rejection matrix covers, sorted and de-duplicated.
 *
 * @param {Record<string, RejectionRow>} matrix - the matrix to read
 * @returns {number[]} the covered conditions
 */
const coveredConditions = (matrix) =>
  [...new Set(Object.values(matrix).map((row) => row.condition))].sort((a, b) => a - b);

/**
 * @param {number} count - how many conditions the entry has
 * @returns {number[]} the full run, `1` through `count`
 */
const runOf = (count) => Array.from({ length: count }, (_, index) => index + 1);

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Source Oracle
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — the ordered contract, as the source numbers it', () => {
  it('the `.d.ts` carries exactly two numbered lists, of twelve and of five', () => {
    const runs = parseNumberedRuns('index.d.ts');

    expect(
      runs.map((run) => run.length),
      'the rejection-order lists of the two freezing entries, in file order',
    ).toEqual([
      CONDITION_COUNTS.defineStableTypeIdentity,
      CONDITION_COUNTS.brandFunctionName,
    ]);
  });

  it('each list numbers its conditions contiguously from one', () => {
    const runs = parseNumberedRuns('index.d.ts');

    expect(runs.length, 'the parser found no list at all').toBeGreaterThan(0);

    for (const [index, run] of runs.entries()) {
      expect(run, `numbered list ${String(index + 1)}`).toEqual(runOf(run.length));
    }
  });

  it('the `.js` twin tiles the `.d.ts` numbering exactly, run for run', () => {
    const declared = parseNumberedRuns('index.d.ts');
    const implemented = parseNumberedRuns('index.js');

    // CLAUDE.md's twin rule, as an instrument rather than a convention: the
    // implementation side may GROUP (`1.–2.`) but the expansion must cover the
    // contract's numbering with no gap and no overlap. The drift this catches is
    // the one CLAUDE.md names by example — a decider list left at eleven after
    // the contract went to twelve.
    expect(implemented.length, 'one run per numbered contract list').toBe(
      declared.length,
    );

    for (const [index, run] of declared.entries()) {
      expect(implemented[index], `numbered list ${String(index + 1)}`).toEqual(run);
    }
  });

  it('the freezing matrix covers all twelve conditions, with no gap', () => {
    expect(coveredConditions(defineRejectionMatrix)).toEqual(
      runOf(CONDITION_COUNTS.defineStableTypeIdentity),
    );
  });

  it('the branding matrix covers all five conditions, with no gap', () => {
    expect(coveredConditions(brandRejectionMatrix)).toEqual(
      runOf(CONDITION_COUNTS.brandFunctionName),
    );
  });

  it('the canonical messages are pairwise distinct, which is what makes an ordinal recoverable', () => {
    for (const messages of [DEFINE_CONDITION_MESSAGES, BRAND_CONDITION_MESSAGES]) {
      const texts = Object.values(messages);

      expect(texts.length, 'an empty message map would pass vacuously').toBeGreaterThan(
        0,
      );
      expect(new Set(texts).size, 'two conditions sharing one message').toBe(
        texts.length,
      );
    }
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  B — What Freezing Lands
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — B: what freezing lands (define/A*)', () => {
  it('define/A1 — a class takes the name, the tag and both verdicts', () => {
    const C = freshClass();

    expect(callDefine([C, 'Foo'])).toEqual({ success: true });
    expect(C.name).toBe('Foo');
    expect(tagOf(instantiate(C))).toBe('[object Foo]');
    expect(doesCarryStableTypeIdentity(C)).toBe(true);
    expect(doesCarryStableTypeIdentity(instantiate(C))).toBe(true);
  });

  it('define/A2 — an ES3 constructor function does the same', () => {
    const F = freshES3();

    expect(callDefine([F, 'Foo'])).toEqual({ success: true });
    expect(F.name).toBe('Foo');
    expect(tagOf(instantiate(F))).toBe('[object Foo]');
    expect(doesCarryStableTypeIdentity(F)).toBe(true);
    expect(doesCarryStableTypeIdentity(instantiate(F))).toBe(true);
  });

  it('define/A3 — a tag differing from the name succeeds, and says so', () => {
    const C = freshClass();

    expect(callDefine([C, 'Bar', 'Baz'])).toEqual({
      success: true,
      warning:
        '2 different identifiers have been assigned, "Bar" as constructor name and "Baz" as tagged type.',
    });
    expect(tagOf(instantiate(C))).toBe('[object Baz]');
  });

  it('define/A4 — the result carries exactly the keys its arm defines', () => {
    expect(Object.keys(callDefine([freshClass(), 'Foo']))).toEqual(['success']);
    expect(Object.keys(callDefine([freshClass(), 'Bar', 'Baz']))).toEqual([
      'success',
      'warning',
    ]);
    expect(Object.keys(callDefine([{}, 'Foo']))).toEqual(['success', 'reason']);
  });

  it('define/A5 — the warning compares the NORMALIZED identifiers', () => {
    expect(callDefine([freshClass(), 'Foo', '  Foo  '])).toEqual({ success: true });
    expect(callDefine([freshClass(), 'Foo', new String('Foo')])).toEqual({
      success: true,
    });
  });

  it('define/A6 — the three installed descriptors are exactly these', () => {
    const C = freshClass();

    expect(callDefine([C, 'Foo']).success).toBe(true);

    const tag = ownDescriptorOf(prototypeOf(C), Symbol.toStringTag);

    expect(typeof tag?.get, "the tag's getter").toBe('function');
    expect(tag?.set, 'the tag is getter-ONLY').toBeUndefined();
    expect(tag?.enumerable).toBe(false);
    expect(tag?.configurable).toBe(false);

    expect(ownDescriptorOf(prototypeOf(C), 'constructor')).toEqual({
      value: C,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    expect(ownDescriptorOf(C, 'name')).toEqual({
      value: 'Foo',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  });

  it('define/A7 — the getter closes over the tag, so no receiver can change its answer', () => {
    const C = freshClass();

    expect(callDefine([C, 'Foo']).success).toBe(true);

    const getter = /** @type {() => unknown} */ (
      ownDescriptorOf(prototypeOf(C), Symbol.toStringTag)?.get
    );

    expect(typeof getter).toBe('function');
    expect(getter.call({}), 'an unrelated receiver').toBe('Foo');
    expect(getter.call(null), 'no receiver at all').toBe('Foo');
    expect(() =>
      defineProperty(prototypeOf(C), Symbol.toStringTag, { get: () => 'Other' }),
    ).toThrow(TypeError);
  });

  it('define/A8 — a reassigned ES3 prototype is the object that gets frozen', () => {
    const F = freshES3();
    const replacement = {
      /** @returns {string} a value, so the replacement is not bare */
      identify() {
        return 'replacement';
      },
    };

    withOwnPrototype(F, replacement);

    expect(callDefine([F, 'Foo']).success).toBe(true);
    expect(ownDescriptorOf(replacement, 'constructor')?.value).toBe(F);
    expect(tagOf(instantiate(F))).toBe('[object Foo]');
  });

  it('define/A9 — two constructors may take the same name and tag; nothing is registered', () => {
    const First = freshClass();
    const Second = freshES3();

    expect(callDefine([First, 'Same']).success).toBe(true);
    expect(callDefine([Second, 'Same']).success).toBe(true);
    expect(First.name).toBe('Same');
    expect(Second.name).toBe('Same');
    expect(doesCarryStableTypeIdentity(First)).toBe(true);
    expect(doesCarryStableTypeIdentity(Second)).toBe(true);
  });

  it('define/A10 — a CALLABLE prototype is accepted; the gate is object-or-callable', () => {
    const F = freshES3();
    const callablePrototype = /** @type {object} */ (
      /** @type {unknown} */ (
        function inner() {
          return undefined;
        }
      )
    );

    withOwnPrototype(F, callablePrototype);

    expect(callDefine([F, 'Foo']).success).toBe(true);
    expect(ownDescriptorOf(callablePrototype, 'constructor')?.value).toBe(F);
    expect(doesCarryStableTypeIdentity(F)).toBe(true);
  });

  it('define/A11 — an inherited non-configurable tag does not block a derived class', () => {
    const { Base, Derived } = freshShadowedTagHierarchy();

    expect(tagOf(instantiate(Base)), 'the base already answers its own tag').toBe(
      '[object Base]',
    );
    expect(callDefine([Derived, 'Derived']).success).toBe(true);
    expect(tagOf(instantiate(Derived))).toBe('[object Derived]');
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  B — The Boundaries
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — B: the boundaries (define/B*)', () => {
  it('define/B1 — freezing SLOTS is not freezing objects', () => {
    const { Frozen } = frozenType('class');
    const prototype = prototypeOf(Frozen);

    expect(Object.isExtensible(Frozen)).toBe(true);
    expect(Object.isExtensible(prototype)).toBe(true);

    defineProperty(prototype, 'addedMember', { value: 1, configurable: true });
    defineProperty(Frozen, 'addedStatic', { value: 2, configurable: true });

    expect(ownDescriptorOf(prototype, 'addedMember')?.value).toBe(1);
    expect(ownDescriptorOf(Frozen, 'addedStatic')?.value).toBe(2);
  });

  it('define/B2 — an ES3 `prototype` pointer stays writable, and a swap replaces the type', () => {
    const { Frozen } = frozenType('es3');
    const original = prototypeOf(Frozen);
    const before = instantiate(Frozen);

    expect(ownDescriptorOf(Frozen, 'prototype')).toMatchObject({
      writable: true,
      configurable: false,
    });
    expect(doesCarryStableTypeIdentity(before)).toBe(true);

    withOwnPrototype(Frozen, {});

    expect(prototypeOf(Frozen), 'the assignment took effect').not.toBe(original);
    expect(doesCarryStableTypeIdentity(Frozen)).toBe(false);
    expect(tagOf(instantiate(Frozen))).toBe('[object Object]');

    // nothing was unfrozen: the frozen prototype still carries both slots, and
    // every value already built from it keeps its tag and its verdict
    expect(ownDescriptorOf(original, 'constructor')?.value).toBe(Frozen);
    expect(doesCarryStableTypeIdentity(before)).toBe(true);
    expect(tagOf(before)).toBe('[object Frozen]');
  });

  it("define/B2 — a class's `prototype` pointer is the read-only one the language made it", () => {
    const { Frozen } = frozenType('class');

    expect(ownDescriptorOf(Frozen, 'prototype')).toMatchObject({
      writable: false,
      configurable: false,
    });
    expect(() => withOwnPrototype(Frozen, {})).toThrow(TypeError);
    expect(doesCarryStableTypeIdentity(Frozen)).toBe(true);
  });

  it('define/B3 — a `Proxy` over an ES3 function is admitted where one over a class is not', () => {
    expect(callDefine([proxyOverES3(), 'Foo']).success).toBe(true);

    const overClass = callDefine([
      /** @type {unknown} */ (new Proxy(freshClass(), {})),
      'Foo',
    ]);

    expect(
      conditionOfMessage(
        'defineStableTypeIdentity',
        reasonOf(overClass, 'define/B3').message,
      ),
    ).toBe(2);
  });

  it('define/B4 — a grafted bound newable freezes, and constructs from somewhere else', () => {
    const bound = boundNewableWithGraftedPrototype();
    const grafted = prototypeOf(bound);

    expect(callDefine([bound, 'Grafted']).success).toBe(true);
    expect(ownDescriptorOf(grafted, 'constructor')?.value, 'the freeze landed').toBe(
      bound,
    );
    expect(
      tagOf(instantiate(bound)),
      'construction consults the TARGET prototype, not the grafted one',
    ).toBe('[object Object]');
  });

  it('define/B5 — two constructors sharing one prototype: the second is refused at 10', () => {
    const { First, Second } = freshPrototypeSharingPair();

    expect(callDefine([First, 'First']).success).toBe(true);

    const second = callDefine([Second, 'Second']);

    expect(
      conditionOfMessage(
        'defineStableTypeIdentity',
        reasonOf(second, 'define/B5').message,
      ),
    ).toBe(10);
  });

  it('define/B6 — a subclass inherits the tag but not the verdict', () => {
    const { Base, Derived } = freshClassHierarchy();

    expect(callDefine([Base, 'Base']).success).toBe(true);
    expect(tagOf(instantiate(Derived)), 'the lookup walks the chain').toBe(
      '[object Base]',
    );
    expect(doesCarryStableTypeIdentity(Derived)).toBe(false);
    expect(doesCarryStableTypeIdentity(instantiate(Derived))).toBe(false);

    expect(callDefine([Derived, 'Derived']).success).toBe(true);
    expect(doesCarryStableTypeIdentity(Derived)).toBe(true);
    expect(doesCarryStableTypeIdentity(instantiate(Derived))).toBe(true);
  });

  it('define/B7 — the entry is not transactional, and the wreckage is loud', () => {
    const { constructor: F, state } = halfwayFailingType();
    const prototype = prototypeOf(F);
    const result = callDefine([F, 'Halfway']);

    expect(result.success).toBe(false);
    expect(state.defines, 'the tag landed, the `constructor` write was refused').toBe(2);

    expect(ownDescriptorOf(prototype, Symbol.toStringTag)).toMatchObject({
      configurable: false,
    });
    expect(ownDescriptorOf(prototype, 'constructor')).toBeNull();
    expect(
      ownDescriptorOf(F, 'name'),
      '`name` is written last, so it still carries its native descriptor',
    ).toMatchObject({ writable: false, configurable: true });
    expect(doesCarryStableTypeIdentity(F)).toBe(false);

    const retry = callDefine([F, 'Halfway']);

    expect(
      conditionOfMessage(
        'defineStableTypeIdentity',
        reasonOf(retry, 'define/B7').message,
      ),
      'the retry fails on the now-unshapeable tag',
    ).toBe(11);
  });

  it('define/B8 — condition 9 is reached by withdrawal only where the slot is configurable', () => {
    const withdrawn = callDefine([withdrawingPrototypeProxy(), 'Foo']);

    expect(
      conditionOfMessage(
        'defineStableTypeIdentity',
        reasonOf(withdrawn, 'define/B8').message,
      ),
    ).toBe(9);

    // the obvious reproduction, and why it is wrong: an ordinary function's own
    // `prototype` slot is non-configurable, so the withdrawal trips a proxy
    // invariant and the ENGINE's error surfaces at condition 8 instead
    const ordinary = callDefine([withdrawingPrototypeProxyOverOrdinaryFunction(), 'Foo']);
    const reason = reasonOf(ordinary, 'define/B8 — over an ordinary function');

    expect(reason).toBeInstanceOf(TypeError);
    expect(reason.message, 'the engine words this one').toMatch(/proxy/i);
    expect(
      conditionOfMessage('defineStableTypeIdentity', reason.message),
      'no condition of the list words it, which is what a pass-through means',
    ).toBeNull();
  });
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  B — The Rejection Order
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — B: the rejection order (define/R*)', () => {
  it('the matrix is non-empty, so this block cannot pass vacuously', () => {
    expect(Object.keys(defineRejectionMatrix).length).toBeGreaterThan(0);
  });

  for (const [key, row] of Object.entries(defineRejectionMatrix)) {
    it(`${row.description} → condition ${String(row.condition)} [${row.vectors.join(', ')}]`, () => {
      assertRejection(callDefine(row.make()), row, defineMessages, key);
    });
  }
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  C — Branding
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — C: what branding lands (brand/A*, brand/B*)', () => {
  it('brand/A1 — the own `name` descriptor is exactly this', () => {
    const fct = freshES3();

    expect(callBrand([fct, 'branded'])).toEqual({ success: true });
    expect(ownDescriptorOf(fct, 'name')).toEqual({
      value: 'branded',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  });

  it('brand/A2 — any callable is admitted', () => {
    const callables = {
      arrow: arrowFunction(),
      classConstructor: freshClass(),
      bound: boundES3(),
      asyncFunction: asyncFunction(),
    };

    expect(Object.keys(callables)).toHaveLength(4);

    for (const [label, fct] of Object.entries(callables)) {
      expect(callBrand([fct, 'branded']), label).toEqual({ success: true });
      expect(fct.name, label).toBe('branded');
    }
  });

  it('brand/A3 — the name is trimmed and unwrapped exactly as an identifier is', () => {
    const trimmed = freshES3();
    const unwrapped = freshES3();

    expect(callBrand([trimmed, '  branded  ']).success).toBe(true);
    expect(trimmed.name).toBe('branded');

    expect(callBrand([unwrapped, new String(' branded ')]).success).toBe(true);
    expect(unwrapped.name).toBe('branded');
    expect(typeof unwrapped.name, 'a wrapper in a `name` slot breaks every reader').toBe(
      'string',
    );
  });

  it('brand/A4 — the success arm never carries a warning', () => {
    expect(Object.keys(callBrand([arrowFunction(), 'branded']))).toEqual(['success']);
  });

  it('brand/A5 — a `Proxy` over a function is branded, the trap forwarding the define', () => {
    const state = { defines: 0 };
    const proxy = /** @type {{ name: string }} */ (
      /** @type {unknown} */ (
        new Proxy(freshES3(), {
          defineProperty(target, key, descriptor) {
            state.defines += 1;

            return Reflect.defineProperty(target, key, descriptor);
          },
        })
      )
    );

    expect(callBrand([proxy, 'branded']).success).toBe(true);
    expect(state.defines, 'the define went THROUGH the trap').toBe(1);
    expect(proxy.name).toBe('branded');
  });

  it('brand/A6 — instances read the brand through `constructor.name`', () => {
    const C = freshClass();

    expect(callBrand([C, 'Branded']).success).toBe(true);
    expect(instantiate(C).constructor.name).toBe('Branded');
  });

  it('brand/B2 — branding installs NO identity', () => {
    const C = freshClass();

    expect(callBrand([C, 'Branded']).success).toBe(true);
    expect(doesCarryStableTypeIdentity(C)).toBe(false);
    expect(doesCarryStableTypeIdentity(instantiate(C))).toBe(false);
    expect(tagOf(instantiate(C))).toBe('[object Object]');
  });

  it('brand/B3 — a brand closes the freezing entry’s door as well', () => {
    const C = freshClass();

    expect(callBrand([C, 'Branded']).success).toBe(true);

    const frozen = defineStableTypeIdentity(C, 'Branded');

    expect(
      conditionOfMessage(
        'defineStableTypeIdentity',
        reasonOf(frozen, 'brand/B3').message,
      ),
    ).toBe(7);
  });
});

describe('type-identity spec — C: the rejection order (brand/R*)', () => {
  it('the matrix is non-empty, so this block cannot pass vacuously', () => {
    expect(Object.keys(brandRejectionMatrix).length).toBeGreaterThan(0);
  });

  for (const [key, row] of Object.entries(brandRejectionMatrix)) {
    it(`${row.description} → condition ${String(row.condition)} [${row.vectors.join(', ')}]`, () => {
      assertRejection(callBrand(row.make()), row, brandMessages, key);
    });
  }
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  The Ordering Rule
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

describe('type-identity spec — the ordering rule (ord/*)', () => {
  it('no row asserts an ordering against itself', () => {
    for (const [key, row] of Object.entries(orderingMatrix)) {
      expect(row.condition, `row "${key}" names one condition twice`).not.toBe(
        row.losing,
      );
    }
  });

  it('every row names a condition its entry actually has', () => {
    for (const [key, row] of Object.entries(orderingMatrix)) {
      for (const condition of [row.condition, row.losing]) {
        expect(condition, `row "${key}"`).toBeLessThanOrEqual(
          CONDITION_COUNTS[row.entry],
        );
        expect(condition, `row "${key}"`).toBeGreaterThan(0);
      }
    }
  });

  for (const [key, row] of Object.entries(orderingMatrix)) {
    it(`${row.description} → ${String(row.condition)}, not ${String(row.losing)} [${row.vectors.join(', ')}]`, () => {
      const reason = reasonOf(callEntry(row.entry, row.make()), key);

      expect(conditionOfMessage(row.entry, reason.message), key).toBe(row.condition);
    });
  }

  it('brandedCallable is genuinely branded, so ord/A7 cannot pass for the wrong reason', () => {
    const fct = brandedCallable();

    expect(fct.name).toBe('Branded');
    expect(ownDescriptorOf(fct, 'name')).toMatchObject({ configurable: false });
  });
});
