// @ts-check

/**
 * @module test/bound/adversarial
 *
 * Axis 3 — forgery, documented boundaries, and hostile input.
 *
 * The spec's admit/reject tables score clean candidates. This suite covers the
 * values that are deliberately trying to look like something they are not, and
 * asserts the boundaries the module documents rather than pretending they do
 * not exist. A boundary asserted here is a boundary that cannot silently close
 * or silently widen: if a future change makes `Function.prototype` reject, this
 * suite fails and the change has to be a decision rather than a side effect.
 *
 * The hostile-input matrix carries the throw-safety invariant (axis 3): every
 * cell asserts BOTH that no throw propagates AND the honest verdict. Both
 * predicates take `unknown`, so every hostile value is in contract and the
 * `@@throw-safe` marker's promise covers all of them — see `BOUND.spec.md`, the
 * marker's contract.
 *
 * Mirrors `docs/spec/BOUND.spec.md` — the documented boundaries `dIBF/B1`–`B3`,
 * `dSIBF/B1`, `dSIBF/R10`–`R13`, and the forgery rejects `dIBF/R7`, `dIBF/R8`.
 */

import { describe, it, expect } from 'vitest';

import { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction } from '#index';

import {
  bareProxyOverArrow,
  bareProxyOverClass,
  conciseMethodWithMarkerLikeBody,
  functionPrototype,
  nameTrappingProxyOverArrow,
  renamed,
  renamedArrow,
  renamedBoundFunction,
  renamedPlainFunction,
  throwSafetyMatrix,
} from './__config.js';

describe('bound — adversarial (axis 3)', () => {
  describe('forgery that ordinary code can attempt', () => {
    it('renaming an arrow to look bound fools the cascade, not the conjunction [dIBF/B3, dSIBF/R11]', () => {
      const value = renamedArrow();
      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('renaming a PLAIN function fools neither — it owns a `prototype` [dIBF/R7]', () => {
      const value = renamedPlainFunction();
      expect(doesIndicateBoundFunction(value)).toBe(false);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('an identifier cannot impersonate the `[native code]` marker [dIBF/R8]', () => {
      const value = conciseMethodWithMarkerLikeBody();
      expect(doesIndicateBoundFunction(value)).toBe(false);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('a bound function renamed to hide itself is lost by the conjunction only [dSIBF/R12]', () => {
      const value = renamedBoundFunction();
      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });
  });

  describe('documented boundaries — asserted, not wished away', () => {
    it('`Function.prototype` is anonymous AND native, so the cascade admits it [dIBF/B1, dSIBF/R10]', () => {
      const value = functionPrototype();
      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('a bare `Proxy` produces the native source honestly [dIBF/B2, dSIBF/R13]', () => {
      const value = bareProxyOverArrow();
      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('a bare `Proxy` over a CLASS forwards the own `prototype` and is rejected [dIBF/R9]', () => {
      const value = bareProxyOverClass();
      expect(doesIndicateBoundFunction(value)).toBe(false);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('a `Proxy` that also traps `name` defeats BOTH — the surviving hole [dSIBF/B1]', () => {
      const value = nameTrappingProxyOverArrow();
      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(true);
    });

    it('the conjunction raises forgery from one defineProperty to an exotic object', () => {
      // one `defineProperty` is enough to fool the cascade …
      expect(doesIndicateBoundFunction(renamedArrow())).toBe(true);
      // … but not the conjunction, which needs a handler-bearing Proxy
      expect(doesStronglyIndicateBoundFunction(renamedArrow())).toBe(false);
      expect(doesStronglyIndicateBoundFunction(nameTrappingProxyOverArrow())).toBe(true);
    });
  });

  describe('neither predicate ever invokes the value', () => {
    it('a bound function whose target throws when called is classified without calling it', () => {
      let invoked = false;
      const exploding = () => {
        invoked = true;
        throw new Error('the value must never be invoked');
      };
      const value = exploding.bind(null);

      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(true);
      expect(invoked).toBe(false);
    });

    it('a renamed exploding arrow is read, never run', () => {
      let invoked = false;
      const value = renamed(() => {
        invoked = true;
        throw new Error('the value must never be invoked');
      }, 'bound exploding');

      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
      expect(invoked).toBe(false);
    });
  });

  describe('hostile input — throw-safety invariant', () => {
    for (const [key, { surface, make, expected }] of Object.entries(throwSafetyMatrix)) {
      describe(`${surface} (${key})`, () => {
        it('doesIndicateBoundFunction answers without throwing', () => {
          const value = make();
          expect(() => doesIndicateBoundFunction(value)).not.toThrow();
          expect(doesIndicateBoundFunction(value)).toBe(
            expected.doesIndicateBoundFunction,
          );
        });

        it('doesStronglyIndicateBoundFunction answers without throwing', () => {
          const value = make();
          expect(() => doesStronglyIndicateBoundFunction(value)).not.toThrow();
          expect(doesStronglyIndicateBoundFunction(value)).toBe(
            expected.doesStronglyIndicateBoundFunction,
          );
        });
      });
    }

    it('completeness: every hostile row scores both predicates', () => {
      const columns = ['doesIndicateBoundFunction', 'doesStronglyIndicateBoundFunction'];
      for (const [key, { expected }] of Object.entries(throwSafetyMatrix)) {
        expect(Object.keys(expected).sort(), `row "${key}"`).toEqual(columns.sort());
      }
    });
  });
});
