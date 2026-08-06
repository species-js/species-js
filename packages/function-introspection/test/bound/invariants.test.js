// @ts-check

/**
 * @module test/bound/invariants
 *
 * Standing structural invariants — the relationship laws that hold across the
 * whole value-universe rather than for a named vector. These are spec-free: no
 * law here restates an admit/reject verdict, and each one would survive a
 * redesign of the marks as long as the module keeps its meaning.
 *
 * The value of a law over a vector is coverage of the space between vectors. A
 * regression that moves one value shows up in `spec.test.js`; a regression that
 * changes the SHAPE of the answer — a predicate becoming constant, the pair
 * collapsing into one function, a read acquiring a side effect — is what these
 * catch.
 *
 * Companion to `docs/spec/BOUND.spec.md`, which owns the verdicts.
 */

import { describe, it, expect } from 'vitest';

import {
  doesIndicateBoundFunction,
  doesStronglyIndicateBoundFunction,
  getCondensedFunctionSource,
} from '#index';
import { isFunction, hasOwnPrototype } from '@species-js/type-detection';

import { crossCuttingRejections, specMatrix } from './__config.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */

/** Every candidate the module is specified over, as fresh values. */
const corpus = () => [
  ...Object.entries(specMatrix).map(([key, row]) => ({ key, value: row.make() })),
  ...Object.entries(crossCuttingRejections).map(([key, make]) => ({
    key,
    value: make(),
  })),
];

describe('bound — standing invariants', () => {
  describe('subset law — strong ⟹ cascade', () => {
    it('holds for every candidate', () => {
      for (const { key, value } of corpus()) {
        if (doesStronglyIndicateBoundFunction(value)) {
          expect(
            doesIndicateBoundFunction(value),
            `"${key}" is strong but not cascade`,
          ).toBe(true);
        }
      }
    });

    it('is what the qualifier claims, so it may never be weakened to an overlap', () => {
      const strong = corpus().filter(({ value }) =>
        doesStronglyIndicateBoundFunction(value),
      );
      const cascade = corpus().filter(({ value }) => doesIndicateBoundFunction(value));
      expect(strong.length).toBeLessThan(cascade.length);
      expect(strong.length).toBeGreaterThan(0);
    });
  });

  describe('entrance-level necessity', () => {
    it('anything either predicate admits is a verified function with no own prototype', () => {
      for (const { key, value } of corpus()) {
        if (
          doesIndicateBoundFunction(value) ||
          doesStronglyIndicateBoundFunction(value)
        ) {
          expect(isFunction(value), `"${key}" admitted but not a verified function`).toBe(
            true,
          );
          expect(hasOwnPrototype(value), `"${key}" admitted but owns a prototype`).toBe(
            false,
          );
        }
      }
    });
  });

  describe('bind-closure', () => {
    it('binding an ordinary callable yields a value both predicates admit', () => {
      /** @type {unknown[]} */
      const targets = [
        /**
         * @param {unknown} a - first parameter
         * @param {unknown} b - second parameter
         * @returns {unknown[]} both
         */
        function plain(a, b) {
          return [a, b];
        },
        () => undefined,
        class Klass {
          /** @returns {number} a member, so the class is not empty */
          read() {
            return 1;
          }
        },
        function* generator() {
          yield 1;
        },
        Math.max,
        Array,
        Proxy,
        {
          concise() {
            return 1;
          },
        }.concise,
      ];

      for (const target of targets) {
        const callable = /** @type {Callable} */ (target);
        const bound = /** @type {Callable} */ (callable.bind(null));
        expect(doesIndicateBoundFunction(bound), `bound ${callable.name}`).toBe(true);
        expect(doesStronglyIndicateBoundFunction(bound), `bound ${callable.name}`).toBe(
          true,
        );
      }
    });

    it('binding is idempotent under both predicates', () => {
      const once = function plain() {
        return undefined;
      }.bind(null);
      const twice = /** @type {Callable} */ (once.bind(null));
      expect(doesIndicateBoundFunction(twice)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(twice)).toBe(true);
    });

    it('`Function.prototype` is the one standard exception, and for a spec reason', () => {
      /** @type {unknown} */
      const rawBound = Function.prototype.bind(null);
      const bound = /** @type {Callable} */ (rawBound);

      // The marks are all there …
      expect(hasOwnPrototype(bound)).toBe(false);
      expect(getCondensedFunctionSource(bound)).toBe('function(){[native code]}');
      expect(
        /** @type {unknown} */ (Object.getOwnPropertyDescriptor(bound, 'name')?.value),
      ).toBe('bound ');

      // … but `bind` preserves the TARGET's [[Prototype]] (ECMA-262 §20.2.3.2,
      // BoundFunctionCreate), and `Function.prototype`'s prototype is
      // `Object.prototype` — so the result inherits no `call`/`apply`/`bind`
      // and fails the entrance-level before any mark is read.
      expect(Object.getPrototypeOf(bound)).toBe(Object.prototype);
      expect(isFunction(bound)).toBe(false);

      expect(doesIndicateBoundFunction(bound)).toBe(false);
      expect(doesStronglyIndicateBoundFunction(bound)).toBe(false);
    });
  });

  describe('determinism', () => {
    it('repeated calls on the same value agree', () => {
      for (const { key, value } of corpus()) {
        const cascade = doesIndicateBoundFunction(value);
        const strong = doesStronglyIndicateBoundFunction(value);
        for (let run = 0; run < 3; run += 1) {
          expect(doesIndicateBoundFunction(value), `"${key}" cascade drifted`).toBe(
            cascade,
          );
          expect(
            doesStronglyIndicateBoundFunction(value),
            `"${key}" strong drifted`,
          ).toBe(strong);
        }
      }
    });
  });

  describe('purity — a classification leaves no trace', () => {
    // A revoked Proxy cannot be introspected at all, so the snapshot itself
    // throws. That is still a state worth comparing: whatever the observable
    // surface was before a classification, it must be the same after.
    /**
     * @param {Callable} value - the callable to snapshot
     * @returns {string} a comparable rendering of the observable surface
     */
    const snapshot = (value) => {
      try {
        return JSON.stringify({
          keys: Object.getOwnPropertyNames(value).sort(),
          name:
            /** @type {unknown} */ (
              Object.getOwnPropertyDescriptor(value, 'name')?.value
            ) ?? null,
          source: getCondensedFunctionSource(value) ?? null,
        });
      } catch {
        return 'un-introspectable';
      }
    };

    it('the observable surface is unchanged by being classified', () => {
      for (const { key, value } of corpus()) {
        if (typeof value !== 'function') {
          continue;
        }
        const before = snapshot(/** @type {Callable} */ (value));

        doesIndicateBoundFunction(value);
        doesStronglyIndicateBoundFunction(value);

        expect(
          snapshot(/** @type {Callable} */ (value)),
          `"${key}" surface changed`,
        ).toBe(before);
      }
    });
  });

  describe('non-collapse', () => {
    it('neither predicate is constant', () => {
      const values = corpus().map(({ value }) => value);
      for (const [name, predicate] of [
        ['doesIndicateBoundFunction', doesIndicateBoundFunction],
        ['doesStronglyIndicateBoundFunction', doesStronglyIndicateBoundFunction],
      ]) {
        const results = values.map((value) =>
          /** @type {(v?: unknown) => boolean} */ (predicate)(value),
        );
        expect(results.includes(true), `${String(name)} never admits`).toBe(true);
        expect(results.includes(false), `${String(name)} never rejects`).toBe(true);
      }
    });

    it('the two predicates are not the same function', () => {
      const differs = corpus().some(
        ({ value }) =>
          doesIndicateBoundFunction(value) !== doesStronglyIndicateBoundFunction(value),
      );
      expect(differs, 'the pair collapsed — one predicate is redundant').toBe(true);
    });
  });
});
