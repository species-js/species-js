// @ts-check

/**
 * @module test/function/cross-realm
 *
 * Axis 2 — cross-realm. A foreign-realm async / generator / async-generator
 * function has the SAME structural shape as a local one but a DIFFERENT intrinsic
 * identity, so the same-realm `instanceof` fast-path
 * (`isCurrentRealm<Species>FunctionInstance`) MISSES and the realm-independent
 * structural arm (`isAlienRealm<Species>Function`) must carry the verdict. This
 * suite pins that decomposition directly: for each species the orchestrator
 * admits the foreign value (`is<Species>Function/A4`), the same-realm arm returns
 * `false` (`iCR<Species>FI/R1`), and the alien arm returns `true`.
 *
 * `%AsyncFunction%` / `%GeneratorFunction%` / `%AsyncGeneratorFunction%` are all
 * ECMAScript intrinsics, so a genuine foreign function of every species is
 * constructible in the vm realm. The newable side (`isFunction`, `isES3Function`,
 * `isClass`, `hasConstructSlot`) is realm-INDEPENDENT by construction — a foreign
 * plain function / class / arrow is classified exactly like a local one, with no
 * fixture asymmetry.
 *
 * Mirrors the "Cross-realm (axis 2)" notes of `docs/spec/FUNCTION.spec.md`
 * (`is<Species>Function/A4`, the `iCR<Species>FI/R1` helper vectors).
 */

import { describe, it, expect } from 'vitest';

import {
  isFunction,
  isES3Function,
  isClass,
  isCustomClass,
  isBuiltInClass,
  hasConstructSlot,
  isAsyncFunction,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isAnyGeneratorFunction,
  isCurrentRealmAsyncFunctionInstance,
  isAlienRealmAsyncFunction,
  isCurrentRealmGeneratorFunctionInstance,
  isAlienRealmGeneratorFunction,
  isCurrentRealmAsyncGeneratorFunctionInstance,
  isAlienRealmAsyncGeneratorFunction,
} from '#index';

import {
  foreignAsyncFunction,
  foreignGeneratorFunction,
  foreignAsyncGeneratorFunction,
  foreignPlainFunction,
  foreignArrowFunction,
  foreignClass,
} from './__config.js';

/**
 * @typedef {object} ForeignSpeciesCase
 * @property {string} species - the species name
 * @property {string} vector - the orchestrator's A4 vector ID
 * @property {() => unknown} make - foreign function factory
 * @property {(value?: unknown) => boolean} orchestrator - the public predicate
 * @property {(value?: unknown) => boolean} sameRealmArm - the same-realm instanceof arm
 * @property {(value?: unknown) => boolean} alienArm - the realm-independent structural arm
 * @property {Array<(value?: unknown) => boolean>} otherSpecies - predicates that must reject it
 */

/** @type {ForeignSpeciesCase[]} */
const foreignSpeciesCases = [
  {
    species: 'AsyncFunction',
    vector: 'isAsyncFunction/A4',
    make: foreignAsyncFunction,
    orchestrator: isAsyncFunction,
    sameRealmArm: isCurrentRealmAsyncFunctionInstance,
    alienArm: isAlienRealmAsyncFunction,
    otherSpecies: [isGeneratorFunction, isAsyncGeneratorFunction, isAnyGeneratorFunction],
  },
  {
    species: 'GeneratorFunction',
    vector: 'isGeneratorFunction/A4',
    make: foreignGeneratorFunction,
    orchestrator: isGeneratorFunction,
    sameRealmArm: isCurrentRealmGeneratorFunctionInstance,
    alienArm: isAlienRealmGeneratorFunction,
    otherSpecies: [isAsyncFunction, isAsyncGeneratorFunction],
  },
  {
    species: 'AsyncGeneratorFunction',
    vector: 'isAsyncGeneratorFunction/A4',
    make: foreignAsyncGeneratorFunction,
    orchestrator: isAsyncGeneratorFunction,
    sameRealmArm: isCurrentRealmAsyncGeneratorFunctionInstance,
    alienArm: isAlienRealmAsyncGeneratorFunction,
    otherSpecies: [isAsyncFunction, isGeneratorFunction],
  },
];

describe('function — cross-realm (axis 2)', () => {
  for (const {
    species,
    vector,
    make,
    orchestrator,
    sameRealmArm,
    alienArm,
    otherSpecies,
  } of foreignSpeciesCases) {
    describe(`foreign ${species}`, () => {
      it(`${vector}: the orchestrator admits the foreign function`, () => {
        expect(orchestrator(make())).toBe(true);
      });

      it('iCR<Species>FI/R1: the same-realm instanceof arm MISSES (foreign intrinsic)', () => {
        expect(sameRealmArm(make())).toBe(false);
      });

      it('the alien structural arm CARRIES the verdict', () => {
        expect(alienArm(make())).toBe(true);
      });

      it('isFunction still admits it (the floor is realm-independent)', () => {
        expect(isFunction(make())).toBe(true);
      });

      it('rejected by the other species’ orchestrators', () => {
        for (const other of otherSpecies) {
          expect(other(make())).toBe(false);
        }
      });
    });
  }

  // isAnyGeneratorFunction unions both generator species across realms.
  describe('isAnyGeneratorFunction/A4 — foreign sync + async generators', () => {
    it('admits a foreign sync generator and a foreign async generator', () => {
      expect(isAnyGeneratorFunction(foreignGeneratorFunction()), 'sync').toBe(true);
      expect(isAnyGeneratorFunction(foreignAsyncGeneratorFunction()), 'async').toBe(true);
    });
    it('rejects a foreign async (non-generator) function', () => {
      expect(isAnyGeneratorFunction(foreignAsyncFunction())).toBe(false);
    });
  });

  // The newable side is realm-independent — no intrinsic identity is read, only
  // the `[[Construct]]` slot and own-`prototype` descriptor shape.
  describe('newable side is realm-independent (foreign === local)', () => {
    it('a foreign plain `function () {}` is an ES3 function, not a class', () => {
      const foreign = foreignPlainFunction();
      expect(isFunction(foreign), 'isFunction').toBe(true);
      expect(hasConstructSlot(foreign), 'hasConstructSlot').toBe(true);
      expect(isES3Function(foreign), 'isES3Function').toBe(true);
      expect(isClass(foreign), 'isClass').toBe(false);
      expect(isAsyncFunction(foreign), 'isAsyncFunction').toBe(false);
    });

    it('a foreign `class C {}` is a custom class', () => {
      const foreign = foreignClass();
      expect(isClass(foreign), 'isClass').toBe(true);
      expect(isCustomClass(foreign), 'isCustomClass').toBe(true);
      expect(isBuiltInClass(foreign), 'isBuiltInClass').toBe(false);
      expect(isES3Function(foreign), 'isES3Function').toBe(false);
    });

    it('a foreign arrow `() => {}` is callable but not newable, not async', () => {
      const foreign = foreignArrowFunction();
      expect(isFunction(foreign), 'isFunction').toBe(true);
      expect(hasConstructSlot(foreign), 'hasConstructSlot').toBe(false);
      expect(isAsyncFunction(foreign), 'isAsyncFunction').toBe(false);
    });
  });
});
