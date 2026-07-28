// @ts-check

/**
 * @module test/function/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance. Two surfaces: the structural spoofs
 * (non-throwing) and the absorbed-hostile ORCHESTRATOR verdicts (the throwing-trap
 * inputs whose public verdict is pinned here; the completeness non-propagation
 * matrix over all 24 marked exports lives in `throw-safety.test.js`). function's
 * discriminators are structural — the `[[Construct]]` slot probe, the realm-fixed
 * source capture, the `isCallable`-first gate — and each closes a specific spoof:
 *
 *   - tag-spoof — a NON-callable object claiming the `AsyncFunction` /
 *     `GeneratorFunction` tag is rejected at the `isCallable` floor
 *     (`typeof !== 'function'`), never reaching the identity signal.
 *   - prototype-graft — an arrow with an own `prototype` still has no
 *     `[[Construct]]`, so the newable chain rejects it before the own-`prototype`
 *     writable tell is read.
 *   - shadowed-`bind` — a real function whose own `bind` is a non-callable fails
 *     `isFunction`'s per-member `isCallable` check (`isFunction/R2`).
 *   - instance-`toString` tampering — a `class` whose own `toString` lies is
 *     still admitted by `isCustomClass`; the `class` source prefix is read through
 *     the realm-fixed capture, immune to instance-level tampering.
 *
 * The B-vector block pins the absorbed-hostile verdicts the re-decidability run
 * must confirm: `isFunction/B1` and `isClass/B1` return `false` (not thrown), and
 * — the crux of the realm decomposition — the species orchestrator returns
 * `false` on a get-trap Proxy over a genuine species EVEN THOUGH the same-realm
 * `instanceof` arm answers `true` on it in isolation (`iCR<Species>FI/B1`, pinned
 * in `_internal/helpers.test.js`). The upstream `isFunction` gate is what rejects
 * it, so the orchestrator and its arm stay consistent.
 *
 * Mirrors the "Spoof (axis 3)" notes of `docs/spec/FUNCTION.spec.md`
 * (`isFunction/R1`, `isFunction/R2`, `isFunction/B1`, `isClass/B1`, the
 * `hasConstructSlot` unspoofable-slot invariant, `isCustomClass`'s realm-fixed
 * source read).
 */

import { describe, it, expect } from 'vitest';

import {
  isCallable,
  isFunction,
  hasConstructSlot,
  isNewableFunction,
  isES3Function,
  isClass,
  isCustomClass,
  isAsyncFunction,
  isGeneratorFunction,
  isAsyncGeneratorFunction,
  isAnyGeneratorFunction,
} from '#index';

import {
  tagSpoofAsyncFunction,
  tagSpoofGeneratorFunction,
  arrowWithSpoofedPrototype,
  shadowedBindFunction,
  classWithTamperedInstanceToString,
  asyncArrow,
  customClass,
} from './__config.js';

describe('function — adversarial / spoof-resistance (axis 3)', () => {
  describe('tag-spoof — a non-callable object claiming a species tag', () => {
    /** @type {Array<{ label: string, make: () => unknown }>} */
    const tagSpoofs = [
      { label: 'AsyncFunction', make: tagSpoofAsyncFunction },
      { label: 'GeneratorFunction', make: tagSpoofGeneratorFunction },
    ];
    for (const { label, make } of tagSpoofs) {
      it(`a { [Symbol.toStringTag]: '${label}' } is rejected at the isCallable floor`, () => {
        expect(isCallable(make()), 'isCallable').toBe(false);
        expect(isFunction(make()), 'isFunction').toBe(false);
        // the species predicates gate on callability first — the tag is never read.
        expect(isAsyncFunction(make()), 'isAsyncFunction').toBe(false);
        expect(isGeneratorFunction(make()), 'isGeneratorFunction').toBe(false);
        expect(isAsyncGeneratorFunction(make()), 'isAsyncGeneratorFunction').toBe(false);
        expect(isAnyGeneratorFunction(make()), 'isAnyGeneratorFunction').toBe(false);
      });
    }
  });

  it('prototype-graft — an arrow with an own `prototype` has no [[Construct]]', () => {
    // the spoofed own `prototype` is a red herring: newability is the [[Construct]]
    // slot, which the arrow lacks, so the whole newable chain rejects it — the
    // own-`prototype`-writable tell (isES3Function) is never even reached.
    const spoof = arrowWithSpoofedPrototype();
    expect(isCallable(spoof), 'isCallable').toBe(true);
    expect(isFunction(spoof), 'isFunction').toBe(true);
    expect(hasConstructSlot(spoof), 'hasConstructSlot').toBe(false);
    expect(isNewableFunction(spoof), 'isNewableFunction').toBe(false);
    expect(isES3Function(spoof), 'isES3Function').toBe(false);
    expect(isClass(spoof), 'isClass').toBe(false);
  });

  it('isFunction/R2 — a real function whose own `bind` is a non-callable → false', () => {
    // isCallable is true (it IS a function), but isFunction's per-member
    // isCallable(value.bind) link fails on the shadowed non-callable bind.
    const spoof = shadowedBindFunction();
    expect(isCallable(spoof), 'isCallable').toBe(true);
    expect(isFunction(spoof), 'isFunction').toBe(false);
  });

  it('isCustomClass source read is immune to instance `toString` tampering', () => {
    // the own `toString` lies (returns `function C(){}`), but the source prefix is
    // read through the realm-fixed `toFunctionString.call`, so the `class` prefix
    // still resolves and isCustomClass admits it.
    const tampered = classWithTamperedInstanceToString();
    expect(isClass(tampered), 'isClass').toBe(true);
    expect(isCustomClass(tampered), 'isCustomClass').toBe(true);
  });

  // ----- absorbed-hostile verdicts (B-vectors, re-decidability confirmation) -----
  describe('absorbed-hostile verdicts (B-vectors)', () => {
    /** A callable Proxy whose `get` trap throws (the `.bind`/`.call`/`.apply` reads). */
    const getTrapCallable = () =>
      new Proxy(asyncArrow(), {
        get() {
          throw new Error('get-trap');
        },
      });

    it('isFunction/B1: a get-trap callable Proxy → false, not thrown', () => {
      // typeof admits the Proxy (isCallable true), then reading `.bind` fires the
      // trap; isFunction's try/catch absorbs it → false. Every downstream marker
      // rests on this.
      let verdict;
      expect(() => {
        verdict = isFunction(getTrapCallable());
      }, 'isFunction threw').not.toThrow();
      expect(verdict).toBe(false);
    });

    it('isClass/B1: a getOwnPropertyDescriptor-trap newable Proxy → false, not thrown', () => {
      // the `prototype` descriptor read routes through the throw-safe
      // hasOwnNonWritablePrototype, so a hostile trap yields false, not a throw.
      const hostileNewable = new Proxy(customClass(), {
        getOwnPropertyDescriptor() {
          throw new Error('descriptor-trap');
        },
      });
      let verdict;
      expect(() => {
        verdict = isClass(hostileNewable);
      }, 'isClass threw').not.toThrow();
      expect(verdict).toBe(false);
    });

    it('the species orchestrator returns false on a get-trap Proxy — even though its same-realm arm returns true in isolation (iCR<Species>FI/B1)', () => {
      // the crux of the realm decomposition: isCurrentRealmAsyncFunctionInstance
      // answers true on this Proxy (instanceof never fires the get trap — pinned
      // in helpers.test.js), but the upstream isFunction gate rejects it, so the
      // public orchestrator stays consistent at false.
      expect(isAsyncFunction(getTrapCallable())).toBe(false);
    });
  });
});
