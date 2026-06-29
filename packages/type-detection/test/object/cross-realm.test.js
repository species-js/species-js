// @ts-check

/**
 * @module test/object/cross-realm
 *
 * Axis 2 — cross-realm. A foreign-realm plain object has the SAME structural
 * `Object` contract as a local one but a DIFFERENT intrinsic identity: its
 * `[[Prototype]]` is the foreign `Object.prototype`, so the local-realm
 * fast-path (`getPrototypeOf(value) === objectPrototype`) misses and the
 * structural arm (`hasPlainObjectIdentitySignal` + `isObjectPrototypeEquivalent`)
 * must carry the verdict. Foreign containers / instances stay rejected by the
 * same realm-independent contract.
 *
 * Mirrors the "Cross-realm (axis 2)" expectations in `docs/spec/OBJECT.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isObject,
  isPlainObject,
  isDictionaryObject,
  isPlainOrDictionaryObject,
  hasPlainObjectIdentitySignal,
  isObjectPrototypeEquivalent,
  getInertPrototypeOf,
} from '@/index.js';

import {
  foreignPlainObject,
  foreignNewObject,
  foreignArray,
  foreignDate,
  foreignClassInstance,
} from './__config.js';

describe('object — cross-realm (axis 2)', () => {
  it('isPlainObject/A2: a foreign-realm plain object → true (structural arm)', () => {
    expect(isPlainObject(foreignPlainObject())).toBe(true);
    expect(isPlainObject(foreignNewObject())).toBe(true);
  });

  it('isPlainOrDictionaryObject/A3: a foreign-realm plain object → true', () => {
    expect(isPlainOrDictionaryObject(foreignPlainObject())).toBe(true);
  });

  it('the structural helpers carry the foreign verdict (local fast-path missed)', () => {
    const foreign = foreignPlainObject();
    expect(hasPlainObjectIdentitySignal(foreign), 'signal').toBe(true);
    // the contract helper takes the already-resolved [[Prototype]] (#059): the
    // foreign Object.prototype satisfies the six-marker contract in every realm.
    expect(isObjectPrototypeEquivalent(getInertPrototypeOf(foreign)), 'contract').toBe(
      true,
    );
  });

  it('foreign plain objects are still objects but never dictionaries', () => {
    expect(isObject(foreignPlainObject())).toBe(true);
    expect(isDictionaryObject(foreignPlainObject())).toBe(false);
  });

  it('foreign containers / instances → isObject true, isPlainObject false', () => {
    for (const make of [foreignArray, foreignDate, foreignClassInstance]) {
      const value = make();
      expect(isObject(value), 'isObject').toBe(true);
      expect(isPlainObject(value), 'isPlainObject').toBe(false);
      expect(isPlainOrDictionaryObject(value), 'isPlainOrDictionaryObject').toBe(false);
    }
  });
});
