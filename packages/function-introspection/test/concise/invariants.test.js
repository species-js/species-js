// @ts-check

/**
 * @module test/concise/invariants
 *
 * Standing structural invariants — the laws that hold across the whole
 * value-universe rather than for a named vector. Spec-free: no law here
 * restates an admit/reject verdict, and each would survive a redesign of the
 * patterns as long as the module keeps its meaning.
 *
 * L1 is the reason this file exists. Rewriting the async block of
 * `isAnyConciseMethod` from `if (isAsync) return false;` into a ternary else
 * silently stopped admitting a plain method NAMED `async` — same words,
 * inverted reach. The corpus nearly missed it because only one row exercises
 * that shape; the union law caught it immediately, and it is cheap.
 *
 * Companion to `docs/spec/CONCISE.spec.md` (FROZEN 2026-08-11) — `L1`–`L5`.
 */

import { describe, it, expect } from 'vitest';

import {
  isPlainConciseMethod,
  isConciseAsyncMethod,
  isConciseGeneratorMethod,
  isConciseAsyncGeneratorMethod,
  isAnyConciseMethod,
} from '#index';
import { isFunction } from '@species-js/type-detection';

import {
  CONCISE_PLAIN,
  CONCISE_ASYNC,
  CONCISE_GENERATOR,
  CONCISE_ASYNC_GENERATOR,
  NOT_CONCISE,
  CONCISE_VECTORS,
  ACCESSOR_SYNTAX_VECTORS,
  ACCESSOR_SLOT_VECTORS,
  FOREIGN_CONCISE_VECTORS,
  hostileCallables,
  materialize,
  materializeForeign,
} from './__config.js';

/** The four flavors, in the order the union tries them. */
const flavors = {
  isPlainConciseMethod,
  isConciseAsyncMethod,
  isConciseGeneratorMethod,
  isConciseAsyncGeneratorMethod,
};

/** Every candidate the module is specified over, as fresh values. */
const corpus = () => [
  ...[...CONCISE_VECTORS, ...ACCESSOR_SYNTAX_VECTORS, ...ACCESSOR_SLOT_VECTORS].map(
    ([kind, description, source]) => ({
      key: description,
      kind,
      value: materialize(source),
    }),
  ),
  ...FOREIGN_CONCISE_VECTORS.map(([kind, description, source]) => ({
    key: `foreign: ${description}`,
    kind,
    value: materializeForeign(source),
  })),
];

/**
 * @param {unknown} value - the candidate
 * @returns {string[]} the names of the flavors admitting it
 */
const admittingFlavors = (value) =>
  Object.entries(flavors)
    .filter(([, predicate]) => predicate(value))
    .map(([name]) => name);

describe('concise — standing invariants', () => {
  describe('L1 — the union is exactly the disjunction of the four', () => {
    it('holds for every candidate', () => {
      for (const { key, value } of corpus()) {
        expect(isAnyConciseMethod(value), `"${key}"`).toBe(
          admittingFlavors(value).length > 0,
        );
      }
    });

    it('holds for the hostile callables too', () => {
      for (const [name, make] of Object.entries(hostileCallables)) {
        const value = make();
        expect(isAnyConciseMethod(value), name).toBe(admittingFlavors(value).length > 0);
      }
    });

    it('holds for a plain method named `async` — the regression vector', () => {
      const value = materialize('({ async(){} }).async');

      expect(isAnyConciseMethod(value)).toBe(true);
      expect(admittingFlavors(value)).toEqual(['isPlainConciseMethod']);
    });

    it('holds for the omitted argument', () => {
      expect(isAnyConciseMethod()).toBe(false);
    });
  });

  describe('L2 — the four flavors are mutually exclusive', () => {
    it('no candidate is admitted by more than one', () => {
      for (const { key, value } of corpus()) {
        const admitting = admittingFlavors(value);

        expect(
          admitting.length,
          `"${key}" admitted by ${admitting.join(' + ')}`,
        ).toBeLessThan(2);
      }
    });
  });

  describe('L3 — precision: admission implies callability', () => {
    it('every admitted value is a function', () => {
      for (const { key, value } of corpus()) {
        if (isAnyConciseMethod(value)) {
          expect(isFunction(value), `"${key}" admitted but not callable`).toBe(true);
        }
      }
    });

    it('the check is not vacuous — the corpus does admit values', () => {
      expect(
        corpus().filter(({ value }) => isAnyConciseMethod(value)).length,
      ).toBeGreaterThan(0);
    });
  });

  describe('non-degeneracy — no predicate has collapsed to a constant', () => {
    it('each flavor admits at least one candidate and refuses at least one', () => {
      const rows = corpus();

      for (const [name, predicate] of Object.entries({
        ...flavors,
        isAnyConciseMethod,
      })) {
        expect(
          rows.filter(({ value }) => predicate(value)).length,
          `${name} never admits`,
        ).toBeGreaterThan(0);
        expect(
          rows.filter(({ value }) => !predicate(value)).length,
          `${name} never refuses`,
        ).toBeGreaterThan(0);
      }
    });

    it('the corpus carries all five kinds, so the laws above are exercised', () => {
      const kinds = new Set(corpus().map(({ kind }) => kind));

      expect([...kinds].sort()).toEqual(
        [
          CONCISE_PLAIN,
          CONCISE_ASYNC,
          CONCISE_GENERATOR,
          CONCISE_ASYNC_GENERATOR,
          NOT_CONCISE,
        ].sort(),
      );
    });
  });

  describe('the predicates are pure reads', () => {
    it('they never invoke the value', () => {
      let invocations = 0;

      /**
       * @param {unknown} a - the forwarded argument
       * @returns {unknown} the argument, after recording the call
       */
      const counting = (a) => {
        invocations += 1;
        return a;
      };

      for (const predicate of Object.values({ ...flavors, isAnyConciseMethod })) {
        predicate(counting);
      }

      expect(invocations).toBe(0);
    });

    it('they are deterministic — a second reading agrees with the first', () => {
      for (const { key, value } of corpus()) {
        expect(isAnyConciseMethod(value), `"${key}" drifted`).toBe(
          isAnyConciseMethod(value),
        );
      }
    });

    it('they do not mutate the value', () => {
      const method = /** @type {object} */ (materialize('({ foo() {} }).foo'));
      const before = Reflect.ownKeys(method).map(String).sort();

      for (const predicate of Object.values({ ...flavors, isAnyConciseMethod })) {
        predicate(method);
      }

      expect(Reflect.ownKeys(method).map(String).sort()).toEqual(before);
    });
  });

  describe('L4/L5 — totality at the boundary', () => {
    it('no candidate makes any predicate throw', () => {
      for (const { key, value } of corpus()) {
        for (const [name, predicate] of Object.entries({
          ...flavors,
          isAnyConciseMethod,
        })) {
          expect(() => predicate(value), `${name} on "${key}"`).not.toThrow();
        }
      }
    });

    it('every predicate answers a boolean', () => {
      for (const { key, value } of corpus()) {
        expect(typeof isAnyConciseMethod(value), `"${key}"`).toBe('boolean');
      }
    });

    it('the omitted call equals the explicit `undefined` call', () => {
      for (const [name, predicate] of Object.entries({
        ...flavors,
        isAnyConciseMethod,
      })) {
        expect(predicate(), name).toBe(predicate(undefined));
      }
    });
  });
});
