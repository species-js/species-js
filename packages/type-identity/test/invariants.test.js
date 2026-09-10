// @ts-check

/**
 * @module test/invariants
 *
 * Standing structural invariants — the relationship laws that hold across the
 * whole value universe rather than for a named vector.
 *
 * These are spec-free. No law here restates an admit/reject verdict, and each
 * would survive a redesign of the conditions as long as the module keeps its
 * meaning. Where a law's boundary is drawn by a spec vector, the vector is
 * named — but as the reason the boundary is there, not as the thing being
 * asserted.
 *
 * The value of a law over a vector is coverage of the space BETWEEN vectors. A
 * regression that moves one value shows up in the matrices; a regression that
 * changes the SHAPE of an answer — a result losing its discriminant, a rejected
 * call acquiring a side effect, an inert read becoming an invoking one, a
 * one-way door swinging back — is what only a law can see.
 *
 * ## The corpus is filtered before anything is mutated
 *
 * Both mutators are one-way doors and `brandFunctionName` admits any callable,
 * built-ins included. A law that branded the whole corpus would rename this
 * realm's `Promise` and `Array` for the rest of the process. Every law that
 * calls a mutator therefore draws from `mutableCorpus()`, and the first block
 * below asserts that the exclusion it depends on is actually populated.
 *
 * Companion to `docs/spec/TYPE-IDENTITY.spec.md`, which owns the verdicts.
 */

import { describe, it, expect } from 'vitest';

import { doesCarryStableTypeIdentity } from '#index';

import { callBrand, callDefine, corpus, mutableCorpus } from './__config.js';
import { freshClass, freshES3, ownDescriptorOf, prototypeOf } from './__fixtures.js';

/**
 * The own-key shapes a result is allowed to have, in the order the entries
 * build them.
 *
 * Unsorted on purpose: `success` is written first and the second key, where
 * there is one, is added by a spread, so the ORDER is as stable as the set and
 * asserting it costs nothing. The spec states the same three lists this way
 * (`define/A4`).
 */
const RESULT_SHAPES = [['success'], ['success', 'reason'], ['success', 'warning']];

/**
 * The three slots this package writes, as descriptors, for a before/after
 * comparison.
 *
 * Read through `JSON`-free structural equality rather than by identity, because
 * a descriptor object is freshly allocated on every read — two reads of an
 * unchanged slot are never the same object.
 *
 * @param {unknown} target - a constructor
 * @returns {unknown[]} the three descriptors, in the order the entry writes them
 */
const slotsOf = (target) => {
  const constructor =
    /** @type {import('@species-js/type-detection').NewableFunction} */ (target);
  const prototype = prototypeOf(constructor);

  return [
    ownDescriptorOf(prototype, Symbol.toStringTag),
    ownDescriptorOf(prototype, 'constructor'),
    ownDescriptorOf(constructor, 'name'),
  ];
};

describe('type-identity — the corpus these laws are checked over', () => {
  it('is non-empty, and its mutable half is a strict, non-empty subset', () => {
    const whole = corpus();
    const mutable = mutableCorpus();

    expect(whole.length).toBeGreaterThan(0);
    expect(mutable.length).toBeGreaterThan(0);
    expect(
      mutable.length,
      'no candidate is flagged as an intrinsic, so the exclusion protects nothing',
    ).toBeLessThan(whole.length);
  });

  it('every key is unique, so a failure names one candidate', () => {
    const keys = corpus().map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('type-identity — the result is always one of three shapes', () => {
  it('every call returns one of the three admitted key sets', () => {
    for (const { key, value } of mutableCorpus()) {
      /** @type {[string, import('#index').IdentityDefinitionResult][]} */
      const answers = [
        ['defineStableTypeIdentity', callDefine([value, 'Law'])],
        ['brandFunctionName', callBrand([value, 'Law'])],
      ];

      for (const [entryName, result] of answers) {
        const shape = Object.keys(result);

        expect(
          RESULT_SHAPES,
          `${entryName}("${key}") → ${shape.join('+')}`,
        ).toContainEqual(shape);
      }
    }
  });

  it('`success` discriminates: a reason appears exactly on the failing arm', () => {
    for (const { key, value } of mutableCorpus()) {
      for (const result of [callDefine([value, 'Law']), callBrand([value, 'Law'])]) {
        expect(typeof result.success, key).toBe('boolean');
        expect('reason' in result, `"${key}" — reason without a failure`).toBe(
          !result.success,
        );

        if (!result.success) {
          expect(result.reason, `"${key}" — a reason is always an error`).toBeInstanceOf(
            Error,
          );
          expect(typeof result.reason.message, key).toBe('string');
        }
      }
    }
  });

  it('a `warning` never appears on the failing arm', () => {
    for (const { key, value } of mutableCorpus()) {
      const result = callDefine([value, 'Law', 'Different']);

      if (!result.success) {
        expect('warning' in result, key).toBe(false);
      }
    }
  });

  it('the corpus reaches BOTH arms, so the laws above are not vacuous', () => {
    const outcomes = mutableCorpus().map(
      ({ value }) => callDefine([value, 'Law']).success,
    );

    expect(new Set(outcomes)).toEqual(new Set([true, false]));
  });
});

describe('type-identity — freezing and the verdict agree', () => {
  it('every successful freeze is visible to the verification entry', () => {
    let confirmed = 0;

    for (const { key, value } of mutableCorpus()) {
      if (callDefine([value, 'Law']).success) {
        expect(
          doesCarryStableTypeIdentity(value),
          `"${key}" froze and does not read back`,
        ).toBe(true);
        confirmed += 1;
      }
    }

    expect(confirmed, 'no candidate froze, so this law asserted nothing').toBeGreaterThan(
      0,
    );
  });

  it('branding alone never produces a verdict — the two are not a weak/strong pair', () => {
    let confirmed = 0;

    for (const { key, value } of mutableCorpus()) {
      const before = doesCarryStableTypeIdentity(value);

      if (callBrand([value, 'Law']).success) {
        expect(
          doesCarryStableTypeIdentity(value),
          `"${key}" gained a verdict from a brand`,
        ).toBe(before);
        confirmed += 1;
      }
    }

    expect(confirmed, 'nothing branded, so this law asserted nothing').toBeGreaterThan(0);
  });
});

describe('type-identity — both entries are one-way doors', () => {
  it('a second freeze on a target that just froze is always refused', () => {
    let confirmed = 0;

    for (const { key, value } of mutableCorpus()) {
      if (callDefine([value, 'Law']).success) {
        expect(callDefine([value, 'Law']).success, `"${key}" froze twice`).toBe(false);
        confirmed += 1;
      }
    }

    expect(confirmed).toBeGreaterThan(0);
  });

  it('a second brand on a callable that just branded is always refused', () => {
    let confirmed = 0;

    for (const { key, value } of mutableCorpus()) {
      if (callBrand([value, 'Law']).success) {
        expect(callBrand([value, 'Law']).success, `"${key}" branded twice`).toBe(false);
        confirmed += 1;
      }
    }

    expect(confirmed).toBeGreaterThan(0);
  });

  it('a brand closes the freezing entry too, whichever ran first', () => {
    const branded = freshClass();

    expect(callBrand([branded, 'Law']).success).toBe(true);
    expect(callDefine([branded, 'Law']).success).toBe(false);

    const frozen = freshClass();

    expect(callDefine([frozen, 'Law']).success).toBe(true);
    expect(callBrand([frozen, 'Law']).success).toBe(false);
  });
});

describe('type-identity — an argument rejection touches nothing', () => {
  it('a bad identifier leaves all three slots exactly as they were', () => {
    /** @type {[string, unknown][]} */
    const badIdentifiers = [
      ['a number', 42],
      ['null', null],
      ['a symbol', Symbol('bad')],
      ['the empty string', ''],
      ['whitespace only', '   '],
      ['a plain object', {}],
    ];

    expect(badIdentifiers).toHaveLength(6);

    for (const shape of [freshClass, freshES3]) {
      for (const [label, bad] of badIdentifiers) {
        const target = shape();
        const before = slotsOf(target);

        expect(callDefine([target, bad]).success).toBe(false);
        expect(slotsOf(target), `${label} as the name`).toEqual(before);

        expect(callDefine([target, 'Fine', bad]).success).toBe(false);
        expect(slotsOf(target), `${label} as the tag`).toEqual(before);
      }
    }
  });

  it('the same target then freezes normally — the rejections cost it nothing', () => {
    const target = freshClass();

    expect(callDefine([target, 42]).success).toBe(false);
    expect(callDefine([target, '']).success).toBe(false);
    expect(callDefine([target, 'Fine', 42]).success).toBe(false);
    expect(callDefine([target, 'Fine'])).toEqual({ success: true });
    expect(doesCarryStableTypeIdentity(target)).toBe(true);
  });

  it('the control: a LATE failure is allowed to leave state, which is why the law is scoped', () => {
    // `define/B7` — the entry is not transactional, so this law covers argument
    // rejections only. Stating the scope as an assertion keeps the two apart:
    // a future change that made the whole entry transactional would turn this
    // red and say so, rather than quietly widening the law above.
    const target = freshES3();

    Object.freeze(prototypeOf(target));

    const before = slotsOf(target);

    expect(callDefine([target, 'Fine']).success, 'refused at condition 10').toBe(false);
    expect(slotsOf(target), 'nothing landed here either — the probes ran first').toEqual(
      before,
    );
  });
});

describe('type-identity — the verification read is inert and repeatable', () => {
  it('the same value answers the same way every time', () => {
    for (const { key, value } of corpus()) {
      const first = doesCarryStableTypeIdentity(value);

      expect(doesCarryStableTypeIdentity(value), key).toBe(first);
      expect(doesCarryStableTypeIdentity(value), key).toBe(first);
    }
  });

  it('reading a verdict never changes a slot', () => {
    for (const shape of [freshClass, freshES3]) {
      const unfrozen = shape();
      const beforeUnfrozen = slotsOf(unfrozen);

      doesCarryStableTypeIdentity(unfrozen);

      expect(slotsOf(unfrozen)).toEqual(beforeUnfrozen);

      const frozen = shape();

      expect(callDefine([frozen, 'Law']).success).toBe(true);

      const beforeFrozen = slotsOf(frozen);

      doesCarryStableTypeIdentity(frozen);

      expect(slotsOf(frozen)).toEqual(beforeFrozen);
    }
  });

  it('the corpus reaches both verdicts, so repeatability is not repeatability of a constant', () => {
    const verdicts = corpus().map(({ value }) => doesCarryStableTypeIdentity(value));

    expect(new Set(verdicts)).toEqual(new Set([true, false]));
  });
});

describe('type-identity — normalization is idempotent', () => {
  it('an identifier that survived the gate survives it again unchanged', () => {
    const identifiers = ['Foo', '  Foo  ', ' a b ', ' a\nb ', new String(' Foo ')];

    expect(identifiers).toHaveLength(5);

    for (const identifier of identifiers) {
      const first = freshClass();
      const second = freshClass();

      expect(callDefine([first, identifier]).success).toBe(true);
      expect(callDefine([second, first.name]).success).toBe(true);
      expect(second.name, `re-normalizing "${String(identifier)}"`).toBe(first.name);
    }
  });
});
