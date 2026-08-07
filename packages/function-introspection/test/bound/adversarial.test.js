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
 * Mirrors `docs/spec/BOUND.spec.md` — the documented boundaries `dIBF/B1`–`B4`,
 * `dSIBF/B1`, `dSIBF/R10`–`R14`, and the forgery rejects `dIBF/R7`, `dIBF/R8`.
 *
 * `dIBF/B4` is the one vector whose reading is engine-relative, and the only one
 * where mark 3 decides on its own. It asserts the decision PATH rather than the
 * verdict alone — marks 1 and 2 pinned as failing first — because a verdict
 * cannot show which mark produced it.
 */

import { describe, it, expect } from 'vitest';

import { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction } from '#index';

import { hasConstructSlot } from '@species-js/type-detection';

import { CONDENSED_NATIVE_SOURCE_FOUNDATION, getCondensedFunctionSource } from '#utility';

import {
  bareProxyOverArrow,
  bareProxyOverClass,
  boundArrow,
  boundNativeNonConstructable,
  boundPlain,
  conciseMethodWithMarkerLikeBody,
  doubleBound,
  foreignNamedNativeRenamed,
  functionPrototype,
  nameTrappingProxyOverArrow,
  renamed,
  renamedArrow,
  renamedBoundFunction,
  renamedPlainFunction,
  throwSafetyMatrix,
} from './__config.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */

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

    it('a named native carrying a `bound ` name is admitted by mark 3 ALONE [dIBF/B4, dSIBF/R14]', () => {
      const value = foreignNamedNativeRenamed();

      // The verdict alone would not show WHICH mark carried it, so the two
      // weaker marks are pinned as failing first. Without this the test would
      // still pass if mark 2 started admitting the value.
      expect(hasConstructSlot(value), 'mark 1 must fail — no construct slot').toBe(false);
      expect(
        getCondensedFunctionSource(value),
        'mark 2 must fail — the source keeps the name',
      ).toBe('function max(){[native code]}');
      expect(value.name.startsWith('bound '), 'mark 3 must hold').toBe(true);

      expect(doesIndicateBoundFunction(value)).toBe(true);
      expect(doesStronglyIndicateBoundFunction(value)).toBe(false);
    });

    it('mark 3 never decides for a REAL bound value on this engine — which is why B4 is simulated', () => {
      // Every genuinely bound form here satisfies mark 2, so the cascade
      // short-circuits before mark 3 is consulted. B4 exists because that is an
      // engine property, not a language guarantee: where built-ins stringify
      // identically bound or unbound, mark 2 fails and mark 3 is all that remains.
      for (const [label, make] of Object.entries({
        boundPlain,
        boundArrow,
        boundNativeNonConstructable,
        doubleBound,
      })) {
        expect(
          getCondensedFunctionSource(/** @type {Callable} */ (make())),
          `${label} must satisfy mark 2`,
        ).toBe(CONDENSED_NATIVE_SOURCE_FOUNDATION);
      }
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
