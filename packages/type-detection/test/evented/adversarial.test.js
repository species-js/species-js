// @ts-check

/**
 * @module test/evented/adversarial
 *
 * Axis 3 — adversarial / spoof-resistance. The strict identity predicates admit
 * only the realm-fixed intrinsic (or a cross-realm structural equivalent), so a
 * value that merely LOOKS right must be rejected. Covers the tag-only spoof, the
 * tag-plus-methods spoof (still rejected — the constructor-name signal gate
 * resolves to `Object`), and the accessor-shaped method (rejected by the
 * inspect-without-invoke contract). Also pins the deliberate `when()` admission
 * (#028): the Observable-proposal method is out of contract, so it neither
 * qualifies nor disqualifies an EventTargetLike.
 *
 * Mirrors the "Spoof (axis 3)" expectations + `dIETC/A4` in
 * `docs/spec/EVENTED.spec.md`.
 */

import { describe, it, expect } from 'vitest';

import {
  isEventTargetLike,
  isEventTarget,
  isAbortSignalLike,
  isAbortSignal,
} from '@/index.js';

import {
  tagSpoofedEventTarget,
  tagSpoofedAbortSignal,
  whenBearingUserlandEventTarget,
} from './__config.js';

const noop = () => undefined;

describe('evented — adversarial / spoof (axis 3)', () => {
  it('isEventTarget/R2: a tag-only `EventTarget` spoof → false (no methods, ctor-name Object)', () => {
    const spoof = tagSpoofedEventTarget();
    expect(isEventTarget(spoof), 'isEventTarget').toBe(false);
    // no method surface either, so not even EventTargetLike
    expect(isEventTargetLike(spoof), 'isEventTargetLike').toBe(false);
  });

  it('isAbortSignal/R2: a tag-only `AbortSignal` spoof → false', () => {
    const spoof = tagSpoofedAbortSignal();
    expect(isAbortSignal(spoof), 'isAbortSignal').toBe(false);
    expect(isAbortSignalLike(spoof), 'isAbortSignalLike').toBe(false);
  });

  it('tag `EventTarget` + the three methods but a plain `[[Prototype]]` → EventTargetLike true, isEventTarget false', () => {
    // the constructor-name signal gate resolves to `Object` (its prototype is
    // Object.prototype), so the cross-realm arm rejects it despite the tag + methods.
    const spoof = {
      [Symbol.toStringTag]: 'EventTarget',
      dispatchEvent: noop,
      addEventListener: noop,
      removeEventListener: noop,
    };
    expect(isEventTargetLike(spoof), 'isEventTargetLike').toBe(true);
    expect(isEventTarget(spoof), 'isEventTarget').toBe(false);
  });

  it('isEventTargetLike/R2: an accessor-shaped method is rejected (inspect-without-invoke)', () => {
    const spoof = {
      dispatchEvent: noop,
      addEventListener: noop,
      get removeEventListener() {
        return noop;
      },
    };
    expect(isEventTargetLike(spoof)).toBe(false);
  });

  it('dIETC/A4: a userland EventTarget carrying `when()` → EventTargetLike true (out of contract, #028)', () => {
    const value = whenBearingUserlandEventTarget();
    // `when` is neither required nor rejected — the three canonical methods carry it.
    expect(isEventTargetLike(value), 'isEventTargetLike').toBe(true);
    // still not a real EventTarget (userland; tag `[object Object]`).
    expect(isEventTarget(value), 'isEventTarget').toBe(false);
  });
});
