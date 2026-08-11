// @ts-check

/**
 * @module test/arrow/invariants
 *
 * Standing structural invariants — the laws that hold across the whole
 * value-universe rather than for a named vector. These are spec-free: no law
 * here restates an admit/reject verdict, and each would survive a redesign of
 * the patterns as long as the module keeps its meaning.
 *
 * The value of a law over a vector is coverage of the space BETWEEN vectors. A
 * regression that moves one value shows up in `spec.test.js`; a regression that
 * changes the SHAPE of the answer — a predicate becoming constant, the union
 * drifting from its operands, a read acquiring a side effect — is what these
 * catch. The union law earns its place by precedent: the equivalent law in the
 * sibling `concise` module caught a regression its corpus nearly missed,
 * because only one row exercised the affected shape.
 *
 * Companion to `docs/spec/ARROW.spec.md` (FROZEN 2026-08-11) — `L1`–`L5`, which
 * owns the verdicts.
 */

import { describe, it, expect } from 'vitest';

import { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction } from '#index';
import {
  isFunction,
  hasOwnPrototype,
  hasConstructSlot,
} from '@species-js/type-detection';

import {
  ARROW,
  ASYNC_ARROW,
  NOT_ARROW,
  ARROW_VECTORS,
  FOREIGN_ARROW_VECTORS,
  hostileCallables,
  materialize,
  materializeForeign,
} from './__config.js';

/** Every candidate the module is specified over, as fresh values. */
const corpus = () => [
  ...ARROW_VECTORS.map(([kind, description, source]) => ({
    key: description,
    kind,
    value: materialize(source),
  })),
  ...FOREIGN_ARROW_VECTORS.map(([kind, description, source]) => ({
    key: `foreign: ${description}`,
    kind,
    value: materializeForeign(source),
  })),
];

describe('arrow — standing invariants', () => {
  describe('L1 — the union is exactly the disjunction', () => {
    it('holds for every candidate', () => {
      for (const { key, value } of corpus()) {
        expect(isAnyArrowFunction(value), `"${key}"`).toBe(
          isArrowFunction(value) || isAsyncArrowFunction(value),
        );
      }
    });

    it('holds for the hostile callables too', () => {
      for (const [name, make] of Object.entries(hostileCallables)) {
        const value = make();
        expect(isAnyArrowFunction(value), name).toBe(
          isArrowFunction(value) || isAsyncArrowFunction(value),
        );
      }
    });

    it('holds for the omitted argument', () => {
      expect(isAnyArrowFunction()).toBe(isArrowFunction() || isAsyncArrowFunction());
    });
  });

  describe('L2 — the two flavors are mutually exclusive', () => {
    it('no candidate is admitted by both', () => {
      for (const { key, value } of corpus()) {
        expect(
          isArrowFunction(value) && isAsyncArrowFunction(value),
          `"${key}" is both flavors`,
        ).toBe(false);
      }
    });
  });

  describe('L3 — precision: admission implies the structure of an arrow', () => {
    it('every admitted value is callable, prototype-less and non-constructable', () => {
      for (const { key, value } of corpus()) {
        if (!isAnyArrowFunction(value)) {
          continue;
        }
        expect(isFunction(value), `"${key}" admitted but not callable`).toBe(true);
        expect(hasOwnPrototype(value), `"${key}" admitted but owns a prototype`).toBe(
          false,
        );
        expect(hasConstructSlot(value), `"${key}" admitted but is constructable`).toBe(
          false,
        );
      }
    });

    it('the check is not vacuous — the corpus does admit values', () => {
      const admitted = corpus().filter(({ value }) => isAnyArrowFunction(value));

      expect(admitted.length).toBeGreaterThan(0);
    });
  });

  describe('non-degeneracy — no predicate has collapsed to a constant', () => {
    it('each flavor admits at least one candidate and refuses at least one', () => {
      const rows = corpus();

      for (const [name, predicate] of /** @type {const} */ ([
        ['isArrowFunction', isArrowFunction],
        ['isAsyncArrowFunction', isAsyncArrowFunction],
        ['isAnyArrowFunction', isAnyArrowFunction],
      ])) {
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

    it('the corpus carries all three kinds, so the laws above are exercised', () => {
      const kinds = new Set(corpus().map(({ kind }) => kind));

      expect([...kinds].sort()).toEqual([ARROW, ASYNC_ARROW, NOT_ARROW].sort());
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

      isArrowFunction(counting);
      isAsyncArrowFunction(counting);
      isAnyArrowFunction(counting);

      expect(invocations).toBe(0);
    });

    it('they never invoke an async candidate either', () => {
      let invocations = 0;

      /**
       * @param {unknown} a - the forwarded argument
       * @returns {Promise<unknown>} the argument, after recording the call
       */
      const counting = async (a) => {
        invocations += 1;
        await Promise.resolve();

        return a;
      };

      isAnyArrowFunction(counting);

      expect(invocations).toBe(0);
    });

    it('they are deterministic — a second reading agrees with the first', () => {
      for (const { key, value } of corpus()) {
        expect(isAnyArrowFunction(value), `"${key}" drifted`).toBe(
          isAnyArrowFunction(value),
        );
      }
    });

    it('they do not mutate the value', () => {
      const arrow = /** @type {object} */ (materialize('(a) => a'));
      const before = Reflect.ownKeys(arrow).map(String).sort();

      isArrowFunction(arrow);
      isAsyncArrowFunction(arrow);
      isAnyArrowFunction(arrow);

      expect(Reflect.ownKeys(arrow).map(String).sort()).toEqual(before);
    });
  });

  describe('L4/L5 — totality at the boundary', () => {
    it('no candidate makes any predicate throw', () => {
      for (const { key, value } of corpus()) {
        expect(() => isArrowFunction(value), `"${key}"`).not.toThrow();
        expect(() => isAsyncArrowFunction(value), `"${key}"`).not.toThrow();
        expect(() => isAnyArrowFunction(value), `"${key}"`).not.toThrow();
      }
    });

    it('every predicate answers a boolean, never a truthy proxy for one', () => {
      for (const { key, value } of corpus()) {
        expect(typeof isAnyArrowFunction(value), `"${key}"`).toBe('boolean');
      }
    });

    it('the omitted call equals the explicit `undefined` call', () => {
      expect(isArrowFunction()).toBe(isArrowFunction(undefined));
      expect(isAsyncArrowFunction()).toBe(isAsyncArrowFunction(undefined));
      expect(isAnyArrowFunction()).toBe(isAnyArrowFunction(undefined));
    });
  });
});
