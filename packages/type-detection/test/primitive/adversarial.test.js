// @ts-check

/**
 * @module test/primitive/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance (the NON-throwing surface; the throwing
 * surface is the universal-invariant matrix in `throw-safety.test.js`). Boxed
 * primitives are the strongest-sealed types in the package: the engine-attested
 * `[[XData]]` slot probe closes the prototype-graft surface that the thenable
 * module's `isPromise` must leave open (decision #052). These vectors pin that
 * seal — every structural spoof is REJECTED, not admitted:
 *
 *   - tag-spoof (`{ [Symbol.toStringTag]: 'X' }`) — the constructor walk reaches
 *     `Object` and the slot probe throws.
 *   - proto-graft (`Object.create(X.prototype)`) — proto-identity (or the
 *     inherited tag) passes, but the slot probe rejects it. The #052 contrast.
 *   - ctor-name-spoof (`class String {}`) — the instance tag is `'[object Object]'`.
 *   - description-shadow (a real boxed `Symbol` whose `description` own-data
 *     property lies) — survives the slot probe, caught by the description
 *     cross-check.
 *
 * Mirrors the "Spoof-resistance expectation (axis 3)" vectors of
 * `docs/spec/PRIMITIVE.spec.md` (`isBoxedX/R-tagspoof`, `isBoxedX/R-protograft`,
 * `isBoxedSymbol/R-descshadow`, `isBoxedPrimitive/R-tagspoof`).
 */

import { describe, it, expect } from 'vitest';

import {
  isBoxedString,
  isBoxedNumber,
  isBoxedBoolean,
  isBoxedSymbol,
  isBoxedBigInt,
  isBoxedPrimitive,
} from '#index';

import {
  tagSpoofString,
  tagSpoofNumber,
  tagSpoofBoolean,
  tagSpoofSymbol,
  tagSpoofBigInt,
  protoGraftString,
  protoGraftNumber,
  protoGraftBoolean,
  protoGraftSymbol,
  protoGraftBigInt,
  ctorNameSpoofString,
  descriptionShadowedBoxedSymbol,
} from './__config.js';

/**
 * @typedef {object} SpoofCase
 * @property {string} family - the family name
 * @property {(value?: unknown) => boolean} isBoxed - the family's boxed predicate
 * @property {() => unknown} tagSpoof - `{ [Symbol.toStringTag]: 'X' }`
 * @property {() => unknown} protoGraft - `Object.create(X.prototype)`
 */

/** @type {SpoofCase[]} */
const spoofCases = [
  {
    family: 'String',
    isBoxed: isBoxedString,
    tagSpoof: tagSpoofString,
    protoGraft: protoGraftString,
  },
  {
    family: 'Number',
    isBoxed: isBoxedNumber,
    tagSpoof: tagSpoofNumber,
    protoGraft: protoGraftNumber,
  },
  {
    family: 'Boolean',
    isBoxed: isBoxedBoolean,
    tagSpoof: tagSpoofBoolean,
    protoGraft: protoGraftBoolean,
  },
  {
    family: 'Symbol',
    isBoxed: isBoxedSymbol,
    tagSpoof: tagSpoofSymbol,
    protoGraft: protoGraftSymbol,
  },
  {
    family: 'BigInt',
    isBoxed: isBoxedBigInt,
    tagSpoof: tagSpoofBigInt,
    protoGraft: protoGraftBigInt,
  },
];

describe('primitive — adversarial / spoof-resistance (axis 3)', () => {
  for (const { family, isBoxed, tagSpoof, protoGraft } of spoofCases) {
    describe(`boxed ${family} spoofs`, () => {
      it(`isBoxedX/R-tagspoof (${family}): a Symbol.toStringTag spoof → false`, () => {
        expect(isBoxed(tagSpoof()), 'isBoxedX').toBe(false);
        expect(isBoxedPrimitive(tagSpoof()), 'isBoxedPrimitive').toBe(false);
      });

      it(`isBoxedX/R-protograft (${family}): Object.create(${family}.prototype) → false (the slot-probe seal)`, () => {
        expect(isBoxed(protoGraft()), 'isBoxedX').toBe(false);
        expect(isBoxedPrimitive(protoGraft()), 'isBoxedPrimitive').toBe(false);
      });
    });
  }

  it('isBoxedX/R-ctorspoof: a userland `class String {}` instance → false (tag is `[object Object]`)', () => {
    expect(isBoxedString(ctorNameSpoofString()), 'isBoxedString').toBe(false);
    expect(isBoxedPrimitive(ctorNameSpoofString()), 'isBoxedPrimitive').toBe(false);
  });

  it('isBoxedSymbol/R-descshadow: a real boxed Symbol with a shadowed `description` → false', () => {
    // the slot probe passes (it IS a genuine boxed Symbol), but the description
    // cross-check diverges: the slot read yields the true description, the own
    // data property lies. The one residual tampering surface the slot alone misses.
    expect(isBoxedSymbol(descriptionShadowedBoxedSymbol()), 'isBoxedSymbol').toBe(false);
    expect(isBoxedPrimitive(descriptionShadowedBoxedSymbol()), 'isBoxedPrimitive').toBe(
      false,
    );
  });
});
