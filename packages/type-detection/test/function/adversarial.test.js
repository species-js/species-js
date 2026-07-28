// @ts-check

/**
 * @module test/function/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance (the NON-throwing surface; the throwing
 * surface is the universal-invariant matrix in `throw-safety.test.js`). function's
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
 * Mirrors the "Spoof (axis 3)" notes of `docs/spec/FUNCTION.spec.md`
 * (`isFunction/R1`, `isFunction/R2`, the `hasConstructSlot` unspoofable-slot
 * invariant, `isCustomClass`'s realm-fixed source read).
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
});
