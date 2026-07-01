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
  localTagSpoofedEventTargetGraft,
  localTagThrowingEventTargetGraft,
  foreignTagSpoofedEventTargetGraft,
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

describe('evented — realm asymmetry + own-shadow rejection on a prototype graft (#063)', () => {
  // DELIBERATE, documented property (spec → isEventTarget "Realm asymmetry on
  // tampered inputs" + Resolved #4): a value grafted onto the real
  // `EventTarget.prototype` genuinely HAS `eventTargetPrototype`, so the local
  // fast-path admits it — UNLESS it shadows the inherited contract at its OWN
  // level (#063). Cosmetic tag tampering is tolerated locally (tag-blind, symbol
  // key) but rejected cross-realm — that asymmetry is RETAINED by design.
  // Behavioral (method / constructor) tampering is rejected in BOTH realms — that
  // half of the asymmetry is reconciled by the own-shadow gate.
  it('isEventTarget/A3: LOCAL grafts — bare, spoofed-tag, throwing-tag → all true (tag tolerated)', () => {
    expect(isEventTarget(Object.create(EventTarget.prototype)), 'bare').toBe(true);
    expect(isEventTarget(localTagSpoofedEventTargetGraft()), 'spoofed-tag').toBe(true);
    expect(isEventTarget(localTagThrowingEventTargetGraft()), 'throwing-tag').toBe(true);
  });

  it('isEventTarget/R5: a LOCAL graft shadowing a contract method at its own level → false', () => {
    expect(
      isEventTarget(
        Object.create(EventTarget.prototype, { dispatchEvent: { value: noop } }),
      ),
    ).toBe(false);
  });

  it('isEventTarget/R6: a LOCAL graft with an own `constructor` → false', () => {
    expect(
      isEventTarget(
        Object.create(EventTarget.prototype, { constructor: { value: noop } }),
      ),
    ).toBe(false);
  });

  it('isAbortSignal behaves identically — a bare `Object.create(AbortSignal.prototype)` → true', () => {
    expect(isAbortSignal(Object.create(AbortSignal.prototype))).toBe(true);
  });

  it('isAbortSignal/R5: a LOCAL graft shadowing an abort accessor at its own level → false', () => {
    expect(
      isAbortSignal(Object.create(AbortSignal.prototype, { aborted: { value: false } })),
    ).toBe(false);
  });

  it('isAbortSignal/R6: a LOCAL graft with an own `constructor` → false', () => {
    expect(
      isAbortSignal(
        Object.create(AbortSignal.prototype, { constructor: { value: noop } }),
      ),
    ).toBe(false);
  });

  it('the FOREIGN-realm counterpart (same spoofed tag) → false (structural arm reads the tag and rejects)', () => {
    expect(isEventTarget(foreignTagSpoofedEventTargetGraft())).toBe(false);
  });
});
