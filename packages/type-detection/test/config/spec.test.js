// @ts-check

/**
 * @module test/config/spec
 *
 * config is a capture/retype layer, not a discrimination domain — it exports no
 * predicates, so there are no admit/reject matrices, no cross-realm suite (its
 * realm-fixity is single-realm-decidable; true cross-realm fixity is the same
 * `const`-binding guarantee one realm up), and no adversarial/spoof surface. This
 * one file drives the runtime-decidable dimensions of `docs/spec/CONFIG.spec.md`:
 *
 *   (A) realm-fixity        — `fix/*`  (identity + tamper-immunity + globalContext)
 *   (A/runtime) captures    — `cap/*`  (the wired-through native behavior)
 *   (C) polyfill-fallback   — `oHO/*` + `hasOwn/*` (selector + isolated closure)
 *   (data+accessor) presets — `dpo/*`  (exact descriptor shapes)
 *   (sentinels)             — `blank/*` + `ilc/*` (#060 shape constants)
 *
 * Dimension (B) — the boundary-retyped signatures (`ret/T1`–`T3`) — is a type-level
 * contract gated by `pnpm run typecheck`, not a runtime vector, so it is not driven
 * here; its runtime faces (`cap/B1`, `cap/A4`, `cap/A5`) are.
 *
 * Everything is reached through the `#index` barrel (config re-exports first, #070).
 */

import { describe, it, expect } from 'vitest';

import {
  globalContext,
  objectPrototype,
  toObjectString,
  toFunctionString,
  objectIs,
  objectKeys,
  objectCreate,
  objectFromEntries,
  defineProperties,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  objectHasOwn,
  hasOwn,
  defaultDataDescriptor,
  defaultDataAccessor,
  defaultEntryDescriptor,
  defaultEntryAccessor,
  readOnlyDataDescriptor,
  readOnlyEntryDescriptor,
  frozenDataDescriptor,
  frozenEntryDescriptor,
  sealedDataAccessor,
  sealedEntryAccessor,
  BLANK_DICTIONARY,
  INSTANCE_LESS_CONSTRUCTOR,
} from '#index';

/**
 * Cast a value to the `Callable` receiver of toFunctionString.
 * @param {unknown} value - the value to retype
 * @returns {import('#function').Callable} the value, retyped as Callable
 */
const asCallable = (value) => /** @type {import('#function').Callable} */ (value);

/**
 * Cast a value to the `object` param of the own-property probes.
 * @param {unknown} value - the value to retype
 * @returns {object} the value, retyped as object
 */
const asObject = (value) => /** @type {object} */ (value);

describe('config — spec (captures, retypes, presets, polyfill, sentinels)', () => {
  // ----- (A) realm-fixity -----
  describe('(A) realm-fixity', () => {
    it('fix/A1: captures are identity-equal to their intrinsics', () => {
      expect(objectIs, 'objectIs').toBe(Object.is);
      expect(objectKeys, 'objectKeys').toBe(Object.keys);
      expect(getPrototypeOf, 'getPrototypeOf').toBe(Object.getPrototypeOf);
      expect(getOwnPropertyDescriptor, 'getOwnPropertyDescriptor').toBe(
        Object.getOwnPropertyDescriptor,
      );
      expect(objectCreate, 'objectCreate').toBe(Object.create);
      expect(objectFromEntries, 'objectFromEntries').toBe(Object.fromEntries);
      expect(defineProperties, 'defineProperties').toBe(Object.defineProperties);
      expect(toObjectString, 'toObjectString').toBe(Object.prototype.toString);
      expect(objectPrototype, 'objectPrototype').toBe(Object.prototype);
    });

    it('fix/A2: tamper-immunity — a captured `const` ignores a post-load reassignment of the global', () => {
      const realIs = globalContext.Object.is;
      // Reassign the global, capture the verdict while tampered, then restore BEFORE
      // asserting: vitest's own `toBe` uses `Object.is`, so asserting while the global
      // is poisoned would break the assertion machinery, not just the export under test.
      globalContext.Object.is =
        /** @type {(value1: unknown, value2: unknown) => boolean} */ ((_a, _b) => false);
      let stillTrue;
      try {
        stillTrue = objectIs(1, 1);
      } finally {
        globalContext.Object.is = realIs;
      }
      expect(stillTrue).toBe(true);
    });

    it('fix/A3: globalContext is the realm-capture root (=== globalThis)', () => {
      expect(globalContext).toBe(globalThis);
    });
  });

  // ----- (A/runtime) capture behavior -----
  describe('(A/runtime) capture behavior', () => {
    it('cap/A1: toObjectString reads the realm-independent [[Class]] tag', () => {
      expect(toObjectString.call([])).toBe('[object Array]');
      expect(toObjectString.call(null)).toBe('[object Null]');
    });

    it('cap/A2: toFunctionString reads source, preserving `[native code]`', () => {
      expect(
        toFunctionString
          .call(function f() {
            return undefined;
          })
          .startsWith('function'),
      ).toBe(true);
      expect(toFunctionString.call(asCallable(Array)).includes('[native code]')).toBe(
        true,
      );
    });

    it('cap/B1: toFunctionString.call(non-callable) → throws TypeError (the #008 retype precondition)', () => {
      expect(() => toFunctionString.call(asCallable({}))).toThrow(TypeError);
    });

    it('cap/A3: objectIs — NaN-equality and ±0 distinction that `===` cannot express', () => {
      expect(objectIs(NaN, NaN)).toBe(true);
      expect(objectIs(0, -0)).toBe(false);
    });

    it('cap/A4: getPrototypeOf — all three arms of `object | Callable | null`', () => {
      expect(getPrototypeOf([]), 'object arm').toBe(Array.prototype);
      expect(getPrototypeOf(objectCreate(null)), 'null arm').toBe(null);
      expect(
        getPrototypeOf(
          class X extends Array {
            m() {
              return undefined;
            }
          },
        ),
        'callable arm (a class parent)',
      ).toBe(Array);
    });

    it('cap/A5: objectCreate — null and prototype variants (the #034 retype, native runtime)', () => {
      expect(getPrototypeOf(objectCreate(null))).toBe(null);
      expect(getPrototypeOf(objectCreate(Array.prototype))).toBe(Array.prototype);
    });
  });

  // ----- (C) polyfill-fallback -----
  describe('(C) polyfill-fallback — objectHasOwn selector + hasOwn closure', () => {
    it('oHO/A1: native branch taken in this runtime (identity-equal to Object.hasOwn)', () => {
      // `Object.hasOwn` (ES2022) is above the package's ES2020 lib floor, so it is
      // reached through a cast — the same access shape config's own selector uses.
      const nativeHasOwn = /** @type {{ hasOwn?: unknown }} */ (Object).hasOwn;
      expect(objectHasOwn).toBe(nativeHasOwn);
    });

    it('oHO/A2 + oHO/R1 + oHO/R2: own → true; inherited / absent → false', () => {
      expect(objectHasOwn({ a: 1 }, 'a'), 'own').toBe(true);
      expect(objectHasOwn({}, 'toString'), 'inherited').toBe(false);
      expect(objectHasOwn({}, 'nope'), 'absent').toBe(false);
    });

    it('oHO/B1: a nullish receiver throws (ToObject)', () => {
      expect(() => objectHasOwn(asObject(null), 'x')).toThrow();
      expect(() => objectHasOwn(asObject(undefined), 'x')).toThrow();
    });

    it('hasOwn/A1: the closure runs the fallback directly, matching the selector semantics', () => {
      expect(hasOwn({ a: 1 }, 'a'), 'own').toBe(true);
      expect(hasOwn({}, 'toString'), 'inherited').toBe(false);
      expect(hasOwn({}, 'nope'), 'absent').toBe(false);
      expect(() => hasOwn(asObject(null), 'x'), 'nullish').toThrow();
    });
  });

  // ----- (data + accessor) descriptor presets -----
  //
  // Listed in the spec's structural order — configurable before non-configurable,
  // visible (`Data`) before hidden (`Entry`), descriptor before accessor. IDs are
  // append-only, so the sequence is deliberately non-contiguous: A1–A4 predate the
  // 2026-08-19 rework and assert exactly the shapes they always did.
  //
  // `toEqual` is an EXACT shape assertion — an extra own key fails it — so the
  // accessor presets' missing `writable` is covered. The explicit `objectHasOwn`
  // check is kept anyway: "no `writable`" is a stated contract, not a side effect.
  describe('(data + accessor) descriptor presets — exact shape', () => {
    // --- configurable ---

    it('dpo/A5: defaultDataDescriptor', () => {
      expect(defaultDataDescriptor).toEqual({
        enumerable: true,
        writable: true,
        configurable: true,
      });
    });

    it('dpo/A6: defaultDataAccessor (no `writable` — invalid on accessors)', () => {
      expect(defaultDataAccessor).toEqual({
        enumerable: true,
        configurable: true,
      });
      expect(objectHasOwn(defaultDataAccessor, 'writable'), 'writable absent').toBe(
        false,
      );
    });

    it('dpo/A1: defaultEntryDescriptor', () => {
      expect(defaultEntryDescriptor).toEqual({
        enumerable: false,
        writable: true,
        configurable: true,
      });
    });

    it('dpo/A3: defaultEntryAccessor (no `writable` — invalid on accessors)', () => {
      expect(defaultEntryAccessor).toEqual({
        enumerable: false,
        configurable: true,
      });
      expect(objectHasOwn(defaultEntryAccessor, 'writable'), 'writable absent').toBe(
        false,
      );
    });

    it('dpo/A7: readOnlyDataDescriptor', () => {
      expect(readOnlyDataDescriptor).toEqual({
        enumerable: true,
        writable: false,
        configurable: true,
      });
    });

    it('dpo/A2: readOnlyEntryDescriptor', () => {
      expect(readOnlyEntryDescriptor).toEqual({
        enumerable: false,
        writable: false,
        configurable: true,
      });
    });

    // --- non-configurable ---

    it('dpo/A8: frozenDataDescriptor', () => {
      expect(frozenDataDescriptor).toEqual({
        enumerable: true,
        writable: false,
        configurable: false,
      });
    });

    it('dpo/A9: frozenEntryDescriptor', () => {
      expect(frozenEntryDescriptor).toEqual({
        enumerable: false,
        writable: false,
        configurable: false,
      });
    });

    it('dpo/A10: sealedDataAccessor (no `writable` — invalid on accessors)', () => {
      expect(sealedDataAccessor).toEqual({
        enumerable: true,
        configurable: false,
      });
      expect(objectHasOwn(sealedDataAccessor, 'writable'), 'writable absent').toBe(false);
    });

    it('dpo/A4: sealedEntryAccessor (no `writable` — invalid on accessors)', () => {
      expect(sealedEntryAccessor).toEqual({
        enumerable: false,
        configurable: false,
      });
      expect(objectHasOwn(sealedEntryAccessor, 'writable'), 'writable absent').toBe(
        false,
      );
    });

    // The ten presets are pairwise distinct grid cells. Guards against a
    // copy-paste that leaves two names pointing at the same shape — which every
    // per-vector assertion above would still pass.
    it('dpo: the ten presets occupy ten distinct flag combinations', () => {
      /** @type {[string, object][]} */
      const presets = [
        ['defaultDataDescriptor', defaultDataDescriptor],
        ['defaultDataAccessor', defaultDataAccessor],
        ['defaultEntryDescriptor', defaultEntryDescriptor],
        ['defaultEntryAccessor', defaultEntryAccessor],
        ['readOnlyDataDescriptor', readOnlyDataDescriptor],
        ['readOnlyEntryDescriptor', readOnlyEntryDescriptor],
        ['frozenDataDescriptor', frozenDataDescriptor],
        ['frozenEntryDescriptor', frozenEntryDescriptor],
        ['sealedDataAccessor', sealedDataAccessor],
        ['sealedEntryAccessor', sealedEntryAccessor],
      ];
      expect(presets.length, 'every preset is imported').toBe(10);

      let comparisons = 0;
      presets.forEach(([leftName, left], index) => {
        presets.slice(index + 1).forEach(([rightName, right]) => {
          expect(left, `${leftName} vs ${rightName}`).not.toEqual(right);
          comparisons += 1;
        });
      });
      // The pair count is asserted so an empty or short loop cannot pass silently.
      expect(comparisons, 'every pair compared').toBe(45);
    });
  });

  // ----- (sentinels) -----
  describe('(sentinels) BLANK_DICTIONARY + INSTANCE_LESS_CONSTRUCTOR', () => {
    it('blank/A1: prototype-less + empty (no own key of either kind)', () => {
      expect(getPrototypeOf(BLANK_DICTIONARY), 'prototype-less').toBe(null);
      expect(getOwnPropertyNames(BLANK_DICTIONARY).length, 'no string keys').toBe(0);
      expect(getOwnPropertySymbols(BLANK_DICTIONARY).length, 'no symbol keys').toBe(0);
    });

    it('blank/A2: a specific never-mutated singleton — a fresh objectCreate(null) is NOT it (identity sentinel)', () => {
      expect(objectCreate(null), 'a fresh blank dict is a different reference').not.toBe(
        BLANK_DICTIONARY,
      );
      expect(objectKeys(BLANK_DICTIONARY).length, 'still empty').toBe(0);
    });

    it('ilc/A1: typeof `function` (a genuine function statement)', () => {
      expect(typeof INSTANCE_LESS_CONSTRUCTOR).toBe('function');
    });

    it('ilc/A2: `x instanceof INSTANCE_LESS_CONSTRUCTOR` → false for every input, never throws', () => {
      const inputs = [{}, [], new Date(), INSTANCE_LESS_CONSTRUCTOR];
      for (const x of inputs) {
        let verdict;
        expect(() => {
          verdict = x instanceof INSTANCE_LESS_CONSTRUCTOR;
        }, 'threw').not.toThrow();
        expect(verdict).toBe(false);
      }
    });
  });
});
