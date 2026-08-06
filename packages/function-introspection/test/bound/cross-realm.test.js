// @ts-check

/**
 * @module test/bound/cross-realm
 *
 * Axis 2 — foreign-realm behaviour. Both predicates are purely structural: they
 * read descriptors, a construct slot and a source string, and consult no
 * realm-fixed identity of their own. A value from another realm must therefore
 * score exactly as its local twin.
 *
 * The one place a realm boundary could bite is the `Proxy` subtraction.
 * `doesMatchProxyConstructor` compares against this realm's captured `Proxy`
 * first, and a foreign constructor fails that compare — so a foreign `Proxy` is
 * recognised only by `hasProxyConstructorShape`, the structural arm. If that arm
 * ever regressed, a foreign `Proxy` would be reported as bound while the local
 * one was not, and only this suite would see it.
 *
 * Mirrors `docs/spec/BOUND.spec.md` vectors `dIBF/A12`, `dIBF/R6`, `dSIBF/A11`.
 */

import { describe, it, expect } from 'vitest';

import { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction } from '#index';

import {
  boundPlain,
  foreignBoundFunction,
  foreignBoundProxyConstructor,
  foreignProxyConstructor,
  proxyConstructor,
} from './__config.js';

describe('bound — cross-realm (axis 2)', () => {
  describe('the fixtures are genuinely foreign', () => {
    it('a foreign bound function is not an instance of this realm’s Function', () => {
      expect(foreignBoundFunction() instanceof Function).toBe(false);
    });

    it('the foreign Proxy constructor is not this realm’s Proxy', () => {
      expect(foreignProxyConstructor()).not.toBe(proxyConstructor());
    });
  });

  describe('a foreign bound function scores as its local twin [dIBF/A12, dSIBF/A11]', () => {
    it('doesIndicateBoundFunction → true', () => {
      expect(doesIndicateBoundFunction(foreignBoundFunction())).toBe(true);
      expect(doesIndicateBoundFunction(boundPlain())).toBe(true);
    });

    it('doesStronglyIndicateBoundFunction → true', () => {
      expect(doesStronglyIndicateBoundFunction(foreignBoundFunction())).toBe(true);
      expect(doesStronglyIndicateBoundFunction(boundPlain())).toBe(true);
    });
  });

  describe('the Proxy subtraction survives the realm boundary [dIBF/R6]', () => {
    it('a foreign Proxy constructor is rejected by both predicates', () => {
      expect(doesIndicateBoundFunction(foreignProxyConstructor())).toBe(false);
      expect(doesStronglyIndicateBoundFunction(foreignProxyConstructor())).toBe(false);
    });

    it('and is rejected for the same reason as the local one', () => {
      expect(doesIndicateBoundFunction(proxyConstructor())).toBe(false);
      expect(doesIndicateBoundFunction(foreignProxyConstructor())).toBe(
        doesIndicateBoundFunction(proxyConstructor()),
      );
    });

    it('a foreign BOUND Proxy is still admitted — the subtraction reads `name` [dIBF/A9]', () => {
      expect(doesIndicateBoundFunction(foreignBoundProxyConstructor())).toBe(true);
      expect(doesStronglyIndicateBoundFunction(foreignBoundProxyConstructor())).toBe(
        true,
      );
    });
  });
});
