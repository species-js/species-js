// @ts-check

/**
 * @module test/function/_internal/helpers
 *
 * Axis 4 — helper-unit (white-box). The 12 exported `@internal` helpers, tested
 * in isolation: the realm-fixed source capture (`getFunctionSource`), the three
 * identity signals (tag + constructor-name), the two proto-surface probes, the
 * three realm-independent structural arms (`isAlienRealm<Species>Function`), and
 * the three same-realm `instanceof` arms (`isCurrentRealm<Species>FunctionInstance`).
 * Exported `@internal` for exactly this — single-realm testability (decision
 * #053): the alien arms are realm-independent, so their structural code path is
 * exercised with LOCAL species values here (the foreign-realm confirmation lives
 * in `cross-realm.test.js`).
 *
 * Two standalone-arm results the decidability run must confirm are pinned here:
 * `hAFPS/A2` (a plain function's proto-surface passes the async check — only the
 * upstream identity signal separates them) and the `iCR<Species>FI/B1` isolation
 * result (a `get`-trap `Proxy` over a genuine species → true, because `instanceof`
 * walks `[[GetPrototypeOf]]` and never fires the `get` trap; the orchestrator
 * still rejects it via the `isFunction` gate upstream).
 *
 * Mirrors the "Helper specification (axis 4)" sections of
 * `docs/spec/FUNCTION.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  getFunctionSource,
  hasAsyncFunctionIdentitySignal,
  hasGeneratorFunctionIdentitySignal,
  hasAsyncGeneratorFunctionIdentitySignal,
  hasAsyncFunctionPrototypeSurface,
  hasAnyGeneratorFunctionPrototypeSurface,
  isAlienRealmAsyncFunction,
  isAlienRealmGeneratorFunction,
  isAlienRealmAsyncGeneratorFunction,
  isCurrentRealmAsyncFunctionInstance,
  isCurrentRealmGeneratorFunctionInstance,
  isCurrentRealmAsyncGeneratorFunctionInstance,
} from '#index';

import {
  plainFunction,
  arrowFunction,
  asyncFunction,
  asyncArrow,
  asyncMethod,
  boundAsync,
  generatorFunction,
  generatorMethod,
  boundGenerator,
  asyncGeneratorFunction,
  asyncGeneratorMethod,
  boundAsyncGenerator,
  customClass,
  arrayCtor,
  mathMax,
  classWithTamperedInstanceToString,
  foreignAsyncFunction,
  foreignGeneratorFunction,
  foreignAsyncGeneratorFunction,
} from '../__config.js';

/**
 * Cast a non-callable through `unknown` to the `Callable` param of getFunctionSource.
 * @param {unknown} value - a non-callable receiver
 * @returns {import('#function').Callable} the value, retyped for the helper signature
 */
const asCallable = (value) =>
  /** @type {import('#function').Callable} */ (/** @type {unknown} */ (value));

/**
 * A get-trap Proxy over a genuine species value (fires no trap during instanceof).
 * @param {object} target - a genuine species function to wrap
 * @returns {object} the trapping proxy
 */
const getTrap = (target) =>
  new Proxy(target, {
    get() {
      throw new Error('get-trap');
    },
  });

/**
 * A getPrototypeOf-trap Proxy over a genuine species value (throws in the instanceof walk).
 * @param {object} target - a genuine species function to wrap
 * @returns {object} the trapping proxy
 */
const protoTrap = (target) =>
  new Proxy(target, {
    getPrototypeOf() {
      throw new Error('getPrototypeOf-trap');
    },
  });

describe('[Internal] function helpers (axis 4)', () => {
  // ----- the realm-fixed source capture -----
  describe('getFunctionSource', () => {
    // args are routed through `asCallable`: getFunctionSource's `Callable` param
    // does not structurally accept concrete signatures (`Array`, a class ctor),
    // pure variance noise — every candidate here IS genuinely callable.
    it('gFS/A1: a `function f() {}` → a string starting `function`', () => {
      expect(getFunctionSource(asCallable(plainFunction()))?.startsWith('function')).toBe(
        true,
      );
    });
    it('gFS/A2: a `class C {}` → a string starting `class`', () => {
      expect(getFunctionSource(asCallable(customClass()))?.startsWith('class')).toBe(
        true,
      );
    });
    it('gFS/A3: `Array` and `Math.max` → a string containing `[native code]`', () => {
      expect(
        getFunctionSource(asCallable(arrayCtor()))?.includes('[native code]'),
        'Array',
      ).toBe(true);
      expect(
        getFunctionSource(asCallable(mathMax()))?.includes('[native code]'),
        'Math.max',
      ).toBe(true);
    });
    it('gFS/A4: an instance-`toString`-tampered class → still its real `class` source', () => {
      // the read goes through the realm-fixed capture, not the lying instance method.
      expect(
        getFunctionSource(asCallable(classWithTamperedInstanceToString()))?.startsWith(
          'class',
        ),
      ).toBe(true);
    });
    it('gFS/B1: a non-callable receiver (`null`, `{}`) → undefined, not thrown', () => {
      expect(getFunctionSource(asCallable(null)), 'null').toBe(undefined);
      expect(getFunctionSource(asCallable({})), '{}').toBe(undefined);
    });
  });

  // ----- the three identity signals (tag + constructor name) -----
  describe('identity signals — has<Species>FunctionIdentitySignal', () => {
    it('hAFIS/A1: async decl / arrow / bound → true', () => {
      expect(hasAsyncFunctionIdentitySignal(asyncFunction()), 'decl').toBe(true);
      expect(hasAsyncFunctionIdentitySignal(asyncArrow()), 'arrow').toBe(true);
      expect(hasAsyncFunctionIdentitySignal(boundAsync()), 'bound').toBe(true);
    });
    it('hAFIS/R1: plain / sync-gen / async-gen → false (wrong tag/name)', () => {
      expect(hasAsyncFunctionIdentitySignal(plainFunction()), 'plain').toBe(false);
      expect(hasAsyncFunctionIdentitySignal(generatorFunction()), 'gen').toBe(false);
      expect(hasAsyncFunctionIdentitySignal(asyncGeneratorFunction()), 'async-gen').toBe(
        false,
      );
    });
    it('hAFIS/R2: `null` / `{}` → false', () => {
      expect(hasAsyncFunctionIdentitySignal(null), 'null').toBe(false);
      expect(hasAsyncFunctionIdentitySignal({}), '{}').toBe(false);
    });

    it('hGFIS/A1: sync generator + bound → true', () => {
      expect(hasGeneratorFunctionIdentitySignal(generatorFunction()), 'gen').toBe(true);
      expect(hasGeneratorFunctionIdentitySignal(boundGenerator()), 'bound').toBe(true);
    });
    it('hGFIS/R1: async-gen / plain / async → false', () => {
      expect(
        hasGeneratorFunctionIdentitySignal(asyncGeneratorFunction()),
        'async-gen',
      ).toBe(false);
      expect(hasGeneratorFunctionIdentitySignal(plainFunction()), 'plain').toBe(false);
      expect(hasGeneratorFunctionIdentitySignal(asyncFunction()), 'async').toBe(false);
    });

    it('hAGFIS/A1: async generator + bound → true', () => {
      expect(
        hasAsyncGeneratorFunctionIdentitySignal(asyncGeneratorFunction()),
        'async-gen',
      ).toBe(true);
      expect(
        hasAsyncGeneratorFunctionIdentitySignal(boundAsyncGenerator()),
        'bound',
      ).toBe(true);
    });
    it('hAGFIS/R1: sync-gen / async → false', () => {
      expect(hasAsyncGeneratorFunctionIdentitySignal(generatorFunction()), 'gen').toBe(
        false,
      );
      expect(hasAsyncGeneratorFunctionIdentitySignal(asyncFunction()), 'async').toBe(
        false,
      );
    });
  });

  // ----- the two proto-surface probes -----
  describe('proto-surface probes', () => {
    it('hAFPS/A1: async decl / arrow → true (constructor, no own prototype)', () => {
      expect(hasAsyncFunctionPrototypeSurface(asyncFunction()), 'decl').toBe(true);
      expect(hasAsyncFunctionPrototypeSurface(asyncArrow()), 'arrow').toBe(true);
    });
    it('hAFPS/A2: plain function / arrow → TRUE — %Function.prototype% also lacks own `prototype` (identity signal is what separates them)', () => {
      expect(hasAsyncFunctionPrototypeSurface(plainFunction()), 'plain').toBe(true);
      expect(hasAsyncFunctionPrototypeSurface(arrowFunction()), 'arrow').toBe(true);
    });
    it('hAFPS/R1: sync-gen / async-gen → false (generator proto carries own `prototype`)', () => {
      expect(hasAsyncFunctionPrototypeSurface(generatorFunction()), 'gen').toBe(false);
      expect(
        hasAsyncFunctionPrototypeSurface(asyncGeneratorFunction()),
        'async-gen',
      ).toBe(false);
    });

    it('hAGFPS/A1: sync-gen / async-gen → true (both protos carry constructor + prototype)', () => {
      expect(hasAnyGeneratorFunctionPrototypeSurface(generatorFunction()), 'gen').toBe(
        true,
      );
      expect(
        hasAnyGeneratorFunctionPrototypeSurface(asyncGeneratorFunction()),
        'async-gen',
      ).toBe(true);
    });
    it('hAGFPS/R1: async function → false (no own `prototype` on %AsyncFunction.prototype%)', () => {
      expect(hasAnyGeneratorFunctionPrototypeSurface(asyncFunction())).toBe(false);
    });
    it('hAGFPS/R2: plain function / arrow → false (the structural discriminator)', () => {
      expect(hasAnyGeneratorFunctionPrototypeSurface(plainFunction()), 'plain').toBe(
        false,
      );
      expect(hasAnyGeneratorFunctionPrototypeSurface(arrowFunction()), 'arrow').toBe(
        false,
      );
    });
  });

  // ----- the three realm-independent structural arms (run on LOCAL values) -----
  describe('alien-realm structural arms — isAlienRealm<Species>Function', () => {
    it('iARAF/A1: async decl / arrow / concise method → true', () => {
      expect(isAlienRealmAsyncFunction(asyncFunction()), 'decl').toBe(true);
      expect(isAlienRealmAsyncFunction(asyncArrow()), 'arrow').toBe(true);
      expect(isAlienRealmAsyncFunction(asyncMethod()), 'method').toBe(true);
    });
    it('iARAF/A2: bound async → true (no own prototype, no [[Construct]])', () => {
      expect(isAlienRealmAsyncFunction(boundAsync())).toBe(true);
    });
    it('iARAF/R1–R4: plain / async-gen / arrow+gen / non-callables → false', () => {
      expect(isAlienRealmAsyncFunction(plainFunction()), 'R1 plain').toBe(false);
      expect(isAlienRealmAsyncFunction(asyncGeneratorFunction()), 'R2 async-gen').toBe(
        false,
      );
      expect(isAlienRealmAsyncFunction(arrowFunction()), 'R3 arrow').toBe(false);
      expect(isAlienRealmAsyncFunction(generatorFunction()), 'R3 gen').toBe(false);
      expect(isAlienRealmAsyncFunction(null), 'R4 null').toBe(false);
      expect(isAlienRealmAsyncFunction({}), 'R4 {}').toBe(false);
      expect(isAlienRealmAsyncFunction(42), 'R4 42').toBe(false);
    });

    it('iARGF/A1–A2: sync generator / concise method / bound → true', () => {
      expect(isAlienRealmGeneratorFunction(generatorFunction()), 'decl').toBe(true);
      expect(isAlienRealmGeneratorFunction(generatorMethod()), 'method').toBe(true);
      expect(isAlienRealmGeneratorFunction(boundGenerator()), 'bound').toBe(true);
    });
    it('iARGF/R1–R4: async-gen / plain / async+arrow / non-callables → false', () => {
      expect(
        isAlienRealmGeneratorFunction(asyncGeneratorFunction()),
        'R1 async-gen',
      ).toBe(false);
      expect(isAlienRealmGeneratorFunction(plainFunction()), 'R2 plain').toBe(false);
      expect(isAlienRealmGeneratorFunction(asyncFunction()), 'R3 async').toBe(false);
      expect(isAlienRealmGeneratorFunction(arrowFunction()), 'R3 arrow').toBe(false);
      expect(isAlienRealmGeneratorFunction(null), 'R4 null').toBe(false);
      expect(isAlienRealmGeneratorFunction({}), 'R4 {}').toBe(false);
    });

    it('iARAGF/A1–A2: async generator / concise method / bound → true', () => {
      expect(isAlienRealmAsyncGeneratorFunction(asyncGeneratorFunction()), 'decl').toBe(
        true,
      );
      expect(isAlienRealmAsyncGeneratorFunction(asyncGeneratorMethod()), 'method').toBe(
        true,
      );
      expect(isAlienRealmAsyncGeneratorFunction(boundAsyncGenerator()), 'bound').toBe(
        true,
      );
    });
    it('iARAGF/R1–R3: sync-gen / plain+async+arrow / non-callables → false', () => {
      expect(isAlienRealmAsyncGeneratorFunction(generatorFunction()), 'R1 gen').toBe(
        false,
      );
      expect(isAlienRealmAsyncGeneratorFunction(plainFunction()), 'R2 plain').toBe(false);
      expect(isAlienRealmAsyncGeneratorFunction(asyncFunction()), 'R2 async').toBe(false);
      expect(isAlienRealmAsyncGeneratorFunction(arrowFunction()), 'R2 arrow').toBe(false);
      expect(isAlienRealmAsyncGeneratorFunction(null), 'R3 null').toBe(false);
      expect(isAlienRealmAsyncGeneratorFunction({}), 'R3 {}').toBe(false);
    });
  });

  // ----- the three same-realm instanceof arms -----
  describe('same-realm instanceof arms — isCurrentRealm<Species>FunctionInstance', () => {
    it('iCRAFI/A1: local async decl / arrow / bound → true', () => {
      expect(isCurrentRealmAsyncFunctionInstance(asyncFunction()), 'decl').toBe(true);
      expect(isCurrentRealmAsyncFunctionInstance(asyncArrow()), 'arrow').toBe(true);
      expect(isCurrentRealmAsyncFunctionInstance(boundAsync()), 'bound').toBe(true);
    });
    it('iCRAFI/R1: a foreign async function → false (foreign %AsyncFunction%)', () => {
      expect(isCurrentRealmAsyncFunctionInstance(foreignAsyncFunction())).toBe(false);
    });
    it('iCRAFI/R2: plain / sync-gen / class → false', () => {
      expect(isCurrentRealmAsyncFunctionInstance(plainFunction()), 'plain').toBe(false);
      expect(isCurrentRealmAsyncFunctionInstance(generatorFunction()), 'gen').toBe(false);
      expect(isCurrentRealmAsyncFunctionInstance(customClass()), 'class').toBe(false);
    });
    it('iCRAFI/B1: a get-trap Proxy over a genuine async → true, not thrown (instanceof never fires get)', () => {
      expect(isCurrentRealmAsyncFunctionInstance(getTrap(asyncArrow()))).toBe(true);
    });
    it('iCRAFI/B2: a getPrototypeOf-trap Proxy → false, not thrown (the instanceof is wrapped)', () => {
      expect(isCurrentRealmAsyncFunctionInstance(protoTrap(asyncArrow()))).toBe(false);
    });

    it('iCRGFI/A1: local sync generator / bound → true', () => {
      expect(isCurrentRealmGeneratorFunctionInstance(generatorFunction()), 'decl').toBe(
        true,
      );
      expect(isCurrentRealmGeneratorFunctionInstance(boundGenerator()), 'bound').toBe(
        true,
      );
    });
    it('iCRGFI/R1: a foreign sync generator → false', () => {
      expect(isCurrentRealmGeneratorFunctionInstance(foreignGeneratorFunction())).toBe(
        false,
      );
    });
    it('iCRGFI/R2: async-gen / async / class → false', () => {
      expect(
        isCurrentRealmGeneratorFunctionInstance(asyncGeneratorFunction()),
        'async-gen',
      ).toBe(false);
      expect(isCurrentRealmGeneratorFunctionInstance(asyncFunction()), 'async').toBe(
        false,
      );
      expect(isCurrentRealmGeneratorFunctionInstance(customClass()), 'class').toBe(false);
    });
    it('iCRGFI/B1: a get-trap Proxy over a genuine sync generator → true, not thrown', () => {
      expect(isCurrentRealmGeneratorFunctionInstance(getTrap(generatorFunction()))).toBe(
        true,
      );
    });
    it('iCRGFI/B2: a getPrototypeOf-trap Proxy → false, not thrown', () => {
      expect(
        isCurrentRealmGeneratorFunctionInstance(protoTrap(generatorFunction())),
      ).toBe(false);
    });

    it('iCRAGFI/A1: local async generator / bound → true', () => {
      expect(
        isCurrentRealmAsyncGeneratorFunctionInstance(asyncGeneratorFunction()),
        'decl',
      ).toBe(true);
      expect(
        isCurrentRealmAsyncGeneratorFunctionInstance(boundAsyncGenerator()),
        'bound',
      ).toBe(true);
    });
    it('iCRAGFI/R1: a foreign async generator → false', () => {
      expect(
        isCurrentRealmAsyncGeneratorFunctionInstance(foreignAsyncGeneratorFunction()),
      ).toBe(false);
    });
    it('iCRAGFI/R2: sync-gen / async → false', () => {
      expect(
        isCurrentRealmAsyncGeneratorFunctionInstance(generatorFunction()),
        'gen',
      ).toBe(false);
      expect(isCurrentRealmAsyncGeneratorFunctionInstance(asyncFunction()), 'async').toBe(
        false,
      );
    });
    it('iCRAGFI/B1: a get-trap Proxy over a genuine async generator → true, not thrown', () => {
      expect(
        isCurrentRealmAsyncGeneratorFunctionInstance(getTrap(asyncGeneratorFunction())),
      ).toBe(true);
    });
    it('iCRAGFI/B2: a getPrototypeOf-trap Proxy → false, not thrown', () => {
      expect(
        isCurrentRealmAsyncGeneratorFunctionInstance(protoTrap(asyncGeneratorFunction())),
      ).toBe(false);
    });
  });
});
